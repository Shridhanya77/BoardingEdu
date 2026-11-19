"use client";

import { useState } from "react";
import { Bookmark, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiErrorMessage, dashboards } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

export default function SchoolShortlistButton({
  schoolId,
  schoolName,
  className,
  label = "Save",
}: {
  schoolId: string;
  schoolName: string;
  className: string;
  label?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { status, user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (status !== "authenticated") {
      const next = `${window.location.pathname}${window.location.search}`;
      router.push(`/login/?next=${encodeURIComponent(next)}`);
      return;
    }
    if (user?.role !== "PARENT") {
      toast("Sign in with a parent account to save schools.", "warn");
      return;
    }
    setBusy(true);
    try {
      if (saved) {
        await dashboards.removeShortlist(schoolId);
        setSaved(false);
        toast(`${schoolName} removed from your shortlist.`, "info");
      } else {
        await dashboards.saveShortlist(schoolId);
        setSaved(true);
        toast(`${schoolName} saved to your shortlist.`, "success");
      }
    } catch (reason) {
      toast(apiErrorMessage(reason), "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className={className}
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${schoolName} from shortlist` : `Save ${schoolName} to shortlist`}
    >
      {saved ? <Check size={15} aria-hidden /> : <Bookmark size={15} aria-hidden />}
      {label}
    </button>
  );
}
