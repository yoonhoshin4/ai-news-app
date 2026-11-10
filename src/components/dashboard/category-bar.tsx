import { AddCategoryButton } from "./add-category-button";
import { CategoryChip } from "./category-chip";

export type CategoryItem = {
  /** URL 쿼리 값: "all" | "none" | 카테고리 id */
  key: string;
  label: string;
  count: number;
  /** 사용자 카테고리일 때만 있음 (이름 변경·삭제 가능) */
  categoryId?: number;
};

function categoryHref(key: string, query: string) {
  const params = new URLSearchParams();
  if (key !== "all") params.set("category", key);
  if (query) params.set("q", query);
  const qs = params.toString();
  return qs ? `/dashboard?${qs}` : "/dashboard";
}

// 순서: 전체 → 사용자 카테고리 → 미분류 → 카테고리 추가 버튼
export function CategoryBar({
  items,
  selected,
  query = "",
  children,
}: {
  items: CategoryItem[];
  selected: string;
  /** 현재 검색 키워드. 카테고리를 바꿔도 유지한다 */
  query?: string;
  /** 추가 버튼 뒤에 붙는 보조 동작 (예: 미분류 재분류) */
  children?: React.ReactNode;
}) {
  return (
    <nav aria-label="카테고리" className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <CategoryChip
          key={item.key}
          href={categoryHref(item.key, query)}
          label={item.label}
          count={item.count}
          active={item.key === selected}
          categoryId={item.categoryId}
        />
      ))}
      <AddCategoryButton />
      {children}
    </nav>
  );
}
