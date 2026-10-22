"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchAllPages, geography, schools } from "@/lib/api";
import type {
  BoardListItem,
  CityListItem,
  CountryListItem,
  LocationListItem,
  SchoolTypeListItem,
} from "@/lib/api";
import SiteFooterSeo from "./SiteFooterSeo";

export default function PublicSiteFooter() {
  const pathname = usePathname();
  const [cities, setCities] = useState<CityListItem[]>([]);
  const [boards, setBoards] = useState<BoardListItem[]>([]);
  const [countries, setCountries] = useState<CountryListItem[]>([]);
  const [schoolTypes, setSchoolTypes] = useState<SchoolTypeListItem[]>([]);
  const [locations, setLocations] = useState<LocationListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      geography.cities().then((page) => fetchAllPages(page, 1000)),
      schools.boards().then((page) => fetchAllPages(page)),
      geography.countries().then((page) => fetchAllPages(page)),
      schools.types().then((page) => fetchAllPages(page)),
      geography.locations().then((page) => fetchAllPages(page, 1000)),
    ]).then(([cityResult, boardResult, countryResult, typeResult, locationResult]) => {
      if (cancelled) return;

      if (cityResult.status === "fulfilled") {
        setCities(
          cityResult.value
            .filter((city) => city.status)
            .sort(
              (left, right) =>
                (right.schools_count ?? 0) - (left.schools_count ?? 0) ||
                left.city_name.localeCompare(right.city_name),
            ),
        );
      }

      if (boardResult.status === "fulfilled") {
        setBoards(boardResult.value.filter((board) => board.status));
      }

      if (countryResult.status === "fulfilled") {
        setCountries(countryResult.value.filter((country) => country.status));
      }

      if (typeResult.status === "fulfilled") {
        setSchoolTypes(typeResult.value.filter((type) => type.status));
      }

      if (locationResult.status === "fulfilled") {
        setLocations(locationResult.value.filter((location) => location.status && location.slug));
      }

      const rejected = [cityResult, boardResult, countryResult, typeResult, locationResult].filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );

      if (rejected.length > 0) {
        const reason: unknown = rejected[0]!.reason;
        setError(
          reason instanceof Error ? reason.message : "Search links are temporarily unavailable.",
        );
      } else {
        setError(null);
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

  return (
    <SiteFooterSeo
      cities={cities}
      boards={boards}
      countries={countries}
      schoolTypes={schoolTypes}
      locations={locations}
      dataError={error}
    />
  );
}
