"use client";

import { Suspense } from "react";

import ForgotPasswordPage from "@/page-components/ForgotPasswordPage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      }
    >
      <ForgotPasswordPage />
    </Suspense>
  );
}
