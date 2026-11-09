# PRD: AI 뉴스 수집 앱

## 1. 개요
해외 AI 뉴스를 RSS로 수집하고, Claude AI가 한국어로 번역·요약·카테고리 분류한 결과를 카드 형태로 보여주는 웹 앱. 마음에 드는 뉴스는 카드의 버튼으로 Notion에 저장할 수 있다.

## 2. 목표
- 영문 AI 뉴스를 한국어로 빠르게 훑어볼 수 있게 한다.
- 카테고리별로 원하는 뉴스만 골라 볼 수 있게 한다.
- 중요한 뉴스를 Notion으로 간편하게 옮길 수 있게 한다.

## 3. 사용자
- 로그인한 여러 사용자. 카테고리, 뉴스, Notion 연결 등 모든 데이터는 계정별로 분리된다.

## 4. 사용자 흐름
로그인 → 메인 화면 → "뉴스 가져오기" 클릭 → RSS 수집 → Claude 번역·요약·분류 → 카테고리별 카드 표시 → (선택) 카드의 "Notion 저장" 클릭

## 5. 기능 요구사항

### 5.1 로그인
- 앱 실행 시 로그인해야 접근할 수 있다. (Clerk)
- 로그인하지 않은 사용자는 로그인/회원가입 페이지 외 모든 경로와 API 접근이 차단된다.

### 5.2 뉴스 수집
- 사용자가 "뉴스 가져오기" 버튼을 눌렀을 때만 수집한다. 자동 스케줄은 없다.
- RSS 소스는 코드에 고정한다.
  - TechCrunch AI: `https://techcrunch.com/category/artificial-intelligence/feed/`
  - The Verge AI: `https://www.theverge.com/rss/ai-artificial-intelligence/index.xml` (입력된 `intex.xml`은 오타로 추정, 구현 시 확인)
- 소스당 최대 10개를 처리한다.
- 이미 저장된 기사(원문 링크 기준)는 건너뛰어 중복 저장과 Claude 호출 비용을 막는다.

### 5.3 번역·요약·분류 (Claude API)
- 모델은 Claude Haiku 5.5(`claude-haiku-5-5`)를 사용한다. 품질이 부족하면 `src/lib/ai/client.ts`의 `ENRICH_MODEL` 한 줄로 Sonnet으로 바꾼다.
- 기사 1건당 1회 호출로 한국어 제목, 한국어 요약, 카테고리를 JSON으로 받는다.
- 호출 시 사용자의 현재 카테고리 목록을 전달해 그 안에서만 고르게 한다. 맞는 카테고리가 없으면 미분류.
- 응답은 스키마로 검증하고, 실패한 기사는 건너뛰고 다시 시도할 수 있게 한다.
- API 키는 서버에서만 사용한다.

### 5.4 카드 목록
- 뉴스 1건당 카드 1개.
- 카드 항목(기본안): 번역된 제목, 요약, 카테고리, 출처, 날짜, 원문 링크, Notion 저장 버튼.
- 카테고리 탭/필터로 해당 카테고리 뉴스만 볼 수 있다.

### 5.5 카테고리 관리
- 사용자가 카테고리를 추가·수정·삭제할 수 있다.
- 최초 가입 시 기본 카테고리를 제공한다. (예: 모델/제품, 연구, 기업/투자, 정책/규제, 도구/오픈소스)
- 카테고리를 수정·삭제하면 기존 뉴스는 "미분류"로 이동한다.
- 새로 추가한 카테고리는 다음 수집부터 분류에 적용된다. 기존 미분류 뉴스는 자동으로 재분류하지 않으며, 사용자가 카테고리 바의 "미분류 N건 다시 분류" 버튼을 눌렀을 때만 현재 카테고리 목록으로 다시 분류한다(제목·요약은 유지).

### 5.6 Notion 저장
- 각 카드의 "Notion 저장" 버튼을 누르면 해당 뉴스가 Notion에 저장된다.
- Notion MCP 서버(`https://mcp.notion.com/mcp`)를 앱 서버가 MCP 클라이언트로 직접 호출한다. (Claude 호출 없음)
- 인증은 OAuth 2.0 + PKCE이며 사용자마다 자기 Notion 계정을 연결한다. 토큰은 서버에서 암호화해 보관한다.
- 저장에 성공하면 해당 카드는 "저장됨"으로 표시되고 중복 저장되지 않는다.

## 6. 기술 스택
| 영역 | 기술 |
|---|---|
| 프레임워크 | Next.js (App Router, TypeScript, Tailwind CSS) |
| 로그인 | Clerk |
| DB / ORM | Neon (PostgreSQL) + Drizzle ORM |
| AI | Claude API (Haiku 5.5), Anthropic SDK |
| RSS | rss-parser |
| Notion | Notion MCP 서버 + `@modelcontextprotocol/sdk` |
| 배포 | Vercel (권장) |

## 7. 데이터 모델
모든 테이블은 Clerk 사용자 ID(`userId`)로 계정별 분리한다.
- `categories`: id, userId, name (userId+name 유니크)
- `articles`: id, userId, sourceName, originalTitle, author(원문 작성자, null 허용), titleKo, summaryKo, url, publishedAt, categoryId(null=미분류, 카테고리 삭제 시 null), notionPageUrl, createdAt (userId+url 유니크)
- `notion_connections`: userId, 암호화된 인증 정보, 저장 대상 위치, updatedAt

## 8. 비기능 요구사항
- 비밀 키(Anthropic, Clerk, Notion 토큰)는 서버 환경변수와 DB(암호화)에만 둔다.
- 비용 관리: 소스당 10개 상한, 중복 기사 호출 제외.
- 모든 API는 로그인 사용자만 호출할 수 있고, 자기 데이터만 접근한다.

## 9. 제약 및 리스크
- TechCrunch RSS는 본문이 아닌 발췌 1~2문장만 제공하므로 요약 품질이 제한된다. 필요하면 원문 페이지를 추가로 가져오는 방안을 검토한다.
- Notion MCP는 AI 클라이언트용으로 설계되어 있어 웹 앱에서 쓰려면 앱 서버에 OAuth 연결과 토큰 갱신 처리가 필요하다.
- Claude 호출 비용은 기사 수에 비례해 늘어난다(Haiku 기준 기사 1건당 약 $0.0002).

## 10. 범위 밖 (현재 버전)
- 자동/예약 수집
- 앱 화면에서 RSS 소스 추가·삭제
- 카테고리 변경 시 기존 뉴스 자동 재분류

## 11. 미정 사항
- 카드·Notion에 저장할 항목 최종 확정 (기본안: 제목, 요약, 카테고리, 출처, 날짜, 링크)
- Notion 저장 위치 (연결 시 사용자가 고른 페이지/데이터베이스 하위 권장)
- 배포 환경 확정 (Vercel 권장)

## 12. 구현 단계
1. Next.js 초기화, Tailwind, Clerk 연동, 보호 라우트 (완료)
2. Neon + Drizzle 스키마, 기본 카테고리 시드 (스키마 작성 완료, 마이그레이션 대기)
3. RSS 수집 + Claude 분류/번역/요약 + 저장
4. 카드 목록과 카테고리 필터/관리
5. Notion MCP OAuth 연결 + "Notion 저장"
6. 배포 및 환경변수 설정

## 13. 검증 기준
- 비로그인 상태에서 화면과 API 접근이 차단된다.
- "뉴스 가져오기"를 연속 2회 실행해도 중복 기사와 중복 Claude 호출이 없다.
- 카테고리 추가·수정·삭제 후 필터와 "미분류" 이동이 올바르다.
- 두 계정으로 로그인했을 때 데이터가 서로 보이지 않는다.
- Notion 연결 후 저장 시 실제 페이지가 생성되고 버튼이 "저장됨"으로 바뀐다.
