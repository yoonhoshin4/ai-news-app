import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { articles, categories } from "./schema";
import { ensureDefaultCategories } from "./seed";

// 사용법: node --env-file=.env.local --experimental-strip-types src/db/seed-samples.ts <clerkUserId>
// 가상의 샘플 기사입니다. (userId, url) 유니크라 여러 번 실행해도 중복되지 않습니다.
const SAMPLES = [
  {
    sourceName: "TechCrunch AI",
    originalTitle: "OpenAI unveils faster reasoning model for enterprise customers",
    author: "Maya Collins",
    titleKo: "OpenAI, 기업 고객용 더 빠른 추론 모델 공개",
    summaryKo:
      "새 모델은 기존 대비 응답 속도를 크게 높이면서 복잡한 추론 정확도를 유지했다고 한다. 기업용 API와 보안 옵션을 우선 제공하며 다음 달부터 단계적으로 확대한다.",
    url: "https://techcrunch.com/2026/11/06/openai-faster-reasoning-model-sample",
    publishedAt: new Date("2026-11-06T09:00:00Z"),
    category: "모델/제품",
  },
  {
    sourceName: "The Verge AI",
    originalTitle:
      "Researchers show small language models can match larger ones on math benchmarks",
    author: null,
    titleKo: "소형 언어 모델, 수학 벤치마크에서 대형 모델에 필적",
    summaryKo:
      "연구진은 파라미터 수가 훨씬 적은 모델도 추론 과정을 단계별로 학습시키면 수학 문제에서 대형 모델과 비슷한 성능을 낸다고 밝혔다. 추론 비용을 줄일 수 있는 결과로 평가된다.",
    url: "https://www.theverge.com/2026/11/5/small-language-models-math-benchmarks-sample",
    publishedAt: new Date("2026-11-05T14:30:00Z"),
    category: "연구",
  },
  {
    sourceName: "TechCrunch AI",
    originalTitle:
      "AI infrastructure startup raises $400M to build regional data centers",
    author: "Daniel Reyes",
    titleKo: "AI 인프라 스타트업, 지역 데이터센터 구축에 4억 달러 투자 유치",
    summaryKo:
      "데이터센터 부족 문제를 풀겠다며 지역 거점형 시설을 짓는 스타트업이 대규모 투자를 받았다. 전력 효율과 낮은 지연 시간을 내세워 기업 고객을 확보할 계획이다.",
    url: "https://techcrunch.com/2026/11/05/ai-infrastructure-startup-raises-400m-sample",
    publishedAt: new Date("2026-11-05T11:15:00Z"),
    category: "기업/투자",
  },
  {
    sourceName: "The Verge AI",
    originalTitle: "EU finalizes labeling rules for AI-generated content",
    author: "Priya Nair",
    titleKo: "EU, AI 생성 콘텐츠 표시 의무 규정 확정",
    summaryKo:
      "EU가 AI로 만든 이미지·영상·텍스트에 출처 표시를 의무화하는 세부 규정을 확정했다. 위반 시 과징금이 부과되며 기업들은 내년까지 대응 체계를 갖춰야 한다.",
    url: "https://www.theverge.com/2026/11/4/eu-ai-content-labeling-rules-sample",
    publishedAt: new Date("2026-11-04T16:45:00Z"),
    category: "정책/규제",
  },
  {
    sourceName: "TechCrunch AI",
    originalTitle:
      "Open-source toolkit lets developers run AI agents fully on-device",
    author: "Tom Becker",
    titleKo: "개발자가 AI 에이전트를 기기 안에서 완전히 실행하게 해 주는 오픈소스 툴킷",
    summaryKo:
      "클라우드 연결 없이 노트북과 스마트폰에서 AI 에이전트를 돌릴 수 있는 툴킷이 공개됐다. 개인정보 보호와 오프라인 사용을 강조하며 코드는 오픈소스 라이선스로 배포된다.",
    url: "https://techcrunch.com/2026/11/03/open-source-on-device-ai-agents-sample",
    publishedAt: new Date("2026-11-03T08:20:00Z"),
    category: "도구/오픈소스",
  },
];

async function main() {
  const userId = process.argv[2];
  if (!userId) throw new Error("사용법: seed-samples.ts <clerkUserId>");

  await ensureDefaultCategories(userId);

  let inserted = 0;
  for (const { category, ...a } of SAMPLES) {
    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.name, category)));
    const res = await db
      .insert(articles)
      .values({ ...a, userId, categoryId: cat?.id ?? null })
      .onConflictDoNothing()
      .returning({ id: articles.id });
    inserted += res.length;
  }
  console.log(`기사 ${inserted}건 저장 (이미 있던 ${SAMPLES.length - inserted}건 건너뜀)`);
}

main();
