import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// 모델은 여기 한 곳에서만 바꾼다. 품질이 부족하면 "claude-sonnet-5-5"로 교체.
export const ENRICH_MODEL = "claude-haiku-5-5";

let client: Anthropic | null = null;

export function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY가 설정되지 않았어요.");
  }
  client ??= new Anthropic();
  return client;
}
