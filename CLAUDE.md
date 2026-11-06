# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AI 뉴스 수집 앱: RSS(TechCrunch AI, The Verge AI)로 해외 AI 뉴스를 수집 → Claude Sonnet이 한국어 제목·요약·카테고리를 JSON으로 반환 → 카드로 표시 → 카드 버튼으로 Notion에 저장. 요구사항과 구현 단계의 기준 문서는 `PRD.md`(한국어)이다. 구현은 PRD 12절의 단계 순서를 따르며, 현재 1단계(Clerk·보호 라우트)와 2단계의 스키마 작성까지 끝났고 마이그레이션·시드·이후 단계는 미구현이다.

## Next.js 버전 주의

`AGENTS.md`에 따르면 이 Next.js(16.x)는 학습 데이터와 API·규약이 다르다. 코드를 쓰기 전에 `node_modules/next/dist/docs/`의 관련 가이드를 읽을 것. 예를 들어 미들웨어 파일명이 `src/proxy.ts`이고, 레이아웃은 전역 타입 `LayoutProps<"/">`를 쓴다.

## Commands

- `npm run dev` / `npm run build` / `npm start`
- `npm run lint` (ESLint 9, `eslint-config-next`)
- 테스트 러너는 아직 없다.
- DB: `npx drizzle-kit generate` (마이그레이션 생성, 출력은 `./drizzle`), `npx drizzle-kit migrate` (적용). `drizzle.config.ts`가 `.env.local`의 `DATABASE_URL`을 읽는다.
- 환경변수는 `.env.example`을 복사해 `.env.local`에 채운다 (`.env*`는 gitignore됨). `TOKEN_ENCRYPTION_KEY`는 hex 64자(32바이트).

## Architecture

- **인증/접근 차단**: `src/proxy.ts`가 Clerk 미들웨어로 `/sign-in`, `/sign-up`을 제외한 모든 경로와 `/api`, `/trpc`를 `auth.protect()`로 막는다. `ClerkProvider`는 `src/app/layout.tsx`에 있다.
- **데이터 분리**: `src/db/schema.ts`의 모든 테이블은 Clerk `userId`로 계정별 분리된다. 모든 쿼리는 반드시 `userId`로 필터해야 한다.
  - `articles`는 `(userId, url)` 유니크가 중복 수집 방지의 기준이다. 수집 시 이 키로 이미 저장된 기사를 먼저 걸러내 Claude 호출을 건너뛴다.
  - `articles.categoryId`는 카테고리 삭제 시 `set null`이며, null이 곧 "미분류"이다.
  - `notion_connections.encryptedAuth`는 암호화된 OAuth 토큰/클라이언트 등록 JSON이다 (`TOKEN_ENCRYPTION_KEY`로 암호화).
- **DB 클라이언트**: `src/db/index.ts`는 Neon HTTP 드라이버 + Drizzle(`neon-http`)이다.
- **계획된 흐름(미구현)**: "뉴스 가져오기"로만 수집(스케줄 없음), 소스당 최대 10건, 기사 1건당 Claude 1회 호출, 응답은 zod로 검증하고 사용자의 현재 카테고리 목록 안에서만 분류한다. Notion 저장은 서버가 `@modelcontextprotocol/sdk` 클라이언트로 `https://mcp.notion.com/mcp`를 직접 호출한다(OAuth 2.0 + PKCE, 사용자별 연결, Claude 호출 없음). Anthropic 키와 Notion 토큰은 서버에서만 사용한다.
