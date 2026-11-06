import { Suspense } from "react";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Suspense fallback={null}>
        <SignUp />
      </Suspense>
    </main>
  );
}
