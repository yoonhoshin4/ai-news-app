import { auth as clerkAuth } from "@clerk/nextjs/server";
import { auth as mcpAuth } from "@modelcontextprotocol/sdk/client/auth.js";
import { NextResponse } from "next/server";
import { loadAuth, patchAuth } from "@/lib/notion/auth-store";
import { NOTION_MCP_URL, NotionOAuthProvider } from "@/lib/notion/oauth-provider";

// Notion이 인증 후 돌려보내는 주소. state를 검증하고 코드를 토큰으로 교환해 저장한다.
export async function GET(request: Request) {
  const { userId } = await clerkAuth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", request.url));

  const params = new URL(request.url).searchParams;
  const done = (result: "connected" | "denied" | "error") =>
    NextResponse.redirect(new URL(`/dashboard?notion=${result}`, request.url));

  if (params.get("error")) return done("denied");

  const code = params.get("code");
  const state = params.get("state");
  const saved = await loadAuth(userId);
  // CSRF 방어: 이 사용자가 시작한 인증의 state와 같아야 한다.
  if (!code || !state || !saved.state || state !== saved.state) return done("error");

  try {
    const result = await mcpAuth(new NotionOAuthProvider(userId), {
      serverUrl: NOTION_MCP_URL,
      authorizationCode: code,
    });
    if (result !== "AUTHORIZED") return done("error");
    // 일회용 값은 지운다 (토큰·클라이언트 정보는 유지)
    await patchAuth(userId, { codeVerifier: undefined, state: undefined });
    return done("connected");
  } catch (e) {
    console.error("Notion 연결 완료 실패", e);
    return done("error");
  }
}
