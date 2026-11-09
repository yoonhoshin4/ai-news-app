"use client";

import { useLinkStatus } from "next/link";

// <Link> 안에서만 동작한다. 레이아웃이 흔들리지 않게 크기를 고정하고 투명도만 바꾼다.
export function PendingSpinner() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`ml-1.5 inline-block size-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent transition-opacity ${
        pending ? "opacity-70" : "opacity-0"
      }`}
    />
  );
}
