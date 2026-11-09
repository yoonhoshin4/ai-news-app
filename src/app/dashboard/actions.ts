"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { articles, categories } from "@/db/schema";
import { fetchRecentArticles, type FeedArticle } from "@/lib/rss/fetch-feed";
import { RSS_SOURCES } from "@/lib/rss/sources";

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
