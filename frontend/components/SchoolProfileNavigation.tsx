"use client";

import { useEffect, useState } from "react";

const sections = [
  { id: "overview", label: "Overview" },
  { id: "fees", label: "Fees" },
  { id: "admissions", label: "Admissions" },
  { id: "facilities", label: "Facilities" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "media", label: "Photos & Videos" },
  { id: "reviews", label: "Reviews" },
  { id: "location", label: "Location" },
];

export default function SchoolProfileNavigation() {
  const [activeSection, setActiveSection] = useState("overview");

  useEffect(() => {
    const targets = sections
      .map(({ id }) => document.getElementById(id))
      .filter((target): target is HTMLElement => target !== null);
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-150px 0px -65% 0px", threshold: [0, 0.1, 0.35, 0.7] },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="school-profile-nav" aria-label="School profile sections">
      <div className="school-profile-nav__inner">
        {sections.map(({ id, label }) => (
          <button
            type="button"
            className={activeSection === id ? "is-active" : ""}
            key={id}
            aria-current={activeSection === id ? "location" : undefined}
            onClick={() => {
              setActiveSection(id);
              document.getElementById(id)?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
