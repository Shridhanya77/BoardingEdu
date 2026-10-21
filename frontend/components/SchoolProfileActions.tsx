"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeftRight, Check, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { SchoolDetail } from "@/lib/api";
import { schoolDetailToListItem } from "@/lib/api";
import { useSearchExperience } from "@/lib/search-experience";
import { trackSearchEvent } from "@/lib/search-analytics";

export function SchoolEnquiryButton({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <button
      className={className}
      type="button"
      onClick={() => document.getElementById("school-enquiry")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })}
    >
      {children}
    </button>
  );
}

export default function SchoolProfileActions({ school }: { school: SchoolDetail }) {
  const router = useRouter();
  const { comparedSchools, hydrated, toggleSchool } = useSearchExperience();
  const [message, setMessage] = useState("");
  const compared = comparedSchools.some((item) => item.school_id === school.school_id);

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
      <button className="detail-button" type="button" onClick={shareProfile}>
        <Share2 size={16} /> Share
      </button>
      <span className="school-detail__action-status" role="status" aria-live="polite">
        {message}
      </span>
    </div>
  );
}
