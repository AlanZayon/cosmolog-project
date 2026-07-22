"use client";

import { Suspense } from "react";

import ResetPasswordPage from "@/page-components/ResetPasswordPage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      }
    >
      <ResetPasswordPage />
    </Suspense>
  );
}
