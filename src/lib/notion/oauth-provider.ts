import { randomBytes } from "node:crypto";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { loadAuth, patchAuth } from "./auth-store";

export const NOTION_MCP_URL = "https://mcp.notion.com/mcp";

export function notionRedirectUrl() {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/notion/callback`;
}

// 사용자 1명의 Notion MCP OAuth 상태를 DB(암호화)에 보관하는 provider.
// 서버 쪽에서만 쓰므로 redirectToAuthorization은 URL만 잡아 두고, 라우트가 리다이렉트한다.
export class NotionOAuthProvider implements OAuthClientProvider {
  /** redirectToAuthorization이 받은 인증 URL (라우트가 이 주소로 보낸다) */
  authorizationUrl: URL | null = null;

  constructor(private readonly userId: string) {}

  get redirectUrl() {
    return notionRedirectUrl();
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: "AI 뉴스 수집기",
      redirect_uris: [this.redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    };
  }

  async state() {
    const state = randomBytes(16).toString("base64url");
    await patchAuth(this.userId, { state });
    return state;
  }

  async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    return (await loadAuth(this.userId)).clientInformation;
  }

  async saveClientInformation(clientInformation: OAuthClientInformationMixed) {
    await patchAuth(this.userId, { clientInformation });
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    return (await loadAuth(this.userId)).tokens;
  }

  async saveTokens(tokens: OAuthTokens) {
    await patchAuth(this.userId, { tokens });
  }

  redirectToAuthorization(authorizationUrl: URL) {
    this.authorizationUrl = authorizationUrl;
  }

  async saveCodeVerifier(codeVerifier: string) {
    await patchAuth(this.userId, { codeVerifier });
  }

  async codeVerifier() {
    const verifier = (await loadAuth(this.userId)).codeVerifier;
    if (!verifier) throw new Error("진행 중인 Notion 연결이 없어요. 다시 연결해 주세요.");
    return verifier;
  }

  // 서버가 자격 증명이 무효라고 알려 줄 때 SDK가 호출한다 (예: invalid_grant).
  async invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery") {
    if (scope === "all") {
      await patchAuth(this.userId, {
        clientInformation: undefined,
        tokens: undefined,
        codeVerifier: undefined,
        state: undefined,
      });
    } else if (scope === "client") {
      await patchAuth(this.userId, { clientInformation: undefined });
    } else if (scope === "tokens") {
      await patchAuth(this.userId, { tokens: undefined });
    } else if (scope === "verifier") {
      await patchAuth(this.userId, { codeVerifier: undefined });
    }
  }
}
