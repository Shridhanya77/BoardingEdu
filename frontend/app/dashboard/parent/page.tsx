"use client";

import { Suspense } from "react";
import ParentDashboard from "@/components/parent-dashboard/ParentDashboard";

export default function ParentDashboardPage() {
  return (
    <Suspense fallback={<main className="dash-page"><p className="dash-state">Loading your dashboard…</p></main>}>
      <ParentDashboard />
    </Suspense>
  );
}
