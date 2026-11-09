export type RssSource = { name: string; url: string };

// RSS 소스는 코드에 고정한다 (PRD 5.2).
export const RSS_SOURCES: readonly RssSource[] = [
  {
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
  },
  {
    name: "The Verge AI",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
  },
];
