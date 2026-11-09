import { Suspense } from "react";
import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { articles, categories } from "@/db/schema";
import { CategoryBar, type CategoryItem } from "@/components/dashboard/category-bar";
import { NewsCard } from "@/components/dashboard/news-card";

export const metadata: Metadata = { title: "대시보드 · AI 뉴스 수집기" };

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
          <Suspense fallback={null}>
            <UserButton />
          </Suspense>
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

async function DashboardContent({
  searchParams,
}: {
  searchParams: PageProps<"/dashboard">["searchParams"];
}) {
  // 접근 차단은 proxy.ts가 하지만, 쿼리는 항상 userId로 필터한다.
  const { userId } = await auth.protect();
  const params = await searchParams;
  const raw = Array.isArray(params.category) ? params.category[0] : params.category;

  const [userCategories, countRows] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(asc(categories.createdAt), asc(categories.id)),
    db
      .select({ categoryId: articles.categoryId, n: count() })
      .from(articles)
      .where(eq(articles.userId, userId))
      .groupBy(articles.categoryId),
  ]);

  const counts = new Map(countRows.map((r) => [r.categoryId, r.n]));
  const total = countRows.reduce((sum, r) => sum + r.n, 0);

  const items: CategoryItem[] = [
    { key: "all", label: "전체", count: total },
    ...userCategories.map((c) => ({
      key: String(c.id),
      label: c.name,
      count: counts.get(c.id) ?? 0,
    })),
    { key: "none", label: "미분류", count: counts.get(null) ?? 0 },
  ];

  // 알 수 없는 값은 "전체"로 취급
  const selected = items.find((i) => i.key === raw)?.key ?? "all";

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
    .where(and(eq(articles.userId, userId), categoryFilter))
    .orderBy(desc(sortDate), desc(articles.id));

  const now = requestTime();

  return (
    <>
      <div className="mb-6">
        <CategoryBar items={items} selected={selected} />
      </div>

      {rows.length === 0 ? (
        <EmptyState hasAny={total > 0} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
          {rows.map(({ publishedAt, createdAt, ...row }) => (
            <NewsCard
              key={row.id}
              article={{ ...row, date: publishedAt ?? createdAt }}
              now={now}
            />
          ))}
        </div>
      )}
    </>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="py-20 text-center">
      {hasAny ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          이 카테고리에는 아직 뉴스가 없어요.
        </p>
      ) : (
        <>
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
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
    <>
      <div className="mb-6 h-9" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="h-44 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
          />
        ))}
      </div>
    </>
  );
}
