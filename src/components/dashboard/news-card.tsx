import { DeleteArticleButton } from "./delete-article-button";
import { SaveToNotionButton } from "./save-to-notion-button";

export type NewsCardData = {
  id: number;
  titleKo: string | null;
  originalTitle: string;
  summaryKo: string | null;
  sourceName: string;
  url: string;
  date: Date;
  categoryName: string | null;
  notionPageUrl: string | null;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Seoul",
});

// 7일 이내는 상대 시간, 그 이후는 2026.11.09 형식
function formatDate(date: Date, now: number) {
  const diff = now - date.getTime();
  if (diff >= 0 && diff < 7 * DAY) {
    if (diff < HOUR) return "방금 전";
    if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`;
    return `${Math.floor(diff / DAY)}일 전`;
  }
  return dateFormat.format(date).replace(/\.\s*/g, ".").replace(/\.$/, "");
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900";

export function NewsCard({
  article,
  now,
  notionConnected,
}: {
  article: NewsCardData;
  now: number;
  notionConnected: boolean;
}) {
  const badge = article.categoryName
    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";

  return (
    <article className="relative flex flex-col rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <DeleteArticleButton articleId={article.id} />
      <div className="flex items-center justify-between gap-2 pr-8">
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge}`}>
          {article.categoryName ?? "미분류"}
        </span>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {article.sourceName} ·{" "}
          <time dateTime={article.date.toISOString()}>
            {formatDate(article.date, now)}
          </time>
        </p>
      </div>

      <h2
        title={article.originalTitle}
        className="mt-3 line-clamp-2 break-words text-lg font-semibold leading-snug text-slate-900 dark:text-slate-100"
      >
        {article.titleKo ?? article.originalTitle}
      </h2>
      {article.summaryKo ? (
        <p className="mt-2 line-clamp-3 break-words text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {article.summaryKo}
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          번역 대기 중 · 뉴스 가져오기를 누르면 번역돼요
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex min-h-9 items-center rounded text-sm font-medium text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 ${focusRing}`}
        >
          원문 보기 ↗
        </a>
        {article.notionPageUrl ? (
          <a
            href={article.notionPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex min-h-9 items-center rounded-lg bg-emerald-50 px-3 text-sm font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 ${focusRing}`}
          >
            ✓ 저장됨
          </a>
        ) : (
          <SaveToNotionButton
            articleId={article.id}
            connected={notionConnected}
            ready={Boolean(article.titleKo && article.summaryKo)}
          />
        )}
      </div>
    </article>
  );
}
