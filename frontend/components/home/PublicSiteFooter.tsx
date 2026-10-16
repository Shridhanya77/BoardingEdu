"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchAllPages, geography, schools } from "@/lib/api";
import type { BoardListItem, CityListItem } from "@/lib/api";
import SiteFooterSeo from "./SiteFooterSeo";

export default function PublicSiteFooter() {
  const pathname = usePathname();
  const [cities, setCities] = useState<CityListItem[]>([]);
  const [boards, setBoards] = useState<BoardListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      geography.cities(),
      schools.boards(),
    ])
      .then(([cityPage, boardPage]) =>
        Promise.all([fetchAllPages(cityPage, 1000), fetchAllPages(boardPage)]),
      )
      .then(([cityRows, boardRows]) => {
        if (cancelled) return;
        setCities(
          cityRows
            .filter((city) => city.status)
            .sort(
              (left, right) =>
                (right.schools_count ?? 0) - (left.schools_count ?? 0) ||
                left.city_name.localeCompare(right.city_name),
            ),
        );
        setBoards(boardRows.filter((board) => board.status));
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Search links are temporarily unavailable.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/parent-dashboard") ||
    pathname.startsWith("/school-dashboard")
  ) {
    return null;
  }

  return <SiteFooterSeo cities={cities} boards={boards} dataError={error} />;
}
