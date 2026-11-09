"use client";

import { useEffect, useState, useTransition } from "react";
import { collectNews, type CollectResult } from "@/app/dashboard/actions";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900";

type Notice = { tone: "success" | "error"; text: string };

function toNotice(result: CollectResult): Notice {
  if (!result.ok) return { tone: "error", text: result.error };
  const failed = result.failedSources.join(", ");
  if (failed) {
    const base = result.added > 0 ? `새 뉴스 ${result.added}건을 추가했어요. ` : "";
    return { tone: "error", text: `${base}${failed}를 불러오지 못했어요.` };
  }
  return {
    tone: "success",
    text: result.added > 0 ? `새 뉴스 ${result.added}건을 추가했어요` : "새 뉴스가 없어요",
  };
}

export function CollectNewsButton() {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice | null>(null);

  // 알림은 5초 뒤 사라진다 (ui.md 6절)
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  function collect() {
    setNotice(null);
    startTransition(async () => {
      try {
        setNotice(toNotice(await collectNews()));
      } catch {
        setNotice({ tone: "error", text: "뉴스를 가져오는 중 문제가 생겼어요." });
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={collect}
        disabled={pending}
        className={`inline-flex min-h-9 items-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400 ${focusRing}`}
      >
        {pending && (
          <span
            aria-hidden
            className="mr-2 inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {pending ? (
          <>
            <span className="sm:hidden">가져오기…</span>
            <span className="hidden sm:inline">가져오는 중…</span>
          </>
        ) : (
          <>
            <span className="sm:hidden">가져오기</span>
            <span className="hidden sm:inline">뉴스 가져오기</span>
          </>
        )}
      </button>
      {/* 알림은 카테고리 바 위 영역에 고정 위치로 표시 */}
      <div aria-live="polite" className="fixed inset-x-4 top-16 z-20 mx-auto max-w-6xl sm:inset-x-6">
        {notice && (
          <p
            className={`w-fit rounded-lg px-4 py-2 text-sm shadow-sm ${
              notice.tone === "success"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
            }`}
          >
            {notice.text}
          </p>
        )}
      </div>
    </>
  );
}
