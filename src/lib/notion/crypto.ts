import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM. 저장 형식: base64(iv(12) | authTag(16) | ciphertext)
function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("TOKEN_ENCRYPTION_KEY는 hex 64자(32바이트)여야 해요.");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function decrypt(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}
