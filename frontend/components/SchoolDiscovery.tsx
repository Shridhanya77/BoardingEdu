"use client";

import {
  ArrowDownUp,
  ArrowRight,
  Building2,
  CheckCircle2,
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
import { usePathname, useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { fetchAllPages, geography, schools } from "@/lib/api";
import type {
  BoardListItem,
  CityListItem,
  SchoolFilters,
  SchoolListItem,
  SchoolTypeListItem,
} from "@/lib/api";
import FeeRangeSlider from "@/components/search/FeeRangeSlider";
import SearchCommandPalette from "@/components/search/SearchCommandPalette";
import CompareBar from "@/components/search/CompareBar";
import HeroFinder, { type HeroFinderValue } from "@/components/home/HeroFinder";
import CounsellingSection from "@/components/home/CounsellingSection";
import FeaturedSchoolCards from "@/components/home/FeaturedSchoolCards";
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
import { homeSchoolCategoryForIds, isDiscoverableSchoolType, schoolProfilePathFromSlugs, schoolTypeLabel, type HomeSchoolCategory } from "@/lib/seo-slugs";
import { boardListingPath, placeListingPath } from "@/lib/school-urls";

function schoolHref(school: SchoolListItem) {
  return schoolProfilePathFromSlugs({
    countrySlug: school.country_slug,
    stateSlug: school.state_slug,
    citySlug: school.city_slug,
    localitySlug: school.location_slug,
    schoolSlug: school.slug,
  });
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
  const coverImage =
    school.school_image_url || school.school_photos?.[0]?.photo_url || "";
  const logoImage = school.school_logo_url || "";

  return (
    <article className="school-card">
      <Link
        className="school-card__cover-link"
        href={href}
        aria-label={`View details for ${school.school_name}`}
      />

      <div className="school-card__media">
        {coverImage ? (
          <Image
            className="school-card__media-image"
            src={coverImage}
            alt={`${school.school_name} campus`}
            fill
            sizes="(max-width: 820px) 100vw, 420px"
            unoptimized
          />
        ) : (
          <span className="school-card__media-fallback" aria-hidden="true">
            <Building2 size={30} strokeWidth={1.4} />
          </span>
        )}

        {school.videos_count ? (
          <span className="school-card__video-count">
            {school.videos_count} video{school.videos_count === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      <div className="school-card__top">
        <div className="school-card__avatar">
          {logoImage ? (
            <Image
              src={logoImage}
              alt={`${school.school_name} logo`}
              width={88}
              height={88}
              unoptimized
            />
          ) : (
            <Building2 size={23} strokeWidth={1.7} aria-hidden="true" />
          )}
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
            {schoolTypeLabel(type.type_code, type.slug, type.type_name)}
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

type InitialDiscoveryFilter = { country?: string; state?: string; city?: string; location?: string; placeName?: string; schoolTypes?: string[]; boardIds?: string[]; homeCategory?: HomeSchoolCategory };
const finderScrollStorageKey = "boardingeu:finder-scroll-path";

export default function SchoolDiscovery({ initialFilter }: { initialFilter?: InitialDiscoveryFilter } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  useEffect(() => {
    const destinationPath = window.sessionStorage.getItem(finderScrollStorageKey);
    if (!destinationPath) return;
    window.sessionStorage.removeItem(finderScrollStorageKey);
    if (destinationPath !== pathname) return;
    window.requestAnimationFrame(() => {
      document.getElementById("schools")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [pathname]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [schoolType, setSchoolType] = useState<string[]>([]);
  const [schoolTypes, setSchoolTypes] = useState<SchoolTypeListItem[]>([]);
  const [schoolTypesLoaded, setSchoolTypesLoaded] = useState(false);
  const [boards, setBoards] = useState<BoardListItem[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(true);
  const [schoolTypesError, setSchoolTypesError] = useState<string | null>(
    null
  );
  const [boardsError, setBoardsError] = useState<string | null>(null);
  const [boardsRetry, setBoardsRetry] = useState(0);
  const [cities, setCities] = useState<CityListItem[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [citiesError, setCitiesError] = useState<string | null>(null);
  const [citiesRetry, setCitiesRetry] = useState(0);
  const [citySearch, setCitySearch] = useState("");
  const [citiesExpanded, setCitiesExpanded] = useState(false);
  const [boardSearch, setBoardSearch] = useState("");
  const [boardsExpanded, setBoardsExpanded] = useState(false);
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
  const [pendingTypeSlug, setPendingTypeSlug] = useState<string | null>(null);
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
  const [homeCategory, setHomeCategory] = useState<HomeSchoolCategory | null>(initialFilter?.homeCategory ?? null);
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
  const initialCountry = initialFilter?.country;
  const initialState = initialFilter?.state;
  const initialCity = initialFilter?.city;
  const initialLocation = initialFilter?.location;
  const initialSchoolTypeKey = initialFilter?.schoolTypes?.join(",") ?? "";
  const initialBoardKey = initialFilter?.boardIds?.join(",") ?? "";
  const initialHomeCategory = initialFilter?.homeCategory;
  const homeSearchEnabled = !initialFilter || Boolean(initialHomeCategory);
  const listingPlaceName = useMemo(() => {
    const isInitialLocation =
      initialFilter?.placeName &&
      geoCountry === (initialFilter.country ?? "") &&
      geoState === (initialFilter.state ?? "") &&
      geoCity === (initialFilter.city ?? "") &&
      geoLocation === (initialFilter.location ?? "");

    const matchingCity = cities.find((city) =>
      geoCity
        ? city.city_id === geoCity
        : geoState
          ? city.state_id === geoState
          : geoCountry
            ? city.country_id === geoCountry
            : false,
    );
    const initialPlaceName = isInitialLocation ? initialFilter.placeName : "";
    if (!matchingCity) return initialPlaceName ?? "";
    if (geoCity) {
      const place = initialPlaceName && initialPlaceName !== matchingCity.city_name
        ? `${initialPlaceName}, `
        : "";
      return `${place}${matchingCity.city_name}, ${matchingCity.state_name}`;
    }
    if (geoState) {
      const place = initialPlaceName && initialPlaceName !== matchingCity.state_name
        ? `${initialPlaceName}, `
        : "";
      return `${place}${matchingCity.state_name}, ${matchingCity.country_name}`;
    }
    return initialPlaceName || matchingCity.country_name;
  }, [
    cities,
    geoCountry,
    geoState,
    geoCity,
    geoLocation,
    initialFilter?.placeName,
    initialFilter?.country,
    initialFilter?.state,
    initialFilter?.city,
    initialFilter?.location,
  ]);
  const listingBoardName = boards.find((item) => board.includes(item.board_id))?.board_name;
  const selectedListingSchoolType = schoolTypes.find((type) => type.school_type_id === schoolType[0]);
  const listingCategoryLabel = homeCategory === "residential-school"
    ? "Residential School"
    : homeCategory === "day-school"
      ? "Day School"
    : schoolType.length
      ? schoolTypeLabel(
          selectedListingSchoolType?.type_code ?? "",
          selectedListingSchoolType?.slug ?? "",
          selectedListingSchoolType?.type_name ?? "",
        )
      : "";
  const listingHeading = listingBoardName
    ? `${listingBoardName} Schools in India`
    : listingPlaceName
      ? `${listingCategoryLabel ? `${listingCategoryLabel}s` : "Schools"} in ${listingPlaceName}`
      : listingCategoryLabel
        ? `${listingCategoryLabel}s in India`
        : "Find Schools in India";
  const listingDescription = listingBoardName
    ? `Explore ${listingBoardName} schools in India. Compare school locations, fees, facilities, and admission information to find options that fit your family.`
    : `Explore ${listingCategoryLabel ? `${listingCategoryLabel.toLowerCase()}s` : "schools"}${listingPlaceName ? ` in ${listingPlaceName}` : " across India"}. Compare available school boards, fees, facilities, and admission information, then contact schools or request counselling.`;
  const queryKey = `${search}|${geoCountry}|${geoState}|${geoCity}|${geoLocation}|${locationGroups.join(";")}|${schoolType.join(",")}|${homeCategory ?? ""}|${board.join(",")}|${feeMin ?? ""}|${feeMax ?? ""}|${gender ?? ""}|${ordering ?? ""}`;

  const activeQuery = useRef(queryKey);
  activeQuery.current = queryKey;

  const cityCards = useMemo(() => {
    const query = citySearch.trim().toLocaleLowerCase();
    const matchingCities = cities.filter((city) =>
      `${city.city_name} ${city.state_name} ${city.country_name}`
        .toLocaleLowerCase()
        .includes(query),
    );
    return citiesExpanded || query ? matchingCities : matchingCities.slice(0, 6);
  }, [cities, citiesExpanded, citySearch]);
  const boardCards = useMemo(() => {
    const query = boardSearch.trim().toLocaleLowerCase();
    const matchingBoards = boards.filter((item) =>
      `${item.board_name} ${item.board_code}`.toLocaleLowerCase().includes(query),
    );
    return boardsExpanded || query ? matchingBoards : matchingBoards.slice(0, 8);
  }, [boardSearch, boards, boardsExpanded]);

  const whyBoardingEdu = [
    "Verified school profiles",
    "Transparent fees",
    "Side-by-side comparison",
    "Expert guidance",
    "Application support",
    "Pan-India coverage",
  ];

  useEffect(() => {
    if (!queryRestored || !schoolTypesLoaded || pendingTypeSlug) return;
    let cancelled = false;
    const residentialOnly = homeCategory === "residential-school" || (schoolType.length > 0 && schoolTypes.length === 0) || isBoardingOnlySelection(schoolType, schoolTypes);

    const filters: SchoolFilters = {
      search: search || undefined,
      country: locationGroups.length ? undefined : geoCountry || undefined,
      state: locationGroups.length ? undefined : geoState || undefined,
      city: !residentialOnly && !locationGroups.length ? geoCity || undefined : undefined,
      location: !residentialOnly && !locationGroups.length ? geoLocation || undefined : undefined,
      location_group: locationGroups,
      school_type: schoolType,
      home_category: homeCategory ?? undefined,
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
  }, [queryRestored, schoolTypesLoaded, pendingTypeSlug, schoolTypes, search, geoCountry, geoState, geoCity, geoLocation, locationGroups, schoolType, homeCategory, board, feeMin, feeMax, gender, ordering, queryKey, retryCount]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (initialCountry || initialState || initialCity || initialLocation || initialSchoolTypeKey || initialBoardKey || initialHomeCategory) {
      initialLocationWasInUrl.current = Boolean(initialCountry || initialState || initialCity || initialLocation);
      setSearch("");
      setSearchInput("");
      setBoard(initialBoardKey ? initialBoardKey.split(",") : []);
      setSchoolType(initialSchoolTypeKey ? initialSchoolTypeKey.split(",") : []);
      setHomeCategory(initialHomeCategory ?? null);
      setGeoCountry(initialCountry ?? "");
      setGeoState(initialState ?? "");
      setGeoCity(initialCity ?? "");
      setGeoLocation(initialLocation ?? "");
      setLocationGroups([]);
      setQueryRestored(true);
      return;
    }
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
    const initialTypes = params.getAll("school_type");
    const typeSlug = params.get("type");
    const requestedHomeCategory = params.get("home_category");
    setHomeCategory(requestedHomeCategory === "day-school" || requestedHomeCategory === "residential-school" ? requestedHomeCategory : null);
    if (initialTypes.length) setSchoolType(initialTypes);
    else if (typeSlug) {
      // Resolved to API ids after the school type list loads.
      setPendingTypeSlug(typeSlug);
    }
    setGeoCountry(params.get("country") ?? "");
    setGeoState(params.get("state") ?? "");
    const initialBoardingSearch = typeSlug === "boarding-school" || typeSlug === "full-boarding-school";
    setGeoCity(initialBoardingSearch ? "" : params.get("city") ?? "");
    setGeoLocation(initialBoardingSearch ? "" : params.get("location") ?? "");
    setLocationGroups(initialBoardingSearch ? [] : params.getAll("location_group"));
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
  }, [initialCountry, initialState, initialCity, initialLocation, initialSchoolTypeKey, initialBoardKey, initialHomeCategory]);

  useEffect(() => {
    if (!pendingTypeSlug || !schoolTypesLoaded) return;
    const matchingTypes = schoolTypes.filter((type) => {
      const category = schoolTypeLabel(type.type_code, type.slug, type.type_name).toLowerCase().replaceAll(" ", "-");
      return category === pendingTypeSlug;
    });
    if (matchingTypes.length) setSchoolType(matchingTypes.map((type) => type.school_type_id));
    setPendingTypeSlug(null);
  }, [pendingTypeSlug, schoolTypes, schoolTypesLoaded]);

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
    setBoardsLoading(true);
    setBoardsError(null);

    schools
      .types()
      .then((response) => fetchAllPages(response))
      .then((rows) => {
        if (!cancelled) {
          setSchoolTypes(rows.filter((type) => type.status && isDiscoverableSchoolType(type.type_code, type.slug, type.type_name)));
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
        if (!cancelled) setSchoolTypesLoaded(true);
      });

    schools
      .boards()
      .then((response) => fetchAllPages(response))
      .then((rows) => {
        if (!cancelled) {
          setBoards(
            rows
              .filter((item) => item.status)
              .sort((left, right) => left.board_name.localeCompare(right.board_name)),
          );
          setBoardsError(null);
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
      })
      .finally(() => {
        if (!cancelled) setBoardsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [boardsRetry]);

  useEffect(() => {
    if (!isHomePage) return;
    let cancelled = false;
    setCitiesLoading(true);
    setCitiesError(null);
    geography
      .cities()
      .then((response) => fetchAllPages(response))
      .then((rows) => {
        if (!cancelled) {
          const uniqueCities = new Map<string, CityListItem>();
          for (const city of rows.filter((item) => item.status)) {
            uniqueCities.set(city.city_id, city);
          }
          setCities(
            [...uniqueCities.values()].sort(
              (left, right) =>
                (right.schools_count ?? 0) - (left.schools_count ?? 0) ||
                left.city_name.localeCompare(right.city_name),
            ),
          );
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setCitiesError(
            reason instanceof Error ? reason.message : "Could not load cities.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCitiesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [citiesRetry, isHomePage]);

  useEffect(() => {
    if (!isBoardingOnlySelection(schoolType, schoolTypes)) return;
    if (geoCity) setGeoCity("");
    if (geoLocation) setGeoLocation("");
    if (locationGroups.length) setLocationGroups([]);
  }, [schoolType, schoolTypes, geoCity, geoLocation, locationGroups.length]);

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
      .list({ is_featured: true, ordering: "school_name" })
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
    if (isHomePage) {
      router.push("/schools");
      return;
    }
    document.getElementById("schools")?.scrollIntoView({ behavior: "smooth" });
  }

  function searchFor(query: string) {
    rememberSearch(query);
    trackSearchEvent(
      "search_query_submitted",
      { query_length: query.length },
      true
    );
    if (isHomePage) {
      router.push(`/schools?search=${encodeURIComponent(query)}`);
      return;
    }
    setSearchInput(query);
    setSearch(query);
    setBoard([]);
    setSchoolType([]);
    setFeeRange([0, 3_000_000]);
    setGender(undefined);
  }

  function selectBoard(selectedBoard: BoardListItem) {
    if (isHomePage) {
      router.push(`/schools?board=${encodeURIComponent(selectedBoard.board_id)}`);
      return;
    }
    setBoard([selectedBoard.board_id]);
    setSearchInput("");
    setSearch("");
    setSchoolType([]);
    setFeeRange([0, 3_000_000]);
    setGender(undefined);
  }

  function selectSchoolType(selectedType: SchoolTypeListItem) {
    if (isHomePage) {
      router.push(`/schools?school_type=${encodeURIComponent(selectedType.school_type_id)}`);
      return;
    }
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
    const nextHomeCategory = homeSearchEnabled ? homeSchoolCategoryForIds(next.schoolType, schoolTypes) : null;
    const boardingOnly = homeSearchEnabled
      ? nextHomeCategory === "residential-school"
      : isBoardingOnlySelection(next.schoolType, schoolTypes);
    setHomeCategory(nextHomeCategory);
    setSchoolType(next.schoolType);
    setGeoCountry(next.country);
    setGeoState(next.state);
    setGeoCity(boardingOnly ? "" : next.city);
    setGeoLocation(boardingOnly ? "" : next.location);
    if (locationChanged) setLocationGroups([]);
  }

  function handleFinderSubmit(path: string) {
    trackSearchEvent("search_query_submitted", { query_length: 0 }, true);
    const destinationPath = new URL(path, window.location.origin).pathname;
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (currentPath === path) {
      scrollToSchools();
      return;
    }
    if (window.location.pathname !== destinationPath) {
      window.sessionStorage.setItem(finderScrollStorageKey, destinationPath);
    }
    router.push(path, { scroll: false });
    if (window.location.pathname === destinationPath) scrollToSchools();
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
    <main className={`discovery-page ${isHomePage ? "discovery-page--home" : "discovery-page--listing"}`}>
      <section className="hero">
        <div className="hero__copy">
          <div className="hero__kicker">
            <span className="hero__pulse" />
            MADE FOR YOUR SCHOOL SEARCH
          </div>

          <h1>
            {isHomePage ? (
              <>Find the Right School <span>for Your Child</span></>
            ) : (
              <>{listingHeading}</>
            )}
          </h1>

          <p>
            {isHomePage
              ? "Discover schools, compare fees and facilities, shortlist favourites, and connect with schools—all in one place."
              : listingDescription}
          </p>

          <HeroFinder
            value={finderValue()}
            schoolTypes={schoolTypes}
            locationMessage={locationMessage}
            locationError={locationError}
            homeSearch={homeSearchEnabled}
            onChange={handleFinderChange}
            onSubmit={handleFinderSubmit}
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

        <Link className="hero-scroll" href={isHomePage ? "/schools" : "#schools"}>
          <span /> {isHomePage ? "Explore schools" : "Scroll to schools"}
        </Link>
      </section>

      {isHomePage && (
        <>
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
          {citiesError && (
            <p className="section-error" role="status">
              Cities unavailable: {citiesError}{" "}
              <button type="button" onClick={() => setCitiesRetry((count) => count + 1)}>
                Retry
              </button>
            </p>
          )}
        </div>

        <label className="home-directory-search">
          <span className="sr-only">Search cities by city, state, or country</span>
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={citySearch}
            onChange={(event) => setCitySearch(event.target.value)}
            placeholder="Search cities, states, or countries"
          />
        </label>

        <div className="city-grid">
          {cityCards.map((city, index) => (
            <Link
              className={`city-card city-card--${index + 1}`}
              key={city.city_id}
              href={placeListingPath({
                countrySlug: city.country_slug ?? city.country_name,
                stateSlug: city.state_slug ?? city.state_name,
                citySlug: city.slug,
              })}
            >
              <span className="city-card__number">{String(index + 1).padStart(2, "0")}</span>
              <span className="city-card__name">{city.city_name}</span>
              <span className="city-card__state">{city.state_name}</span>
              <span className="city-card__action">
                Explore schools <ArrowRight size={14} />
              </span>
            </Link>
          ))}
          {citiesLoading && (
            <p className="section-empty" role="status">Loading cities…</p>
          )}
          {!citiesLoading && !citiesError && cityCards.length === 0 && (
            <p className="section-empty">
              {citySearch
                ? "No cities match your search."
                : "No active cities are available right now."}
            </p>
          )}
        </div>
        {!citiesLoading && cities.length > 6 && !citySearch && (
          <button
            className="home-directory-toggle"
            type="button"
            aria-expanded={citiesExpanded}
            onClick={() => setCitiesExpanded((expanded) => !expanded)}
          >
            {citiesExpanded ? "Show popular cities" : `View all ${cities.length} cities`}
          </button>
        )}
      </section>

      <section className="home-section home-section--boards" id="boards">
        <div className="home-section__heading">
          <div>
            <div className="section-eyebrow">EXPLORE CURRICULA</div>
            <h2>Browse by board</h2>
          </div>

          {boardsError && (
            <p className="section-error" role="status">
              Board options unavailable: {boardsError}{" "}
              <button type="button" onClick={() => setBoardsRetry((count) => count + 1)}>
                Retry
              </button>
            </p>
          )}
        </div>

        <label className="home-directory-search">
          <span className="sr-only">Search education boards</span>
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={boardSearch}
            onChange={(event) => setBoardSearch(event.target.value)}
            placeholder="Search education boards"
          />
        </label>

        <div className="board-grid">
          {boardCards.map((boardItem, index) => (
            <Link
              className={`board-card board-card--${index + 1}`}
              key={boardItem.board_id}
              href={boardListingPath(boardItem.slug)}
            >
              <span className="board-card__mark">{boardItem.board_code}</span>
              <span className="board-card__name">{boardItem.board_name}</span>

              <span className="board-card__action">
                Browse schools <ArrowRight size={14} />
              </span>
            </Link>
          ))}
          {boardsLoading && (
            <p className="section-empty" role="status">Loading education boards…</p>
          )}
          {!boardsLoading && !boardsError && boardCards.length === 0 && (
            <p className="section-empty">
              {boardSearch ? "No boards match your search." : "No active education boards are available right now."}
            </p>
          )}
        </div>
        {!boardsLoading && boards.length > 8 && !boardSearch && (
          <button
            className="home-directory-toggle"
            type="button"
            aria-expanded={boardsExpanded}
            onClick={() => setBoardsExpanded((expanded) => !expanded)}
          >
            {boardsExpanded ? "Show fewer boards" : `View all ${boards.length} boards`}
          </button>
        )}
      </section>

      <section className="home-section home-section--featured" id="featured">
        <div className="home-section__heading">
          <div>
            <div className="section-eyebrow">A FEW PLACES TO BEGIN</div>
            <h2>Featured schools</h2>
          </div>

          <Link href="/schools">
            Browse the directory <ArrowRight size={15} />
          </Link>
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
          <FeaturedSchoolCards schools={featuredSchools} />
        ) : (
          <p className="section-empty">
            Featured schools will appear here when the directory has published
            listings.
          </p>
        )}
      </section>

      <CounsellingSection />

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
            <Link href="/schools" className="secondary-button">
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
            <Link href="/schools" className="primary-button">
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

        </>
      )}

      {!isHomePage && (
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
                {(["Day School", "Day Boarding School", "Boarding School"] as const).map((label) => {
                  const ids = schoolTypes
                    .filter((type) => schoolTypeLabel(type.type_code, type.slug, type.type_name) === label)
                    .map((type) => type.school_type_id);
                  if (!ids.length) return null;
                  const selected = ids.some((id) => schoolType.includes(id));
                  return <label className="filter-check" key={label}>
                    <input type="checkbox" checked={selected} onChange={() => {
                      setSchoolType((current) => selected
                        ? current.filter((id) => !ids.includes(id))
                        : [...new Set([...current, ...ids])]);
                      trackSearchEvent("filter_applied", { filter_type: "school_type", selected: !selected });
                    }} />
                    <span>{label}</span>
                  </label>;
                })}
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
      )}

      <SearchCommandPalette
        boards={boards}
        schoolTypes={schoolTypes}
        recentSearches={recentSearches}
        onSearch={searchFor}
        onBoard={selectBoard}
        onSchoolType={selectSchoolType}
      />
      {!isHomePage && !filtersOpen && <CompareBar />}
    </main>
  );
}
