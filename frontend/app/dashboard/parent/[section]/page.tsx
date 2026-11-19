"use client";

import { Suspense } from "react";
import ParentDashboard from "@/components/parent-dashboard/ParentDashboard";
import { ParentOverviewSkeleton } from "@/components/ui/ContentSkeleton";

export default function ParentDashboardSectionPage() {
  return (
    <Suspense fallback={<main className="dash-page"><ParentOverviewSkeleton /></main>}>
      <ParentDashboard />
    </Suspense>
  );
}
