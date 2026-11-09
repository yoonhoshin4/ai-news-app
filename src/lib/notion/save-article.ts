import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getTargetId, setTargetId } from "./auth-store";
import { NOTION_MCP_URL, NotionOAuthProvider } from "./oauth-provider";

export type NotionArticle = {
  titleKo: string;
  originalTitle: string;
  summaryKo: string;
  sourceName: string;
  url: string;
  publishedAt: Date | null;
  categoryName: string | null;
};

export class NotionSaveError extends Error {
  constructor(
    message: string,
    readonly kind: "auth" | "other" = "other",
  ) {
    super(message);
  }
}

// Notion 도구가 돌려준 오류 (원문은 서버 로그용이라 화면에 그대로 보이지 않는다)
class NotionToolError extends Error {}

const DATABASE_TITLE = "AI 뉴스";
const DATABASE_SCHEMA = `CREATE TABLE ("제목" TITLE, "원문 제목" RICH_TEXT, "요약" RICH_TEXT, "카테고리" RICH_TEXT, "출처" RICH_TEXT, "원문 링크" URL, "발행일" DATE)`;
const RICH_TEXT_LIMIT = 1900; // Notion 서식 텍스트 한 칸은 2000자까지

type ToolResult = { isError?: boolean; content?: unknown };

// 도구 결과의 텍스트 부분을 이어 붙인다.
function textOf(result: ToolResult): string {
  if (!Array.isArray(result.content)) return "";
  return result.content
    .map((c) => (c && typeof c === "object" && "text" in c ? String((c as { text: unknown }).text) : ""))
    .join("\n");
}

async function call(client: Client, name: string, args: Record<string, unknown>): Promise<string> {
  const result = (await client.callTool({ name, arguments: args })) as ToolResult;
  const text = textOf(result);
  if (result.isError) {
    // 원문 오류(JSON 등)는 서버 로그에만 남기고 화면에는 짧은 안내만 보여 준다.
    console.error("Notion 도구 오류", name, text.slice(0, 500));
    throw new NotionToolError(text);
  }
  return text;
}

const UUID = "[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}";

async function createDatabase(client: Client): Promise<string> {
  const text = await call(client, "notion-create-database", {
    title: DATABASE_TITLE,
    description: "AI 뉴스 수집기에서 저장한 기사",
    schema: DATABASE_SCHEMA,
  });
  // 결과의 <data-source url="collection://..."> 에서 data source ID를 꺼낸다.
  const id = text.match(new RegExp(`collection://(${UUID})`))?.[1];
  if (!id) throw new NotionSaveError("Notion 데이터베이스 ID를 확인하지 못했어요.");
  return id;
}

function pageProperties(a: NotionArticle) {
  const props: Record<string, string | number> = {
    제목: a.titleKo,
    "원문 제목": a.originalTitle.slice(0, RICH_TEXT_LIMIT),
    요약: a.summaryKo.slice(0, RICH_TEXT_LIMIT),
    카테고리: a.categoryName ?? "미분류",
    출처: a.sourceName,
    "원문 링크": a.url,
  };
  if (a.publishedAt) {
    props["date:발행일:start"] = a.publishedAt.toISOString().slice(0, 10);
    props["date:발행일:is_datetime"] = 0;
  }
  return props;
}

// 만든 페이지의 URL을 결과 텍스트에서 찾는다. 없으면 ID로 만든다.
function pageUrlOf(text: string): string {
  const url = text.match(/https:\/\/(?:www\.)?notion\.(?:so|site)\/[^\s"'<>)\]]+/)?.[0];
  if (url) return url;
  const id = text.match(new RegExp(UUID))?.[0];
  if (id) return `https://www.notion.so/${id.replaceAll("-", "")}`;
  throw new NotionSaveError("저장된 Notion 페이지 주소를 확인하지 못했어요.");
}

async function createPage(client: Client, dataSourceId: string, a: NotionArticle): Promise<string> {
  const text = await call(client, "notion-create-pages", {
    parent: { type: "data_source_id", data_source_id: dataSourceId },
    pages: [
      {
        properties: pageProperties(a),
        content: `${a.summaryKo}\n\n[원문 보기](${a.url})`,
      },
    ],
    allow_async: false,
  });
  return pageUrlOf(text);
}

// 기사를 사용자의 Notion "AI 뉴스" 데이터베이스에 저장하고 페이지 URL을 돌려준다.
// 데이터베이스는 처음 저장할 때 만들고, 사용자가 지웠다면 다시 만든다.
export async function saveArticleToNotion(userId: string, article: NotionArticle): Promise<string> {
  const client = new Client({ name: "ai-news-collector", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(NOTION_MCP_URL), {
    authProvider: new NotionOAuthProvider(userId),
  });

  try {
    await client.connect(transport);

    const existing = await getTargetId(userId);
    if (existing) {
      try {
        return await createPage(client, existing, article);
      } catch (e) {
        // 데이터베이스가 삭제·보관된 경우에만 새로 만든다. 다른 오류(속성 검증 실패 등)로
        // 다시 만들면 데이터베이스가 중복 생성되므로 그대로 던진다.
        if (!(e instanceof NotionToolError) || !/object_not_found|archived|could not find/i.test(e.message)) {
          throw e;
        }
      }
    }

    const dataSourceId = await createDatabase(client);
    await setTargetId(userId, dataSourceId);
    return await createPage(client, dataSourceId, article);
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      throw new NotionSaveError("Notion 연결이 만료됐어요. 다시 연결해 주세요.", "auth");
    }
    if (e instanceof NotionSaveError) throw e;
    if (!(e instanceof NotionToolError)) console.error("Notion 저장 실패", e);
    throw new NotionSaveError("Notion에 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
  } finally {
    await client.close().catch(() => {});
  }
}
