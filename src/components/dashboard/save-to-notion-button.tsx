"use client";

import { useState, useTransition } from "react";
import { saveToNotion } from "@/app/dashboard/actions";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900";

const base =
  "min-h-9 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors dark:border-slate-600 dark:text-slate-200";

type Props = {
  articleId: number;
  connected: boolean;
  /** 번역·요약이 끝나 저장할 수 있는지 */
  ready: boolean;
};

export function SaveToNotionButton({ articleId, connected, ready }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Notion 미연결: 연결 화면으로 보내는 링크 (라우트 핸들러라 일반 <a>)
  if (!connected) {
    return (
      <a
        href="/api/notion/connect"
        title="Notion을 연결하면 저장할 수 있어요"
        className={`inline-flex items-center ${base} hover:bg-slate-100 dark:hover:bg-slate-800 ${focusRing}`}
      >
        Notion 연결 후 저장
      </a>
    );
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveToNotion(articleId);
        if (!result.ok) setError(result.error);
      } catch {
        setError("Notion에 저장하지 못했어요.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={save}
        disabled={pending || !ready}
        title={ready ? undefined : "번역이 끝난 뒤에 저장할 수 있어요"}
        className={`${base} hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent dark:hover:bg-slate-800 ${focusRing}`}
      >
        {pending ? "저장 중…" : "Notion 저장"}
      </button>
      {error && (
        <p role="alert" className="max-w-48 text-right text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
