"use client";

import { Suspense } from "react";
import LibraryPage from "@/page-components/LibraryPage";
import RouteLoadingFallback from "@/components/loading/RouteLoadingFallback";

export default function LibraryRoutePage() {
  return (
    <Suspense fallback={<RouteLoadingFallback variant="library" />}>
      <LibraryPage />
    </Suspense>
  );
}
