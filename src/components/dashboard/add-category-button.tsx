"use client";

import { useState, useTransition } from "react";
import { addCategory } from "@/app/dashboard/actions";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950";

export function AddCategoryButton() {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setEditing(false);
    setName("");
    setError(null);
  }

  function submit() {
    startTransition(async () => {
      const result = await addCategory(name);
      if (result.ok) close();
      else setError(result.error);
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`inline-flex min-h-9 items-center rounded-full border border-dashed border-slate-300 px-4 text-sm font-medium text-slate-500 transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-600 dark:text-slate-400 dark:hover:border-indigo-400 dark:hover:text-indigo-300 ${focusRing}`}
      >
        + 카테고리 추가
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        autoFocus
        value={name}
        disabled={pending}
        maxLength={30}
        placeholder="카테고리 이름"
        aria-label="새 카테고리 이름"
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return; // 한글 입력 조합 중 Enter 무시
          if (e.key === "Enter") submit();
          if (e.key === "Escape") close();
        }}
        onBlur={() => {
          if (!pending && !name.trim()) close();
        }}
        className={`min-h-9 rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-900 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 ${focusRing}`}
      />
      {error && (
        <p role="alert" className="px-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
