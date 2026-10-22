"use client";

import {
  ArrowDownUp,
  ArrowRight,
  BarChart3,
  BookOpen,
  CircleDollarSign,
  Building2,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  LoaderCircle,
  MapPin,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  House,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { CSSProperties, FormEvent } from "react";
import { fetchAllPages, geography, schools } from "@/lib/api";
import type {
  BoardListItem,
  CityListItem,
  LocationListItem,
  SchoolFAQListItem,
  SchoolFilters,
  SchoolListItem,
  SchoolTypeListItem,
} from "@/lib/api";
import FeeRangeSlider from "@/components/search/FeeRangeSlider";
import SearchCommandPalette from "@/components/search/SearchCommandPalette";
import CompareBar from "@/components/search/CompareBar";
import HeroFinder, { type HeroFinderValue } from "@/components/home/HeroFinder";
import CounsellingSection from "@/components/home/CounsellingSection";
import CounsellingLink from "@/components/home/CounsellingLink";
import FeaturedSchoolCards from "@/components/home/FeaturedSchoolCards";
import HomeBotOnboarding from "@/components/home/HomeBotOnboarding";
import SchoolTypePickerModal, { type SchoolTypePickerRequest } from "@/components/home/SchoolTypePickerModal";
import {
  createLocationPreferences,
  isBoardingOnlySelection,
  normalizeLocationPreferences,
  type LocationPreferences,
} from "@/lib/location-preferences";
import {
  exploreItems,
  faqItems,
} from "@/lib/home-content";
import { useSearchExperience } from "@/lib/search-experience";
import { trackSearchEvent } from "@/lib/search-analytics";
import {
  homeSchoolCategories,
  homeSchoolCategoryForIds,
  homeSchoolCategoryFromValue,
  homeSchoolCategoryPath,
  isDiscoverableSchoolType,
  schoolProfilePathFromSlugs,
  schoolProfileTypeSegment,
  schoolTypeLabel,
  toSeoSlug,
  type HomeSchoolCategory,
} from "@/lib/seo-slugs";
import { boardListingPath, placeListingPath, schoolDirectoryPath } from "@/lib/school-urls";

function schoolHref(school: SchoolListItem) {
  return schoolProfilePathFromSlugs({
    countrySlug: school.country_slug,
    stateSlug: school.state_slug,
    citySlug: school.city_slug,
    localitySlug: school.location_slug,
    schoolSlug: school.slug,
    typeSegment: schoolProfileTypeSegment(school.school_types_detail),
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

const DEFAULT_ORDERING: NonNullable<SchoolFilters["ordering"]> = "-is_featured";

const PAGE_SIZE = 12;

const orderingOptions: Record<
  string,
  NonNullable<SchoolFilters["ordering"]>
> = {
  "-is_featured": "-is_featured",
  "-average_rating": "-average_rating",
  "-review_count": "-review_count",
  annual_fee: "annual_fee",
  "-annual_fee": "-annual_fee",
  "-established_year": "-established_year",
  established_year: "established_year",
  school_name: "school_name",
  "-school_name": "-school_name",
};

/** Human labels for the sort dropdown — one source for the list and the chips. */
const orderingLabels: Partial<
  Record<NonNullable<SchoolFilters["ordering"]>, string>
> = {
  "-is_featured": "Recommended",
  "-average_rating": "Highest rated",
  "-review_count": "Most popular",
  annual_fee: "Annual fees: low to high",
  "-annual_fee": "Annual fees: high to low",
  "-established_year": "Newest established",
  established_year: "Oldest established",
  school_name: "Name: A to Z",
  "-school_name": "Name: Z to A",
};

const schoolTypeBrowseOrder: HomeSchoolCategory[] = [
  "day-school",
  "residential-school",
];

const schoolTypeBrowseCopy: Record<HomeSchoolCategory, { label: string; text: string }> = {
  "day-school": {
    label: "Day Schools",
    text: "Regular school hours, with students travelling home at the end of the day.",
  },
  "residential-school": {
    label: "Boarding Schools",
    text: "Compare day boarding and full boarding schools with residential care.",
  },
};

function formatRupees(value: number) {
  return `₹${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

/** Recognisable accent per education board, so the board grid reads as a set of
 *  distinct cards instead of one repeated colour. */
const boardAccents: Record<string, string> = {
  CBSE: "#17456b",
  ICSE: "#1c715c",
  CISCE: "#5a3fa8",
  IB: "#3f3bad",
  IGCSE: "#b4551d",
  CIE: "#b4551d",
  STATE: "#2b6a86",
};

const boardAccentFallbacks = [
  "#17456b",
  "#3f3bad",
  "#1c715c",
  "#b4551d",
  "#2b6a86",
  "#8e4b24",
];

function boardAccent(board: BoardListItem) {
  const code = board.board_code.trim().toUpperCase();
  if (boardAccents[code]) return boardAccents[code]!;
  const key = `${board.board_name} ${code}`;
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % 9973;
  }
  return boardAccentFallbacks[hash % boardAccentFallbacks.length]!;
}

function boardGroup(board: BoardListItem): "national" | "international" | "other" {
  const value = `${board.board_code} ${board.board_name} ${board.slug}`.toLowerCase();
  if (/\b(ib|igcse|cie)\b|cambridge|international/.test(value)) return "international";
  if (/\b(cbse|icse|cisce|state)\b|national/.test(value)) return "national";
  return "other";
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

function SchoolCard({
  school,
  selectedBoards = [],
  selectedSchoolTypes = [],
}: {
  school: SchoolListItem;
  selectedBoards?: string[];
  selectedSchoolTypes?: string[];
}) {
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

      <div className="school-card__body">
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

            {(school.average_rating != null || school.grades_range) && (
              <div className="school-card__meta">
                {school.average_rating != null && (
                  <span
                    className="school-card__rating"
                    aria-label={`Rated ${school.average_rating} out of 5 from ${school.review_count} reviews`}
                  >
                    <Star size={14} aria-hidden="true" />
                    <strong>{school.average_rating.toFixed(1)}</strong>
                    <span className="school-card__rating-count">
                      ({school.review_count}{" "}
                      {school.review_count === 1 ? "review" : "reviews"})
                    </span>
                  </span>
                )}

                {school.grades_range && (
                  <span className="school-card__classes">
                    Classes: {school.grades_range}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="school-card__tags">
          {school.school_types_detail
            .filter((type) => !selectedSchoolTypes.length || selectedSchoolTypes.includes(type.school_type_id))
            .map((type) => (
            <span className="school-tag" key={type.school_type_id}>
              {schoolTypeLabel(type.type_code, type.slug, type.type_name)}
            </span>
          ))}

          {school.boards_detail
            .filter((item) => !selectedBoards.length || selectedBoards.includes(item.board_id))
            .map((item) => (
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
      </div>
    </article>
  );
}

type InitialDiscoveryFilter = { country?: string; state?: string; city?: string; location?: string; placeName?: string; place?: { countrySlug: string; stateSlug?: string; citySlug?: string; locationSlug?: string }; schoolTypes?: string[]; boardIds?: string[]; boardSlug?: string; homeCategory?: HomeSchoolCategory; ordering?: SchoolFilters["ordering"] };
type RelatedSearch = { label: string; href: string };
type Breadcrumb = { name: string; url: string };
type PlaceHighlight = { label: string; href: string; kind: "state" | "city" | "locality" };
const finderScrollStorageKey = "boardingeu:finder-scroll-path";

function withListingFilters(href: string, boards: string[], schoolTypes: string[]) {
  const url = new URL(href, "https://boardingeu.invalid");
  boards.forEach((id) => url.searchParams.append("board", id));
  schoolTypes.forEach((id) => url.searchParams.append("school_type", id));
  return `${url.pathname}${url.search}`;
}

function HomeSectionTypeSelector({
  value,
  onChange,
}: {
  value: HomeSchoolCategory | null;
  onChange: (value: HomeSchoolCategory | null) => void;
}) {
  return (
    <label className="home-section__type-selector">
      <span className="sr-only">Filter by school type</span>
      <select
        value={value ?? ""}
        onChange={(event) =>
          onChange(homeSchoolCategoryFromValue(event.target.value))
        }
      >
        <option value="">Choose school type</option>
        <option value="day-school">Day school</option>
        <option value="residential-school">Boarding school</option>
      </select>
      <ChevronDown size={14} aria-hidden="true" />
    </label>
  );
}

export default function SchoolDiscovery({ initialFilter, relatedSearches, breadcrumbs }: { initialFilter?: InitialDiscoveryFilter; relatedSearches?: RelatedSearch[]; breadcrumbs?: Breadcrumb[] } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const { comparedSchools, toggleSchool } = useSearchExperience();
  const [comparePromoMessage, setComparePromoMessage] = useState("");
  const [typePicker, setTypePicker] = useState<SchoolTypePickerRequest | null>(null);
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
  const [hoveredCityIds, setHoveredCityIds] = useState<string[] | null>(null);
  const [locations, setLocations] = useState<LocationListItem[]>([]);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [schoolFaqs, setSchoolFaqs] = useState<SchoolFAQListItem[]>([]);
  const [schoolFaqsError, setSchoolFaqsError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
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
    useState<SchoolFilters["ordering"]>(initialFilter?.ordering ?? DEFAULT_ORDERING);
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<SchoolListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [featuredSchools, setFeaturedSchools] = useState<SchoolListItem[]>([]);
  const comparisonSchools = useMemo(() => {
    const additionalSchools = featuredSchools.filter(
      (featured) =>
        !comparedSchools.some((compared) => compared.school_id === featured.school_id),
    );
    return [
      ...comparedSchools,
      ...additionalSchools.slice(0, Math.max(0, 3 - comparedSchools.length)),
    ];
  }, [comparedSchools, featuredSchools]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState<string | null>(null);
  const [featuredFallback, setFeaturedFallback] = useState(false);
  const [geoCountry, setGeoCountry] = useState("");
  const [geoState, setGeoState] = useState("");
  const [geoCity, setGeoCity] = useState("");
  const [geoLocation, setGeoLocation] = useState("");
  const [homeCategory, setHomeCategory] = useState<HomeSchoolCategory | null>(
    initialFilter?.homeCategory ?? null,
  );
  const [statesSectionCategory, setStatesSectionCategory] = useState<HomeSchoolCategory | null>(null);
  const [citiesSectionCategory, setCitiesSectionCategory] = useState<HomeSchoolCategory | null>(null);
  const [boardsSectionCategory, setBoardsSectionCategory] = useState<HomeSchoolCategory | null>(null);
  const [botOnboardingOpen, setBotOnboardingOpen] = useState(false);

  const [locationPreferences, setLocationPreferences] =
    useState<LocationPreferences | null>(null);
  const [locationPreferencesLoaded, setLocationPreferencesLoaded] = useState(false);
  const [locationGroups, setLocationGroups] = useState<string[]>([]);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const locationRestoreApplied = useRef(false);
  const initialLocationWasInUrl = useRef(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  const heroSpots = useMemo(() => {
    const ranked = cities
      .filter((city) => city.status && (city.schools_count ?? 0) > 0)
      .slice(0, 4);
    return ranked.map((city, index) => {
      const category: HomeSchoolCategory = index % 2 === 0 ? "residential-school" : "day-school";
      const label = category === "residential-school" ? "Boarding schools" : "Day schools";
      return {
        key: city.city_id,
        title: `${label} in ${city.city_name || "—"}`,
        place: [city.state_name, city.country_name].filter(Boolean).join(", ") || "—",
        count: city.schools_count ?? 0,
        href: placeListingPath({
          countrySlug: city.country_slug ?? city.country_name,
          stateSlug: city.state_slug ?? city.state_name,
          citySlug: city.slug,
          category,
        }),
      };
    });
  }, [cities]);

  const directoryStats = useMemo(() => {
    const schoolTotal = cities.reduce(
      (total, city) => total + (city.schools_count ?? 0),
      0,
    );
    const stats: { value: number; label: string }[] = [];
    if (schoolTotal > 0) stats.push({ value: schoolTotal, label: "School listings" });
    if (cities.length > 0) stats.push({ value: cities.length, label: "Cities covered" });
    if (boards.length > 0) stats.push({ value: boards.length, label: "Education boards" });
    if (schoolTypes.length > 0) {
      stats.push({ value: schoolTypes.length, label: "School types" });
    }
    return stats;
  }, [boards.length, cities, schoolTypes.length]);

  /** Show the two parent-facing categories while retaining Day Boarding membership. */
  const schoolTypeBrowseCards = useMemo(
    () =>
      schoolTypeBrowseOrder.flatMap((category) => {
        const hasTypes = schoolTypes.some((type) =>
          homeSchoolCategories(type.type_code, type.slug, type.type_name).includes(category),
        );
        if (!hasTypes) return [];
        const copy = schoolTypeBrowseCopy[category];
        return [
          {
            category,
            slug: homeSchoolCategoryPath(category),
            label: copy.label,
            text: copy.text,
          },
        ];
      }),
    [schoolTypes],
  );

  /**
   * Listing chooser cards are built from the static taxonomy so the section is
   * present in the first paint, before the school type list is fetched.
   */
  const schoolTypeChooserCards = useMemo(
    () =>
      schoolTypeBrowseOrder.map((category) => ({
        category,
        slug: homeSchoolCategoryPath(category),
        label: schoolTypeBrowseCopy[category].label,
        text: schoolTypeBrowseCopy[category].text,
      })),
    [],
  );

  const feeMin = feeRange[0] === 0 ? undefined : feeRange[0];
  const feeMax = feeRange[1] === 3_000_000 ? undefined : feeRange[1];
  const initialCountry = initialFilter?.country;
  const initialState = initialFilter?.state;
  const initialCity = initialFilter?.city;
  const initialLocation = initialFilter?.location;
  const initialSchoolTypeKey = initialFilter?.schoolTypes?.join(",") ?? "";
  const initialBoardKey = initialFilter?.boardIds?.join(",") ?? "";
  const initialHomeCategory = initialFilter?.homeCategory;
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
  const listingBoardName = boards.find((item) =>
    board.some(
      (value) =>
        value === item.board_id ||
        toSeoSlug(item.slug) === toSeoSlug(value) ||
        item.board_code.toLowerCase() === value.toLowerCase(),
    ),
  )?.board_name;
  const selectedListingSchoolType = schoolTypes.find((type) => type.school_type_id === schoolType[0]);
  const listingCategoryLabel = homeCategory === "residential-school"
    ? "Boarding School"
    : homeCategory === "day-school"
      ? "Day School"
    : schoolType.length
      ? schoolTypeLabel(
          selectedListingSchoolType?.type_code ?? "",
          selectedListingSchoolType?.slug ?? "",
          selectedListingSchoolType?.type_name ?? "",
        )
      : "";
  const stillOnInitialPlace =
    geoCountry === (initialFilter?.country ?? "") &&
    geoState === (initialFilter?.state ?? "") &&
    geoCity === (initialFilter?.city ?? "") &&
    geoLocation === (initialFilter?.location ?? "");
  const listingPlaceLabel =
    listingPlaceName ||
    (stillOnInitialPlace || (!geoCountry && !geoState && !geoCity) ? initialFilter?.placeName : "") ||
    "India";
  const listingTypeLabel = listingCategoryLabel ? `${listingCategoryLabel}s` : "Schools";
  const listingSubject = listingBoardName ? `${listingBoardName} ${listingTypeLabel}` : listingTypeLabel;
  const listingHeading = `${listingSubject} in ${listingPlaceLabel}`;
  // Day boarding belongs to both families, so the chosen type is always named
  // together with the day boarding schools it includes.
  const listingFamilyTypes = homeCategory === "day-school"
    ? "day schools and day boarding schools"
    : homeCategory === "residential-school"
      ? "boarding schools and day boarding schools"
      : null;
  const listingDescription = listingFamilyTypes
    ? `Explore ${listingFamilyTypes} in ${listingPlaceLabel}. Compare available school boards, fees, facilities, and admission information, then contact schools or request counselling.`
    : `Explore ${listingSubject} in ${listingPlaceLabel}. Compare available school boards, fees, facilities, and admission information, then contact schools or request counselling.`;
  const firstResultIndex = totalCount === 0 ? 0 : 1;
  const lastResultIndex = results.length;
  const resultsHeading = `${listingSubject} in ${listingPlaceLabel}`;
  const hasMoreResults = results.length < totalCount;
  const relatedSearchItems = useMemo(() => {
    const category = homeCategory ?? homeSchoolCategoryForIds(schoolType, schoolTypes);
    const categoryLabel = category === "day-school" ? "Day Schools" : "Boarding Schools";
    const oppositeCategory: HomeSchoolCategory =
      category === "day-school" ? "residential-school" : "day-school";
    const oppositeLabel = oppositeCategory === "day-school" ? "Day Schools" : "Boarding Schools";
    // Every board gets its own search chip, and the first few also name the
    // opposite school type so the block covers both halves of the directory.
    const boardSearches = category
      ? boards.flatMap((item, index) => {
          const primary = {
            label: `${item.board_name} ${categoryLabel}`,
            href: boardListingPath(item.slug, category),
          };
          if (index >= 6) return [primary];
          return [
            primary,
            {
              label: `${item.board_name} ${oppositeLabel}`,
              href: boardListingPath(item.slug, oppositeCategory),
            },
          ];
        })
      : [];
    const seen = new Set<string>();
    return [...(relatedSearches ?? []), ...boardSearches].filter((item) =>
      seen.has(item.href) ? false : (seen.add(item.href), true),
    );
  }, [boards, homeCategory, relatedSearches, schoolType, schoolTypes]);
  /**
   * Family implied by the school-type checkboxes. Only the opposite extreme is
   * hidden in the filter panel, because Day Boarding belongs to both families.
   */
  const filterSelectionFamily = homeSchoolCategoryForIds(schoolType, schoolTypes);
  const queryKey = `${search}|${geoCountry}|${geoState}|${geoCity}|${geoLocation}|${locationGroups.join(";")}|${schoolType.join(",")}|${homeCategory ?? ""}|${board.join(",")}|${feeMin ?? ""}|${feeMax ?? ""}|${gender ?? ""}|${ordering ?? ""}`;

  const activeQuery = useRef(queryKey);
  activeQuery.current = queryKey;

  // Any change to search/filters/sort returns the visitor to the first page.
  const pageResetKey = useRef(queryKey);
  useEffect(() => {
    if (pageResetKey.current === queryKey) return;
    pageResetKey.current = queryKey;
    setPage(1);
    setResults([]);
    setTotalCount(0);
    setLoadMoreError(null);
  }, [queryKey]);

  const cityCards = useMemo(() => {
    // "Top cities" means the cities with the most listed schools, so the row is
    // ranked by school count instead of the API's default name order.
    const featuredCities = cities
      .filter((city) => (city.schools_count ?? 0) > 0)
      .sort(
        (left, right) =>
          (right.schools_count ?? 0) - (left.schools_count ?? 0) ||
          left.city_name.localeCompare(right.city_name),
      );
    if (!hoveredCityIds) return featuredCities.slice(0, 10);
    const selectedIds = new Set(hoveredCityIds);
    return featuredCities.filter((city) => selectedIds.has(city.city_id));
  }, [cities, hoveredCityIds]);
  const boardCards = useMemo(() => {
    const query = boardSearch.trim().toLocaleLowerCase();
    const matchingBoards = boards.filter((item) =>
      `${item.board_name} ${item.board_code}`.toLocaleLowerCase().includes(query),
    );
    if (query || boardsExpanded) return matchingBoards;
    const featuredCodes = ["CBSE", "IB", "ICSE", "IGCSE"];
    return featuredCodes.flatMap((code) => {
      const match = matchingBoards.find(
        (item) => item.board_code.trim().toUpperCase() === code,
      );
      return match ? [match] : [];
    });
  }, [boardSearch, boards, boardsExpanded]);
  const boardGroups = useMemo(
    () =>
      [
        { key: "national" as const, label: "Indian boards" },
        { key: "international" as const, label: "International boards" },
        { key: "other" as const, label: "Other boards" },
      ]
        .map((group) => ({
          ...group,
          boards: boardCards.filter((item) => boardGroup(item) === group.key),
        }))
        .filter((group) => group.boards.length > 0),
    [boardCards],
  );
  /**
   * Top states, ranked by the number of listed schools across their cities.
   * Rendered above Top cities so parents can zoom out before picking a city.
   */
  const stateCards = useMemo(() => {
    const grouped = new Map<
      string,
      { state_id: string; state_name: string; state_slug: string; country_slug: string; count: number }
    >();
    for (const city of cities) {
      const count = city.schools_count ?? 0;
      if (count <= 0) continue;
      const current = grouped.get(city.state_id) ?? {
        state_id: city.state_id,
        state_name: city.state_name,
        state_slug: city.state_slug ?? city.state_name,
        country_slug: city.country_slug ?? city.country_name,
        count: 0,
      };
      current.count += count;
      grouped.set(city.state_id, current);
    }
    return [...grouped.values()]
      .sort((left, right) => right.count - left.count || left.state_name.localeCompare(right.state_name))
      .slice(0, 10);
  }, [cities]);
  const activeCountryId = geoCountry || initialCountry || "";
  const activeStateId = geoState || initialState || "";
  const activeCityId = geoCity || initialCity || "";
  function categoryBrowsePath(category: HomeSchoolCategory) {
    // The server resolves the place for landing pages, so the chooser can link to
    // the typed URL without waiting for the city list to load.
    if (initialFilter?.place) {
      return placeListingPath({ ...initialFilter.place, category });
    }
    const placeCity =
      cities.find((city) => city.city_id === activeCityId) ??
      cities.find((city) => city.state_id === activeStateId) ??
      cities.find((city) => city.country_id === activeCountryId);
    if (!placeCity || !activeCountryId) {
      return schoolDirectoryPath(category);
    }
    const localityId = geoLocation || initialLocation;
    return placeListingPath({
      countrySlug: placeCity.country_slug ?? placeCity.country_name,
      stateSlug: activeStateId ? placeCity.state_slug ?? placeCity.state_name : undefined,
      citySlug: activeCityId ? placeCity.slug : undefined,
      locationSlug: localityId
        ? locations.find((location) => location.location_id === localityId)?.slug
        : undefined,
      category,
    });
  }
  const hasBoardContext = Boolean(initialFilter?.boardIds?.length);
  const hasPlaceContext = Boolean(activeCountryId || activeStateId || activeCityId);
  /** Chooser target for a type card — keeps the board scope when there is one. */
  function typeChooserPath(category: HomeSchoolCategory) {
    if (initialFilter?.boardSlug) return boardListingPath(initialFilter.boardSlug, category);
    return categoryBrowsePath(category);
  }
  /**
   * Board, state and city cards on the home page ask for the school type in a
   * popup before navigating, so the listing lands on a typed URL straight away.
   */
  function openTypePicker(request: SchoolTypePickerRequest) {
    setTypePicker(request);
  }
  /** A place or board page with no type selected asks for a school type first. */
  const showTypeChooser =
    !isHomePage && !homeCategory && schoolType.length === 0 && (hasBoardContext || hasPlaceContext);
  /**
   * The hero finder follows the same two family cards as the home page whenever
   * the visitor still has to pick a school type — including the chooser pages,
   * so the type vocabulary stays consistent end to end.
   */
  const homeSearchEnabled = !initialFilter || Boolean(initialHomeCategory) || showTypeChooser;
  const placeHighlights = useMemo<PlaceHighlight[]>(() => {
    const category = homeCategory ?? homeSchoolCategoryForIds(schoolType, schoolTypes);
    if (activeCityId) {
      return locations
        .slice()
        .sort((left, right) => left.location_name.localeCompare(right.location_name))
        .slice(0, 10)
        .map((location) => ({
          label: location.location_name,
          href: placeListingPath({
            countrySlug: location.country_name,
            stateSlug: location.state_name,
            citySlug: location.city_name,
            locationSlug: location.slug,
            category,
          }),
          kind: "locality",
        }));
    }
    if (activeStateId) {
      return cities
        .filter((city) => city.state_id === activeStateId)
        .slice(0, 10)
        .map((city) => ({
          label: city.city_name,
          href: placeListingPath({
            countrySlug: city.country_slug ?? city.country_name,
            stateSlug: city.state_slug ?? city.state_name,
            citySlug: city.slug,
            category,
          }),
          kind: "city",
        }));
    }
    if (!activeCountryId) return [];
    const states = new Map<string, { city: CityListItem; count: number }>();
    for (const city of cities) {
      if (city.country_id !== activeCountryId) continue;
      const current = states.get(city.state_id) ?? { city, count: 0 };
      current.count += city.schools_count ?? 0;
      states.set(city.state_id, current);
    }
    return [...states.values()]
      .sort((left, right) => right.count - left.count || left.city.state_name.localeCompare(right.city.state_name))
      .slice(0, 10)
      .map(({ city }) => ({
        label: city.state_name,
        href: placeListingPath({
          countrySlug: city.country_slug ?? city.country_name,
          stateSlug: city.state_slug ?? city.state_name,
          category,
        }),
        kind: "state",
      }));
  }, [activeCityId, activeCountryId, activeStateId, cities, homeCategory, locations, schoolType, schoolTypes]);

  useEffect(() => {
    if (!activeCityId) {
      setLocations([]);
      setLocationsError(null);
      return;
    }
    let cancelled = false;
    setLocations([]);
    setLocationsError(null);
    geography
      .locationsOf(activeCityId)
      .then((response) => fetchAllPages(response))
      .then((rows) => {
        if (!cancelled) {
          setLocations(
            rows
              .filter((location) => location.status)
              .sort((left, right) => left.location_name.localeCompare(right.location_name)),
          );
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setLocationsError(
            reason instanceof Error ? reason.message : "Could not load nearby localities.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeCityId]);

  useEffect(() => {
    if (isHomePage || !queryRestored) return;
    let cancelled = false;
    const filters = {
      ...(activeCountryId ? { country: activeCountryId } : {}),
      ...(activeStateId ? { state: activeStateId } : {}),
      ...(activeCityId ? { city: activeCityId } : {}),
      ...(geoLocation || initialLocation
        ? { location: geoLocation || initialLocation || undefined }
        : {}),
      ...(board[0] ? { board: board[0] } : {}),
      ...(schoolType[0] ? { school_type: schoolType[0] } : {}),
    };
    setSchoolFaqs([]);
    setSchoolFaqsError(null);
    schools
      .faqs(filters)
      .then((rows) => {
        if (!cancelled) setSchoolFaqs(rows);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setSchoolFaqsError(
            reason instanceof Error ? reason.message : "Could not load directory FAQs.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeCityId, activeCountryId, activeStateId, board, geoLocation, initialLocation, isHomePage, queryRestored, schoolType]);

  const listingFaqEntries = useMemo(() => {
    const entries = [...schoolFaqs, ...faqItems.slice(0, 4)];
    const seen = new Set<string>();
    return entries.filter((item) => {
      const key = item.question.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [schoolFaqs]);

  useEffect(() => {
    if (!queryRestored || !schoolTypesLoaded || pendingTypeSlug) return;
    const resolvedBoardIds = board.flatMap((value) => {
      const match = boards.find(
        (item) =>
          item.board_id === value ||
          toSeoSlug(item.slug) === toSeoSlug(value) ||
          item.board_code.toLowerCase() === value.toLowerCase(),
      );
      return match ? [match.board_id] : [];
    });
    if (board.length > 0 && boards.length === 0) return;
    if (board.length > 0 && resolvedBoardIds.length === 0) {
      setResults([]);
      setTotalCount(0);
      setLoading(false);
      setError("That education board is not in the directory.");
      return;
    }
    let cancelled = false;
    const placeScoped = Boolean(initialCity || initialLocation);
    const residentialOnly =
      !placeScoped &&
      !geoCity &&
      !geoLocation &&
      (homeCategory === "residential-school" ||
        (schoolType.length > 0 && schoolTypes.length === 0) ||
        isBoardingOnlySelection(schoolType, schoolTypes));

    const filters: SchoolFilters = {
      search: search || undefined,
      country: locationGroups.length ? undefined : geoCountry || undefined,
      state: locationGroups.length ? undefined : geoState || undefined,
      city: !residentialOnly && !locationGroups.length ? geoCity || undefined : undefined,
      location: !residentialOnly && !locationGroups.length ? geoLocation || undefined : undefined,
      location_group: locationGroups,
      school_type: schoolType,
      home_category: homeCategory ? homeSchoolCategoryPath(homeCategory) : undefined,
      board: resolvedBoardIds,
      min_fee: feeMin,
      max_fee: feeMax,
      gender,
      ordering,
      page: page > 1 ? page : undefined,
      page_size: PAGE_SIZE,
    };

    activeQuery.current = queryKey;
    setLoading(true);
    setError(null);
    setLoadMoreError(null);

    schools
      .list(filters)
      .then((response) => {
        if (cancelled) return;

        setResults((current) => {
          if (page === 1) return response.results;
          const existingIds = new Set(current.map((school) => school.school_id));
          return [
            ...current,
            ...response.results.filter((school) => !existingIds.has(school.school_id)),
          ];
        });
        setTotalCount(response.count ?? response.results.length);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;

        const message = reason instanceof Error ? reason.message : "Could not load schools.";
        if (page === 1) {
          setResults([]);
          setTotalCount(0);
          setError(message);
        } else {
          setLoadMoreError(message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [boards, queryRestored, schoolTypesLoaded, pendingTypeSlug, schoolTypes, search, geoCountry, geoState, geoCity, geoLocation, locationGroups, schoolType, homeCategory, board, feeMin, feeMax, gender, ordering, page, queryKey, retryCount]);

  useEffect(() => {
    if (isHomePage || loading || !hasMoreResults || error || loadMoreError) return;
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.unobserve(sentinel);
          setPage((current) => current + 1);
        }
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [error, hasMoreResults, isHomePage, loadMoreError, loading]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (initialCountry || initialState || initialCity || initialLocation || initialSchoolTypeKey || initialBoardKey || initialHomeCategory) {
      initialLocationWasInUrl.current = Boolean(initialCountry || initialState || initialCity || initialLocation);
      setSearch("");
      setSearchInput("");
      // A path scope (place, board or school type) still honours an explicit
      // ?board= scope — this is how footer "CBSE boarding schools in <city>"
      // links keep their board filter instead of falling back to every board.
      const scopedBoards = params.getAll("board");
      setBoard(scopedBoards.length ? scopedBoards : initialBoardKey ? initialBoardKey.split(",") : []);
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
    setHomeCategory(homeSchoolCategoryFromValue(requestedHomeCategory));
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
      (params.get("ordering") as SchoolFilters["ordering"]) || DEFAULT_ORDERING
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
  }, [citiesRetry]);

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
    const activeCountry = geoCountry || initialCountry;
    const activeState = geoState || initialState;
    const activeCity = geoCity || initialCity;
    const activeLocation = geoLocation || initialLocation;
    const boardingOnly = isBoardingOnlySelection(schoolType, schoolTypes);
    setFeaturedLoading(true);
    setFeaturedError(null);
    setFeaturedFallback(false);

    const featuredFilters: SchoolFilters = {
      is_featured: true,
      ordering: "-average_rating",
      page_size: 4,
      country: isHomePage ? undefined : activeCountry || undefined,
      state: isHomePage ? undefined : activeState || undefined,
      city: isHomePage || boardingOnly ? undefined : activeCity || undefined,
      location: isHomePage || boardingOnly ? undefined : activeLocation || undefined,
      board: isHomePage ? undefined : board,
      school_type: isHomePage ? undefined : schoolType,
      home_category: isHomePage || !homeCategory
        ? undefined
        : homeSchoolCategoryPath(homeCategory),
    };

    async function loadFeaturedSchools() {
      try {
        const featuredResponse = await schools.list(featuredFilters);
        if (cancelled) return;
        if (featuredResponse.results.length > 0) {
          setFeaturedSchools(featuredResponse.results.slice(0, 4));
          return;
        }

        const hasAreaFilter =
          !isHomePage &&
          Boolean(activeCountry || activeState || activeCity || activeLocation);
        if (!hasAreaFilter) {
          setFeaturedSchools([]);
          return;
        }

        const localResponse = await schools.list({
          ...featuredFilters,
          is_featured: undefined,
          status: true,
        });
        if (cancelled) return;
        setFeaturedSchools(localResponse.results.slice(0, 4));
        setFeaturedFallback(localResponse.results.length > 0);
      } catch (reason: unknown) {
        if (!cancelled) {
          setFeaturedError(
            reason instanceof Error
              ? reason.message
              : "Could not load featured schools."
          );
        }
      } finally {
        if (!cancelled) setFeaturedLoading(false);
      }
    }

    void loadFeaturedSchools();

    return () => {
      cancelled = true;
    };
  }, [
    board,
    geoCity,
    geoCountry,
    geoLocation,
    geoState,
    homeCategory,
    initialCity,
    initialCountry,
    initialLocation,
    initialState,
    isHomePage,
    schoolType,
    schoolTypes,
  ]);

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
    setOrdering(DEFAULT_ORDERING);
    setPage(1);
  }

  const hasFilters = Boolean(
    search || geoCountry || geoState || geoCity || geoLocation || locationGroups.length > 0 || schoolType.length > 0 || board.length > 0 || gender || ordering !== DEFAULT_ORDERING
      || feeMin !== undefined || feeMax !== undefined
  );

  /**
   * Every applied filter as a removable chip, so visitors can see exactly what
   * is narrowing their results and undo one thing at a time.
   */
  const activeFilters = [
    ...(search
      ? [
          {
            key: "search",
            label: `“${search}”`,
            onClear: () => {
              setSearchInput("");
              setSearch("");
            },
          },
        ]
      : []),
    ...schoolType.map((typeId) => {
      const type = schoolTypes.find((item) => item.school_type_id === typeId);
      return {
        key: `type-${typeId}`,
        label: type
          ? schoolTypeLabel(type.type_code, type.slug, type.type_name)
          : "School type",
        onClear: () =>
          setSchoolType((current) => current.filter((id) => id !== typeId)),
      };
    }),
    ...board.map((boardId) => {
      const item = boards.find((entry) => entry.board_id === boardId);
      return {
        key: `board-${boardId}`,
        label: item?.board_name ?? "Education board",
        onClear: () =>
          setBoard((current) => current.filter((id) => id !== boardId)),
      };
    }),
    ...(gender
      ? [
          {
            key: "gender",
            label:
              genderOptions.find((option) => option.value === gender)?.label ??
              "Students",
            onClear: () => setGender(undefined),
          },
        ]
      : []),
    ...(feeMin !== undefined || feeMax !== undefined
      ? [
          {
            key: "fee",
            label: `Fees ${formatRupees(feeMin ?? 0)} – ${formatRupees(
              feeMax ?? 3_000_000,
            )}`,
            onClear: () => setFeeRange([0, 3_000_000]),
          },
        ]
      : []),
    ...(ordering !== DEFAULT_ORDERING
      ? [
          {
            key: "ordering",
            label: `Sorted by ${
              orderingLabels[ordering ?? DEFAULT_ORDERING] ?? DEFAULT_ORDERING
            }`,
            onClear: () => setOrdering(DEFAULT_ORDERING),
          },
        ]
      : []),
  ];

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
      router.push(boardListingPath(
        selectedBoard.slug,
        homeCategory ?? homeSchoolCategoryForIds(schoolType, schoolTypes),
      ));
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
    setGeoCity(boardingOnly && !homeSearchEnabled ? "" : next.city);
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
      {!isHomePage && breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <ol>
            {breadcrumbs.map((crumb, index) =>
              index === breadcrumbs.length - 1 ? (
                <li key={crumb.url} aria-current="page">
                  {crumb.name}
                </li>
              ) : (
                <li key={crumb.url}>
                  <Link href={crumb.url}>{crumb.name}</Link>
                </li>
              ),
            )}
          </ol>
        </nav>
      )}

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

          {isHomePage && (
            <form
              className="hero-search"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                const query = String(new FormData(event.currentTarget).get("q") ?? "").trim();
                router.push(query ? `/schools/?search=${encodeURIComponent(query)}` : "/schools/");
              }}
            >
              <label className="sr-only" htmlFor="home-school-search">Search schools</label>
              <Search size={18} aria-hidden />
              <input id="home-school-search" name="q" type="search" placeholder="Search a school, city, or board" />
              <button type="submit">Search</button>
            </form>
          )}

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

        <div className="hero-art">
          <div className="hero-art__sun" aria-hidden="true" />
          <div className="hero-art__orbit hero-art__orbit--one" aria-hidden="true" />
          <div className="hero-art__orbit hero-art__orbit--two" aria-hidden="true" />
          {isHomePage && (
            <div className="hero-spots">
              {(heroSpots.length ? heroSpots : [
                { key: "boarding", title: "Boarding schools in —", place: "—", count: 0, href: "/schools/boarding-school/" },
                { key: "day", title: "Day schools in —", place: "—", count: 0, href: "/schools/day-school/" },
              ]).map((spot) => (
                <Link className="hero-spot" href={spot.href} key={spot.key}>
                  <strong>{spot.title}</strong>
                  <span>{spot.count > 0 ? `${spot.count} listed · ${spot.place}` : spot.place}</span>
                </Link>
              ))}
            </div>
          )}

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
      {directoryStats.length > 0 && (
        <section className="trust-strip" aria-label="Directory at a glance">
          <div className="trust-strip__stats">
            {directoryStats.map((stat) => (
              <div className="trust-stat" key={stat.label}>
                <strong>{stat.value.toLocaleString("en-IN")}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
          <p className="trust-strip__note">
            <ShieldCheck size={15} aria-hidden />
            Listings are compiled from school-published information. Always
            confirm fees, seats and admission dates directly with the school.
          </p>
        </section>
      )}

      {!isHomePage && showTypeChooser && (
        <section className="home-section home-section--types" id="school-types">
          <div className="home-section__heading home-section__heading--centered">
            <div>
              <div className="section-eyebrow">START HERE</div>
              <h2>What kind of school are you looking for?</h2>
            </div>
          </div>

          <div className="type-browse-grid">
            {schoolTypeChooserCards.map((card) => (
              <Link className="type-browse-card" href={typeChooserPath(card.category)} key={card.slug}>
                <span className="type-browse-card__icon" aria-hidden="true">
                  {card.category === "day-school"
                    ? <GraduationCap size={20} />
                    : <House size={20} />}
                </span>

                <h3>{card.label}</h3>
                <p>{card.text}</p>

                <span className="type-browse-card__action">
                  Browse {card.label.toLowerCase()} <ArrowRight size={15} />
                </span>
              </Link>
            ))}
          </div>

          <p className="type-browse-note">
            <Link href={schoolDirectoryPath()}>Browse every school</Link>
          </p>
        </section>
      )}

      <section className="home-section compare-promo" id="compare-schools">
        <div className="compare-promo__intro">
          <span className="compare-promo__eyebrow"><BarChart3 size={15} /> YOUR SHORTLIST, SIDE BY SIDE</span>
          <h2>Compare schools</h2>
          <p>Add a school, then open the comparison.</p>
          <Link href="/compare/" className="compare-promo__action">
            Open school comparison <ArrowRight size={16} />
          </Link>
          <span className="compare-promo__status" role="status" aria-live="polite">
            {comparePromoMessage || `${comparedSchools.length} of 4 schools in your comparison`}
          </span>
        </div>
        <div className="compare-promo__schools">
          {comparisonSchools.map((school) => {
            const isCompared = comparedSchools.some((item) => item.school_id === school.school_id);
            const cover =
              school.school_image_url ||
              school.school_photos?.[0]?.photo_url ||
              school.school_logo_url ||
              "";
            return (
              <article key={school.school_id} className={isCompared ? "is-shortlisted" : ""}>
                <Link href={schoolHref(school)} className="compare-promo__school-link">
                  <span className="compare-promo__school-image">
                    {cover ? (
                      <Image src={cover} alt="" fill sizes="200px" unoptimized />
                    ) : (
                      <Building2 size={23} aria-hidden />
                    )}
                  </span>
                  <strong>{school.school_name}</strong>
                </Link>
                <button
                  type="button"
                  className={isCompared ? "is-added" : undefined}
                  onClick={() => {
                    if (!isCompared && comparedSchools.length >= 4) {
                      setComparePromoMessage("Remove a school from your comparison before adding another.");
                      return;
                    }
                    toggleSchool(school);
                    setComparePromoMessage(
                      isCompared
                        ? `${school.school_name} removed from comparison.`
                        : `${school.school_name} added to comparison.`,
                    );
                  }}
                >
                  {isCompared ? (
                    <><X size={14} aria-hidden /> Remove from compare</>
                  ) : (
                    <><Plus size={14} aria-hidden /> Add to compare</>
                  )}
                </button>
              </article>
            );
          })}
          {!comparisonSchools.length && (
            <div className="compare-promo__empty">
              <BookOpen size={24} />
              <p>Explore the directory to build your own school shortlist.</p>
              <Link href="/schools">Browse schools</Link>
            </div>
          )}
        </div>
      </section>

      <section className="home-section home-quick-actions" aria-labelledby="home-quick-actions-heading">
        <div className="home-section__heading">
          <div>
            <div className="section-eyebrow">QUICK ACTIONS</div>
            <h2 id="home-quick-actions-heading">Go straight to what you need</h2>
          </div>
        </div>
        <div className="home-quick-actions__grid">
          <Link className="home-quick-action" href={schoolDirectoryPath()}>
            <span><Search size={20} aria-hidden /></span>
            <strong>Browse all schools</strong>
            <small>Open the complete directory</small>
            <ArrowRight size={17} aria-hidden />
          </Link>
          <Link className="home-quick-action" href="/schools/?max_fee=100000">
            <span><CircleDollarSign size={20} aria-hidden /></span>
            <strong>Schools under ₹1 lakh</strong>
            <small>Start with your budget</small>
            <ArrowRight size={17} aria-hidden />
          </Link>
          <Link
            className="home-quick-action"
            href={
              cityCards[0]
                ? placeListingPath({
                    countrySlug: cityCards[0].country_slug ?? cityCards[0].country_name,
                    stateSlug: cityCards[0].state_slug ?? cityCards[0].state_name,
                    citySlug: cityCards[0].slug,
                  })
                : schoolDirectoryPath()
            }
          >
            <span><MapPin size={20} aria-hidden /></span>
            <strong>Choose a location</strong>
            <small>{cityCards[0]?.city_name ?? "Browse popular cities"}</small>
            <ArrowRight size={17} aria-hidden />
          </Link>
          <Link
            className="home-quick-action"
            href={boards[0] ? boardListingPath(boards[0].slug) : schoolDirectoryPath()}
          >
            <span><BookOpen size={20} aria-hidden /></span>
            <strong>Choose a board</strong>
            <small>{boards[0]?.board_name ?? "Browse curricula"}</small>
            <ArrowRight size={17} aria-hidden />
          </Link>
          <Link className="home-quick-action" href="/compare/">
            <span><BarChart3 size={20} aria-hidden /></span>
            <strong>Compare schools</strong>
            <small>Review your shortlist</small>
            <ArrowRight size={17} aria-hidden />
          </Link>
          <CounsellingLink className="home-quick-action">
            <span><MessageCircle size={20} aria-hidden /></span>
            <strong>Get free counselling</strong>
            <small>Talk to our school guidance team</small>
            <ArrowRight size={17} aria-hidden />
          </CounsellingLink>
        </div>
      </section>

      {stateCards.length > 0 && (
        <section className="home-section home-section--states" id="states">
          <div className="home-section__heading">
            <div>
              <div className="section-eyebrow">EXPLORE BY STATE</div>
              <h2>Top states for school search</h2>
            </div>
            <HomeSectionTypeSelector
              value={statesSectionCategory}
              onChange={setStatesSectionCategory}
            />
          </div>

          <div className="city-grid">
            {stateCards.map((state, index) => {
              const hrefFor = (category?: HomeSchoolCategory | null) =>
                placeListingPath({
                  countrySlug: state.country_slug,
                  stateSlug: state.state_slug,
                  category: category ?? statesSectionCategory,
                });
              return (
                <Link
                  className={`city-card city-card--${index + 1}`}
                  key={state.state_id}
                  href={hrefFor(null)}
                  onClick={(event) => {
                    if (statesSectionCategory) return;
                    event.preventDefault();
                    openTypePicker({
                      title: `Schools in ${state.state_name}`,
                      subtitle: "Pick a school type to open the right listings first.",
                      hrefFor: (category) => hrefFor(category),
                      allHref: hrefFor(null),
                      allLabel: `See every school in ${state.state_name}`,
                    });
                  }}
                >
                  <span className="city-card__number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="city-card__name">{state.state_name}</span>
                  <span className="city-card__state">{state.count} schools listed</span>
                  <span className="city-card__action">
                    Explore schools <ArrowRight size={14} />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="home-section home-section--cities" id="cities">
        <div className="home-section__heading">
          <div>
            <div className="section-eyebrow">SCHOOL LOCATIONS</div>
            <h2>Top cities for school search</h2>
          </div>
          <div className="home-section__heading-actions">
            <HomeSectionTypeSelector
              value={citiesSectionCategory}
              onChange={setCitiesSectionCategory}
            />
            {citiesError && (
              <p className="section-error" role="status">
                Cities unavailable: {citiesError}{" "}
                <button type="button" onClick={() => setCitiesRetry((count) => count + 1)}>
                  Retry
                </button>
              </p>
            )}
          </div>
        </div>

        <div
          className="city-grid"
          onMouseEnter={() => {
            const candidates = cities.filter((city) => (city.schools_count ?? 0) > 0);
            for (let index = candidates.length - 1; index > 0; index -= 1) {
              const randomIndex = Math.floor(Math.random() * (index + 1));
              [candidates[index], candidates[randomIndex]] = [
                candidates[randomIndex]!,
                candidates[index]!,
              ];
            }
            setHoveredCityIds(candidates.slice(0, 10).map((city) => city.city_id));
          }}
          onMouseLeave={() => setHoveredCityIds(null)}
        >
          {cityCards.map((city, index) => {
            const hrefFor = (category?: HomeSchoolCategory | null) =>
              placeListingPath({
                countrySlug: city.country_slug ?? city.country_name,
                stateSlug: city.state_slug ?? city.state_name,
                citySlug: city.slug,
                category: category ?? citiesSectionCategory,
              });
            return (
              <Link
                className={`city-card city-card--${index + 1}`}
                key={city.city_id}
                href={hrefFor(null)}
                onClick={(event) => {
                  if (citiesSectionCategory) return;
                  event.preventDefault();
                  openTypePicker({
                    title: `Schools in ${city.city_name}`,
                    subtitle: "Pick a school type to open the right listings first.",
                    hrefFor: (category) => hrefFor(category),
                    allHref: hrefFor(null),
                    allLabel: `See every school in ${city.city_name}`,
                  });
                }}
              >
                <span className="city-card__number">{String(index + 1).padStart(2, "0")}</span>
                <span className="city-card__name">{city.city_name}</span>
                <span className="city-card__state">{city.state_name}</span>
                <span className="city-card__action">
                  Explore schools <ArrowRight size={14} />
                </span>
              </Link>
            );
          })}
          {citiesLoading && (
            <p className="section-empty" role="status">Loading cities…</p>
          )}
          {!citiesLoading && !citiesError && cityCards.length === 0 && (
            <p className="section-empty">
              No active cities with listed schools are available right now.
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
          <HomeSectionTypeSelector
            value={boardsSectionCategory}
            onChange={setBoardsSectionCategory}
          />

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

        {!boardsLoading && boards.length > 0 && (
          <p className="board-meta" role="status">
            {boardSearch
              ? `${boardCards.length} ${boardCards.length === 1 ? "board" : "boards"} match your search`
              : boardsExpanded
                ? `Showing all ${boards.length} education boards`
                : `Showing ${boardCards.length} featured boards of ${boards.length}`}
          </p>
        )}

        <div className="board-groups">
          {boardGroups.map((group) => (
            <section className="board-group" key={group.key} aria-label={group.label}>
              <h3>{group.label}</h3>
              <div className="board-grid">
                {group.boards.map((boardItem, index) => (
                  <Link
                    className={`board-card board-card--${index + 1}`}
                    key={boardItem.board_id}
                    href={boardListingPath(boardItem.slug, boardsSectionCategory)}
                    style={{ "--board-color": boardAccent(boardItem) } as CSSProperties}
                    onClick={(event) => {
                      if (boardsSectionCategory) return;
                      event.preventDefault();
                      openTypePicker({
                        title: `${boardItem.board_name} schools`,
                        subtitle: "Pick a school type to open the right listings first.",
                        hrefFor: (category) => boardListingPath(boardItem.slug, category),
                        allHref: boardListingPath(boardItem.slug),
                        allLabel: `See every ${boardItem.board_name} school`,
                      });
                    }}
                  >
                    <span className="board-card__mark">{boardItem.board_code}</span>
                    <span className="board-card__name">{boardItem.board_name}</span>

                    <span className="board-card__action">
                      Browse schools <ArrowRight size={14} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
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
        {!boardsLoading && boards.length > 4 && !boardSearch && (
          <button
            className="home-directory-toggle"
            type="button"
            aria-expanded={boardsExpanded}
            onClick={() => setBoardsExpanded((expanded) => !expanded)}
          >
            {boardsExpanded ? (
              <>Show featured boards <ChevronDown size={15} aria-hidden /></>
            ) : (
              <>Explore all boards ({boards.length}) <ArrowRight size={15} aria-hidden /></>
            )}
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

      <section className="home-section talk-to-us" id="talk-to-us">
        <div className="talk-to-us__heading">
          <span className="section-eyebrow">HERE WHEN YOU NEED US</span>
          <h2>Talk to a real person about your school search</h2>
          <p>Get clear answers from our team—whether you&apos;re just starting out or ready to shortlist.</p>
        </div>
        <div className="talk-to-us__options">
          <a href="mailto:hello@boardingedu.com">
            <span><Mail size={20} /></span>
            <strong>Email our team</strong>
            <small>hello@boardingedu.com</small>
            <ArrowRight size={16} />
          </a>
          <a href="tel:+918046110000">
            <span><Phone size={20} /></span>
            <strong>Call BoardingEdu</strong>
            <small>+91 80-4611-0000</small>
            <ArrowRight size={16} />
          </a>
          <CounsellingLink>
            <span><MessageCircle size={20} /></span>
            <strong>Request free guidance</strong>
            <small>Tell us your child&apos;s needs</small>
            <ArrowRight size={16} />
          </CounsellingLink>
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
        {(activeCountryId || activeStateId || activeCityId) && (
          <section className="listing-place-spotlight" aria-label={`Explore schools in ${listingPlaceLabel}`}>
            <div className="listing-place-spotlight__heading">
              <span className="section-eyebrow">EXPLORE THIS AREA</span>
              <h2>Find {listingTypeLabel.toLowerCase()} around {listingPlaceLabel}</h2>
              <p>Browse nearby places or explore schools listed in this area.</p>
            </div>
            {placeHighlights.length > 0 && (
              <nav className="listing-place-spotlight__places" aria-label="Nearby school locations">
                {placeHighlights.map((place) => (
                  <Link
                    key={`${place.kind}-${place.label}`}
                    href={withListingFilters(place.href, board, schoolType)}
                  >
                    <MapPin size={14} aria-hidden />
                    {place.kind === "state" ? `Schools in ${place.label}` : place.label}
                    <ArrowRight size={13} aria-hidden />
                  </Link>
                ))}
              </nav>
            )}
            {locationsError && activeCityId && (
              <p className="listing-place-spotlight__error" role="status">{locationsError}</p>
            )}
            <div className="listing-place-spotlight__featured">
              <div className="home-section__heading">
                <div>
                  <div className="section-eyebrow">
                    {featuredFallback ? "LOCAL SCHOOLS" : "LOCAL PICKS"}
                  </div>
                  <h2>
                    {featuredFallback
                      ? `${listingTypeLabel} in ${listingPlaceLabel}`
                      : `Featured ${listingTypeLabel.toLowerCase()} in ${listingPlaceLabel}`}
                  </h2>
                </div>
              </div>
              {featuredLoading ? (
                <p className="section-empty" role="status">Loading featured schools…</p>
              ) : featuredError ? (
                <p className="listing-place-spotlight__error" role="alert">{featuredError}</p>
              ) : featuredSchools.length ? (
                <>
                  {featuredFallback && (
                    <p className="section-empty">
                      No featured schools are listed in this area yet. Here are other published schools nearby.
                    </p>
                  )}
                  <FeaturedSchoolCards schools={featuredSchools} />
                </>
              ) : (
                <p className="section-empty">No schools are listed for this area yet.</p>
              )}
            </div>
          </section>
        )}

        <div className="section-heading">
          <div>
            <div className="section-eyebrow">SCHOOL DIRECTORY</div>
            <h2>{resultsHeading}</h2>
            <p>
              Compare boards, fees, and facilities, then contact schools
              directly or request free counselling.
            </p>
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
                  const rows = schoolTypes.filter((type) =>
                    schoolTypeLabel(type.type_code, type.slug, type.type_name) === label &&
                    (!homeCategory ||
                      homeSchoolCategories(type.type_code, type.slug, type.type_name).includes(homeCategory)),
                  );
                  const ids = rows.map((type) => type.school_type_id);
                  if (!ids.length) return null;
                  const selected = ids.some((id) => schoolType.includes(id));
                  // Day Boarding belongs to both families, so a typed or checked
                  // selection hides only the opposite extreme, never Day Boarding.
                  if (!homeCategory && !selected && filterSelectionFamily &&
                      !rows.some((type) =>
                        homeSchoolCategories(type.type_code, type.slug, type.type_name).includes(filterSelectionFamily))) {
                    return null;
                  }
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
                {boards
                  .filter((item) => !board.length || board.includes(item.board_id))
                  .map((item) => (
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
                <span>
                  {loading
                    ? "Searching schools…"
                    : totalCount === 0
                      ? "No schools found"
                      : `Showing ${firstResultIndex}–${lastResultIndex} of ${totalCount} schools`}
                </span>
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
                  {Object.values(orderingOptions).map((value) => (
                    <option value={value} key={value}>
                      {orderingLabels[value] ?? value}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {activeFilters.length > 0 && (
              <div className="active-filters" aria-label="Applied filters">
                <span className="active-filters__label">Applied</span>

                {activeFilters.map((filter) => (
                  <button
                    type="button"
                    className="active-filter"
                    key={filter.key}
                    onClick={filter.onClear}
                    aria-label={`Remove filter ${filter.label}`}
                  >
                    {filter.label}
                    <X size={13} aria-hidden="true" />
                  </button>
                ))}

                <button
                  type="button"
                  className="active-filters__clear"
                  onClick={clearFilters}
                >
                  Clear all
                </button>
              </div>
            )}

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

            {loading && results.length === 0 && (
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

            {!error && results.length > 0 && (
              <>
                <div className="school-list">
                  {results.map((school) => (
                    <SchoolCard
                      key={school.school_id}
                      school={school}
                      selectedBoards={board}
                      selectedSchoolTypes={schoolType}
                    />
                  ))}
                </div>
                <div
                  className="school-load-more"
                  ref={loadMoreRef}
                  aria-live="polite"
                >
                  {loadMoreError ? (
                    <>
                      <p role="alert">{loadMoreError}</p>
                      <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
                        Retry loading schools
                      </button>
                    </>
                  ) : loading ? (
                    <p role="status"><LoaderCircle className="spin" size={17} /> Loading more schools…</p>
                  ) : hasMoreResults ? (
                    <button type="button" onClick={() => setPage((current) => current + 1)}>
                      Load more schools <ArrowRight size={16} aria-hidden />
                    </button>
                  ) : totalCount > PAGE_SIZE ? (
                    <p>You&apos;ve viewed all {totalCount} schools.</p>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>

        <section className="listing-faq" aria-labelledby="listing-faq-heading">
          <div className="listing-faq__heading">
            <span className="section-eyebrow">PARENT QUESTIONS</span>
            <h2 id="listing-faq-heading">Frequently asked questions</h2>
            {schoolFaqsError && (
              <p role="status">Staff-managed FAQs could not be loaded: {schoolFaqsError}</p>
            )}
          </div>
          <div className="faq-list">
            {listingFaqEntries.map((item, index) => {
              const open = activeFaq === index;
              return (
                <div className={`faq-item ${open ? "faq-item--open" : ""}`} key={item.question}>
                  <button
                    type="button"
                    className="faq-question"
                    aria-expanded={open}
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

        {relatedSearchItems.length > 0 && (
          <nav className="related-searches" aria-labelledby="related-searches-heading">
            <h2 id="related-searches-heading">Related searches</h2>
            <ul>
              {relatedSearchItems.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
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
      <SchoolTypePickerModal request={typePicker} onClose={() => setTypePicker(null)} />
      {isHomePage && botOnboardingOpen && (
        <HomeBotOnboarding
          boards={boards}
          onClose={() => setBotOnboardingOpen(false)}
        />
      )}
      {!isHomePage && !filtersOpen && <CompareBar />}
    </main>
  );
}
