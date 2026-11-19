"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  geography,
  schools,
  type BoardListItem,
  type SchoolTypeListItem,
} from "@/lib/api";
import { homeSchoolCategories, toSeoSlug } from "@/lib/seo-slugs";
import {
  boardListingPath,
  placeListingPath,
  schoolDirectoryPath,
  schoolListPath,
  schoolSearchPath,
} from "@/lib/school-urls";
import {
  SEARCH_HISTORY_UPDATED_EVENT,
} from "@/lib/search-palette";
import { trackSearchEvent } from "@/lib/search-analytics";
import SearchCommandPalette from "./SearchCommandPalette";

const RECENT_SEARCHES_KEY = "boardingeu:recent-searches";

function readRecentSearches(): string[] {
  try {
    const stored = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string").slice(0, 6)
      : [];
  } catch {
    return [];
  }
}

export default function GlobalSearchPalette() {
  const router = useRouter();
  const [boards, setBoards] = useState<BoardListItem[]>([]);
  const [schoolTypes, setSchoolTypes] = useState<SchoolTypeListItem[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setRecentSearches(readRecentSearches());
    const refreshHistory = () => setRecentSearches(readRecentSearches());
    window.addEventListener(SEARCH_HISTORY_UPDATED_EVENT, refreshHistory);

    Promise.allSettled([schools.boards(), schools.types()]).then(([boardResult, typeResult]) => {
      if (!active) return;
      const failures: string[] = [];
      if (boardResult.status === "fulfilled") {
        setBoards(boardResult.value.results);
      } else {
        failures.push("school boards");
      }
      if (typeResult.status === "fulfilled") {
        setSchoolTypes(typeResult.value.results);
      } else {
        failures.push("school types");
      }
      if (failures.length) {
        setOptionsError(`Quick filters for ${failures.join(" and ")} are unavailable. You can still search by text.`);
      }
    });

    return () => {
      active = false;
      window.removeEventListener(SEARCH_HISTORY_UPDATED_EVENT, refreshHistory);
    };
  }, []);

  function rememberSearch(query: string) {
    const next = [
      query,
      ...recentSearches.filter((recent) => recent.toLowerCase() !== query.toLowerCase()),
    ].slice(0, 6);
    setRecentSearches(next);
    try {
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    } catch {
      setOptionsError("Recent searches could not be saved on this device.");
    }
  }

  async function search(query: string) {
    rememberSearch(query);
    trackSearchEvent("search_query_submitted", { query_length: query.length }, true);

    const normalizedQuery = toSeoSlug(query);
    const boardSearch = toSeoSlug(query.trim().replace(/\s+(schools?|board)$/i, ""));
    const board = boards.find((item) =>
      [item.board_code, item.slug, item.board_name].some(
        (value) => toSeoSlug(value) === normalizedQuery || toSeoSlug(value) === boardSearch,
      ),
    );
    if (board) {
      router.push(boardListingPath(board.slug));
      return;
    }

    const cityQuery = query.trim()
      .replace(/^(schools?\s+(in|near)\s+)/i, "")
      .replace(/\s+schools?$/i, "");
    try {
      const cityPage = await geography.searchCities(cityQuery);
      const citySlug = toSeoSlug(cityQuery);
      const city = cityPage.results.find(
        (item) => toSeoSlug(item.slug) === citySlug || toSeoSlug(item.city_name) === citySlug,
      );
      if (city) {
        router.push(placeListingPath({
          countrySlug: city.country_slug ?? city.country_name,
          stateSlug: city.state_slug ?? city.state_name,
          citySlug: city.slug,
        }));
        return;
      }
    } catch {
      setOptionsError("Live location matching is unavailable. You can still search by school name.");
    }

    try {
      const schoolPage = await schools.list({ search: query, page_size: 10 });
      const exactSchool = schoolPage.results.find(
        (item) => toSeoSlug(item.school_name) === normalizedQuery || toSeoSlug(item.slug) === normalizedQuery,
      );
      if (exactSchool) {
        router.push(schoolListPath(exactSchool));
        return;
      }
    } catch {
      setOptionsError("Live school matching is unavailable. Showing keyword search results instead.");
    }
    router.push(schoolSearchPath(query));
  }

  function selectBoard(board: BoardListItem) {
    router.push(boardListingPath(board.slug));
  }

  function selectSchoolType(type: SchoolTypeListItem) {
    const category = homeSchoolCategories(type.type_code, type.slug, type.type_name)[0];
    if (category) {
      router.push(schoolDirectoryPath(category));
      return;
    }
    const params = new URLSearchParams({ school_type: type.school_type_id });
    router.push(`${schoolDirectoryPath()}?${params.toString()}`);
  }

  return (
    <SearchCommandPalette
      boards={boards}
      schoolTypes={schoolTypes}
      recentSearches={recentSearches}
      optionsError={optionsError}
      onSearch={search}
      onBoard={selectBoard}
      onSchoolType={selectSchoolType}
    />
  );
}
