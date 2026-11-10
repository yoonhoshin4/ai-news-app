"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950";

// 키워드 검색: 입력 후 '검색' 버튼 또는 Enter(폼 제출)로 ?q=<키워드>를 갱신한다.
// 선택된 카테고리는 유지하고, 페이지는 1로 돌아간다.
export function SearchForm({ query, category }: { query: string; category: string }) {
  const router = useRouter();
  const [value, setValue] = useState(query);
  const [pending, startTransition] = useTransition();

  function go(q: string) {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (q) params.set("q", q);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/dashboard?${qs}` : "/dashboard"));
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault(); // IME 조합 중 Enter는 브라우저가 제출로 처리하지 않는다
        go(value.trim());
      }}
      className="flex gap-2"
    >
      <div className="relative min-w-0 flex-1">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          name="q"
          value={value}
          maxLength={100}
          autoComplete="off"
          placeholder="키워드로 뉴스 검색 (제목·요약)"
          aria-label="뉴스 키워드 검색"
          onChange={(e) => setValue(e.target.value)}
          className={`min-h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 ${focusRing}`}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400 ${focusRing}`}
      >
        {pending && (
          <span
            aria-hidden
            className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        검색
      </button>
    </form>
  );
}
