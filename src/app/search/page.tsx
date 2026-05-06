"use client";

import { Suspense } from "react";
import SearchPage from "@/page-components/SearchPage";

function SearchFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
      Loading
    </div>
  );
}

export default function SearchRoutePage() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchPage />
    </Suspense>
  );
}
