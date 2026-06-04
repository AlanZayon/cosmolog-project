"use client";

import { Suspense } from "react";
import LibraryPage from "@/page-components/LibraryPage";

function LibraryFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
      Loading
    </div>
  );
}

export default function LibraryRoutePage() {
  return (
    <Suspense fallback={<LibraryFallback />}>
      <LibraryPage />
    </Suspense>
  );
}
