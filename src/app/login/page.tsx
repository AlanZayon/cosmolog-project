"use client";

import { Suspense } from "react";

import LoginPage from "@/page-components/LoginPage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
