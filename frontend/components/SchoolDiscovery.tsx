"use client";

import {
  ArrowDownUp,
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  Building2,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  LayoutGrid,
  LoaderCircle,
  List as ListView,
  MapPin,
  Mail,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  House,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { fetchAllPages, geography, reviews, schools } from "@/lib/api";
import type {
  BoardListItem,
  CityListItem,
  LocationListItem,
  ReviewListItem,
  PublicRatingSummary,
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
import ReviewSummaryPanel from "@/components/ReviewSummaryPanel";
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
  homeSchoolTypeIds,
  isDiscoverableSchoolType,
  schoolProfilePathFromSlugs,
  schoolTypeLabel,
  toSeoSlug,
  type HomeSchoolCategory,
} from "@/lib/seo-slugs";
import { boardListingPath, placeListingPath, schoolDirectoryPath, schoolEnquiryPath, schoolSearchPath } from "@/lib/school-urls";

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

type StateBrowseItem = {
  state_id: string;
  state_name: string;
  state_slug: string;
  country_slug: string;
  count: number;
};

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

const PLACE_PHOTOS: Record<string, string> = {
  mumbai: "https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?auto=format&fit=crop&w=640&q=60",
  maharashtra: "https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?auto=format&fit=crop&w=640&q=60",
  bengaluru: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=640&q=60",
  bangalore: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=640&q=60",
  karnataka: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=640&q=60",
  dehradun: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=640&q=60",
  mussoorie: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=640&q=60",
  uttarakhand: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=640&q=60",
  delhi: "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=640&q=60",
  pune: "https://images.unsplash.com/photo-1567157577867-05ccb1388e66?auto=format&fit=crop&w=640&q=60",
};

const DEFAULT_PLACE_PHOTO = "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=640&q=60";
const CLASSROOM_PHOTO = "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=640&q=60";
const LIBRARY_PHOTO = "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=640&q=60";

function placeBackdrop(slug: string) {
  const photo = PLACE_PHOTOS[slug.toLowerCase()] ?? DEFAULT_PLACE_PHOTO;
  return `linear-gradient(160deg, rgb(10 24 40 / 78%), rgb(10 24 40 / 38%)), url("${photo}") center / cover no-repeat`;
}

function boardBackdrop(code: string, name: string) {
  const value = `${code} ${name}`.toLowerCase();
  const photo = /ib|cambridge|igcse/.test(value) ? LIBRARY_PHOTO : CLASSROOM_PHOTO;
  return `linear-gradient(160deg, rgb(10 24 40 / 78%), rgb(10 24 40 / 38%)), url("${photo}") center / cover no-repeat`;
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
        {school.is_featured && (
          <span className="school-card__featured">
            <Star size={12} fill="currentColor" aria-hidden />
            Featured
          </span>
        )}
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
            <Link href={schoolEnquiryPath(school)}>Enquire</Link>

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

type InitialDiscoveryFilter = { country?: string; state?: string; city?: string; location?: string; placeName?: string; place?: { countrySlug: string; stateSlug?: string; citySlug?: string; locationSlug?: string }; schoolTypes?: string[]; boardIds?: string[]; boardSlug?: string; homeCategory?: HomeSchoolCategory; search?: string; ordering?: SchoolFilters["ordering"] };
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

function boardSearchPath(board: BoardListItem, category?: HomeSchoolCategory | null) {
  const params = new URLSearchParams({ board: toSeoSlug(board.board_code || board.slug) });
  return `${schoolDirectoryPath(category)}?${params.toString()}`;
}

function randomFeaturedSelection(
  schools: SchoolListItem[],
  requiredSchoolIds: ReadonlySet<string> = new Set(),
  count = 4 + Math.floor(Math.random() * 2),
) {
  const shuffled = [...schools];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex]!, shuffled[index]!];
  }
  const selected = shuffled.slice(0, Math.min(shuffled.length, count));
  const required = shuffled.find((school) => requiredSchoolIds.has(school.school_id));
  if (required && !selected.some((school) => school.school_id === required.school_id)) {
    selected[selected.length - 1] = required;
    for (let index = selected.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [selected[index], selected[randomIndex]] = [selected[randomIndex]!, selected[index]!];
    }
  }
  return selected;
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
  const [homeReviews, setHomeReviews] = useState<ReviewListItem[]>([]);
  const [homeReviewSummary, setHomeReviewSummary] = useState<PublicRatingSummary | null>(null);
  const [homeReviewsError, setHomeReviewsError] = useState<string | null>(null);
  const [homeReviewsLoading, setHomeReviewsLoading] = useState(true);
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
  useEffect(() => {
    if (!isHomePage) return;
    const onboardingSeenKey = "boardingeu:school-discovery-onboarding-seen";
    if (window.sessionStorage.getItem(onboardingSeenKey)) return;
    window.sessionStorage.setItem(onboardingSeenKey, "true");
    setBotOnboardingOpen(true);
  }, [isHomePage]);
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
  const [listingFeaturedError, setListingFeaturedError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [schoolView, setSchoolView] = useState<"grid" | "list">("grid");
  const [topBoardingSchools, setTopBoardingSchools] = useState<SchoolListItem[]>([]);
  const [topDaySchools, setTopDaySchools] = useState<SchoolListItem[]>([]);
  const [topBoardingSchoolsError, setTopBoardingSchoolsError] = useState<string | null>(null);
  const [topBoardingSchoolsLoading, setTopBoardingSchoolsLoading] = useState(true);
  const [topSchoolsCategory, setTopSchoolsCategory] = useState<HomeSchoolCategory>(
    initialFilter?.homeCategory ?? "residential-school",
  );
  const [topSchoolsBoardId, setTopSchoolsBoardId] = useState("");
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
  const reviewCategory = homeCategory ?? homeSchoolCategoryForIds(schoolType, schoolTypes);
  const reviewSchoolTypeIds = useMemo(
    () => schoolTypesLoaded && reviewCategory
      ? homeSchoolTypeIds(schoolTypes, reviewCategory)
      : [],
    [reviewCategory, schoolTypes, schoolTypesLoaded],
  );
  useEffect(() => {
    if (!isHomePage) return;
    let cancelled = false;
    setHomeReviewsLoading(true);
    setHomeReviewsError(null);
    Promise.allSettled([
      reviews.latest(reviewSchoolTypeIds),
      reviews.publicSummary(reviewSchoolTypeIds),
    ]).then(([reviewResult, summaryResult]) => {
      if (cancelled) return;
      if (reviewResult.status === "fulfilled") {
        setHomeReviews(
          reviewResult.value.results
            .filter((review) => review.status === "PUBLISHED")
            .slice(0, 2),
        );
      } else {
        setHomeReviewsError(
          reviewResult.reason instanceof Error
            ? reviewResult.reason.message
            : "Parent reviews are temporarily unavailable.",
        );
      }
      if (summaryResult.status === "fulfilled") {
        setHomeReviewSummary(summaryResult.value);
      } else {
        setHomeReviewsError(
          summaryResult.reason instanceof Error
            ? summaryResult.reason.message
            : "Review ratings are temporarily unavailable.",
        );
      }
      setHomeReviewsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isHomePage, reviewSchoolTypeIds]);
  const [citiesSectionCategory, setCitiesSectionCategory] = useState<HomeSchoolCategory | null>(null);
  const [boardsSectionCategory, setBoardsSectionCategory] = useState<HomeSchoolCategory | null>(null);
  const [selectedState, setSelectedState] = useState<StateBrowseItem | null>(null);
  const [stateCitySearch, setStateCitySearch] = useState("");
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
  const selectedTopBoard = boards.find((item) => item.board_id === topSchoolsBoardId);
  const selectedTopBoardName = selectedTopBoard?.board_name;
  const boardingSchoolTypeIds = useMemo(
    () => homeSchoolTypeIds(schoolTypes, "residential-school"),
    [schoolTypes],
  );
  const daySchoolTypeIds = useMemo(
    () => homeSchoolTypeIds(schoolTypes, "day-school"),
    [schoolTypes],
  );

  useEffect(() => {
    const selectedCategory =
      homeCategory ?? homeSchoolCategoryForIds(schoolType, schoolTypes);
    if (selectedCategory) setTopSchoolsCategory(selectedCategory);
  }, [homeCategory, schoolType, schoolTypes]);

  useEffect(() => {
    if (!board.length || !boards.length) return;
    const selected = boards.find((item) =>
      board.some(
        (value) =>
          item.board_id === value ||
          toSeoSlug(item.slug) === toSeoSlug(value) ||
          toSeoSlug(item.board_code) === toSeoSlug(value),
      ),
    );
    if (selected && selected.board_id !== topSchoolsBoardId) {
      setTopSchoolsBoardId(selected.board_id);
    }
  }, [board, boards, topSchoolsBoardId]);

  useEffect(() => {
    if (isHomePage || !schoolTypesLoaded) return;
    if (boardingSchoolTypeIds.length === 0 && daySchoolTypeIds.length === 0) {
      setTopBoardingSchools([]);
      setTopDaySchools([]);
      setTopBoardingSchoolsLoading(false);
      return;
    }
    let cancelled = false;
    setTopBoardingSchoolsLoading(true);
    const activeCountry = geoCountry || initialFilter?.country;
    const activeState = geoState || initialFilter?.state;
    const activeCity = geoCity || initialFilter?.city;

    const sharedFilters: SchoolFilters = {
      status: true,
      ordering: "-average_rating",
      page_size: 10,
      country: activeCountry || undefined,
      state: activeState || undefined,
      city: activeCity || undefined,
      board: topSchoolsBoardId ? [topSchoolsBoardId] : undefined,
    };
    Promise.all([
      boardingSchoolTypeIds.length
        ? schools.list({ ...sharedFilters, school_type: boardingSchoolTypeIds })
        : Promise.resolve({ results: [] as SchoolListItem[] }),
      daySchoolTypeIds.length
        ? schools.list({ ...sharedFilters, school_type: daySchoolTypeIds })
        : Promise.resolve({ results: [] as SchoolListItem[] }),
    ]).then(([boardingResponse, dayResponse]) => {
      if (!cancelled) {
        setTopBoardingSchools(boardingResponse.results.slice(0, 10));
        setTopDaySchools(dayResponse.results.slice(0, 10));
        setTopBoardingSchoolsError(null);
      }
    }).catch((reason: unknown) => {
      if (!cancelled) {
        setTopBoardingSchools([]);
        setTopDaySchools([]);
        setTopBoardingSchoolsError(
          reason instanceof Error ? reason.message : "Top school recommendations are temporarily unavailable.",
        );
      }
    }).finally(() => {
      if (!cancelled) setTopBoardingSchoolsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [
    boardingSchoolTypeIds,
    daySchoolTypeIds,
    topSchoolsBoardId,
    geoCity,
    geoCountry,
    geoState,
    initialFilter?.city,
    initialFilter?.country,
    initialFilter?.state,
    isHomePage,
    schoolTypesLoaded,
  ]);
  useEffect(() => {
    if (!selectedState) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedState(null);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedState]);

  const heroSpots = useMemo(() => {
    const ranked = cities
      .filter((city) => city.status && (city.schools_count ?? 0) > 0)
      .slice(0, 4);
    return ranked.map((city, index) => {
      const category: HomeSchoolCategory = index % 2 === 0 ? "residential-school" : "day-school";
      const label = category === "residential-school" ? "Boarding schools" : "Day schools";
      return {
        key: city.city_id,
        category,
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
    ? `Browse ${listingFamilyTypes} in ${listingPlaceLabel}. Compare fees, boards, and facilities.`
    : `Browse ${listingSubject} in ${listingPlaceLabel}. Compare fees, boards, and facilities.`;
  const firstResultIndex = totalCount === 0 ? 0 : 1;
  const lastResultIndex = results.length;
  const resultsHeading = `${listingSubject} in ${listingPlaceLabel}`;
  const hasMoreResults = results.length < totalCount;
  const relatedSearchItems = useMemo(() => {
    const category = homeCategory ?? homeSchoolCategoryForIds(schoolType, schoolTypes);
    const categoryLabel = category === "day-school" ? "Day Schools" : "Boarding Schools";
    const currentBoard = boards.find(
      (item) =>
        initialFilter?.boardIds?.includes(item.board_id) ||
        (initialFilter?.boardSlug && toSeoSlug(item.slug) === toSeoSlug(initialFilter.boardSlug)) ||
        board.some(
          (value) =>
            item.board_id === value ||
            toSeoSlug(item.slug) === toSeoSlug(value) ||
            toSeoSlug(item.board_code) === toSeoSlug(value),
        ),
    );
    const categorySearches: RelatedSearch[] = category
      ? []
      : (["day-school", "residential-school"] as const).map((itemCategory) => ({
          label: currentBoard
            ? `${itemCategory === "day-school" ? "Day" : "Boarding"} ${currentBoard.board_name} schools`
            : itemCategory === "day-school" ? "Day schools" : "Boarding schools",
          href: currentBoard
            ? boardListingPath(currentBoard.slug, itemCategory)
            : withListingFilters(schoolDirectoryPath(itemCategory), board, []),
        }));
    const boardSearches = category
      ? boards.slice(0, 8).map((item) => ({
            label: `${item.board_name} ${categoryLabel}`,
            href: boardListingPath(item.slug, category),
          }))
      : currentBoard
        ? []
        : boards.slice(0, 6).map((item) => ({
            label: `${item.board_name} schools`,
            href: boardListingPath(item.slug),
          }));
    const seen = new Set<string>();
    return [...(relatedSearches ?? []), ...categorySearches, ...boardSearches].filter((item) =>
      seen.has(item.href) ? false : (seen.add(item.href), true),
    );
  }, [board, boards, homeCategory, initialFilter?.boardIds, initialFilter?.boardSlug, relatedSearches, schoolType, schoolTypes]);
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
    return boards.filter((item) =>
      `${item.board_name} ${item.board_code}`.toLocaleLowerCase().includes(query),
    );
  }, [boardSearch, boards]);
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
    const grouped = new Map<string, StateBrowseItem>();
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
  const stateModalCities = useMemo(() => {
    if (!selectedState) return [];
    const query = stateCitySearch.trim().toLocaleLowerCase();
    return cities
      .filter(
        (city) =>
          city.state_id === selectedState.state_id &&
          (city.schools_count ?? 0) > 0 &&
          city.city_name.toLocaleLowerCase().includes(query),
      )
      .sort(
        (left, right) =>
          (right.schools_count ?? 0) - (left.schools_count ?? 0) ||
          left.city_name.localeCompare(right.city_name),
      );
  }, [cities, selectedState, stateCitySearch]);
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
    const locationScoped = !isHomePage && Boolean(
      geoCountry || geoState || geoCity || geoLocation ||
      initialCountry || initialState || initialCity || initialLocation,
    );
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
      is_featured: locationScoped ? false : undefined,
      page: page > 1 ? page : undefined,
      page_size: locationScoped ? PAGE_SIZE - 1 : PAGE_SIZE,
    };

    activeQuery.current = queryKey;
    setLoading(true);
    setError(null);
    setLoadMoreError(null);
    if (page === 1) setListingFeaturedError(null);

    async function loadListingSchools() {
      try {
        const response = await schools.list(filters);
        if (cancelled) return;

        let localFeaturedSchool: SchoolListItem | undefined;
        let featuredError: string | null = null;
        if (locationScoped && page === 1) {
          try {
            const candidates = await fetchAllPages(await schools.list({
              ...filters,
              is_featured: true,
              page: undefined,
              page_size: 100,
              ordering: "-average_rating",
            }));
            if (cancelled) return;
            localFeaturedSchool = candidates[
              Math.floor(Math.random() * candidates.length)
            ];
          } catch (reason: unknown) {
            featuredError = reason instanceof Error
              ? reason.message
              : "Could not load a featured school for this location.";
          }
        }

        setListingFeaturedError(featuredError);
        const pageResults = localFeaturedSchool
          ? [localFeaturedSchool, ...response.results]
          : response.results;
        setResults((current) => {
          if (page === 1) return pageResults;
          const existingIds = new Set(current.map((school) => school.school_id));
          return [
            ...current,
            ...pageResults.filter((school) => !existingIds.has(school.school_id)),
          ];
        });
        if (page === 1) {
          setTotalCount((response.count ?? response.results.length) + Number(Boolean(localFeaturedSchool)));
        }
      } catch (reason: unknown) {
        if (cancelled) return;

        const message = reason instanceof Error ? reason.message : "Could not load schools.";
        if (page === 1) {
          setResults([]);
          setTotalCount(0);
          setError(message);
        } else {
          setLoadMoreError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadListingSchools();

    return () => {
      cancelled = true;
    };
  }, [boards, queryRestored, schoolTypesLoaded, pendingTypeSlug, schoolTypes, search, geoCountry, geoState, geoCity, geoLocation, initialCountry, initialState, initialCity, initialLocation, locationGroups, schoolType, homeCategory, board, feeMin, feeMax, gender, ordering, page, queryKey, retryCount, isHomePage]);

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
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    for (const key of new Set(hashParams.keys())) {
      params.delete(key);
      hashParams.getAll(key).forEach((item) => params.append(key, item));
    }
    if (initialCountry || initialState || initialCity || initialLocation || initialSchoolTypeKey || initialBoardKey || initialHomeCategory) {
      initialLocationWasInUrl.current = Boolean(initialCountry || initialState || initialCity || initialLocation);
      const scopedSearch = initialFilter?.search ?? params.get("search") ?? "";
      setSearch(scopedSearch);
      setSearchInput(scopedSearch);
      // A path scope (place, board or school type) still honours an explicit
      // ?board= scope — this is how footer "CBSE boarding schools in <city>"
      // links keep their board filter instead of falling back to every board.
      const scopedBoards = params.getAll("board");
      setBoard(scopedBoards.length ? scopedBoards : initialBoardKey ? initialBoardKey.split(",") : []);
      setSchoolType(initialSchoolTypeKey ? initialSchoolTypeKey.split(",") : []);
      setHomeCategory(initialHomeCategory ?? homeSchoolCategoryFromValue(params.get("home_category")));
      setGeoCountry(initialCountry ?? "");
      setGeoState(initialState ?? "");
      setGeoCity(initialCity ?? "");
      setGeoLocation(initialLocation ?? "");
      setLocationGroups([]);
      const min = Number(params.get("min_fee") ?? 0);
      const max = Number(params.get("max_fee") ?? 3_000_000);
      if (Number.isFinite(min) && Number.isFinite(max) && min < max) {
        setFeeRange([min, max]);
      }
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
    const initialSearch = initialFilter?.search ?? params.get("search") ?? "";
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
  }, [initialCountry, initialState, initialCity, initialLocation, initialSchoolTypeKey, initialBoardKey, initialHomeCategory, initialFilter?.search]);

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
      page_size: isHomePage ? 10 : 100,
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
        let featuredCandidates = featuredResponse.results;
        let otherLocationIds = new Set<string>();
        if (!isHomePage && (activeCountry || activeState || activeCity || activeLocation)) {
          const globalResponse = await schools.list({
            ...featuredFilters,
            country: undefined,
            state: undefined,
            city: undefined,
            location: undefined,
            page_size: 100,
          });
          if (cancelled) return;
          const candidateIds = new Set(featuredCandidates.map((school) => school.school_id));
          const isOutsideListingArea = (school: SchoolListItem) => {
            if (featuredFilters.location) return school.location_id !== featuredFilters.location;
            if (featuredFilters.city) return school.city_id !== featuredFilters.city;
            if (featuredFilters.state) return school.state_id !== featuredFilters.state;
            if (featuredFilters.country) return school.country_id !== featuredFilters.country;
            return true;
          };
          otherLocationIds = new Set(
            globalResponse.results
              .filter((school) => !candidateIds.has(school.school_id) && isOutsideListingArea(school))
              .map((school) => school.school_id),
          );
          featuredCandidates = [
            ...featuredCandidates,
            ...globalResponse.results.filter((school) => otherLocationIds.has(school.school_id)),
          ];
        }
        if (featuredCandidates.length > 0) {
          setFeaturedSchools(
            randomFeaturedSelection(featuredCandidates, otherLocationIds, 4),
          );
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
        setFeaturedSchools(randomFeaturedSelection(localResponse.results, new Set(), 4));
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
      router.push(schoolDirectoryPath());
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
      void navigateHomeSearch(query);
      return;
    }
    setSearchInput(query);
    setSearch(query);
    setBoard([]);
    setSchoolType([]);
    setFeeRange([0, 3_000_000]);
    setGender(undefined);
  }

  async function navigateHomeSearch(query: string) {
    const normalizedQuery = toSeoSlug(query);
    if (!normalizedQuery) {
      router.push(schoolDirectoryPath());
      return;
    }

    const boardSearch = toSeoSlug(query.trim().replace(/\s+(schools?|board)$/i, ""));
    const board = boards.find((item) =>
      [item.board_code, item.slug, item.board_name].some((value) =>
        toSeoSlug(value) === normalizedQuery || toSeoSlug(value) === boardSearch,
      ),
    );
    if (board) {
      router.push(boardSearchPath(
        board,
        homeCategory ?? homeSchoolCategoryForIds(schoolType, schoolTypes),
      ));
      return;
    }

    const cityQuery = query.trim()
      .replace(/^(schools?\s+(in|near)\s+)/i, "")
      .replace(/\s+schools?$/i, "");
    const citySlug = toSeoSlug(cityQuery);
    const city = cities.find((item) =>
      [item.slug, item.city_name].some((value) => toSeoSlug(value) === citySlug),
    );
    if (city) {
      router.push(placeListingPath({
        countrySlug: city.country_slug ?? city.country_name,
        stateSlug: city.state_slug ?? city.state_name,
        citySlug: city.slug,
      }));
      return;
    }

    try {
      const schoolPage = await schools.list({ search: query, page_size: 10 });
      const exactSchool = schoolPage.results.find(
        (item) => toSeoSlug(item.school_name) === normalizedQuery || toSeoSlug(item.slug) === normalizedQuery,
      );
      if (exactSchool) {
        router.push(schoolHref(exactSchool));
        return;
      }
    } catch {
      // The slugged search route remains available if live school matching is unavailable.
    }
    router.push(schoolSearchPath(query));
  }

  function selectBoard(selectedBoard: BoardListItem) {
    if (isHomePage) {
      router.push(boardSearchPath(
        selectedBoard,
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
      const category = homeSchoolCategories(
        selectedType.type_code,
        selectedType.slug,
        selectedType.type_name,
      )[0];
      router.push(category ? schoolDirectoryPath(category) : schoolDirectoryPath());
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
              ? "Compare school fees, boards, and facilities. Find the right fit for your child."
              : listingDescription}
          </p>

          {isHomePage && (
            <form
              className="hero-search"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                const query = String(new FormData(event.currentTarget).get("q") ?? "").trim();
                void navigateHomeSearch(query);
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

          {isHomePage && (
            <nav className="hero-quick-links" aria-label="Popular school searches">
              <Link href={schoolDirectoryPath("day-school")}>Day schools</Link>
              <Link href={schoolDirectoryPath("residential-school")}>Boarding schools</Link>
              <Link href="/compare/">Compare schools</Link>
              {boards[0] && <Link href={boardListingPath(boards[0].slug)}>{boards[0].board_name} schools</Link>}
              <button type="button" onClick={() => setBotOnboardingOpen(true)}>
                <Bot size={14} aria-hidden /> School discovery assistant
              </button>
            </nav>
          )}

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
                { key: "boarding", category: "residential-school" as const, title: "Boarding schools in —", place: "—", count: 0, href: "/schools/boarding-school/" },
                { key: "day", category: "day-school" as const, title: "Day schools in —", place: "—", count: 0, href: "/schools/day-school/" },
              ])
                .filter((spot) => !homeCategory || spot.category === homeCategory)
                .map((spot) => (
                <Link className="hero-spot" href={spot.href} key={spot.key}>
                  <strong className="hero-spot__title">{spot.title}</strong>
                  <strong className="hero-spot__mobile-title">
                    {spot.category === "day-school" ? "Day schools" : "Boarding schools"}
                  </strong>
                  <span className="hero-spot__details">
                    {spot.count > 0 ? `${spot.count} listed · ${spot.place}` : spot.place}
                  </span>
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

      {stateCards.length > 0 && (
        <section className="home-section home-section--states" id="states">
          <div className="home-section__heading">
            <div>
              <div className="section-eyebrow">EXPLORE BY STATE</div>
              <h2>Top states for school search</h2>
              <p>Choose a state to explore its cities and school listings.</p>
            </div>
          </div>

          <div className="city-grid">
            {stateCards.map((state, index) => (
              <button
                className={`city-card state-city-trigger city-card--${index + 1}`}
                key={state.state_id}
                type="button"
                style={{ background: placeBackdrop(state.state_slug) }}
                onClick={() => {
                  setStateCitySearch("");
                  setSelectedState(state);
                }}
                aria-label={`Explore cities in ${state.state_name}, ${state.count} schools listed`}
                aria-haspopup="dialog"
                aria-expanded={selectedState?.state_id === state.state_id}
              >
                <span className="city-card__number">{String(index + 1).padStart(2, "0")}</span>
                <span className="city-card__name">{state.state_name}</span>
                <span className="city-card__state">{state.count} schools listed</span>
                <span className="city-card__action">
                  Explore cities <ArrowRight size={14} aria-hidden />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {selectedState && (
        <div className="state-explorer" role="presentation">
          <button
            className="state-explorer__backdrop"
            type="button"
            aria-label="Close state city explorer"
            onClick={() => setSelectedState(null)}
          />
          <section
            className="state-explorer__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="state-explorer-title"
            aria-describedby="state-explorer-description"
            onKeyDown={(event) => {
              if (event.key === "Escape") setSelectedState(null);
            }}
          >
            <div className="state-explorer__header">
              <div>
                <span className="section-eyebrow">EXPLORE BY CITY</span>
                <h2 id="state-explorer-title">Schools in {selectedState.state_name}</h2>
                <p id="state-explorer-description">
                  Choose a city, then open all schools, day schools, or boarding schools.
                </p>
              </div>
              <button
                className="state-explorer__close"
                type="button"
                aria-label="Close city explorer"
                onClick={() => setSelectedState(null)}
                autoFocus
              >
                <X size={19} aria-hidden />
              </button>
            </div>

            <label className="state-explorer__search">
              <Search size={17} aria-hidden />
              <span className="sr-only">Search cities in {selectedState.state_name}</span>
              <input
                type="search"
                value={stateCitySearch}
                onChange={(event) => setStateCitySearch(event.target.value)}
                placeholder="Search cities"
              />
            </label>

            <div className="state-explorer__cities">
              {stateModalCities.map((city) => {
                const place = {
                  countrySlug: city.country_slug ?? city.country_name,
                  stateSlug: city.state_slug ?? city.state_name,
                  citySlug: city.slug,
                };
                return (
                  <article className="state-city-card" key={city.city_id}>
                    <div className="state-city-card__heading">
                      <span className="state-city-card__icon"><MapPin size={17} aria-hidden /></span>
                      <span>
                        <strong>{city.city_name}</strong>
                        <small>{city.schools_count ?? 0} listed schools</small>
                      </span>
                    </div>
                    <div className="state-city-card__links" aria-label={`School types in ${city.city_name}`}>
                      <Link href={placeListingPath(place)} onClick={() => setSelectedState(null)}>
                        All schools <ArrowRight size={13} aria-hidden />
                      </Link>
                      <Link href={placeListingPath({ ...place, category: "day-school" })} onClick={() => setSelectedState(null)}>
                        Day schools <ArrowRight size={13} aria-hidden />
                      </Link>
                      <Link href={placeListingPath({ ...place, category: "residential-school" })} onClick={() => setSelectedState(null)}>
                        Boarding schools <ArrowRight size={13} aria-hidden />
                      </Link>
                    </div>
                  </article>
                );
              })}
              {!stateModalCities.length && (
                <p className="state-explorer__empty">
                  {stateCitySearch
                    ? "No cities match your search. Try another city name."
                    : "No cities with published school listings are available for this state yet."}
                </p>
              )}
            </div>
          </section>
        </div>
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
                style={{ background: placeBackdrop(city.slug) }}
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
              : `Showing all ${boardCards.length} education boards`}
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
                    style={{ background: boardBackdrop(boardItem.board_code, boardItem.board_name) }}
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
          <span className="section-eyebrow">NEED A HAND?</span>
          <h2>Talk to our team</h2>
          <p>Questions about your school search? We&apos;re happy to help.</p>
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

      <section className="home-section home-reviews" aria-labelledby="home-reviews-heading">
        <div className="home-section__heading">
          <div>
            <div className="section-eyebrow">PARENT VOICES</div>
            <h2 id="home-reviews-heading">
              {reviewCategory === "day-school"
                ? "Day school parent reviews"
                : reviewCategory === "residential-school"
                  ? "Boarding school parent reviews"
                  : "Reviews from school communities"}
            </h2>
            <p>
              {reviewCategory
                ? `Read published feedback from parents about ${reviewCategory === "day-school" ? "day" : "boarding"} schools.`
                : "Read published feedback shared by parents about their school experiences."}
            </p>
          </div>
          <Link href={schoolDirectoryPath()} className="home-reviews__browse">
            Explore schools <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
        {homeReviewsLoading ? (
          <p className="home-reviews__status" role="status">Loading published reviews…</p>
        ) : homeReviewsError ? (
          <p className="home-reviews__status home-reviews__status--error" role="alert">
            Reviews are temporarily unavailable. Please try again later.
          </p>
        ) : homeReviewSummary ? (
          <div className="home-reviews__layout">
            <ReviewSummaryPanel summary={homeReviewSummary} />
            {homeReviews.length > 0 ? (
              <div className="home-reviews__grid">
                {homeReviews.map((review) => (
                  <article className="home-review-card" key={review.review_id}>
                    <div className="home-review-card__head">
                      <span className="home-review-card__avatar" aria-hidden="true">
                        {review.author_name.trim().charAt(0).toUpperCase() || "P"}
                      </span>
                      <span className="home-review-card__identity">
                        <strong>{review.author_name}</strong>
                        <small>
                          {new Date(review.created_at).toLocaleDateString("en-IN", {
                            month: "long",
                            year: "numeric",
                            timeZone: "UTC",
                          })} · Published review
                        </small>
                      </span>
                      {review.is_verified && <span className="home-review-card__verified">Verified</span>}
                    </div>
                    <div className="home-review-card__rating" aria-label={`${review.rating} out of 5 stars`}>
                      {Array.from({ length: 5 }, (_, index) => (
                        <Star
                          key={index}
                          size={15}
                          fill={index < review.rating ? "currentColor" : "none"}
                          aria-hidden
                        />
                      ))}
                      <strong>{review.rating.toFixed(1)} / 5</strong>
                    </div>
                    {review.title && <h3>{review.title}</h3>}
                    {review.body && <p>{review.body}</p>}
                    <Link
                      className="home-review-card__school"
                      href={`/schools/${toSeoSlug(review.school_slug)}/`}
                    >
                      <span className="home-review-card__school-image">
                        {review.school_image_url || review.school_logo_url ? (
                          <Image
                            src={review.school_image_url || review.school_logo_url || ""}
                            alt=""
                            width={48}
                            height={48}
                            unoptimized
                          />
                        ) : (
                          <Building2 size={20} aria-hidden />
                        )}
                      </span>
                      <span>
                        <strong>{review.school_name}</strong>
                        <small>
                          {[review.school_city_name, review.school_state_name]
                            .filter(Boolean)
                            .join(", ") || "View school profile"}
                        </small>
                      </span>
                      <ArrowRight size={15} aria-hidden />
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <p className="home-reviews__status">
                {homeReviewSummary.review_count > 0
                  ? "Recent review cards are temporarily unavailable."
                  : "No published parent reviews yet. Check back as school communities share their experiences."}
              </p>
            )}
          </div>
        ) : (
          <p className="home-reviews__status">
            {homeReviewsError
              ? "Published reviews are temporarily unavailable. Please try again later."
              : "No published parent reviews yet. Check back as school communities share their experiences."}
          </p>
        )}
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
              Compare fees, boards, facilities, and admission details, then contact schools directly.
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
              <div className="school-view-toggle" role="group" aria-label="School result layout">
                <button
                  type="button"
                  className={schoolView === "grid" ? "is-active" : ""}
                  aria-label="Show schools in grid view"
                  aria-pressed={schoolView === "grid"}
                  onClick={() => setSchoolView("grid")}
                >
                  <LayoutGrid size={16} aria-hidden />
                  <span>Grid</span>
                </button>
                <button
                  type="button"
                  className={schoolView === "list" ? "is-active" : ""}
                  aria-label="Show schools in list view"
                  aria-pressed={schoolView === "list"}
                  onClick={() => setSchoolView("list")}
                >
                  <ListView size={16} aria-hidden />
                  <span>List</span>
                </button>
              </div>
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

            {listingFeaturedError && (
              <p className="listing-place-spotlight__error" role="status">
                A featured school for this location could not be loaded. The remaining schools are still available below.
              </p>
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
                <div className={`school-list school-list--${schoolView}`}>
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
                  ) : totalCount > PAGE_SIZE ? (
                    <p>You&apos;ve viewed all {totalCount} schools.</p>
                  ) : null}
                </div>
              </>
            )}
          </div>
          <aside className="top-boarding-schools" aria-labelledby="top-boarding-schools-heading">
            <div className="top-boarding-schools__heading">
              <span className="section-eyebrow">TOP PICKS</span>
              <h2 id="top-boarding-schools-heading">
                Top 10{selectedTopBoardName ? ` ${selectedTopBoardName}` : ""}{" "}
                {topSchoolsCategory === "residential-school" ? "boarding" : "day"} schools
              </h2>
            </div>
            {topBoardingSchoolsLoading ? (
              <p className="top-boarding-schools__status" role="status">
                Loading schools…
              </p>
            ) : topBoardingSchoolsError ? (
              <p className="top-boarding-schools__status" role="status">
                {topBoardingSchoolsError}
              </p>
            ) : (topSchoolsCategory === "residential-school" ? topBoardingSchools : topDaySchools).length ? (
              <ul>
                {(topSchoolsCategory === "residential-school" ? topBoardingSchools : topDaySchools).map((school) => (
                  <li key={school.school_id}>
                    <Link href={schoolHref(school)}>
                      {school.school_name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="top-boarding-schools__status" role="status">
                Top {topSchoolsCategory === "residential-school" ? "boarding" : "day"} schools will appear as listings are available.
              </p>
            )}
          </aside>
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
          cities={cities}
          onClose={() => setBotOnboardingOpen(false)}
        />
      )}
      {!isHomePage && !filtersOpen && <CompareBar />}
    </main>
  );
}
