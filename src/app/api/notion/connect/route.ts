import { auth as clerkAuth } from "@clerk/nextjs/server";
import { auth as mcpAuth } from "@modelcontextprotocol/sdk/client/auth.js";
import { NextResponse } from "next/server";
import { NOTION_MCP_URL, NotionOAuthProvider } from "@/lib/notion/oauth-provider";

// "Notion 연결" 버튼이 여는 주소. 클라이언트 등록(처음 한 번) → PKCE 인증 URL로 리다이렉트.
export async function GET(request: Request) {
  const { userId } = await clerkAuth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", request.url));

  const provider = new NotionOAuthProvider(userId);
  try {
    const result = await mcpAuth(provider, { serverUrl: NOTION_MCP_URL });
    if (result === "REDIRECT" && provider.authorizationUrl) {
      return NextResponse.redirect(provider.authorizationUrl);
    }
    // 이미 유효한 토큰이 있어 인증이 필요 없는 경우
    return NextResponse.redirect(new URL("/dashboard?notion=connected", request.url));
  } catch (e) {
    console.error("Notion 연결 시작 실패", e);
    return NextResponse.redirect(new URL("/dashboard?notion=error", request.url));
  }
}
