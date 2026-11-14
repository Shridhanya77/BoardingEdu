"use client";

import { useEffect, useRef, useState } from "react";

export default function AnimatedCount({ value }: { value: number | null }) {
  const elementRef = useRef<HTMLSpanElement>(null);
  const [visibleValue, setVisibleValue] = useState(0);
  const [started, setStarted] = useState(false);
  const formattedValue = (count: number) =>
    count >= 1000
      ? `${(count / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}K`
      : count.toLocaleString("en-IN");

  useEffect(() => {
    if (value === null || started || !elementRef.current) return;
    const element = elementRef.current;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setStarted(true);
        observer.disconnect();
      }
    }, { threshold: 0.4 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [started, value]);

  useEffect(() => {
    if (!started || value === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisibleValue(value);
      return;
    }

    let frame = 0;
    let startTime: number | null = null;
    const duration = 850;
    const animate = (time: number) => {
      if (startTime === null) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setVisibleValue(Math.round(value * eased));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [started, value]);

  return (
    <span ref={elementRef} aria-label={value === null ? "Unavailable" : value.toLocaleString("en-IN")}>
      {value === null ? "—" : formattedValue(visibleValue)}
    </span>
  );
}
