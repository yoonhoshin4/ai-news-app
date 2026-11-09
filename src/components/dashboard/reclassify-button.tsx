"use client";

import { useEffect, useState, useTransition } from "react";
import { reclassifyArticles } from "@/app/dashboard/actions";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950";

// 배치(5건)당 호출 수의 안전 상한 (최대 200건)
const MAX_BATCHES = 40;

type Notice = { tone: "success" | "error"; text: string };

export function ReclassifyButton({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  // 결과 메시지는 5초 뒤 사라진다
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  async function run(): Promise<Notice> {
    const attempted: number[] = [];
    let classified = 0;
    let failed = 0;
    let stopReason: string | undefined;

    for (let i = 0; i < MAX_BATCHES; i++) {
      const batch = await reclassifyArticles(attempted);
      if (!batch.ok) return { tone: "error", text: batch.error };
      attempted.push(...batch.attemptedIds);
      classified += batch.classified;
      failed += batch.failed;
      setRemaining(batch.remaining);
      if (batch.stopReason) {
        stopReason = batch.stopReason;
        break;
      }
      if (batch.remaining === 0 || batch.attemptedIds.length === 0) break;
    }

    const text =
      classified > 0
        ? `${classified}건을 분류했어요`
        : "맞는 카테고리를 찾지 못했어요";
    if (stopReason) return { tone: "error", text: `${text}. ${stopReason}` };
    if (failed > 0) return { tone: "error", text: `${text}. ${failed}건은 실패했어요` };
    return { tone: "success", text };
  }

  function start() {
    setNotice(null);
    setRemaining(null);
    startTransition(async () => {
      try {
        setNotice(await run());
      } catch {
        setNotice({ tone: "error", text: "분류하는 중 문제가 생겼어요." });
      } finally {
        setRemaining(null);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={pending}
        title="현재 카테고리 목록으로 미분류 기사를 다시 분류해요"
        className={`inline-flex min-h-9 items-center rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ${focusRing}`}
      >
        {pending && (
          <span
            aria-hidden
            className="mr-2 inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {pending
          ? remaining === null
            ? "분류 중…"
            : `분류 중 · 남은 ${remaining}건`
          : `미분류 ${count}건 다시 분류`}
      </button>
      <span aria-live="polite" className="contents">
        {notice && (
          <span
            className={`rounded-lg px-3 py-1.5 text-xs ${
              notice.tone === "success"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
            }`}
          >
            {notice.text}
          </span>
        )}
      </span>
    </>
  );
}
