"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Building2,
  Compass,
  GraduationCap,
  HeartHandshake,
  House,
  Map,
  Menu,
  MessageSquare,
  MessagesSquare,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";

/** Height of the sticky site header (`.site-header--sticky`). */
const HEADER_OFFSET = 72;
/** Extra breathing room so a targeted heading clears the sticky header. */
const SCROLL_GAP = 18;

type RailSection = {
  id: string;
  label: string;
  icon: LucideIcon;
};

/**
 * Candidate homepage sections, declared in document order.
 * Sections that are not present in the DOM are dropped at runtime, so the rail
 * never links to content that does not exist on the page.
 */
const SECTION_CANDIDATES: RailSection[] = [
  { id: "explore", label: "Home", icon: House },
  { id: "how-it-works", label: "How It Works", icon: Compass },
  { id: "compare-schools", label: "Compare Schools", icon: BarChart3 },
  { id: "states", label: "Browse by State", icon: Map },
  { id: "cities", label: "Browse by City", icon: Building2 },
  { id: "boards", label: "Browse by Board", icon: GraduationCap },
  { id: "featured", label: "Featured Schools", icon: Star },
  { id: "counselling", label: "Counselling", icon: HeartHandshake },
  { id: "faq", label: "FAQs", icon: MessageSquare },
  { id: "home-reviews", label: "Parent Reviews", icon: MessagesSquare },
];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Floating vertical icon rail for the homepage. Only the active section shows
 * its label; the icon expands into a pill. Scroll position is tracked with an
 * IntersectionObserver and clicking an icon smooth-scrolls to its section.
 */
export default function SectionRail() {
  const [sections, setSections] = useState<RailSection[]>(SECTION_CANDIDATES);
  const [activeId, setActiveId] = useState<string>(SECTION_CANDIDATES[0].id);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sectionsRef = useRef<RailSection[]>(SECTION_CANDIDATES);
  const activeIdRef = useRef<string>(SECTION_CANDIDATES[0].id);
  // While a click-initiated scroll is in flight we ignore observer updates so
  // the clicked item stays highlighted instead of flashing through sections.
  const pendingTargetRef = useRef<string | null>(null);
  const pendingTimerRef = useRef<number | null>(null);

  const highlight = useCallback((id: string) => {
    if (activeIdRef.current === id) return;
    activeIdRef.current = id;
    setActiveId(id);
  }, []);

  const clearPending = useCallback(() => {
    pendingTargetRef.current = null;
    if (pendingTimerRef.current !== null) {
      window.clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
  }, []);

  const scrollToSection = useCallback(
    (id: string) => {
      const element = document.getElementById(id);
      if (!element) return;

      pendingTargetRef.current = id;
      if (pendingTimerRef.current !== null) window.clearTimeout(pendingTimerRef.current);
      // Safety net in case the target never reports as intersecting.
      pendingTimerRef.current = window.setTimeout(clearPending, 1200);

      highlight(id);

      const top =
        element.getBoundingClientRect().top +
        window.scrollY -
        (HEADER_OFFSET + SCROLL_GAP);
      window.scrollTo({
        top: Math.max(top, 0),
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
      setMobileOpen(false);
    },
    [clearPending, highlight],
  );

  useEffect(() => {
    const intersecting = new Set<string>();
    const observed = new WeakSet<Element>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) intersecting.add(entry.target.id);
          else intersecting.delete(entry.target.id);
        }

        if (pendingTargetRef.current) {
          if (intersecting.has(pendingTargetRef.current)) clearPending();
          return;
        }

        const firstVisible = sectionsRef.current.find((section) =>
          intersecting.has(section.id),
        );
        if (firstVisible) highlight(firstVisible.id);
      },
      {
        // Thin band just below the sticky header: the section crossing it wins.
        rootMargin: `-${HEADER_OFFSET + 12}px 0px -78% 0px`,
        threshold: 0,
      },
    );

    let rafId = 0;

    const reconcile = () => {
      const present = SECTION_CANDIDATES.filter(
        (section) => document.getElementById(section.id) !== null,
      );

      for (const section of present) {
        const element = document.getElementById(section.id);
        if (element && !observed.has(element)) {
          observed.add(element);
          observer.observe(element);
        }
      }

      const current = sectionsRef.current;
      const changed =
        present.length !== current.length ||
        present.some((section, index) => section.id !== current[index]?.id);
      if (changed) {
        sectionsRef.current = present;
        setSections(present);
      }

      if (!present.some((section) => section.id === activeIdRef.current)) {
        const first = present[0];
        if (first) highlight(first.id);
      }
    };

    const scheduleReconcile = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        reconcile();
      });
    };

    reconcile();

    // Sections such as states/cities mount after their data loads.
    const mutation = new MutationObserver(scheduleReconcile);
    mutation.observe(document.body, { childList: true, subtree: true });

    const onScroll = () => {
      if (pendingTargetRef.current) return;
      const list = sectionsRef.current;
      if (!list.length) return;

      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;
      if (!atBottom) return;

      const last = list[list.length - 1];
      const element = document.getElementById(last.id);
      if (element && element.getBoundingClientRect().top < window.innerHeight) {
        highlight(last.id);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // Any manual scroll abandons a pending click-scroll lock.
    window.addEventListener("wheel", clearPending, { passive: true });
    window.addEventListener("touchstart", clearPending, { passive: true });

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      observer.disconnect();
      mutation.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", clearPending);
      window.removeEventListener("touchstart", clearPending);
    };
  }, [clearPending, highlight]);

  return (
    <>
      <nav className="section-rail" aria-label="Homepage sections">
        <ul>
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = section.id === activeId;
            return (
              <li key={section.id}>
                <button
                  type="button"
                  className={`section-rail__item${isActive ? " is-active" : ""}`}
                  onClick={() => scrollToSection(section.id)}
                  aria-current={isActive ? "location" : undefined}
                  aria-label={section.label}
                  title={section.label}
                >
                  <span className="section-rail__icon">
                    <Icon size={18} aria-hidden />
                  </span>
                  <span className="section-rail__label">{section.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={`section-rail-mobile${mobileOpen ? " is-open" : ""}`}>
        {mobileOpen && (
          <button
            type="button"
            className="section-rail-mobile__backdrop"
            aria-label="Close section navigation"
            onClick={() => setMobileOpen(false)}
          />
        )}
        {mobileOpen && (
          <nav
            className="section-rail-mobile__panel"
            id="section-rail-mobile-panel"
            aria-label="Homepage sections"
          >
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === activeId;
              return (
                <button
                  type="button"
                  key={section.id}
                  className={`section-rail-mobile__item${isActive ? " is-active" : ""}`}
                  onClick={() => scrollToSection(section.id)}
                  aria-current={isActive ? "location" : undefined}
                >
                  <Icon size={17} aria-hidden />
                  {section.label}
                </button>
              );
            })}
          </nav>
        )}
        <button
          type="button"
          className="section-rail-mobile__toggle"
          aria-expanded={mobileOpen}
          aria-controls="section-rail-mobile-panel"
          aria-label={mobileOpen ? "Close section navigation" : "Open section navigation"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
        </button>
      </div>
    </>
  );
}
