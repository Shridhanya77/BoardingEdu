"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { dashboards } from "@/lib/api";
import { readRecentSchoolIds, saveRecentSchoolIds } from "@/lib/recent-schools";

export default function RecentSchoolTracker({ schoolId }: { schoolId: string }) {
  const { status, user } = useAuth();

  useEffect(() => {
    try {
      saveRecentSchoolIds([schoolId, ...readRecentSchoolIds()]);
    } catch (reason) {
      console.error("Could not save this school to recently viewed history.", reason);
    }

    if (status === "authenticated" && user?.role === "PARENT") {
      dashboards.trackRecentlyViewedSchool(schoolId).catch((reason: unknown) => {
        console.error("Could not sync recently viewed school history.", reason);
      });
    }
  }, [schoolId, status, user?.role]);

  return null;
}
