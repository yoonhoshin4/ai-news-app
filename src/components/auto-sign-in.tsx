"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";

// 서버가 로그아웃 상태로 판단했을 때만 렌더되며,
// 로그인 모달을 자동으로 열고, 로그인이 끝나면 서버 컴포넌트를 다시 렌더링한다.
export function AutoSignIn() {
  const clerk = useClerk();
  const router = useRouter();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    if (!clerk.loaded || clerk.session) return;
    try {
      // 거부되더라도(예: 다른 탭에서 방금 로그인) 무시한다.
      Promise.resolve(clerk.openSignIn()).catch(() => {});
    } catch {}
  }, [clerk, clerk.loaded, clerk.session]);

  // 모달에서 로그인하면 서버가 새 쿠키로 로그인 화면을 다시 그리게 한다.
  useEffect(() => {
    if (isSignedIn) router.refresh();
  }, [isSignedIn, router]);

  return null;
}
