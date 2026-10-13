"use client";

import {
  ArrowDownUp,
  ArrowRight,
  Building2,
  CheckCircle2,
  GraduationCap,
  Heart,
  LoaderCircle,
  MapPin,
  Newspaper,
  Search,
  SearchCheck,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { fetchAllPages, geography, schools } from "@/lib/api";
import type {
  BoardListItem,
  SchoolFilters,
  SchoolListItem,
  SchoolTypeListItem,
} from "@/lib/api";
import FeeRangeSlider from "@/components/search/FeeRangeSlider";
import SearchCommandPalette from "@/components/search/SearchCommandPalette";
import CompareBar from "@/components/search/CompareBar";
import HeroFinder, { type HeroFinderValue } from "@/components/home/HeroFinder";
import {
  createLocationPreferences,
  isBoardingOnlySelection,
  normalizeLocationPreferences,
  type LocationPreferences,
} from "@/lib/location-preferences";
import {
  exploreItems,
  faqItems,
  howItWorksSteps,
} from "@/lib/home-content";
import { useSearchExperience } from "@/lib/search-experience";
import { trackSearchEvent } from "@/lib/search-analytics";

function schoolHref(school: SchoolListItem) {
  return `/${school.country_slug}/${school.state_slug}/${school.city_slug}/${school.slug}`;
}

const genderOptions: {
  label: string;
  value: SchoolFilters["gender"];
}[] = [
  { label: "Any", value: undefined },
  { label: "Co-ed", value: "COED" },
  { label: "Boys", value: "BOYS" },
  { label: "Girls", value: "GIRLS" },
];

const orderingOptions: Record<
  string,
  NonNullable<SchoolFilters["ordering"]>
> = {
  school_name: "school_name",
  "-school_name": "-school_name",
  established_year: "established_year",
  "-established_year": "-established_year",
  annual_fee: "annual_fee",
  "-annual_fee": "-annual_fee",
};

function formatRupees(value: number) {
  return `₹${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

async function currentLocationPreferences(
  preferences: LocationPreferences,
): Promise<LocationPreferences> {
  const countries = await fetchAllPages(await geography.countries());
  const activeCountryIds = new Set(
    countries.filter((country) => country.status).map((country) => country.country_id),
  );
  const validatedCountries = await Promise.all(
    preferences.countries
      .filter((item) => activeCountryIds.has(item.country_id))
      .map(async (item) => {
        const states = await fetchAllPages(await geography.statesOf(item.country_id));
        const activeStateIds = new Set(
          states
            .filter((state) => state.status && state.country_id === item.country_id)
            .map((state) => state.state_id),
        );
        return {
          country_id: item.country_id,
          state_ids: item.state_ids.filter((id) => activeStateIds.has(id)),
        };
      }),
  );
  return createLocationPreferences(validatedCountries);
}

function SchoolCard({ school }: { school: SchoolListItem }) {
  const {
    comparedSchools,
    limitReached,
    toggleSchool,
  } = useSearchExperience();
  const isCompared = comparedSchools.some(
    (item) => item.school_id === school.school_id
  );
  const location = [school.city_name, school.state_name]
    .filter(Boolean)
    .join(", ");

  const href = schoolHref(school);

  return (
    <article className="school-card">
      <Link
        className="school-card__cover-link"
        href={href}
        aria-label={`View details for ${school.school_name}`}
      />
      <div className="school-card__top">
        <div className="school-card__avatar" aria-hidden="true">
          <Building2 size={23} strokeWidth={1.7} />
        </div>

        <div className="school-card__title">
          <div className="school-card__eyebrow">
            {school.verification_status?.toLowerCase() === "verified" && (
              <span className="verified-tag">
                <CheckCircle2 size={13} />
                Verified
              </span>
            )}

            {school.established_year && (
              <span>Est. {school.established_year}</span>
            )}
          </div>

          <h3>{school.school_name}</h3>

          <p className="school-card__location">
            <MapPin size={14} />
            {location || "Location not listed"}
          </p>
        </div>
      </div>

      <div className="school-card__tags">
        {school.school_types_detail.map((type) => (
          <span className="school-tag" key={type.school_type_id}>
            {type.type_name}
          </span>
        ))}

        {school.boards_detail.map((item) => (
          <span className="school-tag school-tag--blue" key={item.board_id}>
            {item.board_name}
          </span>
        ))}

        {school.gender && (
          <span className="school-tag school-tag--plain">
            {school.gender}
          </span>
        )}
        {school.annual_fee != null && (
          <span className="school-tag school-tag--fee">
            From {formatRupees(Number(school.annual_fee))} / year
          </span>
        )}
      </div>

      <div className="school-card__footer">
        <p>
          {school.address || "Contact the school for address details."}
        </p>

        <div className="school-card__actions">
          <label className="school-compare">
            <input
              type="checkbox"
              checked={isCompared}
              disabled={limitReached && !isCompared}
              title={
                comparedSchools.length >= 3 && !isCompared
                  ? "Remove a school from comparison before adding another."
                  : undefined
              }
              onChange={() => {
                toggleSchool(school);
                trackSearchEvent("school_compared", {
                  selected: !isCompared,
                });
              }}
            />
            Compare
          </label>
          <Link href={href}>View school</Link>

          {school.phone && (
            <a href={`tel:${school.phone}`}>Call school</a>
          )}

          {school.email && (
            <a
              className="school-card__email"
              href={`mailto:${school.email}`}
              aria-label={`Email ${school.school_name}`}
            >
              <ArrowRight size={16} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export default function SchoolDiscovery() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [schoolType, setSchoolType] = useState<string[]>([]);
  const [schoolTypes, setSchoolTypes] = useState<SchoolTypeListItem[]>([]);
  const [boards, setBoards] = useState<BoardListItem[]>([]);
  const [schoolTypesError, setSchoolTypesError] = useState<string | null>(
    null
  );
  const [boardsError, setBoardsError] = useState<string | null>(null);
  const [board, setBoard] = useState<string[]>([]);
  const [feeRange, setFeeRange] = useState<[number, number]>([
    0,
    3_000_000,
  ]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<SchoolListItem[]>([]);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  void suggestions;
  void suggestionsError;
  void activeSuggestion;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [queryRestored, setQueryRestored] = useState(false);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const filtersPanelRef = useRef<HTMLElement>(null);
  const [gender, setGender] = useState<SchoolFilters["gender"]>();
  const [ordering, setOrdering] =
    useState<SchoolFilters["ordering"]>("school_name");
  const [results, setResults] = useState<SchoolListItem[]>([]);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [featuredSchools, setFeaturedSchools] = useState<SchoolListItem[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState<string | null>(null);
  const [geoCountry, setGeoCountry] = useState("");
  const [geoState, setGeoState] = useState("");
  const [geoCity, setGeoCity] = useState("");
  const [geoLocation, setGeoLocation] = useState("");
  const [locationPreferences, setLocationPreferences] =
    useState<LocationPreferences | null>(null);
  const [locationPreferencesLoaded, setLocationPreferencesLoaded] = useState(false);
  const [locationGroups, setLocationGroups] = useState<string[]>([]);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const locationRestoreApplied = useRef(false);
  const initialLocationWasInUrl = useRef(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  const feeMin = feeRange[0] === 0 ? undefined : feeRange[0];
  const feeMax = feeRange[1] === 3_000_000 ? undefined : feeRange[1];
  const queryKey = `${search}|${geoCountry}|${geoState}|${geoCity}|${geoLocation}|${locationGroups.join(";")}|${schoolType.join(",")}|${board.join(",")}|${feeMin ?? ""}|${feeMax ?? ""}|${gender ?? ""}|${ordering ?? ""}`;

  const activeQuery = useRef(queryKey);
  activeQuery.current = queryKey;

  const boardCards = [
    "CBSE",
    "ICSE",
    "IB",
    "IGCSE",
  ].map((code) => ({
    code,
    board: boards.find((item) => item.board_code.toUpperCase() === code),
  }));
  const cityCards = useMemo(() => {
    const uniqueCities = new Map<string, SchoolListItem>();
    for (const school of [...featuredSchools, ...results]) {
      if (school.city_id && !uniqueCities.has(school.city_id)) {
        uniqueCities.set(school.city_id, school);
      }
    }
    return [...uniqueCities.values()].slice(0, 6);
  }, [featuredSchools, results]);

  const whyBoardingEdu = [
    "Verified school profiles",
    "Transparent fees",
    "Side-by-side comparison",
    "Expert guidance",
    "Application support",
    "Pan-India coverage",
  ];

  useEffect(() => {
    if (!queryRestored) return;
    let cancelled = false;

    const filters: SchoolFilters = {
      search: search || undefined,
      country: locationGroups.length ? undefined : geoCountry || undefined,
      state: locationGroups.length ? undefined : geoState || undefined,
      city: locationGroups.length ? undefined : geoCity || undefined,
      location: locationGroups.length ? undefined : geoLocation || undefined,
      location_group: locationGroups,
      school_type: schoolType,
      board,
      min_fee: feeMin,
      max_fee: feeMax,
      gender,
      ordering,
    };

    activeQuery.current = queryKey;
    setLoading(true);
    setError(null);
    setLoadingMore(false);

    schools
      .list(filters)
      .then((response) => {
        if (cancelled) return;

        setResults(response.results);
        setNextPage(response.next);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;

        setResults([]);
        setNextPage(null);

        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load schools."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queryRestored, search, geoCountry, geoState, geoCity, geoLocation, locationGroups, schoolType, board, feeMin, feeMax, gender, ordering, queryKey, retryCount]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    initialLocationWasInUrl.current = [
      "country",
      "state",
      "city",
      "location",
      "location_group",
    ].some((key) => params.has(key));
    const initialSearch = params.get("search") ?? "";
    setSearch(initialSearch);
    setSearchInput(initialSearch);
    setBoard(params.getAll("board"));
    setSchoolType(params.getAll("school_type"));
    setGeoCountry(params.get("country") ?? "");
    setGeoState(params.get("state") ?? "");
    setGeoCity(params.get("city") ?? "");
    setGeoLocation(params.get("location") ?? "");
    setLocationGroups(params.getAll("location_group"));
    setGender(
      (params.get("gender") as SchoolFilters["gender"]) || undefined
    );
    setOrdering(
      (params.get("ordering") as SchoolFilters["ordering"]) || "school_name"
    );
    const min = Number(params.get("min_fee") ?? 0);
    const max = Number(params.get("max_fee") ?? 3_000_000);
    if (Number.isFinite(min) && Number.isFinite(max) && min < max) {
      setFeeRange([min, max]);
    }
    try {
      const recent = JSON.parse(
        window.localStorage.getItem("boardingeu:recent-searches") ?? "[]"
      ) as unknown;
      if (
        Array.isArray(recent) &&
        recent.every((value) => typeof value === "string")
      ) {
        setRecentSearches(recent.slice(0, 6));
      }
    } catch {
      setRecentSearches([]);
    }
    setQueryRestored(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/location-preferences", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Saved locations could not be loaded.");
        }
        return (await response.json()) as unknown;
      })
      .then((value) => {
        const preferences = normalizeLocationPreferences(value);
        if (!preferences) {
          throw new Error("Saved locations have an unsupported format.");
        }
        if (!cancelled) {
          setLocationPreferences(preferences);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setLocationError(
            reason instanceof Error
              ? reason.message
              : "Saved locations could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLocationPreferencesLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!queryRestored) return;
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    locationGroups.forEach((group) => params.append("location_group", group));
    if (locationGroups.length === 0) {
      if (geoCountry) params.set("country", geoCountry);
      if (geoState) params.set("state", geoState);
      if (geoCity) params.set("city", geoCity);
      if (geoLocation) params.set("location", geoLocation);
    }
    board.forEach((id) => params.append("board", id));
    schoolType.forEach((id) => params.append("school_type", id));
    if (feeMin !== undefined) params.set("min_fee", String(feeMin));
    if (feeMax !== undefined) params.set("max_fee", String(feeMax));
    if (gender) params.set("gender", gender);
    if (ordering && ordering !== "school_name") {
      params.set("ordering", ordering);
    }
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`
    );
  }, [queryRestored, search, geoCountry, geoState, geoCity, geoLocation, locationGroups, board, schoolType, feeMin, feeMax, gender, ordering]);

  useEffect(() => {
    const normalized = searchInput.trim();
    if (normalized.length < 2) {
      setSuggestions([]);
      setSuggestionsError(null);
      setActiveSuggestion(-1);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      schools
        .list({ search: normalized, ordering: "school_name" })
        .then((response) => {
          if (!cancelled) {
            setSuggestions(response.results.slice(0, 5));
            setSuggestionsError(null);
            setActiveSuggestion(-1);
          }
        })
        .catch((reason: unknown) => {
          if (!cancelled) {
            setSuggestions([]);
            setSuggestionsError(
              reason instanceof Error
                ? reason.message
                : "Could not load search suggestions."
            );
          }
        });
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    if (!filtersOpen) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = filterTriggerRef.current;
    document.body.style.overflow = "hidden";
    filtersPanelRef.current?.focus();
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeFilters();
    }
    document.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onEscape);
      trigger?.focus();
    };
  }, [filtersOpen]);

  useEffect(() => {
    let cancelled = false;

    schools
      .types()
      .then((response) => {
        if (!cancelled) {
          setSchoolTypes(
            response.results.filter((type) => type.status)
          );
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setSchoolTypesError(
            reason instanceof Error
              ? reason.message
              : "Could not load school types."
          );
        }
      })
      .finally(() => {
      });

    schools
      .boards()
      .then((response) => {
        if (!cancelled) {
          setBoards(
            response.results.filter((item) => item.status)
          );
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setBoardsError(
            reason instanceof Error
              ? reason.message
              : "Could not load education boards."
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      !queryRestored ||
      !locationPreferencesLoaded ||
      !locationPreferences ||
      locationRestoreApplied.current
    ) {
      return;
    }

    locationRestoreApplied.current = true;
    let cancelled = false;
    currentLocationPreferences(locationPreferences)
      .then(async (validated) => {
        if (cancelled) return;
        const changed =
          JSON.stringify(validated.countries) !==
          JSON.stringify(locationPreferences.countries);
        if (changed) {
          const response = await fetch("/api/location-preferences", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(validated),
          });
          if (!response.ok) {
            throw new Error("Could not update outdated saved locations.");
          }
        }
        setLocationPreferences(validated);
        if (!initialLocationWasInUrl.current && validated.countries.length > 0) {
          const savedLocation = validated.countries[0];
          setLocationGroups([]);
          setGeoCountry(savedLocation.country_id);
          setGeoState(savedLocation.state_ids[0] ?? "");
          setGeoCity("");
          setGeoLocation("");
          setLocationMessage("Your saved location preference was restored.");
        } else if (changed) {
          setLocationMessage("Unavailable saved locations were removed.");
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setLocationError(
            reason instanceof Error
              ? reason.message
              : "Saved locations could not be validated.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [locationPreferences, locationPreferencesLoaded, queryRestored]);

  useEffect(() => {
    let cancelled = false;

    schools
      .list({ ordering: "school_name" })
      .then((response) => {
        if (cancelled) return;

        setFeaturedSchools(response.results.slice(0, 4));
        setFeaturedError(null);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setFeaturedError(
            reason instanceof Error
              ? reason.message
              : "Could not load featured schools."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setFeaturedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchInput.trim();
    setSearch(query);
    setSuggestions([]);
    rememberSearch(query);
    trackSearchEvent(
      "search_query_submitted",
      { query_length: query.length },
      true
    );
  }

  function rememberSearch(query: string) {
    if (!query) return;
    const nextSearches = [
      query,
      ...recentSearches.filter(
        (recent) => recent.toLowerCase() !== query.toLowerCase()
      ),
    ].slice(0, 6);
    setRecentSearches(nextSearches);
    try {
      window.localStorage.setItem(
        "boardingeu:recent-searches",
        JSON.stringify(nextSearches)
      );
    } catch {
      setError("Recent searches could not be saved on this device.");
    }
  }

  function closeFilters() {
    setFiltersOpen(false);
  }

  function selectSuggestion(school: SchoolListItem) {
    trackSearchEvent("search_autocomplete_selected", {
      school_id: school.school_id,
    });
    rememberSearch(school.school_name);
    router.push(schoolHref(school));
  }

  function clearFilters() {
    trackSearchEvent("filter_cleared", { filters: "all" });
    setSearchInput("");
    setSearch("");
    setSchoolType([]);
    setBoard([]);
    setGeoCountry("");
    setGeoState("");
    setGeoCity("");
    setGeoLocation("");
    setFeeRange([0, 3_000_000]);
    setGender(undefined);
    setOrdering("school_name");
  }

  async function loadMore() {
    if (!nextPage || loadingMore) return;

    const requestedQuery = queryKey;

    setLoadingMore(true);
    setError(null);

    try {
      const response = await schools.page(nextPage);

      if (activeQuery.current !== requestedQuery) return;

      setResults((current) => [...current, ...response.results]);
      setNextPage(response.next);
    } catch (reason: unknown) {
      if (activeQuery.current === requestedQuery) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load more schools."
        );
      }
    } finally {
      if (activeQuery.current === requestedQuery) {
        setLoadingMore(false);
      }
    }
  }

  const hasFilters = Boolean(
    search || geoCountry || geoState || geoCity || geoLocation || locationGroups.length > 0 || schoolType.length > 0 || board.length > 0 || gender || ordering !== "school_name"
      || feeMin !== undefined || feeMax !== undefined
  );

  function scrollToSchools() {
    document.getElementById("schools")?.scrollIntoView({ behavior: "smooth" });
  }

  function searchFor(query: string) {
    setSearchInput(query);
    setSearch(query);
    rememberSearch(query);
    trackSearchEvent("search_query_submitted", { query_length: query.length }, true);
    setBoard([]);
    setSchoolType([]);
    setFeeRange([0, 3_000_000]);
    setGender(undefined);
  }

  function selectBoard(selectedBoard: BoardListItem) {
    setBoard([selectedBoard.board_id]);
    setSearchInput("");
    setSearch("");
    setSchoolType([]);
    setFeeRange([0, 3_000_000]);
    setGender(undefined);
  }

  function selectSchoolType(selectedType: SchoolTypeListItem) {
    setSchoolType([selectedType.school_type_id]);
    setSearchInput("");
    setSearch("");
    setBoard([]);
    setFeeRange([0, 3_000_000]);
    setGender(undefined);
    if (
      isBoardingOnlySelection([selectedType.school_type_id], schoolTypes) &&
      (geoCity || geoLocation)
    ) {
      setGeoCity("");
      setGeoLocation("");
      setLocationGroups([]);
    }
  }

  function finderValue(): HeroFinderValue {
    return {
      country: geoCountry,
      state: geoState,
      city: geoCity,
      location: geoLocation,
      board,
      schoolType,
    };
  }

  function handleFinderChange(next: HeroFinderValue) {
    setBoard(next.board);
    const locationChanged =
      next.country !== geoCountry ||
      next.state !== geoState ||
      next.city !== geoCity ||
      next.location !== geoLocation;
    const boardingOnly = isBoardingOnlySelection(next.schoolType, schoolTypes);
    setSchoolType(next.schoolType);
    setGeoCountry(next.country);
    setGeoState(next.state);
    setGeoCity(boardingOnly ? "" : next.city);
    setGeoLocation(boardingOnly ? "" : next.location);
    if (locationChanged) setLocationGroups([]);
  }

  async function saveCurrentLocationPreference() {
    if (!geoCountry) return;

    setLocationMessage(null);
    setLocationError(null);
    try {
      const payload = createLocationPreferences([
        {
          country_id: geoCountry,
          state_ids: geoState ? [geoState] : [],
        },
      ]);
      const response = await fetch("/api/location-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Could not save your location.");
      }
      setLocationPreferences(payload);
      setLocationGroups([]);
      setLocationMessage("Your country and state preference has been saved.");
    } catch (reason: unknown) {
      setLocationError(
        reason instanceof Error
          ? reason.message
          : "Could not save your location preference.",
      );
    }
  }

  async function handleFinderSubmit() {
    trackSearchEvent("search_query_submitted", { query_length: 0 }, true);
    await saveCurrentLocationPreference();
    scrollToSchools();
  }

  function handleExplore(query: (typeof exploreItems)[number]["query"]) {
    if (!query) return;
    const matchBoard = (code: string) =>
      boards.find((item) => item.board_code.toUpperCase() === code);
    const matchType = (needle: string) =>
      schoolTypes.find(
        (item) =>
          item.slug.includes(needle) ||
          item.type_name.toLowerCase().includes(needle)
      );

    if (query === "boarding") {
      const type = matchType("boarding") ?? matchType("full-boarding");
      if (type) selectSchoolType(type);
      else searchFor("Boarding");
    } else if (query === "day") {
      const type = matchType("day");
      if (type) selectSchoolType(type);
      else searchFor("Day school");
    } else if (query === "cbse") {
      const item = matchBoard("CBSE");
      if (item) selectBoard(item);
      else searchFor("CBSE");
    } else if (query === "ib") {
      const item = matchBoard("IB");
      if (item) selectBoard(item);
      else searchFor("IB");
    } else if (query === "icse") {
      const item = matchBoard("ICSE");
      if (item) selectBoard(item);
      else searchFor("ICSE");
    } else if (query === "igcse") {
      const item = matchBoard("IGCSE");
      if (item) selectBoard(item);
      else searchFor("IGCSE");
    } else if (query === "girls") {
      setGender("GIRLS");
      const type = matchType("boarding");
      if (type) setSchoolType([type.school_type_id]);
      setSearch("");
      setSearchInput("");
    } else if (query === "boys") {
      setGender("BOYS");
      const type = matchType("boarding");
      if (type) setSchoolType([type.school_type_id]);
      setSearch("");
      setSearchInput("");
    } else if (query === "india") {
      searchFor("India");
    } else if (query === "sainik") {
      searchFor("Sainik");
    }
    scrollToSchools();
  }

  void submitSearch;
  void selectSuggestion;
  void handleExplore;

  return (
    <main className="discovery-page">
      <section className="hero">
        <div className="hero__copy">
          <div className="hero__kicker">
            <span className="hero__pulse" />
            MADE FOR YOUR SCHOOL SEARCH
          </div>

          <h1>
            Find the Right School <span>for Your Child</span>
          </h1>

          <p>
            Discover schools, compare fees and facilities, shortlist
            favourites, and connect with schools—all in one place.
          </p>

          <HeroFinder
            value={finderValue()}
            boards={boards}
            schoolTypes={schoolTypes}
            locationMessage={locationMessage}
            locationError={locationError}
            onChange={handleFinderChange}
            onSubmit={() => void handleFinderSubmit()}
          />

          <div className="hero-search__shortcuts">
            <button
              type="button"
              onClick={() => {
                document.dispatchEvent(
                  new KeyboardEvent("keydown", {
                    key: "k",
                    ctrlKey: true,
                    bubbles: true,
                  })
                );
              }}
              aria-label="Open search commands"
            >
              <kbd>Ctrl</kbd> + <kbd>K</kbd> Search commands
            </button>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="hero-art__sun" />
          <div className="hero-art__orbit hero-art__orbit--one" />
          <div className="hero-art__orbit hero-art__orbit--two" />

          <div className="hero-art__card">
            <div className="hero-art__building">
              <div className="building-roof" />
              <div className="building-body">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <div className="building-door" />
              </div>
            </div>

            <span className="hero-art__label">
              A brighter future, together
            </span>
          </div>

          <span className="hero-art__spark hero-art__spark--one">✳</span>
          <span className="hero-art__spark hero-art__spark--two">✳</span>
          <span className="hero-art__dot" />
        </div>

        <a className="hero-scroll" href="#schools">
          <span /> Scroll to explore
        </a>
      </section>

      <section className="home-section home-section--steps" id="how-it-works">
        <div className="home-section__heading home-section__heading--centered">
          <div>
            <div className="section-eyebrow">HOW IT WORKS</div>
            <h2>Simple steps to your ideal school</h2>
          </div>
        </div>

        <div className="how-it-works-grid">
          {howItWorksSteps.map((step, index) => (
            <article className="how-step" key={step.title}>
              <div className="how-step__number">0{index + 1}</div>

              <div className="how-step__icon">
                {index === 0 && <Search size={18} />}
                {index === 1 && <SlidersHorizontal size={18} />}
                {index === 2 && <CheckCircle2 size={18} />}
                {index === 3 && <ArrowRight size={18} />}
              </div>

              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-section--cities" id="cities">
        <div className="home-section__heading">
          <div>
            <div className="section-eyebrow">SCHOOL LOCATIONS</div>
            <h2>Cities in the directory</h2>
          </div>

          <a href="#schools">
            Explore all cities <ArrowRight size={15} />
          </a>
        </div>

        <div className="city-grid">
          {cityCards.map((school, index) => (
            <button
              className={`city-card city-card--${index + 1}`}
              key={school.city_id}
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setBoard([]);
                setSchoolType([]);
                setLocationGroups([]);
                setGeoCountry(school.country_id);
                setGeoState(school.state_id);
                setGeoCity(school.city_id);
                setGeoLocation("");
                scrollToSchools();
              }}
            >
              <span className="city-card__number">0{index + 1}</span>
              <span className="city-card__name">{school.city_name}</span>
              <span className="city-card__state">{school.state_name}</span>
              <span className="city-card__action">
                Explore schools <ArrowRight size={14} />
              </span>
            </button>
          ))}
          {cityCards.length === 0 && (
            <p className="section-empty">
              School locations will appear here when listings are available.
            </p>
          )}
        </div>
      </section>

      <section className="home-section home-section--boards" id="boards">
        <div className="home-section__heading">
          <div>
            <div className="section-eyebrow">EXPLORE CURRICULA</div>
            <h2>Browse by board</h2>
          </div>

          {boardsError && (
            <p className="section-error" role="status">
              Board options unavailable: {boardsError}
            </p>
          )}
        </div>

        <div className="board-grid">
          {boardCards.map(({ code, board: boardItem }, index) => (
            <button
              className={`board-card board-card--${index + 1}`}
              key={code}
              onClick={() =>
                boardItem ? selectBoard(boardItem) : searchFor(code)
              }
            >
              <span className="board-card__mark">{code}</span>

              <span className="board-card__name">
                {boardItem?.board_name ??
                  (code === "IGCSE"
                    ? "International General Certificate of Secondary Education"
                    : `${code} curriculum`)}
              </span>

              <span className="board-card__action">
                {boardItem ? "Browse schools" : "Search directory"}{" "}
                <ArrowRight size={14} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="home-section home-section--featured" id="featured">
        <div className="home-section__heading">
          <div>
            <div className="section-eyebrow">A FEW PLACES TO BEGIN</div>
            <h2>Featured schools</h2>
          </div>

          <a href="#schools">
            Browse the directory <ArrowRight size={15} />
          </a>
        </div>

        {featuredLoading ? (
          <div className="featured-state" role="status">
            <LoaderCircle className="spin" size={20} />
            Loading schools…
          </div>
        ) : featuredError ? (
          <div className="featured-state featured-state--error" role="alert">
            {featuredError}
          </div>
        ) : featuredSchools.length > 0 ? (
          <div
            className="featured-school-row"
            role="region"
            aria-label="Featured schools"
          >
            {featuredSchools.map((school) => (
              <SchoolCard key={school.school_id} school={school} />
            ))}
          </div>
        ) : (
          <p className="section-empty">
            Featured schools will appear here when the directory has published
            listings.
          </p>
        )}
      </section>

      <section
        className="home-section home-section--testimonials"
        id="parent-stories"
      >
        <div className="home-section__heading">
          <div>
            <div className="section-eyebrow">TRUST, EARNED</div>
            <h2>Parent testimonials</h2>
          </div>

          <span className="coming-soon-label">
            <Heart size={14} /> Coming soon
          </span>
        </div>

        <div
          className="coming-soon-grid"
          aria-label="Parent testimonials are coming soon"
        >
          {[1, 2, 3].map((item) => (
            <article className="coming-soon-card" key={item}>
              <div className="coming-soon-card__icon">
                <Users size={19} />
              </div>
              <span>Parent stories</span>
              <p>
                We’ll share verified experiences from families once reviews are
                available.
              </p>
              <div className="coming-soon-card__rule" />
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-section--blog" id="blog">
        <div className="home-section__heading">
          <div>
            <div className="section-eyebrow">FROM THE BLOG</div>
            <h2>Latest school guides</h2>
          </div>

          <span className="coming-soon-label">
            <Newspaper size={14} /> Coming soon
          </span>
        </div>

        <div
          className="coming-soon-grid coming-soon-grid--blog"
          aria-label="Blog articles are coming soon"
        >
          {[
            "Boarding school admissions",
            "Choosing an education board",
            "Planning a school visit",
          ].map((title) => (
            <article className="blog-placeholder" key={title}>
              <span className="blog-placeholder__icon">
                <Newspaper size={19} />
              </span>
              <span className="blog-placeholder__tag">SCHOOL GUIDE</span>
              <h3>{title}</h3>
              <p>Practical guides from BoardingEdu are on the way.</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-section--benefits" id="about">
        <div className="home-section__heading home-section__heading--centered">
          <div>
            <div className="section-eyebrow">WHY BOARDINGEDU</div>
            <h2>Everything parents need to choose with confidence</h2>
          </div>
        </div>

        <div className="benefit-grid">
          {whyBoardingEdu.map((benefit, index) => (
            <article className="benefit-card" key={benefit}>
              <span className="benefit-card__icon">
                {index === 0 && <Building2 size={18} />}
                {index === 1 && <ShieldCheck size={18} />}
                {index === 2 && <SearchCheck size={18} />}
                {index === 3 && <CheckCircle2 size={18} />}
                {index === 4 && <ArrowRight size={18} />}
                {index === 5 && <Users size={18} />}
              </span>

              <h3>{benefit}</h3>
            </article>
          ))}
        </div>
      </section>

      <section
        className="home-section home-section--school-cta"
        id="for-schools"
      >
        <div className="school-cta">
          <div>
            <div className="section-eyebrow section-eyebrow--light">
              FOR SCHOOLS
            </div>
            <h2>Are You a School?</h2>
            <p>
              Showcase your school, connect with parents, and manage admission
              enquiries through BoardingEdu.
            </p>
          </div>

          <div className="school-cta__actions">
            <Link href="/signup" className="primary-button">
              List Your School
            </Link>
            <Link href="#schools" className="secondary-button">
              Learn More
            </Link>
          </div>
        </div>
      </section>

      <section className="home-section home-section--final-cta">
        <div className="final-cta">
          <div>
            <div className="section-eyebrow">START YOUR SEARCH</div>
            <h2>Ready to Find the Right School?</h2>
          </div>

          <div className="final-cta__actions">
            <Link href="#schools" className="primary-button">
              Find Schools
            </Link>
            <Link
              href="/signup"
              className="secondary-button secondary-button--light"
            >
              Create Parent Account
            </Link>
          </div>
        </div>
      </section>

      <section className="home-section home-section--faq" id="faq">
        <div className="home-section__heading home-section__heading--centered">
          <div>
            <div className="section-eyebrow">FAQ</div>
            <h2>Common questions</h2>
          </div>
        </div>

        <div className="faq-list">
          {faqItems.map((item, index) => {
            const open = activeFaq === index;

            return (
              <div
                className={`faq-item ${open ? "faq-item--open" : ""}`}
                key={item.question}
              >
                <button
                  type="button"
                  className="faq-question"
                  onClick={() => setActiveFaq(open ? null : index)}
                >
                  <span>{item.question}</span>
                  <span className="faq-toggle">{open ? "−" : "+"}</span>
                </button>

                {open && <p className="faq-answer">{item.answer}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <div className="site-footer__brand">
            <div className="brand brand--footer">
              <Image
                className="brand__image"
                src="/BoardingEdu_LOGO.jpeg"
                alt="BoardingEdu"
                width={56}
                height={56}
              />
            </div>
            <div className="site-footer__title">BoardingEdu</div>
          </div>

          <div className="site-footer__links">
            <div>
              <h3>Explore</h3>
              <Link href="#schools">Find Schools</Link>
              <Link href="#schools">Compare Schools</Link>
              <Link href="#schools">Shortlist</Link>
            </div>

            <div>
              <h3>Company</h3>
              <Link href="#for-schools">For Schools</Link>
              <Link href="#about">About Us</Link>
              <Link href="#faq">FAQs</Link>
            </div>

            <div>
              <h3>Legal</h3>
              <Link href="#">Privacy Policy</Link>
              <Link href="#">Terms & Conditions</Link>
              <Link href="#">Contact</Link>
            </div>
          </div>

          <div className="site-footer__socials" aria-label="Social media links">
            <span>f</span>
            <span>in</span>
            <span>◎</span>
          </div>
        </div>
      </footer>

      <section className="newsletter" id="newsletter">
        <div className="newsletter__copy">
          <div className="section-eyebrow">STAY IN THE LOOP</div>
          <h2>School search, made a little easier.</h2>
          <p>Newsletter subscriptions will be available here soon.</p>
        </div>

        <span className="newsletter__status">
          <CheckCircle2 size={17} /> Newsletter signup coming soon
        </span>
      </section>

      <section className="discovery-content" id="schools">
        <div className="section-heading">
          <div>
            <div className="section-eyebrow">EXPLORE THE DIRECTORY</div>
            <h2>Schools to start your search</h2>
            <p>
              Search, filter, and compare the school details that matter to
              your family.
            </p>
          </div>

          <div className="results-count" aria-live="polite">
            {loading
              ? "Finding schools…"
              : `${results.length} ${
                  results.length === 1 ? "school" : "schools"
                } shown`}
          </div>
        </div>

        <div className="results-layout">
          {filtersOpen && (
            <button
              className="filters-backdrop"
              type="button"
              aria-label="Close filters"
              onClick={closeFilters}
            />
          )}
          <aside
            ref={filtersPanelRef}
            className={`filters-panel${filtersOpen ? " filters-panel--open" : ""}`}
            aria-label="School filters"
            aria-modal={filtersOpen || undefined}
            role={filtersOpen ? "dialog" : undefined}
            tabIndex={filtersOpen ? -1 : undefined}
          >
            <div className="filters-panel__heading">
              <div>
                <SlidersHorizontal size={17} />
                <h3>Refine your search</h3>
              </div>

              {hasFilters && (
                <button type="button" onClick={clearFilters}>
                  Clear all
                </button>
              )}
              <button
                className="filters-panel__close"
                type="button"
                onClick={closeFilters}
                aria-label="Close filters"
              >
                <X size={18} />
              </button>
            </div>

            <fieldset className="filter-group">
              <legend>School type</legend>
              <div className="filter-checklist" id="school-type-filter">
                {schoolTypes.map((type) => (
                  <label className="filter-check" key={type.school_type_id}>
                    <input
                      type="checkbox"
                      checked={schoolType.includes(type.school_type_id)}
                      onChange={() => {
                        const selected = !schoolType.includes(type.school_type_id);
                        setSchoolType((current) =>
                          selected
                            ? [...current, type.school_type_id]
                            : current.filter((id) => id !== type.school_type_id)
                        );
                        trackSearchEvent("filter_applied", {
                          filter_type: "school_type",
                          selected,
                        });
                      }}
                    />
                    <span>{type.type_name}</span>
                  </label>
                ))}
              </div>

              {schoolTypesError && (
                <p className="filter-error" role="alert">
                  School type filters unavailable: {schoolTypesError}
                </p>
              )}
            </fieldset>

            <fieldset className="filter-group">
              <legend>Education board</legend>
              <div className="filter-checklist" id="board-filter">
                {boards.map((item) => (
                  <label className="filter-check" key={item.board_id}>
                    <input
                      type="checkbox"
                      checked={board.includes(item.board_id)}
                      onChange={() => {
                        const selected = !board.includes(item.board_id);
                        setBoard((current) =>
                          selected
                            ? [...current, item.board_id]
                            : current.filter((id) => id !== item.board_id)
                        );
                        trackSearchEvent("filter_applied", {
                          filter_type: "board",
                          selected,
                        });
                      }}
                    />
                    <span>{item.board_name}</span>
                  </label>
                ))}
              </div>
              {boardsError && (
                <p className="filter-error" role="alert">
                  Education board filters unavailable: {boardsError}
                </p>
              )}
            </fieldset>

            <fieldset className="filter-group">
              <legend>Annual fee</legend>
              <p className="filter-select-label">
                Published fee details for the current academic year
              </p>
              <FeeRangeSlider
                value={feeRange}
                onValueCommit={(next) => {
                  setFeeRange(next);
                  trackSearchEvent("filter_applied", {
                    filter_type: "fees",
                    values: [`${next[0]}-${next[1]}`],
                  });
                }}
              />
            </fieldset>

            <fieldset className="filter-group">
              <legend>Student community</legend>

              <div className="gender-options">
                {genderOptions.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className={
                      gender === option.value
                        ? "gender-option gender-option--active"
                        : "gender-option"
                    }
                    aria-pressed={gender === option.value}
                    onClick={() => {
                      setGender(option.value);
                      trackSearchEvent("filter_applied", {
                        filter_type: "gender",
                        selected: option.value ?? "all",
                      });
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="filter-note">
              <span className="filter-note__icon">
                <CheckCircle2 size={16} />
              </span>
              <p>
                School information is provided by the school directory.
                Contact schools directly to confirm current details.
              </p>
            </div>
            <div className="filters-panel__apply">
              <button type="button" onClick={closeFilters}>
                Show {results.length} {results.length === 1 ? "school" : "schools"}
              </button>
            </div>
          </aside>

          <div className="school-results">
            <div className="school-results__toolbar">
              <button
                ref={filterTriggerRef}
                className="mobile-filter-trigger"
                type="button"
                onClick={() => setFiltersOpen(true)}
                aria-haspopup="dialog"
              >
                <SlidersHorizontal size={15} />
                Filters
                {(board.length + schoolType.length + (gender ? 1 : 0) +
                  (feeMin !== undefined || feeMax !== undefined ? 1 : 0)) > 0 && (
                  <span className="mobile-filter-trigger__count">
                    {board.length + schoolType.length + (gender ? 1 : 0) +
                      (feeMin !== undefined || feeMax !== undefined ? 1 : 0)}
                  </span>
                )}
              </button>
              <div className="school-results__label">
                <span className="school-results__icon">
                  <Building2 size={16} />
                </span>
                <span>Schools</span>
              </div>

              <label className="sort-control">
                <ArrowDownUp size={14} />
                <span className="sr-only">Sort schools</span>

                <select
                  value={ordering}
                  onChange={(event) => {
                    const selected = orderingOptions[event.target.value];
                    if (selected) setOrdering(selected);
                  }}
                  aria-label="Sort schools"
                >
                  <option value="school_name">Name: A to Z</option>
                  <option value="-school_name">Name: Z to A</option>
                  <option value="-established_year">
                    Newest established
                  </option>
                  <option value="established_year">
                    Oldest established
                  </option>
                  <option value="annual_fee">Annual fees: low to high</option>
                  <option value="-annual_fee">Annual fees: high to low</option>
                </select>
              </label>
            </div>

            {error && (
              <div
                className="state-panel state-panel--error"
                role="alert"
              >
                <h3>We couldn’t load schools</h3>
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => setRetryCount((count) => count + 1)}
                >
                  Try again
                </button>
              </div>
            )}

            {loading && (
              <div className="school-list school-list--skeleton" role="status">
                <span className="sr-only">Finding schools for you…</span>
                {Array.from({ length: 4 }, (_, index) => (
                  <article className="school-skeleton" key={index}>
                    <span />
                    <div>
                      <span />
                      <span />
                      <span />
                    </div>
                  </article>
                ))}
              </div>
            )}

            {!loading && !error && results.length === 0 && (
              <div className="state-panel state-panel--empty">
                <Search size={25} />
                <h3>No schools found</h3>
                <p>
                  {search
                    ? `No schools matched “${search}”. Try a city or shorter search.`
                    : "Your selected filters do not match any schools. Remove a filter to broaden the results."}
                </p>
                <button type="button" onClick={clearFilters}>
                  {search ? "Clear search and filters" : "Clear filters"}
                </button>
              </div>
            )}

            {!loading && !error && results.length > 0 && (
              <>
                <div className="school-list">
                  {results.map((school) => (
                    <SchoolCard
                      key={school.school_id}
                      school={school}
                    />
                  ))}
                </div>

                {nextPage && (
                  <button
                    className="load-more"
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <LoaderCircle className="spin" size={17} />
                        Loading…
                      </>
                    ) : (
                      <>
                        Load more schools <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <SearchCommandPalette
        boards={boards}
        schoolTypes={schoolTypes}
        recentSearches={recentSearches}
        onSearch={searchFor}
        onBoard={selectBoard}
        onSchoolType={selectSchoolType}
      />
      {!filtersOpen && <CompareBar />}

      {/* A second how-it-works section; renamed its ID to avoid duplicate IDs. */}
      <section className="how-it-works" id="how-it-works-steps">
        <div className="how-it-works__intro">
          <div className="section-eyebrow">A LITTLE LESS OVERWHELMING</div>
          <h2>Three steps to a more confident choice.</h2>
        </div>

        <div className="how-it-works__steps">
          <article>
            <span>01</span>
            <h3>Explore</h3>
            <p>Search the directory by school, city, or education board.</p>
          </article>

          <article>
            <span>02</span>
            <h3>Find your fit</h3>
            <p>
              Filter by school type and student community to narrow your
              options.
            </p>
          </article>

          <article>
            <span>03</span>
            <h3>Reach out</h3>
            <p>
              Review the school details and contact the school directly.
            </p>
          </article>
        </div>
      </section>

      <section className="why-boardingedu" id="why-boardingedu">
        <div className="why-boardingedu__heading">
          <div className="section-eyebrow">A CLEARER WAY TO CHOOSE</div>
          <h2>Everything you need to make a confident start.</h2>
          <p>
            Useful school information and practical tools, without making the
            search feel overwhelming.
          </p>
        </div>

        <div className="why-boardingedu__grid">
          <article>
            <span>
              <ShieldCheck size={20} />
            </span>
            <h3>School profiles</h3>
            <p>
              See school type, board, location, and verification details
              together in one profile.
            </p>
          </article>

          <article>
            <span>
              <SlidersHorizontal size={20} />
            </span>
            <h3>Search your way</h3>
            <p>
              Narrow the directory by school type and student community, then
              sort to explore.
            </p>
          </article>

          <article>
            <span>
              <GraduationCap size={20} />
            </span>
            <h3>Connect directly</h3>
            <p>
              Use the listed phone number or email to ask the school about
              current admissions.
            </p>
          </article>
        </div>
      </section>

      {/* Kept the second footer's existing content. */}
      <footer className="site-footer site-footer--compact">
        <Link className="brand brand--footer" href="/" aria-label="BoardingEdu home">
          <Image
            className="brand__image"
            src="/BoardingEdu_LOGO.jpeg"
            alt="BoardingEdu"
            width={1024}
            height={1024}
          />
        </Link>

        <div className="site-footer__links">
          <Link href="#cities">Cities</Link>
          <Link href="#boards">Boards</Link>
          <Link href="#schools">Schools</Link>
          <Link href="#parent-stories">Parent stories</Link>
          <Link href="#blog">Blog</Link>
        </div>

        <span className="site-footer__meta">
          Social and legal links coming soon
        </span>

        <p>Helping every family find a place to belong.</p>
      </footer>
    </main>
  );
}