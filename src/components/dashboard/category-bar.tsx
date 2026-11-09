import Link from "next/link";
import { AddCategoryButton } from "./add-category-button";

export type CategoryItem = {
  /** URL 쿼리 값: "all" | "none" | 카테고리 id */
  key: string;
  label: string;
  count: number;
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950";

const base =
  "inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium transition-colors";
const idle =
  "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800";
const active =
  "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500";

// 순서: 전체 → 사용자 카테고리 → 미분류 → 카테고리 추가 버튼
export function CategoryBar({
  items,
  selected,
}: {
  items: CategoryItem[];
  selected: string;
}) {
  return (
    <nav aria-label="카테고리" className="flex flex-wrap items-center gap-2">
      {items.map((item) => {
        const isActive = item.key === selected;
        return (
          <Link
            key={item.key}
            href={item.key === "all" ? "/dashboard" : `/dashboard?category=${item.key}`}
            aria-current={isActive ? "true" : undefined}
            className={`${base} ${isActive ? active : idle} ${focusRing}`}
          >
            {item.label}
            <span className="ml-1.5 text-xs opacity-70">{item.count}</span>
          </Link>
        );
      })}
      <AddCategoryButton />
    </nav>
  );
}
