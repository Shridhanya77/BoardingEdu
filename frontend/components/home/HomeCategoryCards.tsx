"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BedDouble, SunMedium } from "lucide-react";
import { schools } from "@/lib/api";
import { schoolDirectoryPath } from "@/lib/school-urls";

function formatCount(value: number | null) {
  if (value == null) return "Browse schools";
  return `${new Intl.NumberFormat("en-IN").format(value)} schools`;
}

export default function HomeCategoryCards() {
  const [dayCount, setDayCount] = useState<number | null>(null);
  const [boardingCount, setBoardingCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      schools.list({ home_category: "day-school", page_size: 1, status: true }),
      schools.list({ home_category: "residential-school", page_size: 1, status: true }),
    ]).then(([day, boarding]) => {
      if (!active) return;
      setDayCount(typeof day.count === "number" ? day.count : null);
      setBoardingCount(typeof boarding.count === "number" ? boarding.count : null);
    }).catch(() => {
      if (!active) return;
      setDayCount(null);
      setBoardingCount(null);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="home-categories" aria-labelledby="home-categories-title">
      <div className="home-section__heading">
        <div>
          <div className="section-eyebrow">EXPLORE</div>
          <h2 id="home-categories-title">Explore schools by category</h2>
        </div>
      </div>
      <div className="home-categories__grid">
        <Link href={schoolDirectoryPath("day-school")}>
          <SunMedium size={22} aria-hidden />
          <strong>Day schools</strong>
          <span>{formatCount(dayCount)}</span>
        </Link>
        <Link href={schoolDirectoryPath("residential-school")}>
          <BedDouble size={22} aria-hidden />
          <strong>Boarding schools</strong>
          <span>{formatCount(boardingCount)}</span>
        </Link>
      </div>
    </section>
  );
}
