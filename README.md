# AI 뉴스 수집 앱

해외 AI 뉴스를 RSS로 수집하고, Claude가 한국어 제목·요약·카테고리를 만들어 카드로 보여주는 웹 앱입니다. 마음에 드는 뉴스는 카드의 버튼으로 Notion에 저장할 수 있습니다.

## 주요 기능

- **로그인**: Clerk 인증. 로그인하지 않으면 로그인/회원가입 외 모든 경로와 API가 차단됩니다.
- **뉴스 수집**: "뉴스 가져오기" 버튼을 누를 때만 수집합니다. TechCrunch AI, The Verge AI에서 지난 48시간 기사를 소스당 최대 10건 가져오며, 이미 저장된 기사(원문 링크 기준)는 건너뜁니다.
- **번역·요약·분류**: Claude Haiku 5.5가 기사 1건당 1회 호출로 한국어 제목, 요약, 카테고리를 반환합니다. 사용자의 카테고리 목록 안에서만 분류하며, 맞는 카테고리가 없으면 "미분류"입니다.
- **카테고리 관리**: 카테고리를 추가·수정·삭제하고, 미분류 기사는 버튼으로 다시 분류할 수 있습니다.
- **Notion 저장**: Notion MCP 서버(OAuth 2.0 + PKCE)로 사용자별 연결 후 "AI 뉴스" 데이터베이스에 기사를 저장합니다.
- 모든 데이터는 계정별로 분리됩니다.

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프레임워크 | Next.js 16 (App Router), React 19, TypeScript |
| 스타일 | Tailwind CSS v4 |
| 인증 | Clerk |
| DB / ORM | Neon (PostgreSQL) + Drizzle ORM |
| AI | Anthropic API (Claude Haiku 5.5) |
| RSS | rss-parser |
| Notion 연동 | `@modelcontextprotocol/sdk` |

## 시작하기

### 1. 설치

```bash
npm install
```

### 2. 환경변수

`.env.example`을 `.env.local`로 복사해 값을 채웁니다.

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | [Clerk](https://dashboard.clerk.com) 키 |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | 로그인/회원가입 경로 (`/sign-in`, `/sign-up`) |
| `DATABASE_URL` | Neon PostgreSQL 연결 문자열 |
| `ANTHROPIC_API_KEY` | Anthropic API 키 |
| `TOKEN_ENCRYPTION_KEY` | Notion 토큰 암호화용 32바이트 키 (hex 64자) |
| `APP_URL` | OAuth 콜백에 쓰는 앱 주소 (로컬: `http://localhost:3000`) |
| `NOTION_DATABASE_ID` | 뉴스를 저장할 Notion 데이터베이스 ID |

`TOKEN_ENCRYPTION_KEY`는 다음 명령으로 만들 수 있습니다.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. 데이터베이스 마이그레이션

```bash
npx drizzle-kit migrate
```

스키마를 바꾼 뒤에는 `npx drizzle-kit generate`로 마이그레이션을 만들고 다시 적용합니다.

### 4. 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 확인합니다.

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm start` | 프로덕션 서버 |
| `npm run lint` | ESLint |

## 프로젝트 구조

```
src/
├── app/          # 페이지, 서버 액션 (dashboard, sign-in, sign-up, api)
├── components/   # UI 컴포넌트
├── db/           # Drizzle 스키마와 Neon 클라이언트
├── lib/
│   ├── ai/       # Claude 번역·요약·분류
│   ├── rss/      # RSS 수집
│   └── notion/   # Notion MCP 연동·저장
└── proxy.ts      # Clerk 미들웨어 (접근 차단)
drizzle/          # 마이그레이션 파일
```

## 문서

- [`PRD.md`](./PRD.md): 요구사항과 구현 단계
- [`ui.md`](./ui.md): UI 가이드
- [`CLAUDE.md`](./CLAUDE.md): 개발 가이드
