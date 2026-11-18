"use client";

import { useEffect, type RefObject } from "react";

export function usePreservedSidebarScroll(
  containerRef: RefObject<HTMLElement | null>,
  storageKey: string,
  routeKey: string,
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const savedPosition = window.sessionStorage.getItem(storageKey);
    const [savedTop, savedLeft] = savedPosition?.split(",").map(Number) ?? [];
    const hasSavedPosition =
      Number.isFinite(savedTop) || Number.isFinite(savedLeft);

    const restorePosition = () => {
      if (Number.isFinite(savedTop)) container.scrollTop = Math.max(0, savedTop);
      if (Number.isFinite(savedLeft)) container.scrollLeft = Math.max(0, savedLeft);
    };

    if (hasSavedPosition) restorePosition();

    const savePosition = () => {
      window.sessionStorage.setItem(
        storageKey,
        `${container.scrollTop},${container.scrollLeft}`,
      );
    };

    container.addEventListener("scroll", savePosition, { passive: true });
    window.addEventListener("pagehide", savePosition);
    const restoreFrame = window.requestAnimationFrame(() => {
      restorePosition();
      savePosition();
    });

    return () => {
      window.cancelAnimationFrame(restoreFrame);
      savePosition();
      container.removeEventListener("scroll", savePosition);
      window.removeEventListener("pagehide", savePosition);
    };
  }, [containerRef, routeKey, storageKey]);
}
