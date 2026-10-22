"use client";

import { useEffect, useRef, useState } from "react";
import { schoolSectionPath, schoolSectionSeo, schoolSections, type SchoolSectionId } from "@/lib/school-sections";

function setHeadMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(selector);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attribute, key);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

export default function SchoolProfileNavigation({
  schoolPath,
  schoolName,
  city,
  overviewDescription,
  initialSection = "overview",
}: {
  schoolPath: string;
  schoolName: string;
  city: string;
  overviewDescription: string;
  initialSection?: SchoolSectionId;
}) {
  const [activeSection, setActiveSection] = useState<SchoolSectionId>(initialSection);
  const clickedSection = useRef<SchoolSectionId | null>(null);

  function applySectionHead(section: SchoolSectionId) {
    const { title, description } = schoolSectionSeo({
      schoolName,
      city,
      section,
      overviewDescription,
    });
    document.title = title;
    setHeadMeta('meta[name="description"]', "name", "description", description);
    setHeadMeta('meta[property="og:title"]', "property", "og:title", title);
    setHeadMeta('meta[property="og:description"]', "property", "og:description", description);
    setHeadMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    setHeadMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
  }

  useEffect(() => {
    applySectionHead(activeSection);
  }, [activeSection, city, overviewDescription, schoolName]);

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
        if (clickedSection.current) return;
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
    clickedSection.current = id;
    window.setTimeout(() => {
      if (clickedSection.current === id) clickedSection.current = null;
    }, 900);
    setActiveSection(id);
    applySectionHead(id);
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
