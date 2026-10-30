"use client";

import { useState } from "react";
import type { SchoolDetail } from "@/lib/api";
import {
  BedDouble,
  BookOpen,
  Bus,
  CheckCircle2,
  FlaskConical,
  HeartPulse,
  Monitor,
  ShieldCheck,
  Star,
  Trophy,
  Utensils,
  Waves,
} from "lucide-react";

function facilityAppearance(name: string, category: string) {
  const value = `${name} ${category}`.toLowerCase();
  if (value.includes("librar") || value.includes("book")) return { Icon: BookOpen, tone: "library" };
  if (value.includes("lab")) return { Icon: FlaskConical, tone: "laboratory" };
  if (value.includes("smart class") || value.includes("technology") || value.includes("computer")) {
    return { Icon: Monitor, tone: "technology" };
  }
  if (value.includes("sport") || value.includes("playground")) return { Icon: Trophy, tone: "sports" };
  if (value.includes("swim") || value.includes("pool")) return { Icon: Waves, tone: "aquatic" };
  if (value.includes("hostel") || value.includes("boarding")) return { Icon: BedDouble, tone: "residential" };
  if (value.includes("dining") || value.includes("food") || value.includes("cafeteria")) {
    return { Icon: Utensils, tone: "dining" };
  }
  if (value.includes("medical") || value.includes("health") || value.includes("clinic")) {
    return { Icon: HeartPulse, tone: "medical" };
  }
  if (value.includes("transport") || value.includes("bus")) return { Icon: Bus, tone: "transport" };
  if (value.includes("security") || value.includes("safety")) return { Icon: ShieldCheck, tone: "security" };
  return { Icon: CheckCircle2, tone: "general" };
}

export default function SchoolFacilitiesInteractive({
  facilitiesByCategory,
}: {
  facilitiesByCategory: [string, SchoolDetail["facilities_detail"]][];
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  if (!facilitiesByCategory.length) {
    return <p className="empty-state">Facility details have not been published yet.</p>;
  }

  return (
    <div className="facilities-interactive">
      {facilitiesByCategory.map(([category, list]) => (
        <section className="facilities-interactive__group" key={category}>
          <h3>{category}</h3>
          <ul className="facilities-interactive__grid">
            {list.map((facility) => {
              const { Icon, tone } = facilityAppearance(facility.facility_name, facility.category);
              const expanded = activeId === facility.school_facility_id;
              return (
                <li key={facility.school_facility_id}>
                  <button
                    type="button"
                    className={`facility-tile facility-tile--${tone}${expanded ? " is-active" : ""}`}
                    aria-expanded={expanded}
                    onClick={() =>
                      setActiveId((current) =>
                        current === facility.school_facility_id ? null : facility.school_facility_id,
                      )
                    }
                  >
                    <span className="facility-tile__icon" aria-hidden>
                      <Icon size={22} />
                    </span>
                    <span className="facility-tile__name">{facility.facility_name}</span>
                    {expanded && facility.description && (
                      <p className="facility-tile__detail">{facility.description}</p>
                    )}
                    {expanded && facility.quantity_or_capacity != null && (
                      <p className="facility-tile__meta">Capacity: {facility.quantity_or_capacity}</p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
