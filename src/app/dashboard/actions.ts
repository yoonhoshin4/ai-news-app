"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { categories } from "@/db/schema";

export type AddCategoryResult = { ok: true } | { ok: false; error: string };

export async function addCategory(name: string): Promise<AddCategoryResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "로그인이 필요해요." };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "카테고리 이름을 입력해 주세요." };
  if (trimmed.length > 30) {
    return { ok: false, error: "이름은 30자 이하로 입력해 주세요." };
  }

  const inserted = await db
    .insert(categories)
    .values({ userId, name: trimmed })
    .onConflictDoNothing()
    .returning({ id: categories.id });

  if (inserted.length === 0) {
    return { ok: false, error: "이미 있는 카테고리예요." };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
