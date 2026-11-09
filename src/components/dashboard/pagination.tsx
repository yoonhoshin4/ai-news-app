import Link from "next/link";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950";

const base =
  "inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors";
const idle =
  "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";
const current =
  "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500";
const disabled =
  "cursor-not-allowed border-slate-200 text-slate-400 dark:border-slate-800 dark:text-slate-500";

// 현재 페이지 주변 5개까지만 번호를 보여준다.
function pageWindow(page: number, totalPages: number) {
  const size = 5;
  const start = Math.max(1, Math.min(page - 2, totalPages - size + 1));
  const end = Math.min(totalPages, start + size - 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="페이지 이동" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={buildHref(page - 1)} className={`${base} ${idle} ${focusRing}`}>
          이전
        </Link>
      ) : (
        <span aria-disabled className={`${base} ${disabled}`}>
          이전
        </span>
      )}

      {pageWindow(page, totalPages).map((p) => (
        <Link
          key={p}
          href={buildHref(p)}
          aria-label={`${p}페이지`}
          aria-current={p === page ? "page" : undefined}
          className={`${base} ${p === page ? current : idle} ${focusRing}`}
        >
          {p}
        </Link>
      ))}

      {page < totalPages ? (
        <Link href={buildHref(page + 1)} className={`${base} ${idle} ${focusRing}`}>
          다음
        </Link>
      ) : (
        <span aria-disabled className={`${base} ${disabled}`}>
          다음
        </span>
      )}
    </nav>
  );
}
