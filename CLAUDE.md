# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AI 뉴스 수집 앱: RSS(TechCrunch AI, The Verge AI)로 해외 AI 뉴스를 수집 → Claude Haiku 5.5가 한국어 제목·요약·카테고리를 JSON으로 반환 → 카드로 표시 → 카드 버튼으로 Notion에 저장. 요구사항과 구현 단계의 기준 문서는 `PRD.md`(한국어)이다. 구현은 PRD 12절의 단계 순서를 따르며, 현재 인증, DB 스키마·마이그레이션·시드, 대시보드 화면, RSS 수집("뉴스 가져오기"), Claude 번역·요약·분류, Notion 연결·저장까지 구현했다.

## UI 가이드

화면(대시보드·카드·카테고리 바 등)을 만들거나 수정할 때는 먼저 `ui.md`를 읽고 따른다. 스타일은 Tailwind CSS v4만 사용하며, 색·간격·컴포넌트 클래스 규칙, 레이아웃, 상태별 화면은 `ui.md`가 기준이다.

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
- **수집·번역 흐름(구현됨)**: "뉴스 가져오기"로만 수집(스케줄 없음). `collectNews`(`src/app/dashboard/actions.ts`)가 `src/lib/rss`로 지난 48시간 기사를 소스당 최대 10건 받아 `articles`에 저장한다(제목·요약·카테고리는 null, RSS 발췌문은 `excerpt`). 이어서 클라이언트 버튼이 `enrichArticles`를 5건씩 반복 호출하며, `title_ko IS NULL`인 기사를 `src/lib/ai/enrich-article.ts`가 기사 1건당 Claude 1회로 번역·요약·분류한다(응답은 zod 구조화 출력, 사용자의 현재 카테고리 목록 안에서만 분류, 없으면 미분류). 실패한 기사는 null로 남아 다음 수집 때 자동 재시도된다. 미분류 기사는 카테고리 바의 "미분류 N건 다시 분류" 버튼(`reclassifyArticles`, `classifyArticle`)으로 사용자가 누를 때만 재분류한다. 모델은 `src/lib/ai/client.ts`의 `ENRICH_MODEL`.
- **Notion 저장(구현됨)**: 서버가 `@modelcontextprotocol/sdk` 클라이언트로 `https://mcp.notion.com/mcp`를 직접 호출한다(OAuth 2.0 + PKCE, 사용자별 연결, Claude 호출 없음). 카드의 `SaveToNotionButton`이 `saveToNotion`(`actions.ts`)을 호출하면 `src/lib/notion/save-article.ts`가 처음 저장할 때 "AI 뉴스" 데이터베이스를 만들어 data source ID를 `notion_connections.targetId`에 저장하고(삭제됐으면 다시 만든다), 기사마다 페이지를 추가한 뒤 `articles.notionPageUrl`을 기록한다. 번역 전 기사는 저장할 수 없다. Anthropic 키와 Notion 토큰은 서버에서만 사용한다.
