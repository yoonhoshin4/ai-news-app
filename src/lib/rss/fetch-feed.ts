import Parser from "rss-parser";
import type { RssSource } from "./sources";

export type FeedArticle = {
  sourceName: string;
  originalTitle: string;
  author: string | null;
  url: string;
  publishedAt: Date;
};

const WINDOW_MS = 48 * 60 * 60 * 1000;
export const MAX_PER_SOURCE = 10;

const parser = new Parser({
  timeout: 10_000,
  headers: { "User-Agent": "ai-news-collector/0.1" },
});

// 트래킹 파라미터·해시를 제거해 같은 기사가 다른 URL로 저장되는 것을 막는다.
function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "guccounter" || key === "guce_referrer") {
        u.searchParams.delete(key);
      }
    }
    return u.toString();
  } catch {
    return null;
  }
}

// 지난 48시간 안에 발행된 기사만, 최신순으로 소스당 MAX_PER_SOURCE건까지 반환한다.
// 파싱 실패 시 예외를 던진다 (호출 측에서 소스별로 처리).
export async function fetchRecentArticles(
  source: RssSource,
  now: number,
): Promise<FeedArticle[]> {
  const feed = await parser.parseURL(source.url);
  const articles: FeedArticle[] = [];

  for (const item of feed.items) {
    const title = item.title?.trim();
    const url = item.link ? normalizeUrl(item.link) : null;
    const time = item.isoDate ? Date.parse(item.isoDate) : NaN;
    if (!title || !url || Number.isNaN(time)) continue;
    if (now - time > WINDOW_MS || time > now + 60_000) continue;

    articles.push({
      sourceName: source.name,
      originalTitle: title,
      author: item.creator?.trim() || null,
      url,
      publishedAt: new Date(time),
    });
  }

  return articles
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, MAX_PER_SOURCE);
}
