import { auth } from "@clerk/nextjs/server";
import { getConnectionStatus } from "@/lib/notion/auth-store";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900";

const NOTICES = {
  connected: { tone: "success", text: "Notion이 연결됐어요." },
  denied: { tone: "error", text: "Notion 연결을 취소했어요." },
  error: { tone: "error", text: "Notion을 연결하지 못했어요. 다시 시도해 주세요." },
} as const;

// 헤더의 "Notion 연결" 버튼. 연결되면 상태 표시로 바뀐다.
export async function NotionConnect() {
  const { userId } = await auth();
  const status = userId ? await getConnectionStatus(userId) : null;

  if (status?.connected) {
    return (
      <span className="inline-flex min-h-9 items-center rounded-lg bg-emerald-50 px-3 text-sm font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        ✓ Notion 연결됨
      </span>
    );
  }

  return (
    // 라우트 핸들러(OAuth 시작)이므로 prefetch가 일어나는 next/link 대신 일반 링크를 쓴다.
    <a
      href="/api/notion/connect"
      className={`inline-flex min-h-9 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 ${focusRing}`}
    >
      Notion 연결
    </a>
  );
}

// ?notion=connected|denied|error 결과 안내 (카테고리 바 위 고정 위치, 수집 알림과 같은 자리)
export function NotionNotice({ result }: { result: string | undefined }) {
  const notice = result && result in NOTICES ? NOTICES[result as keyof typeof NOTICES] : null;
  if (!notice) return null;
  return (
    <div aria-live="polite" className="mb-4">
      <p
        className={`w-fit rounded-lg px-4 py-2 text-sm ${
          notice.tone === "success"
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
        }`}
      >
        {notice.text}
      </p>
    </div>
  );
}
