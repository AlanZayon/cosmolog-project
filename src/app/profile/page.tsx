"use client";

import { Suspense } from "react";
import ProfilePage from "@/page-components/ProfilePage";
import RouteLoadingFallback from "@/components/loading/RouteLoadingFallback";

export default function Page() {
  return (
    <Suspense fallback={<RouteLoadingFallback variant="profile" />}>
      <ProfilePage />
    </Suspense>
  );
}
