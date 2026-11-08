import { eq } from "drizzle-orm";
import { db } from "./index";
import { categories } from "./schema";

export const DEFAULT_CATEGORIES = [
  "모델/제품",
  "연구",
  "기업/투자",
  "정책/규제",
  "도구/오픈소스",
];

// 사용자의 카테고리가 하나도 없을 때만 기본 카테고리를 넣는다.
export async function ensureDefaultCategories(userId: string) {
  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.userId, userId))
    .limit(1);
  if (existing.length > 0) return;

  await db
    .insert(categories)
    .values(DEFAULT_CATEGORIES.map((name) => ({ userId, name })))
    .onConflictDoNothing();
}
