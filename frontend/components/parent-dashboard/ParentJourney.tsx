"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bookmark, Check, GraduationCap, Search, Send } from "lucide-react";
import { savedSearches, type ParentDashboardData } from "@/lib/api";

type Step = {
  id: string;
  title: string;
  detail: string;
  done: boolean;
  href: string;
  Icon: typeof GraduationCap;
};

export default function ParentJourney({ data }: { data: ParentDashboardData }) {
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    savedSearches.list()
      .then((rows) => {
        if (active) setSavedCount(rows.length);
      })
      .catch(() => {
        if (active) setSavedCount(0);
      });
    return () => {
      active = false;
    };
  }, []);

  const hasChild = data.children.length > 0 || data.stats.children > 0;
  const hasShortlist = data.shortlist.length > 0 || data.stats.shortlisted > 0;
  const hasApplication = data.stats.applications_total > 0 || data.recent_enquiries.length > 0;

  const steps: Step[] = [
    {
      id: "child",
      title: "Add a child",
      detail: "Keep class and date of birth ready for enquiries.",
      done: hasChild,
      href: "/dashboard/parent/students/",
      Icon: GraduationCap,
    },
    {
      id: "shortlist",
      title: "Shortlist schools",
      detail: "Save the schools you want to compare.",
      done: hasShortlist,
      href: hasShortlist ? "/dashboard/parent/shortlist/" : "/dashboard/parent/finder/",
      Icon: Bookmark,
    },
    {
      id: "search",
      title: "Save a search",
      detail: "Get an email when a new matching school is added.",
      done: savedCount !== null && savedCount > 0,
      href: "/dashboard/parent/saved-searches/",
      Icon: Search,
    },
    {
      id: "enquiry",
      title: "Send an enquiry",
      detail: "Ask a shortlisted school about admission.",
      done: hasApplication,
      href: hasApplication ? "/dashboard/parent/applications/" : "/dashboard/parent/finder/",
      Icon: Send,
    },
  ];

  const knownSteps = steps.filter((step) => step.id !== "search" || savedCount !== null);
  const doneCount = knownSteps.filter((step) => step.done).length;
  const next = steps.find((step) => (step.id === "search" && savedCount === null ? false : !step.done));
  const complete = knownSteps.length === steps.length && doneCount === steps.length;

  return (
    <section className="pd-journey" aria-label="Your next steps">
      <header className="pd-journey__head">
        <div>
          <p className="pd-journey__eyebrow">Your next step</p>
          <h2>{complete ? "Your family setup is complete" : next?.title ?? "Continue your school search"}</h2>
          <p>
            {savedCount === null
              ? "Checking the searches saved on this account."
              : complete
                ? "Applications, shortlists, and alerts are ready on this account."
                : `${doneCount} of ${steps.length} steps complete. ${next?.detail ?? ""}`}
          </p>
        </div>
        {next && (
          <Link className="pd-primary-link" href={next.href}>
            Continue
          </Link>
        )}
      </header>
      <ol className="pd-journey__steps">
        {steps.map((step, index) => {
          const pending = step.id === "search" && savedCount === null;
          const state = step.done ? "is-done" : next?.id === step.id ? "is-next" : "";
          return (
            <li key={step.id} className={state}>
              <Link href={step.href} aria-current={next?.id === step.id ? "step" : undefined}>
                <span className="pd-journey__mark" aria-hidden>
                  {step.done ? <Check size={14} /> : pending ? "…" : index + 1}
                </span>
                <step.Icon size={16} aria-hidden />
                <strong>{step.title}</strong>
                <small>{pending ? "Checking saved searches…" : step.detail}</small>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
