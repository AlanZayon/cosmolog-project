"use client";

import { Suspense } from "react";
import LoginPage from "@/page-components/LoginPage";
import AuthRouteLoadingFallback from "@/components/loading/AuthRouteLoadingFallback";

export default function Page() {
  return (
    <Suspense fallback={<AuthRouteLoadingFallback />}>
      <LoginPage />
    </Suspense>
  );
}
