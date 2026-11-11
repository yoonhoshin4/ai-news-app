"use server";

import { auth } from "@clerk/nextjs/server";
import { and, count, desc, eq, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { articles, categories } from "@/db/schema";
import { fetchRecentArticles, type FeedArticle } from "@/lib/rss/fetch-feed";
import { RSS_SOURCES } from "@/lib/rss/sources";
import { EnrichError, classifyArticle, enrichArticle } from "@/lib/ai/enrich-article";
import { getConnectionStatus } from "@/lib/notion/auth-store";
import { NotionSaveError, saveArticleToNotion } from "@/lib/notion/save-article";

const ENRICH_BATCH_SIZE = 5;
const ENRICH_CONCURRENCY = 3;

export type EnrichResult =
  | {
      ok: true;
      /** 이번 배치에서 번역·저장에 성공한 건수 */
      processed: number;
      /** 이번 배치에서 실패한 기사 id (같은 실행에서 다시 시도하지 않도록 호출 측이 누적) */
      failedIds: number[];
      /** 아직 번역 대기 중인 기사 수 (실패 누적분 제외) */
      remaining: number;
      /** 배치를 중단해야 하는 사유(요청 한도 등). 있으면 호출 측은 반복을 멈춘다. */
      stopReason?: string;
    }
  | { ok: false; error: string };

// 번역 전(title_ko가 null)인 기사를 한 배치만 Claude로 처리한다.
// 실패한 기사는 null로 남아 다음 실행에서 다시 시도된다.
export async function enrichArticles(excludeIds: number[] = []): Promise<EnrichResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "로그인이 필요해요." };

  const ownerId = userId; // 함수 선언(worker) 안에서도 string으로 좁혀진 타입을 쓰기 위함

  const pendingWhere = and(
    eq(articles.userId, ownerId),
    isNull(articles.titleKo),
    excludeIds.length > 0 ? notInArray(articles.id, excludeIds) : undefined,
  );

  const [targets, userCategories] = await Promise.all([
    db
      .select({
        id: articles.id,
        sourceName: articles.sourceName,
        originalTitle: articles.originalTitle,
        excerpt: articles.excerpt,
      })
      .from(articles)
      .where(pendingWhere)
      .orderBy(desc(sql`coalesce(${articles.publishedAt}, ${articles.createdAt})`), desc(articles.id))
      .limit(ENRICH_BATCH_SIZE),
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.userId, userId)),
  ]);

  const categoryIdByName = new Map(userCategories.map((c) => [c.name, c.id]));
  const categoryNames = userCategories.map((c) => c.name);

  let processed = 0;
  const failedIds: number[] = [];
  let stopReason: string | undefined;
  let next = 0;

  // 동시 호출 수를 제한하는 간단한 워커 풀
  async function worker() {
    while (next < targets.length && !stopReason) {
      const target = targets[next++];
      try {
        const result = await enrichArticle(target, categoryNames);
        await db
          .update(articles)
          .set({
            titleKo: result.titleKo,
            summaryKo: result.summaryKo,
            categoryId: result.category ? (categoryIdByName.get(result.category) ?? null) : null,
          })
          // 이미 다른 요청이 채웠다면 덮어쓰지 않는다.
          .where(
            and(eq(articles.id, target.id), eq(articles.userId, ownerId), isNull(articles.titleKo)),
          );
        processed++;
      } catch (e) {
        failedIds.push(target.id);
        if (e instanceof EnrichError && e.kind !== "article") stopReason = e.message;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(ENRICH_CONCURRENCY, targets.length) }, () => worker()),
  );

  const [{ n }] = await db
    .select({ n: count() })
    .from(articles)
    .where(
      and(
        pendingWhere,
        failedIds.length > 0 ? notInArray(articles.id, failedIds) : undefined,
      ),
    );

  revalidatePath("/dashboard");
  return { ok: true, processed, failedIds, remaining: n, stopReason };
}

export type CollectResult =
  | { ok: true; added: number; failedSources: string[] }
  | { ok: false; error: string };

// 지난 48시간의 RSS 기사를 수집해 저장한다. 번역·분류는 아직 하지 않는다(미분류, 제목·요약 null).
// 중복은 (userId, url) 유니크 인덱스로 걸러낸다.
export async function collectNews(): Promise<CollectResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "로그인이 필요해요." };

  const now = Date.now();
  const results = await Promise.allSettled(
    RSS_SOURCES.map((source) => fetchRecentArticles(source, now)),
  );

  const fetched: FeedArticle[] = [];
  const failedSources: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") fetched.push(...r.value);
    else failedSources.push(RSS_SOURCES[i].name);
  });

  if (failedSources.length === RSS_SOURCES.length) {
    return { ok: false, error: "뉴스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." };
  }

  // 소스 간 같은 URL이 겹치면 한 번만 넣는다 (한 INSERT 안의 중복은 ON CONFLICT로도 막지만 명시적으로 제거).
  const unique = [...new Map(fetched.map((a) => [a.url, a])).values()];

  let added = 0;
  if (unique.length > 0) {
    const inserted = await db
      .insert(articles)
      .values(unique.map((a) => ({ ...a, userId })))
      .onConflictDoNothing({ target: [articles.userId, articles.url] })
      .returning({ id: articles.id });
    added = inserted.length;
  }

  revalidatePath("/dashboard");
  return { ok: true, added, failedSources };
}

export type ReclassifyResult =
  | {
      ok: true;
      /** 이번 배치에서 시도한 기사 id (성공·실패·여전히 미분류 모두). 호출 측이 누적해 다시 보내야 한다. */
      attemptedIds: number[];
      /** 이번 배치에서 카테고리가 새로 정해진 건수 */
      classified: number;
      /** 이번 배치에서 실패한 건수 */
      failed: number;
      /** 아직 시도하지 않은 미분류 기사 수 */
      remaining: number;
      stopReason?: string;
    }
  | { ok: false; error: string };

// 번역은 끝났지만 미분류인 기사를 현재 카테고리 목록으로 다시 분류한다 (한 배치).
// 카테고리를 추가·삭제한 뒤 기존 기사에 적용할 때 쓴다. 제목·요약은 바꾸지 않는다.
export async function reclassifyArticles(excludeIds: number[] = []): Promise<ReclassifyResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "로그인이 필요해요." };
  const ownerId = userId;

  const userCategories = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.userId, ownerId));
  if (userCategories.length === 0) {
    return { ok: false, error: "먼저 카테고리를 추가해 주세요." };
  }
  const categoryIdByName = new Map(userCategories.map((c) => [c.name, c.id]));
  const categoryNames = userCategories.map((c) => c.name);

  const pendingWhere = (excluded: number[]) =>
    and(
      eq(articles.userId, ownerId),
      isNotNull(articles.titleKo),
      isNull(articles.categoryId),
      excluded.length > 0 ? notInArray(articles.id, excluded) : undefined,
    );

  const targets = await db
    .select({
      id: articles.id,
      sourceName: articles.sourceName,
      originalTitle: articles.originalTitle,
      excerpt: articles.excerpt,
    })
    .from(articles)
    .where(pendingWhere(excludeIds))
    .orderBy(desc(sql`coalesce(${articles.publishedAt}, ${articles.createdAt})`), desc(articles.id))
    .limit(ENRICH_BATCH_SIZE);

  let classified = 0;
  let failed = 0;
  let stopReason: string | undefined;
  let next = 0;
  const attemptedIds: number[] = [];

  async function worker() {
    while (next < targets.length && !stopReason) {
      const target = targets[next++];
      attemptedIds.push(target.id);
      try {
        const name = await classifyArticle(target, categoryNames);
        const categoryId = name ? (categoryIdByName.get(name) ?? null) : null;
        if (categoryId === null) continue; // 맞는 카테고리가 없으면 미분류로 둔다
        const updated = await db
          .update(articles)
          .set({ categoryId })
          // 그 사이 다른 요청이 분류했다면 덮어쓰지 않는다.
          .where(
            and(eq(articles.id, target.id), eq(articles.userId, ownerId), isNull(articles.categoryId)),
          )
          .returning({ id: articles.id });
        classified += updated.length;
      } catch (e) {
        failed++;
        if (e instanceof EnrichError && e.kind !== "article") stopReason = e.message;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(ENRICH_CONCURRENCY, targets.length) }, () => worker()),
  );

  const [{ n }] = await db
    .select({ n: count() })
    .from(articles)
    .where(pendingWhere([...excludeIds, ...attemptedIds]));

  revalidatePath("/dashboard");
  return { ok: true, attemptedIds, classified, failed, remaining: n, stopReason };
}

export type SaveToNotionResult =
  | { ok: true; pageUrl: string }
  | { ok: false; error: string; needsConnect?: boolean };

// 기사 1건을 Notion에 저장하고 페이지 URL을 articles.notionPageUrl에 기록한다 (Claude 호출 없음).
export async function saveToNotion(articleId: number): Promise<SaveToNotionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "로그인이 필요해요." };

  const [row] = await db
    .select({
      titleKo: articles.titleKo,
      summaryKo: articles.summaryKo,
      originalTitle: articles.originalTitle,
      sourceName: articles.sourceName,
      url: articles.url,
      publishedAt: articles.publishedAt,
      notionPageUrl: articles.notionPageUrl,
      categoryName: categories.name,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(and(eq(articles.id, articleId), eq(articles.userId, userId)));

  if (!row) return { ok: false, error: "기사를 찾을 수 없어요." };
  if (row.notionPageUrl) return { ok: true, pageUrl: row.notionPageUrl }; // 이미 저장됨 (중복 방지)
  if (!row.titleKo || !row.summaryKo) {
    return { ok: false, error: "번역이 끝난 뒤에 저장할 수 있어요." };
  }

  const status = await getConnectionStatus(userId);
  if (!status.connected) {
    return { ok: false, error: "먼저 Notion을 연결해 주세요.", needsConnect: true };
  }

  try {
    const pageUrl = await saveArticleToNotion(userId, {
      ...row,
      titleKo: row.titleKo,
      summaryKo: row.summaryKo,
    });
    await db
      .update(articles)
      .set({ notionPageUrl: pageUrl })
      .where(and(eq(articles.id, articleId), eq(articles.userId, userId)));
    revalidatePath("/dashboard");
    return { ok: true, pageUrl };
  } catch (e) {
    if (e instanceof NotionSaveError) {
      return { ok: false, error: e.message, needsConnect: e.kind === "auth" };
    }
    throw e;
  }
}

export type CategoryActionResult = { ok: true } | { ok: false; error: string };

const MAX_NAME_LENGTH = 30;

function validateName(name: string): { name: string } | { error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { error: "카테고리 이름을 입력해 주세요." };
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { error: `이름은 ${MAX_NAME_LENGTH}자 이하로 입력해 주세요.` };
  }
  return { name: trimmed };
}

// Postgres unique_violation(23505). 드라이버가 에러를 감싸는 경우도 확인한다.
function isUniqueViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } } | null;
  return err?.code === "23505" || err?.cause?.code === "23505";
}

export async function addCategory(name: string): Promise<CategoryActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "로그인이 필요해요." };

  const checked = validateName(name);
  if ("error" in checked) return { ok: false, error: checked.error };

  const inserted = await db
    .insert(categories)
    .values({ userId, name: checked.name })
    .onConflictDoNothing()
    .returning({ id: categories.id });

  if (inserted.length === 0) {
    return { ok: false, error: "이미 있는 카테고리예요." };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function renameCategory(
  id: number,
  name: string,
): Promise<CategoryActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "로그인이 필요해요." };

  const checked = validateName(name);
  if ("error" in checked) return { ok: false, error: checked.error };

  try {
    const updated = await db
      .update(categories)
      .set({ name: checked.name })
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning({ id: categories.id });
    if (updated.length === 0) {
      return { ok: false, error: "카테고리를 찾을 수 없어요." };
    }
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: "이미 있는 카테고리예요." };
    throw e;
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

// 삭제하면 해당 카테고리의 기사는 FK(on delete set null)로 "미분류"가 된다.
export async function deleteCategory(id: number): Promise<CategoryActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "로그인이 필요해요." };

  await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));

  revalidatePath("/dashboard");
  return { ok: true };
}

export type DeleteArticleResult = { ok: true } | { ok: false; error: string };

// 기사 1건을 DB에서 삭제한다. 이미 Notion에 저장한 페이지는 그대로 둔다.
export async function deleteArticle(articleId: number): Promise<DeleteArticleResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "로그인이 필요해요." };

  try {
    await db
      .delete(articles)
      .where(and(eq(articles.id, articleId), eq(articles.userId, userId)));
  } catch {
    return { ok: false, error: "삭제하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
