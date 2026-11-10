import { Suspense } from "react";
import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { and, asc, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, categories } from "@/db/schema";
import { ensureDefaultCategories } from "@/db/seed";
import { CategoryBar, type CategoryItem } from "@/components/dashboard/category-bar";
import { CollectNewsButton } from "@/components/dashboard/collect-news-button";
import { NewsCard } from "@/components/dashboard/news-card";
import { NotionConnect, NotionNotice } from "@/components/dashboard/notion-connect";
import { getConnectionStatus } from "@/lib/notion/auth-store";
import { Pagination } from "@/components/dashboard/pagination";
import { ReclassifyButton } from "@/components/dashboard/reclassify-button";
import { SearchForm } from "@/components/dashboard/search-form";

export const metadata: Metadata = { title: "대시보드 · AI 뉴스 수집기" };

const PAGE_SIZE = 9;

// 요청 시점 기준 시각 (상대 시간 표시용). 렌더 중 직접 Date.now()를 부르지 않도록 분리.
function requestTime() {
  return Date.now();
}

const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className={`${container} flex h-14 items-center justify-between`}>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
            AI 뉴스 수집기
          </span>
          <div className="flex items-center gap-3">
            <Suspense fallback={<div className="h-9 w-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />}>
              <NotionConnect />
            </Suspense>
            <CollectNewsButton />
            <Suspense fallback={<div className="size-7 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />}>
              <UserButton />
            </Suspense>
          </div>
        </div>
      </header>
      <main className={`${container} py-6`}>
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

function getUserCategories(userId: string) {
  return db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.createdAt), asc(categories.id));
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

// 공백으로 나눈 키워드를 모두 포함(AND)하는 기사만. 각 키워드는 제목·원문 제목·요약 중 하나에 있으면 된다.
function searchFilter(query: string) {
  const terms = query.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return undefined;
  return and(
    ...terms.map((term) => {
      const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`; // LIKE 와일드카드 이스케이프
      return or(
        ilike(articles.titleKo, pattern),
        ilike(articles.originalTitle, pattern),
        ilike(articles.summaryKo, pattern),
      );
    }),
  );
}

async function DashboardContent({
  searchParams,
}: {
  searchParams: PageProps<"/dashboard">["searchParams"];
}) {
  // 접근 차단은 proxy.ts가 하지만, 쿼리는 항상 userId로 필터한다.
  const { userId } = await auth.protect();
  const params = await searchParams;
  const rawCategory = firstParam(params.category);
  const rawPage = Number.parseInt(firstParam(params.page) ?? "", 10);
  const query = (firstParam(params.q) ?? "").trim().slice(0, 100);
  const keywordFilter = searchFilter(query);

  const [initialCategories, countRows, [allRow], notionStatus] = await Promise.all([
    getUserCategories(userId),
    // 카테고리 칩의 개수는 검색 결과 기준이다.
    db
      .select({ categoryId: articles.categoryId, n: count() })
      .from(articles)
      .where(and(eq(articles.userId, userId), keywordFilter))
      .groupBy(articles.categoryId),
    // 검색과 무관한 전체 기사 수 (기본 카테고리 생성·빈 화면 문구 판단용)
    db.select({ n: count() }).from(articles).where(eq(articles.userId, userId)),
    getConnectionStatus(userId),
  ]);
  const notionConnected = notionStatus.connected;

  const total = countRows.reduce((sum, r) => sum + r.n, 0);
  const totalAll = allRow?.n ?? 0;

  // 카테고리도 기사도 없는 신규 사용자에게는 기본 카테고리를 만들어 준다 (PRD 5.5).
  let userCategories = initialCategories;
  if (userCategories.length === 0 && totalAll === 0) {
    await ensureDefaultCategories(userId);
    userCategories = await getUserCategories(userId);
  }

  const counts = new Map(countRows.map((r) => [r.categoryId, r.n]));
  const uncategorizedCount = counts.get(null) ?? 0;

  const items: CategoryItem[] = [
    { key: "all", label: "전체", count: total },
    ...userCategories.map((c) => ({
      key: String(c.id),
      label: c.name,
      count: counts.get(c.id) ?? 0,
      categoryId: c.id,
    })),
    { key: "none", label: "미분류", count: counts.get(null) ?? 0 },
  ];

  // 알 수 없는 값은 "전체"로 취급
  const selected = items.find((i) => i.key === rawCategory)?.key ?? "all";
  const selectedCount = items.find((i) => i.key === selected)?.count ?? 0;

  // 범위를 벗어난 페이지(삭제·카테고리 변경 후 등)는 마지막 페이지로 맞춘다.
  const totalPages = Math.max(1, Math.ceil(selectedCount / PAGE_SIZE));
  const page = Number.isFinite(rawPage) ? Math.min(Math.max(rawPage, 1), totalPages) : 1;

  const categoryFilter =
    selected === "all"
      ? undefined
      : selected === "none"
        ? isNull(articles.categoryId)
        : eq(articles.categoryId, Number(selected));

  // 최신순: 발행일(없으면 수집일) 내림차순
  const sortDate = sql`coalesce(${articles.publishedAt}, ${articles.createdAt})`;
  const rows = await db
    .select({
      id: articles.id,
      titleKo: articles.titleKo,
      originalTitle: articles.originalTitle,
      summaryKo: articles.summaryKo,
      sourceName: articles.sourceName,
      url: articles.url,
      publishedAt: articles.publishedAt,
      createdAt: articles.createdAt,
      categoryName: categories.name,
      notionPageUrl: articles.notionPageUrl,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(and(eq(articles.userId, userId), categoryFilter, keywordFilter))
    .orderBy(desc(sortDate), desc(articles.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  function pageHref(p: number) {
    const q = new URLSearchParams();
    if (selected !== "all") q.set("category", selected);
    if (query) q.set("q", query);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `/dashboard?${qs}` : "/dashboard";
  }

  const now = requestTime();

  return (
    <>
      <NotionNotice result={firstParam(params.notion)} />
      {/* 검색은 카드 목록 위, 카테고리 바 위에 둔다. key로 URL 키워드가 바뀌면 입력값도 맞춘다 */}
      <div className="mb-4">
        <SearchForm key={`${selected}:${query}`} query={query} category={selected} />
      </div>
      <div className="mb-6">
        <CategoryBar items={items} selected={selected} query={query}>
          {/* 카테고리가 있고 미분류 기사가 있을 때만 보인다 */}
          {userCategories.length > 0 && uncategorizedCount > 0 && (
            <ReclassifyButton count={uncategorizedCount} />
          )}
        </CategoryBar>
      </div>

      {rows.length === 0 ? (
        <EmptyState hasAny={totalAll > 0} query={query} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
            {rows.map(({ publishedAt, createdAt, ...row }) => (
              <NewsCard
                key={row.id}
                article={{ ...row, date: publishedAt ?? createdAt }}
                now={now}
                notionConnected={notionConnected}
              />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} buildHref={pageHref} />
        </>
      )}
    </>
  );
}

function EmptyState({ hasAny, query }: { hasAny: boolean; query: string }) {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-12 text-slate-300 dark:text-slate-600"
      >
        <path d="M4 5h13a2 2 0 0 1 2 2v11a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V5Z" />
        <path d="M19 9h2v9a2 2 0 0 1-2 2" />
        <path d="M8 9h7M8 13h7M8 17h4" />
      </svg>
      {query ? (
        <>
          <p className="mt-4 text-base font-semibold break-all text-slate-900 dark:text-slate-100">
            &lsquo;{query}&rsquo; 검색 결과가 없어요
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            다른 키워드로 검색하거나 카테고리를 &lsquo;전체&rsquo;로 바꿔 보세요.
          </p>
        </>
      ) : hasAny ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          이 카테고리에는 아직 뉴스가 없어요.
        </p>
      ) : (
        <>
          <p className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
            아직 수집한 뉴스가 없어요
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            뉴스를 가져오면 이곳에 카드로 표시돼요.
          </p>
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="뉴스를 불러오는 중">
      {/* 검색창·카테고리 바 자리 (레이아웃이 밀리지 않도록 같은 높이) */}
      <div className="mb-4 h-10 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      <div className="mb-6 flex flex-wrap gap-2">
        {[20, 24, 16, 28, 24, 20].map((w, i) => (
          <div
            key={i}
            style={{ width: `${w * 4}px` }}
            className="h-9 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="h-52 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
          />
        ))}
      </div>
    </div>
  );
}
