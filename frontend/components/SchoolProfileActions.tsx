"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeftRight, Bookmark, Check, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiErrorMessage, dashboards, schoolDetailToListItem, type SchoolDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useSearchExperience } from "@/lib/search-experience";
import { trackSearchEvent } from "@/lib/search-analytics";
import { useSchoolEnquiry } from "./SchoolEnquiryDialog";

export function SchoolEnquiryButton({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const enquiry = useSchoolEnquiry();

  return (
    <button className={className} type="button" onClick={() => enquiry?.open()}>
      {children}
    </button>
  );
}

export default function SchoolProfileActions({ school }: { school: SchoolDetail }) {
  const router = useRouter();
  const { status, user } = useAuth();
  const { comparedSchools, hydrated, toggleSchool } = useSearchExperience();
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const compared = comparedSchools.some((item) => item.school_id === school.school_id);

  useEffect(() => {
    if (status !== "authenticated" || user?.role !== "PARENT") {
      setSaved(false);
      return;
    }
    let cancelled = false;
    dashboards.shortlistStatus(school.school_id)
      .then((result) => {
        if (!cancelled) setSaved(result.saved);
      })
      .catch(() => {
        if (!cancelled) setSaved(false);
      });
    return () => {
      cancelled = true;
    };
  }, [school.school_id, status, user?.role]);

  async function toggleShortlist() {
    if (status !== "authenticated") {
      const next = `${window.location.pathname}${window.location.search}`;
      router.push(`/login/?next=${encodeURIComponent(next)}`);
      return;
    }
    if (user?.role !== "PARENT") {
      setMessage("Sign in with a parent account to save schools.");
      return;
    }
    setSaving(true);
    try {
      if (saved) {
        await dashboards.removeShortlist(school.school_id);
        setSaved(false);
        setMessage("Removed from your shortlist.");
      } else {
        await dashboards.saveShortlist(school.school_id);
        setSaved(true);
        setMessage("Saved to your parent dashboard.");
      }
    } catch (reason) {
      setMessage(apiErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  function toggleCompare() {
    if (!compared && comparedSchools.length >= 4) {
      setMessage("You can compare up to four schools. Remove one from your comparison first.");
      return;
    }
    toggleSchool(schoolDetailToListItem(school));
    trackSearchEvent("school_compared", { selected: !compared });
    setMessage(compared ? "School removed from comparison." : "School added to comparison.");
    if (!compared) router.push("/compare/");
  }

  async function shareProfile() {
    const shareData = {
      title: school.school_name,
      text: `Explore ${school.school_name} on BoardingEdu.`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setMessage("School profile shared.");
      } else {
        await navigator.clipboard.writeText(shareData.url);
        setMessage("School profile link copied.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("Could not share the link. Copy the page URL from your browser.");
    }
  }

  return (
    <div className="school-detail__extra-actions">
      <button
        className="detail-button"
        type="button"
        onClick={toggleCompare}
        disabled={!hydrated}
        aria-pressed={compared}
      >
        {compared ? <Check size={16} /> : <ArrowLeftRight size={16} />}
        {compared ? "Added to compare" : "Compare"}
      </button>
      <button
        className="detail-button"
        type="button"
        onClick={() => void toggleShortlist()}
        disabled={saving}
        aria-pressed={saved}
      >
        {saved ? <Check size={16} /> : <Bookmark size={16} />}
        {saved ? "Shortlisted" : "Shortlist"}
      </button>
      <button className="detail-button" type="button" onClick={shareProfile}>
        <Share2 size={16} /> Share
      </button>
      <span className="school-detail__action-status" role="status" aria-live="polite">
        {message}
      </span>
    </div>
  );
}
