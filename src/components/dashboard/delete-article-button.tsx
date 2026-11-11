"use client";

import { useState, useTransition } from "react";
import { deleteArticle } from "@/app/dashboard/actions";

export function DeleteArticleButton({ articleId }: { articleId: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteArticle(articleId);
        if (!result.ok) setError(result.error);
      } catch {
        setError("삭제하지 못했어요.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        aria-label="뉴스 삭제"
        title={error ?? "뉴스 삭제"}
        className={`absolute right-3 top-3 inline-flex size-7 items-center justify-center rounded-full text-base leading-none transition-colors hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          error ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"
        }`}
      >
        ✕
      </button>
      {error && (
        <p role="alert" className="sr-only">
          {error}
        </p>
      )}
    </>
  );
}
