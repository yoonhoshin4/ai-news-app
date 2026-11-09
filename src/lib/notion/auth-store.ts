import { eq } from "drizzle-orm";
import type {
  OAuthClientInformationMixed,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { db } from "@/db";
import { notionConnections } from "@/db/schema";
import { decrypt, encrypt } from "./crypto";

// notion_connections.encryptedAuth에 암호화해 저장하는 JSON.
// 클라이언트 등록 정보는 한 번 받으면 계속 재사용해야 한다 (다시 등록하면 기존 연결이 끊긴다).
export type NotionAuth = {
  clientInformation?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  // 인증 진행 중에만 존재 (콜백에서 검증 후 지운다)
  codeVerifier?: string;
  state?: string;
};

export async function loadAuth(userId: string): Promise<NotionAuth> {
  const [row] = await db
    .select({ encryptedAuth: notionConnections.encryptedAuth })
    .from(notionConnections)
    .where(eq(notionConnections.userId, userId));
  if (!row) return {};
  try {
    return JSON.parse(decrypt(row.encryptedAuth)) as NotionAuth;
  } catch {
    // 키가 바뀌었거나 데이터가 손상된 경우: 연결되지 않은 것으로 취급한다.
    return {};
  }
}

// 일부 필드만 바꾼다. undefined를 넘긴 필드는 지운다. targetId는 건드리지 않는다.
export async function patchAuth(userId: string, patch: Partial<NotionAuth>): Promise<void> {
  const next: NotionAuth = { ...(await loadAuth(userId)), ...patch };
  const encryptedAuth = encrypt(JSON.stringify(next));
  await db
    .insert(notionConnections)
    .values({ userId, encryptedAuth })
    .onConflictDoUpdate({
      target: notionConnections.userId,
      set: { encryptedAuth, updatedAt: new Date() },
    });
}

// 저장 대상 데이터베이스(data source) ID. 연결 행이 없으면 null.
export async function getTargetId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ targetId: notionConnections.targetId })
    .from(notionConnections)
    .where(eq(notionConnections.userId, userId));
  return row?.targetId ?? null;
}

export async function setTargetId(userId: string, targetId: string | null): Promise<void> {
  await db
    .update(notionConnections)
    .set({ targetId, updatedAt: new Date() })
    .where(eq(notionConnections.userId, userId));
}

export type ConnectionStatus = {
  connected: boolean;
  /** 데이터베이스(저장 위치)가 정해졌는지 */
  hasTarget: boolean;
};

export async function getConnectionStatus(userId: string): Promise<ConnectionStatus> {
  const [row] = await db
    .select({
      encryptedAuth: notionConnections.encryptedAuth,
      targetId: notionConnections.targetId,
    })
    .from(notionConnections)
    .where(eq(notionConnections.userId, userId));
  if (!row) return { connected: false, hasTarget: false };
  let connected = false;
  try {
    connected = Boolean((JSON.parse(decrypt(row.encryptedAuth)) as NotionAuth).tokens);
  } catch {
    connected = false;
  }
  return { connected, hasTarget: Boolean(row.targetId) };
}
