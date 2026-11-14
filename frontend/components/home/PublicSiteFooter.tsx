"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchAllPages, geography, schools } from "@/lib/api";
import type {
  BoardListItem,
  CityListItem,
  CountryListItem,
  LocationListItem,
} from "@/lib/api";
import { isSchoolProfileSegmentPath } from "@/lib/school-profile-route";
import SiteFooterSeo from "./SiteFooterSeo";

export default function PublicSiteFooter() {
  const pathname = usePathname();
  const schoolSegments = pathname.split("/").filter(Boolean);
  const schoolPathWithoutEnquiry =
    schoolSegments.at(-1)?.toLowerCase() === "enquiry"
      ? schoolSegments.slice(0, -1)
      : schoolSegments;
  const lastSchoolSegment = schoolPathWithoutEnquiry.at(-1)?.toLowerCase().replace(/_/g, "-");
  const isSchoolListingCategory = [
    "boarding-school",
    "boarding-schools",
    "day-school",
    "day-schools",
    "day-boarding-school",
    "day-boarding-schools",
    "residential-school",
    "residential-schools",
  ].includes(lastSchoolSegment ?? "");
  const isLegacyTypedSchoolProfile =
    schoolPathWithoutEnquiry.length === 6 &&
    isSchoolProfileSegmentPath(schoolPathWithoutEnquiry);
  const isSchoolDetailPage =
    isSchoolProfileSegmentPath(schoolPathWithoutEnquiry) &&
    (!isSchoolListingCategory || isLegacyTypedSchoolProfile);
  const showCallbackDock = !isSchoolDetailPage;
  const [cities, setCities] = useState<CityListItem[]>([]);
  const [boards, setBoards] = useState<BoardListItem[]>([]);
  const [countries, setCountries] = useState<CountryListItem[]>([]);
  const [locations, setLocations] = useState<LocationListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    Promise.allSettled([
      geography.cities().then((page) => fetchAllPages(page, 1000)),
      schools.boards().then((page) => fetchAllPages(page)),
      geography.countries().then((page) => fetchAllPages(page)),
      geography.locations().then((page) => fetchAllPages(page, 1000)),
    ]).then(([cityResult, boardResult, countryResult, locationResult]) => {
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
        const activeBoards = boardResult.value.filter((board) => board.status);
        setBoards(activeBoards);
      }

      if (countryResult.status === "fulfilled") {
        setCountries(countryResult.value.filter((country) => country.status));
      }

      if (locationResult.status === "fulfilled") {
        setLocations(locationResult.value.filter((location) => location.status && location.slug));
      }

      const rejected = [
        cityResult,
        boardResult,
        countryResult,
        locationResult,
      ].filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );

      if (rejected.length > 0) {
        const reason: unknown = rejected[0]!.reason;
        setError(
          reason instanceof Error ? reason.message : "Search links are temporarily unavailable.",
        );
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
      locations={locations}
      dataError={error}
      showCallbackDock={showCallbackDock}
    />
  );
}
