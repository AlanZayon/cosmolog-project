"use client";

import { Suspense } from "react";
import SearchPage from "@/page-components/SearchPage";
import RouteLoadingFallback from "@/components/loading/RouteLoadingFallback";

export default function SearchRoutePage() {
  return (
    <Suspense fallback={<RouteLoadingFallback variant="search" />}>
      <SearchPage />
    </Suspense>
  );
}
