"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { dashboardPathForRole, useAuth } from "@/lib/auth";

/** Sends each signed-in user to the dashboard that matches their role. */
export default function DashboardIndexPage() {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "guest") {
      router.replace("/login/?next=%2Fdashboard%2F");
      return;
    }
    if (status === "authenticated" && user) {
      router.replace(dashboardPathForRole(user.role));
    }
  }, [status, user, router]);

  return (
    <main className="dash-page">
      <p className="dash-state" role="status">
        <Loader2 size={18} className="spin" aria-hidden /> Opening your dashboard…
      </p>
    </main>
  );
}
