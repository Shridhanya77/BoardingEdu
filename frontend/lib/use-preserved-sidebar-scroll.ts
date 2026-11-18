"use client";

import { useEffect, type RefObject } from "react";

export function usePreservedSidebarScroll(
  containerRef: RefObject<HTMLElement | null>,
  storageKey: string,
  routeKey: string,
  activeSelector = '[aria-current="page"], .is-active',
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

    const keepActiveItemVisible = () => {
      const activeItem = container.querySelector<HTMLElement>(activeSelector);
      if (!activeItem) return;

      const containerRect = container.getBoundingClientRect();
      const activeRect = activeItem.getBoundingClientRect();
      if (activeRect.top < containerRect.top) {
        container.scrollTop += activeRect.top - containerRect.top;
      } else if (activeRect.bottom > containerRect.bottom) {
        container.scrollTop += activeRect.bottom - containerRect.bottom;
      }
      if (activeRect.left < containerRect.left) {
        container.scrollLeft += activeRect.left - containerRect.left;
      } else if (activeRect.right > containerRect.right) {
        container.scrollLeft += activeRect.right - containerRect.right;
      }
    };

    if (hasSavedPosition) restorePosition();
    else keepActiveItemVisible();

    const savePosition = () => {
      window.sessionStorage.setItem(
        storageKey,
        `${container.scrollTop},${container.scrollLeft}`,
      );
    };

    container.addEventListener("scroll", savePosition, { passive: true });
    window.addEventListener("pagehide", savePosition);
    const restoreFrame = window.requestAnimationFrame(() => {
      if (hasSavedPosition) restorePosition();
      else keepActiveItemVisible();
      savePosition();
    });

    return () => {
      window.cancelAnimationFrame(restoreFrame);
      savePosition();
      container.removeEventListener("scroll", savePosition);
      window.removeEventListener("pagehide", savePosition);
    };
  }, [activeSelector, containerRef, routeKey, storageKey]);
}
