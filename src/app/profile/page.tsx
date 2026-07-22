"use client";

import { Suspense } from "react";
import ProfilePage from "@/page-components/ProfilePage";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ProfilePage />
    </Suspense>
  );
}
