"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-20 dark:bg-slate-950">
      <div
        role="alert"
        className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
      >
        <p className="font-semibold">뉴스를 불러오지 못했어요</p>
        <p className="mt-1">잠시 후 다시 시도해 주세요.</p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-4 min-h-9 rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
