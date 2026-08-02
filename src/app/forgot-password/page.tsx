"use client";

import { Suspense } from "react";
import ForgotPasswordPage from "@/page-components/ForgotPasswordPage";
import AuthRouteLoadingFallback from "@/components/loading/AuthRouteLoadingFallback";

export default function Page() {
  return (
    <Suspense fallback={<AuthRouteLoadingFallback />}>
      <ForgotPasswordPage />
    </Suspense>
  );
}
