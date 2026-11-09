import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SignInButton } from "@clerk/nextjs";
import { AutoSignIn } from "@/components/auto-sign-in";

// 서버에서 쿠키로 로그인 여부를 판단한다. (쿠키를 읽으므로 Suspense 안에서 렌더)
async function HomeContent() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <>
        <AutoSignIn />
        <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
          <h1 className="text-3xl font-semibold">AI 뉴스 수집기</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            해외 AI 뉴스를 한국어로 요약해 보여드립니다. 로그인 후 이용할 수 있습니다.
          </p>
          <SignInButton mode="modal">
            <button className="h-12 rounded-full bg-foreground px-6 font-medium text-background">
              로그인
            </button>
          </SignInButton>
        </main>
      </>
    );
  }

  // 로그인된 사용자는 대시보드로 이동
  redirect("/dashboard");
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
