"use client";

import { useEffect, useState, useTransition } from "react";
import { collectNews, enrichArticles } from "@/app/dashboard/actions";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900";

type Notice = { tone: "success" | "error"; text: string };

// 한 번에 도는 번역 배치 수의 안전 상한 (배치당 5건 → 최대 200건)
const MAX_BATCHES = 40;

export function CollectNewsButton() {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice | null>(null);
  // null = 수집 중, 숫자 = 번역 대기 건수
  const [remaining, setRemaining] = useState<number | null>(null);

  // 알림은 5초 뒤 사라진다 (ui.md 6절)
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  async function run(): Promise<Notice> {
    const collected = await collectNews();
    if (!collected.ok) return { tone: "error", text: collected.error };

    // 번역 대기 기사(이번에 추가된 것 + 이전에 실패한 것)를 배치로 처리한다.
    const failed = new Set<number>();
    let translated = 0;
    let stopReason: string | undefined;
    setRemaining(null);

    for (let i = 0; i < MAX_BATCHES; i++) {
      const batch = await enrichArticles([...failed]);
      if (!batch.ok) {
        stopReason = batch.error;
        break;
      }
      translated += batch.processed;
      batch.failedIds.forEach((id) => failed.add(id));
      setRemaining(batch.remaining);
      if (batch.stopReason) {
        stopReason = batch.stopReason;
        break;
      }
      if (batch.remaining === 0 || batch.processed === 0) break;
    }

    const parts: string[] = [];
    parts.push(
      collected.added > 0 ? `새 뉴스 ${collected.added}건을 추가했어요` : "새 뉴스가 없어요",
    );
    if (translated > 0) parts.push(`${translated}건을 번역했어요`);

    const problems: string[] = [];
    if (collected.failedSources.length > 0) {
      problems.push(`${collected.failedSources.join(", ")}를 불러오지 못했어요`);
    }
    if (stopReason) problems.push(stopReason);
    else if (failed.size > 0) {
      problems.push(`${failed.size}건은 번역하지 못했어요. 다시 가져오면 재시도해요`);
    }

    return problems.length > 0
      ? { tone: "error", text: `${parts.join(", ")}. ${problems.join(". ")}.` }
      : { tone: "success", text: `${parts.join(", ")}` };
  }

  function collect() {
    setNotice(null);
    startTransition(async () => {
      try {
        setNotice(await run());
      } catch {
        setNotice({ tone: "error", text: "뉴스를 가져오는 중 문제가 생겼어요." });
      } finally {
        setRemaining(null);
      }
    });
  }

  const label = remaining === null ? "가져오는 중…" : `번역 중 · 남은 ${remaining}건`;

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
            <span className="sm:hidden">{remaining === null ? "가져오기…" : `번역 ${remaining}`}</span>
            <span className="hidden sm:inline">{label}</span>
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
