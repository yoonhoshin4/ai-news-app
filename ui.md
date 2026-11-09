# ui.md — AI 뉴스 수집기 UI 가이드

앱 이름은 **AI 뉴스 수집기**이다. 이 문서는 화면을 구현할 때 따르는 UI 기준이다. 기능 요구사항은 `PRD.md`, 여기서는 모양과 동작 규칙만 다룬다.

- 스타일링은 **Tailwind CSS v4**(`@import "tailwindcss"`, `src/app/globals.css`)만 사용한다. 별도 CSS 파일이나 CSS-in-JS는 쓰지 않는다.
- 색·간격·글자 크기는 아래 토큰(Tailwind 기본 팔레트)만 쓰고, 임의 값(`w-[313px]` 등)은 피한다.
- 메인 화면은 뉴스 카드 대시보드 하나다. 로그인/회원가입 화면은 Clerk 컴포넌트를 그대로 쓴다.

## 1. 디자인 원칙

1. **읽기 우선**: 카드의 주인공은 한국어 제목과 요약이다. 장식은 최소화한다.
2. **차분한 톤**: 흰 배경 + 옅은 회색 테두리, 강조색은 인디고 한 가지만 쓴다.
3. **여백으로 구분**: 그림자·진한 테두리 대신 충분한 간격과 옅은 테두리로 영역을 나눈다.
4. **일관성**: 같은 역할의 요소는 항상 같은 클래스 조합을 쓴다 (아래 컴포넌트 규칙 참고).

## 2. 디자인 토큰

### 색상

| 용도 | 라이트 | 다크 |
| --- | --- | --- |
| 페이지 배경 | `bg-slate-50` | `dark:bg-slate-950` |
| 카드/헤더 배경 | `bg-white` | `dark:bg-slate-900` |
| 테두리 | `border-slate-200` | `dark:border-slate-800` |
| 본문 제목 | `text-slate-900` | `dark:text-slate-100` |
| 본문 텍스트 | `text-slate-600` | `dark:text-slate-300` |
| 보조 텍스트(출처·날짜) | `text-slate-500` | `dark:text-slate-400` |
| 강조(주 버튼, 선택된 카테고리) | `bg-indigo-600 text-white` | `dark:bg-indigo-500` |
| 강조 hover | `hover:bg-indigo-700` | `dark:hover:bg-indigo-400` |
| 성공(저장됨) | `text-emerald-700 bg-emerald-50` | `dark:text-emerald-300 dark:bg-emerald-950` |
| 오류 | `text-red-700 bg-red-50` | `dark:text-red-300 dark:bg-red-950` |

- 다크 모드는 `prefers-color-scheme`을 따른다 (현재 `globals.css`와 동일). 모든 색 클래스에 `dark:` 짝을 함께 쓴다.
- 텍스트 대비는 WCAG AA(본문 4.5:1) 이상을 유지한다. 보조 텍스트도 `slate-400`보다 옅게 쓰지 않는다.

### 글꼴·글자 크기

- 한글이 잘 보이도록 `font-sans` 스택 뒤에 시스템 한글 글꼴을 폴백으로 둔다. 현재 `body`의 `Arial, Helvetica`는 `font-sans`(Geist)로 교체한다.
- 본문은 `leading-relaxed`(줄간격 1.625)로 읽기 편하게 한다.

| 요소 | 클래스 |
| --- | --- |
| 앱 이름(헤더) | `text-lg font-bold tracking-tight` |
| 카드 제목 | `text-lg font-semibold leading-snug` |
| 카드 요약 | `text-sm leading-relaxed` |
| 메타(출처·날짜) | `text-xs` |
| 카테고리 칩 / 버튼 | `text-sm font-medium` |

### 모양·간격

- 모서리: 카드 `rounded-xl`, 버튼·칩 `rounded-full`(칩) / `rounded-lg`(일반 버튼).
- 카드 안쪽 여백 `p-5`, 카드 사이 간격 `gap-4`(모바일) / `gap-6`(데스크톱).
- 그림자는 카드 hover에서만 `hover:shadow-md`로 약하게 준다.
- 전환 효과는 `transition-colors` 또는 `transition-shadow`(150ms 기본값)만 쓴다.

## 3. 페이지 레이아웃

```
┌──────────────────────────────────────────────────────┐
│ 헤더: AI 뉴스 수집기        [뉴스 가져오기] [사용자 메뉴] │  sticky
├──────────────────────────────────────────────────────┤
│ 카테고리 바:  (전체) (모델/제품) (연구) ... (미분류) (+ 추가) │
│                                                      │
│ ┌────────┐  ┌────────┐  ┌────────┐                   │
│ │ 뉴스카드 │  │ 뉴스카드 │  │ 뉴스카드 │                   │
│ └────────┘  └────────┘  └────────┘                   │
│ ┌────────┐  ┌────────┐  ┌────────┐                   │
│ │ 뉴스카드 │  │ ...     │  │        │                   │
│ └────────┘  └────────┘  └────────┘                   │
└──────────────────────────────────────────────────────┘
```

- 최상위 래퍼: `min-h-screen bg-slate-50 dark:bg-slate-950`
- 콘텐츠 폭: `mx-auto w-full max-w-6xl px-4 sm:px-6`
- 헤더: `sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90`, 높이 `h-14`. 왼쪽에 앱 이름 "AI 뉴스 수집기", 오른쪽에 "뉴스 가져오기" 버튼과 Clerk `UserButton`.
- 본문: 헤더 아래 `py-6`. 카테고리 바 → 카드 그리드 순서로 세로 배치, 둘 사이 `mb-6`.
- 카드 그리드: `grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3`
  - 모바일 1열 / 태블릿 2열 / 데스크톱 3열.

## 4. 카테고리 바 (카드 목록 바로 위)

카드 목록 위에 카테고리를 가로로 나열하고, **맨 끝에 "카테고리 추가" 버튼**을 둔다.

```
[전체] [모델/제품] [연구] [기업/투자] [정책/규제] [도구/오픈소스] [미분류] [+ 카테고리 추가]
```

- 컨테이너: `flex flex-wrap items-center gap-2`
  - 줄바꿈을 허용해 모바일에서도 가로 스크롤 없이 모두 보이게 한다. 카테고리가 매우 많아지면 `overflow-x-auto` 한 줄 스크롤로 바꿀 수 있다.
- 항목 순서: **전체 → 사용자 카테고리(생성순) → 미분류 → 추가 버튼**. "추가 버튼"은 항상 마지막이다.
- **전체**: 모든 뉴스를 보여주는 고정 항목, 기본 선택 상태. **미분류**: `categoryId`가 null인 뉴스. 둘 다 이름 수정·삭제 불가.
- 칩 기본(미선택): `rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800`
- 칩 선택됨: `border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500` (미선택 클래스의 색을 대체)
- 각 칩에 해당 카테고리의 뉴스 개수를 작은 숫자로 덧붙인다 (예: `연구 12`, `text-xs opacity-70 ml-1.5`).
- **카테고리 추가 버튼**: 칩과 같은 크기이되 점선 테두리로 구분한다.
  - `rounded-full border border-dashed border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-500 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-600 dark:text-slate-400`
  - 라벨은 `+ 카테고리 추가`. 모바일에서도 라벨을 줄이지 않는다.
  - 클릭하면 버튼 자리가 이름 입력 필드로 바뀌는 인라인 입력(`rounded-full border px-4 py-1.5 text-sm`)이 되고, Enter로 추가·Esc로 취소한다. 추가에 성공하면 칩이 버튼 바로 앞에 생기고 자동 선택하지 않는다.
  - 이름이 비었거나 이미 있는 이름이면 입력 필드 아래에 `text-xs text-red-600`로 이유를 보여준다.
- 수정·삭제: 사용자 카테고리 칩에 마우스를 올리거나(데스크톱) 길게 누르면(모바일) 작은 `⋯` 메뉴가 나타난다. 삭제 시 "이 카테고리의 뉴스는 '미분류'로 이동합니다" 확인 문구를 보여준다 (PRD 5.5).
- 접근성: 칩 그룹은 `role="tablist"` 대신 단순 버튼 목록으로 두고, 선택된 칩에 `aria-pressed="true"`를 준다. 키보드 포커스는 `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`.

## 5. 뉴스 카드

카드 1개 = 기사 1건. 항목은 PRD 5.4 기본안(제목, 요약, 카테고리, 출처, 날짜, 원문 링크, Notion 저장 버튼)을 따른다.

```
┌──────────────────────────────────────┐
│ (연구)                    TechCrunch · 2일 전 │
│                                      │
│ 한국어 제목이 여기에 두 줄까지 표시됩니다   │
│ 한국어 요약이 세 줄까지 표시되고 넘치면 …    │
│                                      │
│ 원문 보기 ↗                [Notion 저장] │
└──────────────────────────────────────┘
```

- 컨테이너: `flex flex-col rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900`
- **상단 줄** (`flex items-center justify-between gap-2`): 왼쪽에 카테고리 배지, 오른쪽에 `출처 · 날짜`.
  - 카테고리 배지: `rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300`. 미분류는 `bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`.
  - 출처·날짜: `text-xs text-slate-500 dark:text-slate-400`. 날짜는 7일 이내면 상대 시간("2일 전"), 그 이후는 `2026.11.09` 형식. `publishedAt`이 없으면 날짜를 생략한다.
- **제목**: `mt-3 text-lg font-semibold leading-snug text-slate-900 line-clamp-2 dark:text-slate-100` (한국어 제목 `titleKo`). 원문 영어 제목은 카드에 표시하지 않는다 (`title` 속성으로 호버 시에만 노출해도 됨).
- **요약**: `mt-2 text-sm leading-relaxed text-slate-600 line-clamp-3 dark:text-slate-300`. 카드 높이가 들쭉날쭉하지 않도록 줄 수를 고정 상한으로 자른다.
- **하단 줄**: `mt-auto pt-4 flex items-center justify-between` — 항상 카드 아래쪽에 붙어 카드 높이가 달라도 버튼 위치가 맞는다.
  - 왼쪽 "원문 보기 ↗": `text-sm font-medium text-slate-500 hover:text-indigo-600`, `target="_blank" rel="noopener noreferrer"`.
  - 오른쪽 Notion 저장 버튼 (아래 상태 표 참고).
- 카드 전체를 링크로 만들지 않는다. 제목은 텍스트로 두고, 원문 이동은 "원문 보기" 링크로만 한다 (버튼과 링크가 겹치는 클릭 영역 방지).

### Notion 저장 버튼 상태

| 상태 | 표시 | 클래스 |
| --- | --- | --- |
| 기본 | `Notion 저장` | `rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800` |
| 저장 중 | 스피너 + `저장 중…` | 기본 클래스 + `disabled:opacity-60 cursor-wait`, 클릭 불가 |
| 저장됨 | `✓ 저장됨` (클릭 시 `notionPageUrl`로 이동) | `rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300` |
| 실패 | `다시 시도` + 카드 하단에 `text-xs text-red-600` 오류 문구 | 기본 클래스 + `border-red-300 text-red-700` |
| Notion 미연결 | `Notion 연결` (설정 안내로 이동) | 기본 클래스 |

- `notionPageUrl`이 있으면 "저장됨"으로 표시하고 다시 저장되지 않게 한다 (PRD 5.6).

## 6. 상단 "뉴스 가져오기" 버튼과 수집 상태

- 헤더 오른쪽의 주 버튼: `rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400`
- 수집 중에는 버튼이 `disabled`가 되고 스피너와 `가져오는 중…`을 보여준다. 모바일(`sm` 미만)에서는 라벨을 `가져오기`로 줄인다.
- 완료되면 카테고리 바 위에 한 줄 알림(`rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700`)으로 "새 뉴스 8건을 추가했어요"를 보여주고, 5초 뒤 사라지게 한다. 새 기사가 없으면 "새 뉴스가 없어요".
- 일부 소스가 실패했으면 같은 위치에 오류 톤(`bg-red-50 text-red-700`)으로 어느 소스가 실패했는지 알린다. 성공한 소스의 결과는 그대로 보여준다.

## 7. 상태별 화면

- **로딩**: 카드와 같은 크기의 스켈레톤(`animate-pulse rounded-xl bg-slate-200 h-44 dark:bg-slate-800`)을 6개 보여준다.
- **빈 목록(아직 수집 전)**: 카드 영역 중앙에 안내를 둔다. `py-20 text-center`, 제목 `text-base font-semibold text-slate-900`, 설명 `mt-1 text-sm text-slate-500` ("아직 수집한 뉴스가 없어요. 오른쪽 위 '뉴스 가져오기'를 눌러 시작해 보세요.").
- **선택한 카테고리에 뉴스 없음**: "이 카테고리에는 아직 뉴스가 없어요."만 간단히 보여준다 (버튼 없음).
- **오류(목록 불러오기 실패)**: `rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700` 안에 이유와 `다시 시도` 버튼.

## 8. 반응형·접근성 체크리스트

- 가장 작은 화면(360px)에서 가로 스크롤이 없어야 한다. 긴 제목·URL은 `break-words`로 처리한다.
- 터치 대상은 높이 36px 이상(`py-1.5` + `text-sm` 이상)을 유지한다.
- 모든 버튼·링크는 키보드 포커스 링(`focus-visible:ring-2 focus-visible:ring-indigo-500`)이 보여야 한다.
- 아이콘만 있는 버튼에는 `aria-label`을 붙인다. 색만으로 상태를 전달하지 않는다 (저장됨은 `✓` 문구 포함).
- `<html lang="ko">`는 이미 설정되어 있다. 날짜는 `<time dateTime=...>`으로 마크업한다.

## 9. 구현 메모

- 이 앱의 Next.js는 학습 데이터와 규약이 다르다. 페이지·레이아웃 코드를 쓰기 전에 `node_modules/next/dist/docs/`의 관련 가이드를 읽는다 (`CLAUDE.md` 참고).
- 서버 컴포넌트를 기본으로 하고, 상태가 필요한 부분(카테고리 선택, 인라인 입력, Notion 저장 버튼, 수집 버튼)만 `"use client"` 컴포넌트로 분리한다.
- 컴포넌트 분리 기준 (제안): `Header`, `CategoryBar`, `CategoryChip`, `AddCategoryButton`, `NewsCard`, `NotionSaveButton`, `FetchNewsButton`, `EmptyState`.
- 카테고리 필터는 URL 쿼리(`?category=<id>`, 미분류는 `?category=none`)로 유지해 새로고침·공유 시에도 같은 화면이 나오게 한다.
