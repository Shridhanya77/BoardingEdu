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
    if (savedPosition) {
      const [top, left] = savedPosition.split(",").map(Number);
      if (Number.isFinite(top)) container.scrollTop = Math.max(0, top);
      if (Number.isFinite(left)) container.scrollLeft = Math.max(0, left);
    }

    const activeItem = container.querySelector<HTMLElement>(activeSelector);
    if (activeItem) {
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
    }

    const savePosition = () => {
      window.sessionStorage.setItem(
        storageKey,
        `${container.scrollTop},${container.scrollLeft}`,
      );
    };

    container.addEventListener("scroll", savePosition, { passive: true });
    window.addEventListener("pagehide", savePosition);
    savePosition();

    return () => {
      savePosition();
      container.removeEventListener("scroll", savePosition);
      window.removeEventListener("pagehide", savePosition);
    };
  }, [activeSelector, containerRef, routeKey, storageKey]);
}
