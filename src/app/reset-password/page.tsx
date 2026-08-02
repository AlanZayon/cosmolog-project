"use client";

import { Suspense } from "react";
import ResetPasswordPage from "@/page-components/ResetPasswordPage";
import AuthRouteLoadingFallback from "@/components/loading/AuthRouteLoadingFallback";

export default function Page() {
  return (
    <Suspense fallback={<AuthRouteLoadingFallback />}>
      <ResetPasswordPage />
    </Suspense>
  );
}
