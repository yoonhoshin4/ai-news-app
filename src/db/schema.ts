import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("categories_user_name_idx").on(t.userId, t.name)],
);

export const articles = pgTable(
  "articles",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    sourceName: text("source_name").notNull(),
    originalTitle: text("original_title").notNull(),
    // RSS에 작성자가 없을 수 있어 null 허용
    author: text("author"),
    // null = 아직 번역·요약 전 (RSS 수집 직후). Claude 단계에서 채운다.
    titleKo: text("title_ko"),
    summaryKo: text("summary_ko"),
    url: text("url").notNull(),
    publishedAt: timestamp("published_at"),
    // null = 미분류. 카테고리 삭제 시 null로 이동
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    notionPageUrl: text("notion_page_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("articles_user_url_idx").on(t.userId, t.url)],
);

export const notionConnections = pgTable("notion_connections", {
  userId: text("user_id").primaryKey(),
  // 암호화된 OAuth 토큰/클라이언트 등록 정보(JSON 문자열)
  encryptedAuth: text("encrypted_auth").notNull(),
  // 저장 대상 페이지/데이터베이스 ID
  targetId: text("target_id"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
