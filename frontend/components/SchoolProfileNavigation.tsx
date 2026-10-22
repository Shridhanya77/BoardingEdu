"use client";

import { useEffect, useState } from "react";
import { schoolSectionPath, schoolSections, type SchoolSectionId } from "@/lib/school-sections";

export default function SchoolProfileNavigation({
  schoolPath,
  initialSection = "overview",
}: {
  schoolPath: string;
  initialSection?: SchoolSectionId;
}) {
  const [activeSection, setActiveSection] = useState<SchoolSectionId>(initialSection);

  useEffect(() => {
    const targets = schoolSections
      .map(({ id }) => document.getElementById(id))
      .filter((target): target is HTMLElement => target !== null);
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id as SchoolSectionId);
      },
      { rootMargin: "-150px 0px -65% 0px", threshold: [0, 0.1, 0.35, 0.7] },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  // Deep-linked section URLs (e.g. /…/school/admissions/) scroll into place on load.
  useEffect(() => {
    if (initialSection === "overview") return;
    const target = document.getElementById(initialSection);
    if (!target) return;
    requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
  }, [initialSection]);

  function goToSection(id: SchoolSectionId) {
    setActiveSection(id);
    const nextPath = schoolSectionPath(schoolPath, id);
    if (window.location.pathname !== nextPath) {
      window.history.replaceState(null, "", nextPath);
    }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav className="school-profile-nav" aria-label="School profile sections">
      <div className="school-profile-nav__inner">
        {schoolSections.map(({ id, label }) => (
          <button
            type="button"
            className={activeSection === id ? "is-active" : ""}
            key={id}
            aria-current={activeSection === id ? "location" : undefined}
            onClick={() => goToSection(id)}
          >
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
