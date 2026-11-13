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
  MessageSquare,
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
import type { CSSProperties, FormEvent } from "react";
import {
  apiErrorMessage,
  dashboards,
  fetchAllPages,
  geography,
  guideContent,
  reviews,
  schools,
} from "@/lib/api";
import { publicSchoolImageUrl, schoolCoverImageUrl } from "@/lib/school-media";
import { boardsAffiliatedLabel } from "@/lib/board-labels";
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
  GuideSummary as ApiGuideSummary,
} from "@/lib/api";
import FeeRangeFilter from "@/components/search/FeeRangeFilter";
import SearchCommandPalette from "@/components/search/SearchCommandPalette";
import SchoolSearchAutocomplete from "@/components/search/SchoolSearchAutocomplete";
import CompareBar from "@/components/search/CompareBar";
import HeroFinder, { type HeroFinderValue } from "@/components/home/HeroFinder";
import CounsellingSection from "@/components/home/CounsellingSection";
import ReviewSummaryPanel from "@/components/ReviewSummaryPanel";
import PublicReviewCard from "@/components/PublicReviewCard";
import ReviewsCollection from "@/components/ReviewsCollection";
import FeaturedSchoolCards from "@/components/home/FeaturedSchoolCards";
import FeaturedSchoolCarousel from "@/components/home/FeaturedSchoolCarousel";
import RecentlyViewedSchools from "@/components/home/RecentlyViewedSchools";
import AnimatedCount from "@/components/home/AnimatedCount";
import GuideBrowser from "@/components/guides/GuideBrowser";
import FeaturedGuide from "@/components/guides/FeaturedGuide";
import HomeBotOnboarding from "@/components/home/HomeBotOnboarding";
import IndiaRegionPickerModal from "@/components/home/IndiaRegionPickerModal";
import SchoolTypePickerModal, { type SchoolTypePickerRequest } from "@/components/home/SchoolTypePickerModal";
import {
  createLocationPreferences,
  isBoardingOnlySelection,
  normalizeLocationPreferences,
  type LocationPreferences,
} from "@/lib/location-preferences";
import { INDIA_REGIONS, indiaRegionById, indiaRegionBySlug, indiaRegionForState } from "@/lib/india-regions";
import {
  exploreItems,
  faqItems,
  howItWorksSteps,
} from "@/lib/home-content";
import { useSearchExperience } from "@/lib/search-experience";
import { trackSearchEvent } from "@/lib/search-analytics";
import { SITE_EMAIL, SITE_PHONE, SITE_PHONE_DISPLAY } from "@/lib/site";
import { guideList } from "@/lib/guides";
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
import { boardListingPath, indiaRegionBoardListingPath, indiaRegionListingPath, placeListingPath, schoolDirectoryPath, schoolEnquiryPath, schoolSearchPath } from "@/lib/school-urls";

function schoolHref(school: SchoolListItem) {
  return schoolProfilePathFromSlugs({
    countrySlug: school.country_slug,
    stateSlug: school.state_slug,
    citySlug: school.city_slug,
    localitySlug: school.location_slug,
    schoolSlug: school.slug,
    schoolName: school.school_name,
    schoolTypes: school.school_types_detail,
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
type IndiaRegionBrowseItem = {
  id: (typeof INDIA_REGIONS)[number]["id"];
  label: string;
  count: number;
  stateIds: string[];
};

const DEFAULT_ORDERING: NonNullable<SchoolFilters["ordering"]> = "-is_featured";

const PAGE_SIZE = 12;
const schoolGuides = guideList();
const staticHomeFaqs: SchoolFAQListItem[] = [
  {
    faq_id: "saved-home-faq-general",
    question: "How do I get started with BoardingEdu?",
    answer: "Browse schools by location, school type, grade, and board, then open a school's profile to review the information it has published.",
    category: "GENERAL",
  },
  ...faqItems.map((item, index): SchoolFAQListItem => ({
    faq_id: `saved-home-faq-${index}`,
    question: item.question,
    answer: item.answer,
    category: index === 0 || index === 1 || index === 2 || index === 5 ? "FINDING" : "ADMISSIONS",
  })),
  {
    faq_id: "saved-home-faq-fees",
    question: "Are fee estimates the final amount a school will charge?",
    answer: "No. Estimates use the school's published fee schedule and may exclude variable or optional charges. Confirm the current total and payment dates directly with the school.",
    category: "FEES",
  },
  {
    faq_id: "saved-home-faq-boarding",
    question: "How can I check what boarding facilities a school provides?",
    answer: "Review the facilities published on the school's profile and ask the school about supervision, accommodation arrangements, meals, and student wellbeing during your visit.",
    category: "BOARDING",
  },
  {
    faq_id: "saved-home-faq-parent-account",
    question: "What can I do from a parent account?",
    answer: "A parent account can help you manage your profile, shortlist schools, track admission enquiries, and review updates linked to your account.",
    category: "PARENT_ACCOUNTS",
  },
  {
    faq_id: "saved-home-faq-school-profile",
    question: "How can a school administrator update a school profile?",
    answer: "A school administrator can use the school dashboard to submit profile, grade, facility, photograph, and fee updates. Some updates require review before they are published.",
    category: "SCHOOL_PROFILES",
  },
  {
    faq_id: "saved-home-faq-privacy",
    question: "Who can see my admission enquiries and documents?",
    answer: "Admission information is provided to the relevant school and authorized platform staff to support the enquiry. Do not send sensitive documents unless the school requests them through an appropriate channel.",
    category: "PRIVACY",
  },
];

function uniqueSchoolsById(schoolsToFilter: SchoolListItem[]) {
  const seen = new Set<string>();
  return schoolsToFilter.filter((school) => {
    if (seen.has(school.school_id)) return false;
    seen.add(school.school_id);
    return true;
  });
}

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

const REGION_PHOTOS: Record<string, string> = {
  north: PLACE_PHOTOS.uttarakhand,
  south: PLACE_PHOTOS.karnataka,
  east: DEFAULT_PLACE_PHOTO,
  west: PLACE_PHOTOS.maharashtra,
  central: CLASSROOM_PHOTO,
};

function placeBackdrop(slug: string) {
  const normalizedSlug = slug.toLowerCase();
  const photo = REGION_PHOTOS[normalizedSlug] ?? PLACE_PHOTOS[normalizedSlug] ?? DEFAULT_PLACE_PHOTO;
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
  className = "",
  style,
}: {
  school: SchoolListItem;
  selectedBoards?: string[];
  selectedSchoolTypes?: string[];
  className?: string;
  style?: CSSProperties;
}) {
  const {
    comparedSchools,
    limitReached,
    toggleSchool,
  } = useSearchExperience();
  const isCompared = comparedSchools.some(
    (item) => item.school_id === school.school_id
  );
  const [coverImageFailed, setCoverImageFailed] = useState(false);
  const [logoImageFailed, setLogoImageFailed] = useState(false);
  const location = [school.city_name, school.state_name]
    .filter(Boolean)
    .join(", ");

  const href = schoolHref(school);
  const coverImage = schoolCoverImageUrl(school);
  const logoImage = publicSchoolImageUrl(school.school_logo_url || "");
  const initials = (school.short_name || school.school_name).slice(0, 2).toUpperCase();

  return (
    <article className={`school-card${className ? ` ${className}` : ""}`} style={style}>
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
        {coverImage && !coverImageFailed ? (
          <Image
            className="school-card__media-image"
            src={coverImage}
            alt={`${school.school_name} campus`}
            fill
            sizes="(max-width: 820px) 100vw, 420px"
            unoptimized
            onError={() => setCoverImageFailed(true)}
          />
        ) : (
          <Image
            className="school-card__media-image"
            src="/school-cover-fallback.svg"
            alt=""
            fill
            sizes="(max-width: 800px) 100vw, 50vw"
          />
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
            {logoImage && !logoImageFailed ? (
              <Image
                src={logoImage}
                alt={`${school.school_name} logo`}
                width={88}
                height={88}
                unoptimized
                onError={() => setLogoImageFailed(true)}
              />
            ) : (
              <span aria-label={`${school.school_name} logo unavailable`}>{initials}</span>
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
          {school.boards_detail.length > 0 && (
            <span className="school-tag school-tag--blue">
              {boardsAffiliatedLabel(
                school.boards_detail.filter((item) => !selectedBoards.length || selectedBoards.includes(item.board_id)),
              ) || boardsAffiliatedLabel(school.boards_detail)}
            </span>
          )}
          {school.grades_range && (
            <span className="school-tag school-tag--blue">Classes {school.grades_range}</span>
          )}
          {school.school_types_detail
            .filter((type) => !selectedSchoolTypes.length || selectedSchoolTypes.includes(type.school_type_id))
            .map((type) => (
            <span className="school-tag" key={type.school_type_id}>
              {schoolTypeLabel(type.type_code, type.slug, type.type_name)}
            </span>
          ))}

          {school.gender && (
            <span className="school-tag school-tag--plain">
              {school.gender}
            </span>
          )}
        </div>

        <div className="school-card__footer">
          <div className="school-card__actions">
            <Link className="school-card__enquire" href={schoolEnquiryPath(school)}>
              <MessageSquare size={15} aria-hidden />
              Enquire
            </Link>
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
            <Link className="school-card__view" href={href}>View Details</Link>
          </div>
        </div>
      </div>
    </article>
  );
}

type InitialDiscoveryFilter = { country?: string; state?: string; city?: string; location?: string; region?: (typeof INDIA_REGIONS)[number]["id"]; placeName?: string; place?: { countrySlug: string; stateSlug?: string; citySlug?: string; locationSlug?: string }; schoolTypes?: string[]; boardIds?: string[]; boardSlug?: string; homeCategory?: HomeSchoolCategory; search?: string; ordering?: SchoolFilters["ordering"] };
type RelatedSearch = { label: string; href: string };
type Breadcrumb = { name: string; url: string };
type PlaceHighlight = { label: string; href: string; kind: "state" | "city" | "locality" };
const finderScrollStorageKey = "boardingeu:finder-scroll-path";

function TopBoardingSchools({
  category,
  boardName,
  boardingSchools,
  daySchools,
  loading,
  error,
}: {
  category: HomeSchoolCategory;
  boardName: string | null;
  boardingSchools: SchoolListItem[];
  daySchools: SchoolListItem[];
  loading: boolean;
  error: string | null;
}) {
  const schools = category === "residential-school" ? boardingSchools : daySchools;

  return (
    <aside className="top-boarding-schools" aria-labelledby="top-boarding-schools-heading">
      <div className="top-boarding-schools__heading">
        <span className="section-eyebrow">TOP PICKS</span>
        <h2 id="top-boarding-schools-heading">
          Top 10{boardName ? ` ${boardName}` : ""}{" "}
          {category === "residential-school" ? "boarding" : "day"} schools
        </h2>
      </div>
      {loading ? (
        <p className="top-boarding-schools__status" role="status">
          Loading schools…
        </p>
      ) : error ? (
        <p className="top-boarding-schools__status" role="status">
          {error}
        </p>
      ) : schools.length ? (
        <ul>
          {schools.map((school) => (
            <li key={school.school_id}>
              <Link href={schoolHref(school)}>{school.school_name}</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="top-boarding-schools__status" role="status">
          Top {category === "residential-school" ? "boarding" : "day"} schools will appear as listings are available.
        </p>
      )}
    </aside>
  );
}

function withListingFilters(href: string, boards: string[]) {
  const url = new URL(href, "https://boardingeu.invalid");
  url.searchParams.delete("school_type");
  boards.forEach((id) => {
    if (!url.searchParams.getAll("board").includes(id)) url.searchParams.append("board", id);
  });
  return `${url.pathname}${url.search}`;
}

function boardSearchPath(board: BoardListItem, category?: HomeSchoolCategory | null) {
  const url = new URL(schoolDirectoryPath(category), "https://boardingeu.invalid");
  url.searchParams.set("board", toSeoSlug(board.board_code || board.slug));
  return `${url.pathname}${url.search}`;
}

function randomFeaturedSelection(
  schools: SchoolListItem[],
  requiredSchoolIds: ReadonlySet<string> = new Set(),
  count = 4 + Math.floor(Math.random() * 2),
) {
  const shuffled = uniqueSchoolsById(schools);
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
    <div className="home-section__type-filter">
      <label className="home-section__type-selector">
        <span>Show boards for</span>
        <span className="home-section__type-select">
          <span className="sr-only">Filter boards by school type</span>
          <select
            value={value ?? ""}
            aria-label="Filter boards by school type"
            onChange={(event) =>
              onChange(homeSchoolCategoryFromValue(event.target.value))
            }
          >
            <option value="">All school types</option>
            <option value="day-school">Day schools</option>
            <option value="residential-school">Boarding schools</option>
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </span>
      </label>
      <span className="home-section__type-hint" aria-live="polite">
        {value === "day-school"
          ? "Showing boards for day schools"
          : value === "residential-school"
            ? "Showing boards for boarding schools"
            : "Browse boards for every school type"}
      </span>
    </div>
  );
}

export default function SchoolDiscovery({ initialFilter, relatedSearches, breadcrumbs }: { initialFilter?: InitialDiscoveryFilter; relatedSearches?: RelatedSearch[]; breadcrumbs?: Breadcrumb[] } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [reviewsDialogOpen, setReviewsDialogOpen] = useState(false);
  const isHomePage = pathname === "/" || (pathname === "/reviews/" && reviewsDialogOpen);
  const { comparedSchools, toggleSchool } = useSearchExperience();
  const [comparePromoMessage, setComparePromoMessage] = useState("");
  const [homeReviews, setHomeReviews] = useState<ReviewListItem[]>([]);
  const [homeReviewSummary, setHomeReviewSummary] = useState<PublicRatingSummary | null>(null);
  const [homeReviewsError, setHomeReviewsError] = useState<string | null>(null);
  const [homeReviewSummaryError, setHomeReviewSummaryError] = useState<string | null>(null);
  const [homeReviewsLoading, setHomeReviewsLoading] = useState(true);
  const [typePicker, setTypePicker] = useState<SchoolTypePickerRequest | null>(null);
  const [homeSummary, setHomeSummary] = useState<{
    schools_listed: number;
    cities_covered: number;
    published_reviews: number;
    last_updated: string | null;
  } | null>(null);
  const [homeSummaryError, setHomeSummaryError] = useState<string | null>(null);
  const [publishedGuides, setPublishedGuides] = useState<ApiGuideSummary[]>(schoolGuides);
  const [guidesError, setGuidesError] = useState<string | null>(null);
  const [homeFaqs, setHomeFaqs] = useState<SchoolFAQListItem[]>(staticHomeFaqs);
  const [homeFaqsError, setHomeFaqsError] = useState<string | null>(null);
  const [activeFaqCategory, setActiveFaqCategory] =
    useState<SchoolFAQListItem["category"]>("ADMISSIONS");
  const [trustDetailsOpen, setTrustDetailsOpen] = useState(false);
  const [faqSearch, setFaqSearch] = useState("");
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
  useEffect(() => {
    if (!isHomePage) return;
    let active = true;
    dashboards.publicSummary()
      .then((summary) => {
        if (active) {
          setHomeSummary(summary);
          setHomeSummaryError(null);
        }
      })
      .catch((reason: unknown) => {
        if (active) setHomeSummaryError(apiErrorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [isHomePage]);
  useEffect(() => {
    if (!isHomePage) return;
    let active = true;
    guideContent.list()
      .then((page) => fetchAllPages(page))
      .then((rows) => {
        if (active) {
          setPublishedGuides(rows);
          setGuidesError(null);
        }
      })
      .catch((reason: unknown) => {
        if (active) setGuidesError(apiErrorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [isHomePage]);
  useEffect(() => {
    if (!isHomePage) return;
    let active = true;
    schools.faqs()
      .then((rows) => {
        if (active) {
          setHomeFaqs(rows);
          setHomeFaqsError(null);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setHomeFaqs(staticHomeFaqs);
          setHomeFaqsError(apiErrorMessage(reason));
        }
      });
    return () => {
      active = false;
    };
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
  const [locations, setLocations] = useState<LocationListItem[]>([]);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [schoolFaqs, setSchoolFaqs] = useState<SchoolFAQListItem[]>([]);
  const [schoolFaqsError, setSchoolFaqsError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const schoolResultsRef = useRef<HTMLDivElement>(null);
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
  const featuredSchoolIds = useMemo(
    () => new Set(featuredSchools.map((school) => school.school_id)),
    [featuredSchools],
  );
  const displayTopBoardingSchools = useMemo(
    () => uniqueSchoolsById(topBoardingSchools)
      .filter((school) => !featuredSchoolIds.has(school.school_id))
      .slice(0, 10),
    [featuredSchoolIds, topBoardingSchools],
  );
  const displayTopDaySchools = useMemo(
    () => uniqueSchoolsById(topDaySchools)
      .filter((school) => !featuredSchoolIds.has(school.school_id))
      .slice(0, 10),
    [featuredSchoolIds, topDaySchools],
  );
  const topPickSchools = topSchoolsCategory === "residential-school"
    ? displayTopBoardingSchools
    : displayTopDaySchools;
  const excludedSchoolIds = useMemo(
    () => new Set([
      ...featuredSchoolIds,
      ...topPickSchools.map((school) => school.school_id),
    ]),
    [featuredSchoolIds, topPickSchools],
  );
  const comparisonSchools = useMemo(() => {
    const seen = new Set<string>();
    const schools: SchoolListItem[] = [];
    for (const school of [...comparedSchools, ...featuredSchools]) {
      if (seen.has(school.school_id)) continue;
      seen.add(school.school_id);
      schools.push(school);
      if (schools.length >= 8) break;
    }
    return schools;
  }, [comparedSchools, featuredSchools]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState<string | null>(null);
  const [featuredFallback, setFeaturedFallback] = useState(false);
  const [geoCountry, setGeoCountry] = useState("");
  const [geoRegion, setGeoRegion] = useState("");
  const [geoState, setGeoState] = useState("");
  const [geoCity, setGeoCity] = useState("");
  const [geoLocation, setGeoLocation] = useState("");
  const activeCountryId = geoCountry || initialFilter?.country || "";
  const activeStateId = geoState || initialFilter?.state || "";
  const activeCityId = geoCity || initialFilter?.city || "";
  const indiaCountryCity = cities.find((city) =>
    toSeoSlug(city.country_slug ?? city.country_name) === "india",
  );
  const regionCountryId = activeCountryId || indiaCountryCity?.country_id || "";
  const countryCity = cities.find((city) => city.country_id === activeCountryId);
  const isIndiaCountry = toSeoSlug(
    initialFilter?.place?.countrySlug ?? countryCity?.country_slug ?? countryCity?.country_name ?? "",
  ) === "india";
  const hasBroadBoardScope = Boolean(
    (initialFilter?.boardIds?.length || initialFilter?.boardSlug || board.length) &&
    !activeCountryId &&
    !activeStateId &&
    !activeCityId,
  );
  const hasBroadDirectoryScope = Boolean(
    !initialFilter?.search &&
    !search &&
    !activeCountryId &&
    !activeStateId &&
    !activeCityId,
  );
  const countryScopeStillLoading = Boolean(
    activeCountryId &&
    !countryCity &&
    citiesLoading &&
    !activeStateId &&
    !activeCityId,
  );
  const requiresIndiaRegion =
    !isHomePage &&
    ((isIndiaCountry && Boolean(activeCountryId)) ||
      hasBroadBoardScope ||
      hasBroadDirectoryScope ||
      countryScopeStillLoading) &&
    !activeStateId &&
    !activeCityId &&
    !geoRegion;
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
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
    if (!isHomePage || !schoolTypesLoaded) return;
    let cancelled = false;
    setHomeReviewsLoading(true);
    setHomeReviewsError(null);
    setHomeReviewSummaryError(null);
    Promise.allSettled([
      reviews.latest(reviewSchoolTypeIds),
      reviews.publicSummary(reviewSchoolTypeIds),
    ]).then(([reviewResult, summaryResult]) => {
      if (cancelled) return;
      if (reviewResult.status === "fulfilled") {
        const publishedReviews = reviewResult.value.results.filter(
          (review) => review.status === "PUBLISHED",
        );
        for (let index = publishedReviews.length - 1; index > 0; index -= 1) {
          const swapIndex = Math.floor(Math.random() * (index + 1));
          [publishedReviews[index], publishedReviews[swapIndex]] = [
            publishedReviews[swapIndex],
            publishedReviews[index],
          ];
        }
        setHomeReviews(publishedReviews.slice(0, 2 + Math.floor(Math.random() * 2)));
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
        setHomeReviewSummary(null);
        setHomeReviewSummaryError(
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
  }, [isHomePage, reviewSchoolTypeIds, schoolTypesLoaded]);
  useEffect(() => {
    const syncReviewsDialog = () => {
      setReviewsDialogOpen(window.location.pathname === "/reviews/");
    };
    window.addEventListener("popstate", syncReviewsDialog);
    return () => window.removeEventListener("popstate", syncReviewsDialog);
  }, []);
  const openReviewsDialog = () => {
    if (typeof window === "undefined") return;
    setReviewsDialogOpen(true);
    window.history.pushState(
      { boardingEduReviewsDialog: true },
      "",
      "/reviews/",
    );
  };
  const closeReviewsDialog = () => {
    if (typeof window !== "undefined" && window.history.state?.boardingEduReviewsDialog) {
      window.history.back();
      return;
    }
    setReviewsDialogOpen(false);
  };
  const [boardsSectionCategory, setBoardsSectionCategory] = useState<HomeSchoolCategory | null>(null);
  const [selectedState, setSelectedState] = useState<StateBrowseItem | null>(null);
  const [allStatesOpen, setAllStatesOpen] = useState(false);
  const [allCitiesOpen, setAllCitiesOpen] = useState(false);
  const [allStateQuery, setAllStateQuery] = useState("");
  const [allCityQuery, setAllCityQuery] = useState("");
  const [allCityStateId, setAllCityStateId] = useState("");
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
    if (requiresIndiaRegion) {
      setTopBoardingSchools([]);
      setTopDaySchools([]);
      setTopBoardingSchoolsLoading(false);
      return;
    }
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
    const regionalStateIds = geoRegion
      ? [...new Set(cities
          .filter((city) =>
              city.country_id === regionCountryId &&
              indiaRegionForState(city.state_name, city.state_slug)?.id === geoRegion,
            )
          .map((city) => city.state_id))]
      : [];
    if (geoRegion && citiesLoading) return;
    if (geoRegion && !regionalStateIds.length) {
      setTopBoardingSchools([]);
      setTopDaySchools([]);
      setTopBoardingSchoolsLoading(false);
      return;
    }

    const sharedFilters: SchoolFilters = {
      status: true,
      ordering: "-average_rating",
      page_size: 20,
      country: geoRegion ? undefined : activeCountry || undefined,
      state: activeState || undefined,
      city: activeCity || undefined,
      location_group: geoRegion
        ? [`${regionCountryId}|${regionalStateIds.join(",")}`]
        : undefined,
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
        setTopBoardingSchools(boardingResponse.results.slice(0, 20));
        setTopDaySchools(dayResponse.results.slice(0, 20));
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
    geoRegion,
    geoState,
    activeCountryId,
    regionCountryId,
    cities,
    citiesLoading,
    requiresIndiaRegion,
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
    if (geoRegion) {
      return [
        indiaRegionById(geoRegion)?.label ?? "Indian region",
        initialPlaceName || matchingCity?.country_name || "India",
      ].join(", ");
    }
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
    geoRegion,
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
  // The India region (North/South/East/West/Central) of the place being
  // browsed, derived from real city records so the featured section can stay
  // regional ("Featured Boarding Schools in North India") instead of being
  // scoped to a single state or city.
  const browsedRegion = useMemo(() => {
    if (geoRegion) return indiaRegionById(geoRegion) ?? undefined;
    const city = cities.find((item) =>
      activeCityId
        ? item.city_id === activeCityId
        : activeStateId
          ? item.state_id === activeStateId
          : activeCountryId
            ? item.country_id === activeCountryId
            : false,
    );
    const stateSlug = city?.state_slug ?? initialFilter?.place?.stateSlug ?? "";
    const stateName = city?.state_name ?? initialFilter?.placeName ?? "";
    if (!stateSlug && !stateName) return undefined;
    return indiaRegionForState(stateName, stateSlug);
  }, [
    activeCityId,
    activeCountryId,
    activeStateId,
    cities,
    geoRegion,
    initialFilter?.place?.stateSlug,
    initialFilter?.placeName,
  ]);
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
  const resultsHeading = `${listingSubject} in ${listingPlaceLabel}`;
  const directoryRecommendationsLoading =
    !isHomePage && (featuredLoading || topBoardingSchoolsLoading);
  const hasMoreResults = page * PAGE_SIZE < totalCount;
  const displayResults = useMemo(() => {
    if (directoryRecommendationsLoading) return [];
    return uniqueSchoolsById(results).filter(
      (school) => !excludedSchoolIds.has(school.school_id),
    );
  }, [directoryRecommendationsLoading, excludedSchoolIds, results]);
  const lastResultIndex = displayResults.length;
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
            : withListingFilters(schoolDirectoryPath(itemCategory), board),
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
  const queryKey = `${search}|${geoCountry}|${geoRegion}|${geoState}|${geoCity}|${geoLocation}|${locationGroups.join(";")}|${schoolType.join(",")}|${homeCategory ?? ""}|${board.join(",")}|${feeMin ?? ""}|${feeMax ?? ""}|${gender ?? ""}|${ordering ?? ""}`;

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

  const rankedCities = useMemo(() => {
    return cities
      .filter((city) => (city.schools_count ?? 0) > 0)
      .sort(
        (left, right) =>
          (right.featured_schools_count ?? 0) - (left.featured_schools_count ?? 0) ||
          (right.schools_count ?? 0) - (left.schools_count ?? 0) ||
          left.city_name.localeCompare(right.city_name),
      );
  }, [cities]);
  const cityCards = useMemo(() => rankedCities.slice(0, 8), [rankedCities]);
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
  const rankedStates = useMemo(() => {
    const grouped = new Map<string, StateBrowseItem & { featured: number }>();
    for (const city of cities) {
      const count = city.schools_count ?? 0;
      const current = grouped.get(city.state_id) ?? {
        state_id: city.state_id,
        state_name: city.state_name,
        state_slug: city.state_slug ?? city.state_name,
        country_slug: city.country_slug ?? city.country_name,
        count: 0,
        featured: 0,
      };
      current.count += count;
      current.featured += city.featured_schools_count ?? 0;
      grouped.set(city.state_id, current);
    }
    return [...grouped.values()]
      .sort((left, right) => right.featured - left.featured || right.count - left.count || left.state_name.localeCompare(right.state_name));
  }, [cities]);
  const stateCards = useMemo(
    () => rankedStates.filter((state) => state.count > 0).slice(0, 8),
    [rankedStates],
  );
  const visibleStates = useMemo(() => {
    const query = allStateQuery.trim().toLocaleLowerCase();
    return rankedStates.filter((state) => state.state_name.toLocaleLowerCase().includes(query));
  }, [allStateQuery, rankedStates]);
  const visibleCities = useMemo(() => {
    const query = allCityQuery.trim().toLocaleLowerCase();
    return cities
      .filter((city) =>
        (!allCityStateId || city.state_id === allCityStateId) &&
        `${city.city_name} ${city.state_name}`.toLocaleLowerCase().includes(query),
      )
      .sort(
        (left, right) =>
          (right.schools_count ?? 0) - (left.schools_count ?? 0) ||
          left.city_name.localeCompare(right.city_name),
      );
  }, [allCityQuery, allCityStateId, cities]);
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
  const indiaRegionCards = useMemo<IndiaRegionBrowseItem[]>(() => {
    if (!regionCountryId) return [];
    const grouped = new Map<string, IndiaRegionBrowseItem>();
    for (const city of cities) {
      if (city.country_id !== regionCountryId) continue;
      const region = indiaRegionForState(city.state_name, city.state_slug);
      if (!region) continue;
      const entry = grouped.get(region.id) ?? {
        id: region.id,
        label: region.label,
        count: 0,
        stateIds: [],
      };
      entry.count += city.schools_count ?? 0;
      if (!entry.stateIds.includes(city.state_id)) entry.stateIds.push(city.state_id);
      grouped.set(region.id, entry);
    }
    return INDIA_REGIONS.flatMap((region) => {
      const item = grouped.get(region.id);
      return item ? [item] : [];
    });
  }, [cities, regionCountryId]);
  const selectedIndiaRegion = indiaRegionById(geoRegion);
  const selectedIndiaRegionStateIds = useMemo(
    () => indiaRegionCards.find((region) => region.id === geoRegion)?.stateIds ?? [],
    [geoRegion, indiaRegionCards],
  );
  useEffect(() => {
    if (!requiresIndiaRegion) {
      setRegionPickerOpen(false);
      return;
    }
    if (window.sessionStorage.getItem("boardingedu:region-prompt") === "dismissed") return;
    if (!citiesLoading && !citiesError && indiaRegionCards.length) {
      setRegionPickerOpen(true);
    }
  }, [citiesError, citiesLoading, indiaRegionCards.length, requiresIndiaRegion]);
  function categoryBrowsePath(category: HomeSchoolCategory) {
    const selectedRegion = indiaRegionById(geoRegion);
    if (selectedRegion) return indiaRegionListingPath(selectedRegion.id, category);
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
    if (geoRegion && activeCountryId && !activeStateId && !activeCityId) {
      const region = indiaRegionById(geoRegion);
      if (region) {
        const states = new Map<string, { city: CityListItem; count: number }>();
        for (const city of cities) {
          if (city.country_id !== activeCountryId) continue;
          if (indiaRegionForState(city.state_name, city.state_slug)?.id !== region.id) continue;
          const current = states.get(city.state_id) ?? { city, count: 0 };
          current.count += city.schools_count ?? 0;
          states.set(city.state_id, current);
        }
        return [...states.values()]
          .sort(
            (left, right) =>
              right.count - left.count || left.city.state_name.localeCompare(right.city.state_name),
          )
          .map(({ city }) => ({
            label: city.state_name,
            href: placeListingPath({
              countrySlug: city.country_slug ?? city.country_name,
              stateSlug: city.state_slug ?? city.state_name,
              category,
            }),
            kind: "state" as const,
          }));
      }
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
  }, [activeCityId, activeCountryId, activeStateId, cities, geoRegion, homeCategory, locations, schoolType, schoolTypes]);

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
  const homeFaqCategories = useMemo(() => {
    const order: SchoolFAQListItem["category"][] = [
      "GENERAL",
      "FINDING",
      "ADMISSIONS",
      "FEES",
      "BOARDING",
      "PARENT_ACCOUNTS",
      "SCHOOL_PROFILES",
      "PRIVACY",
    ];
    const existing = new Set(homeFaqs.map((item) => item.category));
    return order.filter((category) => existing.has(category));
  }, [homeFaqs]);
  const visibleHomeFaqs = useMemo(() => {
    const query = faqSearch.trim().toLowerCase();
    return homeFaqs.filter((item) =>
      item.category === activeFaqCategory &&
      (!query || `${item.question} ${item.answer}`.toLowerCase().includes(query)),
    );
  }, [activeFaqCategory, faqSearch, homeFaqs]);

  useEffect(() => {
    if (homeFaqCategories.length && !homeFaqCategories.includes(activeFaqCategory)) {
      setActiveFaqCategory(homeFaqCategories[0]);
    }
  }, [activeFaqCategory, homeFaqCategories]);

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
    if (geoRegion && citiesLoading) return () => {
      cancelled = true;
    };
    if (geoRegion && !selectedIndiaRegionStateIds.length) {
      setResults([]);
      setTotalCount(0);
      setLoading(false);
      setError(
        citiesError
          ? `Indian region could not be loaded: ${citiesError}`
          : `No school listings are available in ${selectedIndiaRegion?.label ?? "this region"} yet.`,
      );
      return () => {
        cancelled = true;
      };
    }
    const placeScoped = Boolean(initialCity || initialLocation);
    const locationScoped = !isHomePage && Boolean(
      geoCountry || geoState || geoCity || geoLocation ||
      initialCountry || initialState || initialCity || initialLocation || geoRegion,
    );
    const effectiveLocationGroups = geoRegion
      ? [`${regionCountryId}|${selectedIndiaRegionStateIds.join(",")}`]
      : locationGroups;
    const residentialOnly =
      !placeScoped &&
      !geoCity &&
      !geoLocation &&
      (homeCategory === "residential-school" ||
        (schoolType.length > 0 && schoolTypes.length === 0) ||
        isBoardingOnlySelection(schoolType, schoolTypes));

    const filters: SchoolFilters = {
      search: search || undefined,
      country: effectiveLocationGroups.length ? undefined : geoCountry || undefined,
      state: effectiveLocationGroups.length ? undefined : geoState || undefined,
      city: !residentialOnly && !effectiveLocationGroups.length ? geoCity || undefined : undefined,
      location: !residentialOnly && !effectiveLocationGroups.length ? geoLocation || undefined : undefined,
      location_group: effectiveLocationGroups,
      school_type: schoolType,
      home_category: homeCategory ? homeSchoolCategoryPath(homeCategory) : undefined,
      board: resolvedBoardIds,
      min_fee: feeMin,
      max_fee: feeMax,
      gender,
      ordering,
      is_featured: locationScoped ? false : undefined,
      page: page > 1 ? page : undefined,
      page_size: PAGE_SIZE,
    };

    activeQuery.current = queryKey;
    setLoading(true);
    setError(null);
    setLoadMoreError(null);

    async function loadListingSchools() {
      try {
        const response = await schools.list(filters);
        if (cancelled) return;

        setResults((current) => {
          return uniqueSchoolsById(
            page === 1 ? response.results : [...current, ...response.results],
          );
        });
        if (page === 1) {
          setTotalCount(response.count ?? response.results.length);
        }
      } catch (reason: unknown) {
        if (cancelled) return;

        const message = apiErrorMessage(reason);
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
  }, [boards, queryRestored, schoolTypesLoaded, pendingTypeSlug, schoolTypes, search, geoCountry, geoRegion, geoState, geoCity, geoLocation, initialCountry, initialState, initialCity, initialLocation, locationGroups, selectedIndiaRegionStateIds, selectedIndiaRegion, activeCountryId, regionCountryId, requiresIndiaRegion, citiesLoading, citiesError, schoolType, homeCategory, board, feeMin, feeMax, gender, ordering, page, queryKey, retryCount, isHomePage]);

  useEffect(() => {
    if (
      isHomePage ||
      loading ||
      directoryRecommendationsLoading ||
      !hasMoreResults ||
      error ||
      loadMoreError
    ) return;
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;
    const scrollContainer = schoolResultsRef.current;
    const root = scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight
      ? scrollContainer
      : null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.unobserve(sentinel);
          setPage((current) => current + 1);
        }
      },
      { root, rootMargin: "320px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    directoryRecommendationsLoading,
    error,
    hasMoreResults,
    isHomePage,
    loadMoreError,
    loading,
    results.length,
    page,
  ]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    for (const key of new Set(hashParams.keys())) {
      params.delete(key);
      hashParams.getAll(key).forEach((item) => params.append(key, item));
    }
    if (initialCountry || initialState || initialCity || initialLocation || initialFilter?.region || initialSchoolTypeKey || initialBoardKey || initialHomeCategory) {
      initialLocationWasInUrl.current = Boolean(initialCountry || initialState || initialCity || initialLocation || initialFilter?.region || params.has("region"));
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
      setGeoRegion(initialFilter?.region ?? params.get("region") ?? "");
      setGeoState(initialState ?? "");
      setGeoCity(initialCity ?? "");
      setGeoLocation(initialLocation ?? "");
      setLocationGroups([]);
      const genderParam = params.get("gender");
      if (genderParam === "COED" || genderParam === "BOYS" || genderParam === "GIRLS") {
        setGender(genderParam);
      }
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
      "region",
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
    setGeoRegion(params.get("region") ?? "");
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
  }, [initialCountry, initialState, initialCity, initialLocation, initialFilter?.region, initialSchoolTypeKey, initialBoardKey, initialHomeCategory, initialFilter?.search]);

  useEffect(() => {
    const syncRegionFromUrl = () => {
      setGeoRegion(new URLSearchParams(window.location.search).get("region") ?? "");
    };
    window.addEventListener("popstate", syncRegionFromUrl);
    return () => window.removeEventListener("popstate", syncRegionFromUrl);
  }, []);

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
    setFeaturedLoading(true);
    const activeCountry = geoCountry || initialCountry;
    const activeState = geoState || initialState;
    const activeCity = geoCity || initialCity;
    const activeLocation = geoLocation || initialLocation;
    // Region-wide scope: either an explicit region page (geoRegion) or a place
    // that maps to an India region. Keeps "Featured ... in North India" truly
    // regional and prevents other regions leaking into the section.
    const featuredRegionId = geoRegion || browsedRegion?.id || "";
    const featuredNeedsRegion = Boolean(featuredRegionId);
    const regionalStateIds = featuredNeedsRegion
      ? [...new Set(cities
          .filter((city) =>
            city.country_id === regionCountryId &&
            indiaRegionForState(city.state_name, city.state_slug)?.id === featuredRegionId,
          )
          .map((city) => city.state_id))]
      : [];
    const boardingOnly = isBoardingOnlySelection(schoolType, schoolTypes);
    const featuredCategory = homeCategory ?? homeSchoolCategoryForIds(schoolType, schoolTypes);
    if (requiresIndiaRegion) {
      setFeaturedSchools([]);
      setFeaturedLoading(false);
      return () => {
        cancelled = true;
      };
    }
    if (featuredNeedsRegion && citiesLoading) return () => {
      cancelled = true;
    };
    if (featuredNeedsRegion && !regionalStateIds.length) {
      setFeaturedSchools([]);
      setFeaturedLoading(false);
      return () => {
        cancelled = true;
      };
    }
    if (isHomePage && schoolType.length > 0 && !schoolTypesLoaded) {
      setFeaturedLoading(true);
      return () => {
        cancelled = true;
      };
    }
    setFeaturedError(null);
    setFeaturedFallback(false);

    const featuredFilters: SchoolFilters = {
      is_featured: true,
      ordering: "-average_rating",
      page_size: isHomePage ? 10 : 100,
      country: isHomePage || featuredNeedsRegion ? undefined : activeCountry || undefined,
      state: isHomePage || featuredNeedsRegion ? undefined : activeState || undefined,
      city: isHomePage || boardingOnly || featuredNeedsRegion ? undefined : activeCity || undefined,
      location: isHomePage || boardingOnly || featuredNeedsRegion ? undefined : activeLocation || undefined,
      location_group: featuredNeedsRegion
        ? [`${regionCountryId}|${regionalStateIds.join(",")}`]
        : undefined,
      board: isHomePage ? undefined : board,
      school_type: isHomePage
        ? featuredCategory
          ? homeSchoolTypeIds(schoolTypes, featuredCategory)
          : schoolType
        : schoolType,
      home_category: featuredCategory
        ? homeSchoolCategoryPath(featuredCategory)
        : undefined,
    };

    async function loadFeaturedSchools() {
      try {
        const featuredResponse = await schools.list(featuredFilters);
        if (cancelled) return;
        let featuredCandidates = featuredResponse.results;
        let otherLocationIds = new Set<string>();
        if (
          !isHomePage &&
          !featuredNeedsRegion &&
          (activeCountry || activeState || activeCity || activeLocation)
        ) {
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
          (featuredNeedsRegion ||
            Boolean(activeCountry || activeState || activeCity || activeLocation));
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
    activeCountryId,
    regionCountryId,
    browsedRegion?.id,
    cities,
    citiesLoading,
    geoCity,
    geoCountry,
    geoLocation,
    geoRegion,
    geoState,
    homeCategory,
    initialCity,
    initialCountry,
    initialLocation,
    initialState,
    isHomePage,
    requiresIndiaRegion,
    schoolType,
    schoolTypes,
    schoolTypesLoaded,
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
    setGeoRegion("");
    const pathnameRegion = pathname.split("/").filter(Boolean)[1];
    if (pathname.startsWith("/india/") && indiaRegionBySlug(pathnameRegion)) {
      router.replace(schoolDirectoryPath(), { scroll: false });
    }
    const params = new URLSearchParams(window.location.search);
    if (params.has("region")) {
      params.delete("region");
      const query = params.toString();
      router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    }
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
    ...(selectedIndiaRegion
      ? [{
          key: "region",
          label: selectedIndiaRegion.label,
          onClear: () => selectIndiaRegion(""),
        }]
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
      region: geoRegion,
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
      next.region !== geoRegion ||
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
    setGeoRegion(next.region);
    setGeoState(next.state);
    setGeoCity(boardingOnly && !homeSearchEnabled ? "" : next.city);
    setGeoLocation(boardingOnly ? "" : next.location);
    if (locationChanged) setLocationGroups([]);
  }

  function selectIndiaRegion(region: string) {
    setGeoRegion(region);
    setLocationGroups([]);
    setPage(1);
    const category = homeCategory ?? initialFilter?.homeCategory;
    const selectedRegion = indiaRegionById(region);
    const boardIds = board.length ? board : initialFilter?.boardIds ?? [];
    const boardSlugs = boardIds
      .map((boardId) => boards.find((item) =>
        item.board_id === boardId ||
        toSeoSlug(item.slug) === toSeoSlug(boardId) ||
        item.board_code.toLowerCase() === boardId.toLowerCase(),
      )?.slug)
      .filter((slug): slug is string => Boolean(slug));
    if (!boardSlugs.length && initialFilter?.boardSlug) {
      boardSlugs.push(initialFilter.boardSlug);
    }
    const destination = selectedRegion
      ? boardSlugs.length
        ? indiaRegionBoardListingPath(selectedRegion.id, boardSlugs, category)
        : indiaRegionListingPath(selectedRegion.id, category)
      : category
        ? placeListingPath({ countrySlug: "india", category })
        : "/india/";
    router.push(destination, { scroll: false });
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

  const loadMoreContent = !error && (results.length > 0 || displayResults.length > 0) ? (
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
      ) : loading && page > 1 ? (
        <p role="status"><LoaderCircle className="spin" size={17} /> Loading more schools…</p>
      ) : hasMoreResults ? (
        <p className="school-load-more__hint">Scroll down to load more unique schools</p>
      ) : (
        <p>You&apos;ve seen all {totalCount} schools in this search.</p>
      )}
    </div>
  ) : null;

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
            <SchoolSearchAutocomplete
              variant="hero"
              placeholder="Search a school, city, state, or board"
              ariaLabel="Search schools and locations"
              onFreeTextSubmit={(value) => {
                void navigateHomeSearch(value);
              }}
            />
          )}

          <HeroFinder
            value={finderValue()}
            schoolTypes={schoolTypes}
            locationMessage={locationMessage}
            locationError={locationError}
            homeSearch={homeSearchEnabled}
            mobileCategory={!isHomePage ? initialHomeCategory : null}
            onChange={handleFinderChange}
            onSubmit={handleFinderSubmit}
          />

          {isHomePage && (
            <nav className="hero-quick-links" aria-label="Popular school searches">
              <Link href={schoolDirectoryPath("day-school")}>Day schools</Link>
              <Link href={schoolDirectoryPath("residential-school")}>Boarding schools</Link>
              <Link href="/compare/">Compare schools</Link>
              <Link href="/fee-calculator/">Estimate fees</Link>
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
                { key: "boarding", category: "residential-school" as const, title: "Boarding schools in —", place: "—", count: 0, href: schoolDirectoryPath("residential-school") },
                { key: "day", category: "day-school" as const, title: "Day schools in —", place: "—", count: 0, href: schoolDirectoryPath("day-school") },
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
      <section className="trust-strip" aria-label="Verified BoardingEdu directory facts">
        <div className="trust-strip__stats">
          <div className="trust-stat">
            <strong><AnimatedCount value={homeSummary?.schools_listed ?? null} /></strong>
            <span>Verified schools listed</span>
          </div>
          <div className="trust-stat">
            <strong><AnimatedCount value={homeSummary?.cities_covered ?? null} /></strong>
            <span>Cities with listings</span>
          </div>
          <div className="trust-stat">
            <strong><AnimatedCount value={homeSummary?.published_reviews ?? null} /></strong>
            <span>Published parent reviews</span>
          </div>
        </div>
        <div className="trust-strip__trust">
          <strong>Information you can explore with confidence</strong>
          <p>Making school discovery clearer for parents. Explore school information and compare available details before making a decision.</p>
          <button
            type="button"
            className="trust-strip__disclosure"
            aria-expanded={trustDetailsOpen}
            aria-controls="trust-details"
            onClick={() => setTrustDetailsOpen((open) => !open)}
          >
            <CheckCircle2 size={16} aria-hidden />
            How school information is reviewed
          </button>
          {trustDetailsOpen && (
            <div className="trust-strip__details" id="trust-details">
              <p>School details may be submitted by school administrators or updated by BoardingEdu staff. The verified label is shown only for profiles that have completed the platform&apos;s verification workflow.</p>
              <p>Published information can change. Please confirm current admissions, fees, and facilities directly with the school.</p>
              {homeSummary?.last_updated && (
                <p>Latest update to a listed school profile or published review:{" "}
                  <time dateTime={homeSummary.last_updated}>
                    {new Date(homeSummary.last_updated).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>.
                </p>
              )}
            </div>
          )}
        </div>
        {homeSummaryError && (
          <p className="trust-strip__error" role="status">
            Live directory totals are temporarily unavailable.
            <span className="sr-only"> {homeSummaryError}</span>
          </p>
        )}
      </section>

      <RecentlyViewedSchools />

      <section className="home-section home-how-it-works" aria-labelledby="home-how-it-works-title">
        <div className="home-section__heading home-section__heading--centered">
          <div>
            <span className="section-eyebrow">A CLEARER SCHOOL SEARCH</span>
            <h2 id="home-how-it-works-title">How BoardingEdu works</h2>
          </div>
        </div>
        <ol className="home-how-it-works__steps">
          {howItWorksSteps.map((step, index) => (
            <li key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

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
        <div className="compare-promo__marquee">
          <div className="compare-promo__track">
          {[0, 1].flatMap((copy) => comparisonSchools.map((school) => ({ school, copy }))).map(({ school, copy }) => {
            const isCompared = comparedSchools.some((item) => item.school_id === school.school_id);
            const cover = schoolCoverImageUrl(school);
            return (
              <article key={`${school.school_id}-${copy}`} className={isCompared ? "is-shortlisted" : ""} aria-hidden={copy === 1 || undefined}>
                <Link href={schoolHref(school)} className="compare-promo__school-link" tabIndex={copy === 1 ? -1 : undefined}>
                  <span className="compare-promo__school-image">
                    <Building2
                      className="compare-promo__school-fallback"
                      size={23}
                      aria-hidden
                    />
                    {cover && (
                      <Image
                        src={cover}
                        alt={`${school.school_name} campus`}
                        fill
                        sizes="200px"
                        unoptimized
                        onError={(event) => {
                          event.currentTarget.style.visibility = "hidden";
                        }}
                      />
                    )}
                    {school.school_logo_url && (
                      <span className="compare-promo__school-logo">
                        <span aria-hidden>{(school.short_name || school.school_name).slice(0, 2).toUpperCase()}</span>
                        <Image
                          src={school.school_logo_url}
                          alt={`${school.school_name} logo`}
                          width={42}
                          height={42}
                          unoptimized
                          onError={(event) => {
                            event.currentTarget.style.visibility = "hidden";
                          }}
                        />
                      </span>
                    )}
                  </span>
                  <strong>{school.school_name}</strong>
                </Link>
                {copy === 0 && <button
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
                </button>}
              </article>
            );
          })}
          </div>
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

          <div
            className="city-grid"
            role="region"
            aria-label="Top states, scroll horizontally to see more"
            tabIndex={0}
          >
            {stateCards.map((state, index) => (
              <Link
                className={`city-card state-city-trigger city-card--${index + 1}`}
                key={state.state_id}
                href={placeListingPath({
                  countrySlug: state.country_slug,
                  stateSlug: state.state_slug,
                })}
                onClick={(event) => {
                  event.preventDefault();
                  openTypePicker({
                    title: `Schools in ${state.state_name}`,
                    subtitle: "Choose the school type you want to explore.",
                    hrefFor: (category) => placeListingPath({
                      countrySlug: state.country_slug,
                      stateSlug: state.state_slug,
                      category,
                    }),
                    showAllOption: false,
                  });
                }}
                style={{ background: placeBackdrop(state.state_slug) }}
                aria-label={`${state.state_name}, ${state.count} schools listed`}
              >
                <span className="city-card__number">{String(index + 1).padStart(2, "0")}</span>
                <span className="city-card__name">{state.state_name}</span>
                <span className="city-card__state">{state.count} schools listed</span>
                <span className="city-card__action">
                  View schools <ArrowRight size={14} aria-hidden />
                </span>
              </Link>
            ))}
          </div>
          <div className="home-section__more">
            <button type="button" className="secondary-button" onClick={() => setAllStatesOpen(true)}>
              Explore All States
            </button>
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
                  Choose a school type for this state, or pick a city to narrow your search.
                </p>
                <button
                  className="state-explorer__type-button"
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => {
                    const place = {
                      countrySlug: selectedState.country_slug,
                      stateSlug: selectedState.state_slug,
                    };
                    setSelectedState(null);
                    openTypePicker({
                      title: `Schools in ${selectedState.state_name}`,
                      subtitle: "Choose the school type you want to explore.",
                      hrefFor: (category) => placeListingPath({ ...place, category }),
                      showAllOption: false,
                    });
                  }}
                >
                  Choose day or boarding schools
                </button>
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
                    <div className="state-city-card__links">
                      <button
                        type="button"
                        aria-label={`Choose a school type in ${city.city_name}`}
                        aria-haspopup="dialog"
                        onClick={() => {
                          setSelectedState(null);
                          openTypePicker({
                            title: `Schools in ${city.city_name}`,
                            subtitle: "Choose the type of school you want to explore.",
                            hrefFor: (category) => placeListingPath({ ...place, category }),
                            showAllOption: false,
                          });
                        }}
                      >
                        Choose school type <ArrowRight size={13} aria-hidden />
                      </button>
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
          role="region"
          aria-label="Top cities, scroll horizontally to see more"
          tabIndex={0}
        >
          {cityCards.map((city, index) => {
            const place = {
              countrySlug: city.country_slug ?? city.country_name,
              stateSlug: city.state_slug ?? city.state_name,
              citySlug: city.slug,
            };
            return (
              <Link
                className={`city-card city-card--${index + 1}`}
                key={city.city_id}
                href={placeListingPath(place)}
                onClick={(event) => {
                  event.preventDefault();
                  openTypePicker({
                    title: `Schools in ${city.city_name}`,
                    subtitle: `Choose the school type you want to explore in ${city.city_name}.`,
                    hrefFor: (category) => placeListingPath({ ...place, category }),
                    showAllOption: false,
                  });
                }}
                style={{ background: placeBackdrop(city.slug) }}
              >
                <span className="city-card__number">{String(index + 1).padStart(2, "0")}</span>
                <span className="city-card__name">{city.city_name}</span>
                <span className="city-card__state">{city.state_name} · {city.schools_count ?? 0} schools</span>
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
        {cities.length > 0 && (
          <div className="home-section__more">
            <button type="button" className="secondary-button" onClick={() => setAllCitiesOpen(true)}>
              Explore All Cities
            </button>
          </div>
        )}
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
          <a href={`mailto:${SITE_EMAIL}`}>
            <span><Mail size={20} /></span>
            <strong>Email our team</strong>
            <small>{SITE_EMAIL}</small>
            <ArrowRight size={16} />
          </a>
          <a href={`tel:${SITE_PHONE}`}>
            <span><Phone size={20} /></span>
            <strong>Call BoardingEdu</strong>
            <small>{SITE_PHONE_DISPLAY}</small>
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
            <p>Browse answers by topic or search for a question.</p>
          </div>
        </div>

        <div className="home-faq-layout">
          <nav className="home-faq-categories" aria-label="FAQ categories">
            {homeFaqCategories.map((category) => (
              <button
                type="button"
                key={category}
                className={activeFaqCategory === category ? "is-active" : ""}
                aria-pressed={activeFaqCategory === category}
                aria-current={activeFaqCategory === category ? "page" : undefined}
                onClick={() => {
                  setActiveFaqCategory(category);
                  setActiveFaq(null);
                }}
              >
                {({
                  GENERAL: "General Information",
                  FINDING: "Finding and Comparing Schools",
                  ADMISSIONS: "School Admissions",
                  FEES: "Fees and Payments",
                  BOARDING: "Boarding and Hostel Facilities",
                  PARENT_ACCOUNTS: "Parent Dashboard and Accounts",
                  SCHOOL_PROFILES: "School Admin and School Profiles",
                  PRIVACY: "Privacy, Security and Documents",
                } satisfies Record<SchoolFAQListItem["category"], string>)[category]}
              </button>
            ))}
          </nav>
          <div className="home-faq-content">
            <label className="home-faq-search">
              <Search size={16} aria-hidden />
              <span className="sr-only">Search frequently asked questions</span>
              <input
                type="search"
                value={faqSearch}
                onChange={(event) => {
                  setFaqSearch(event.target.value);
                  setActiveFaq(null);
                }}
                placeholder="Search questions"
              />
            </label>
            {homeFaqsError && (
              <p className="home-faq-error" role="status">
                Saved FAQ content is shown because the latest answers could not be loaded.
                <span className="sr-only"> {homeFaqsError}</span>
              </p>
            )}
            <div className="faq-list">
              {visibleHomeFaqs.map((item, index) => {
                const open = activeFaq === index;
                const answerId = `home-faq-answer-${item.faq_id}`;

                return (
                  <div
                    className={`faq-item ${open ? "faq-item--open" : ""}`}
                    key={item.faq_id}
                  >
                    <button
                      type="button"
                      className="faq-question"
                      aria-expanded={open}
                      aria-controls={answerId}
                      onClick={() => setActiveFaq(open ? null : index)}
                    >
                      <span>{item.question}</span>
                      <span className="faq-toggle" aria-hidden>{open ? "−" : "+"}</span>
                    </button>
                    <div className={`faq-answer-wrap${open ? " is-open" : ""}`} id={answerId} aria-hidden={!open}>
                      <p className="faq-answer">{item.answer}</p>
                    </div>
                  </div>
                );
              })}
              {!visibleHomeFaqs.length && (
                <p className="home-faq-empty" role="status">
                  No published questions match this topic and search.
                </p>
              )}
            </div>
            <p className="home-faq-contact">
              Still have a question? <Link href="/contact/">Contact BoardingEdu</Link>
            </p>
          </div>
        </div>
      </section>

      <section className="home-section home-reviews" id="home-reviews" aria-labelledby="home-reviews-heading">
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
          <button
            type="button"
            className="home-reviews__browse"
            onClick={openReviewsDialog}
          >
            Explore more reviews <ArrowRight size={15} aria-hidden />
          </button>
        </div>
        {homeReviewsLoading ? (
          <p className="home-reviews__status" role="status">Loading published reviews…</p>
        ) : homeReviewSummary || homeReviews.length > 0 ? (
          <div className="home-reviews__layout">
            {homeReviewSummary && <ReviewSummaryPanel summary={homeReviewSummary} />}
            {homeReviews.length > 0 ? (
              <div className="home-reviews__grid">
                {homeReviews.map((review) => (
                  <PublicReviewCard key={review.review_id} review={review} />
                ))}
              </div>
            ) : (
              <p className="home-reviews__status">
                {(homeReviewSummary?.review_count ?? 0) > 0
                  ? "Recent review cards are temporarily unavailable."
                  : "No published parent reviews yet. Check back as school communities share their experiences."}
              </p>
            )}
            {(homeReviewsError || homeReviewSummaryError) && (
              <p className="home-reviews__status" role="status">
                {homeReviewsError || homeReviewSummaryError}
              </p>
            )}
          </div>
        ) : (
          <p className="home-reviews__status">
            {homeReviewsError || homeReviewSummaryError
              ? "Published reviews and ratings are temporarily unavailable. Please try again later."
              : "No published parent reviews yet. Check back as school communities share their experiences."}
          </p>
        )}
        {reviewsDialogOpen && (
          <ReviewsCollection
            mode="dialog"
            heading={
              reviewCategory === "day-school"
                ? "Day school parent reviews"
                : reviewCategory === "residential-school"
                  ? "Boarding school parent reviews"
                  : "Reviews from school communities"
            }
            description="Browse published parent reviews and ratings from school communities."
            schoolTypes={reviewSchoolTypeIds}
            onClose={closeReviewsDialog}
          />
        )}
      </section>

        </>
      )}

      {!isHomePage && (
      <section className="discovery-content" id="schools">
        {(isIndiaCountry || hasBroadBoardScope || hasBroadDirectoryScope) && !activeStateId && !activeCityId && (
          <section className="home-section home-section--states" aria-labelledby="india-region-heading">
            <div className="home-section__heading">
              <div>
                <div className="section-eyebrow">BROWSE INDIA BY REGION</div>
                <h2 id="india-region-heading">Choose a region to explore schools</h2>
                <p>
                  {listingBoardName
                    ? `Choose a region to narrow ${listingBoardName} school listings.`
                    : "Start with a smaller area to browse schools more easily."}
                </p>
              </div>
            </div>
            {citiesLoading ? (
              <p className="section-empty" role="status">Loading school regions…</p>
            ) : citiesError ? (
              <p className="section-error" role="alert">
                School regions could not be loaded: {citiesError}{" "}
                <button type="button" onClick={() => setCitiesRetry((count) => count + 1)}>Retry</button>
              </p>
            ) : indiaRegionCards.length ? (
              <div className="city-grid" role="group" aria-label="Indian school regions">
                {indiaRegionCards.map((region, index) => (
                  <button
                    className={`city-card city-card--${index + 1}${geoRegion === region.id ? " is-selected" : ""}`}
                    key={region.id}
                    type="button"
                    style={{ background: placeBackdrop(region.id) }}
                    onClick={() => selectIndiaRegion(region.id)}
                    aria-pressed={geoRegion === region.id}
                  >
                    <span className="city-card__number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="city-card__name">{region.label}</span>
                    <span className="city-card__state">{region.count} schools listed</span>
                    <span className="city-card__action">
                      Explore region <ArrowRight size={14} aria-hidden />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="section-empty">No Indian regions with published school listings are available right now.</p>
            )}
          </section>
        )}
        {requiresIndiaRegion && (
          <p className="finder-message" role="status">
            Choose an Indian region above to load its school listings.
          </p>
        )}
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
                    href={withListingFilters(place.href, board)}
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
                    {featuredFallback
                      ? "LOCAL SCHOOLS"
                      : browsedRegion
                        ? "REGIONAL PICKS"
                        : "LOCAL PICKS"}
                  </div>
                  <h2>{homeCategory === "day-school" ? "Featured Day Schools" : homeCategory === "residential-school" ? "Featured Boarding Schools" : "Featured Schools"}</h2>
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
                  <FeaturedSchoolCarousel
                    schools={featuredSchools}
                    label={`Featured schools in ${listingPlaceLabel}`}
                  />
                </>
              ) : (
                <p className="section-empty">No schools are listed for this area yet.</p>
              )}
            </div>
          </section>
        )}

        {!activeCountryId && !activeStateId && !activeCityId &&
          !featuredLoading && !featuredError && featuredSchools.length > 0 && (
            <section className="listing-directory-carousel" aria-labelledby="listing-directory-carousel-heading">
              <div className="listing-directory-carousel__heading">
                <div>
                  <span className="section-eyebrow">SCHOOLS TO EXPLORE</span>
                  <h2 id="listing-directory-carousel-heading">Featured schools</h2>
                  <p>Scroll through featured listings to compare schools before you refine your search.</p>
                </div>
              </div>
              <FeaturedSchoolCarousel schools={featuredSchools} />
            </section>
          )}

        <div className="section-heading">
          <div>
            <div className="section-eyebrow">SCHOOL DIRECTORY</div>
            <h2>{resultsHeading}</h2>
            <p>
              Compare fees, boards, facilities, and admission details, then contact schools directly.
            </p>
            <details className="listing-seo-copy">
              <summary>Read more about {listingSubject.toLowerCase()} in {listingPlaceLabel}</summary>
              <p>
                {listingDescription} Use the directory filters to narrow schools by location, board,
                school type, fee range, and gender. Review each school profile for its published
                facilities, grade information, and contact options, and confirm current admissions
                details directly with the school.
              </p>
            </details>
          </div>
        </div>

        <div className={`results-layout${schoolView === "grid" ? " results-layout--school-grid" : ""}`}>
          {filtersOpen && (
            <button
              className="filters-backdrop"
              type="button"
              aria-label="Close filters"
              onClick={closeFilters}
            />
          )}
          <div className="filters-column">
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
              <legend>School type{schoolType.length ? ` (${schoolType.length})` : ""}</legend>
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
              <legend>Education board{board.length ? ` (${board.length})` : ""}</legend>
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
              <FeeRangeFilter
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
              <legend>Gender</legend>

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

            <div className="filters-panel__apply">
              <button type="button" onClick={closeFilters}>
                Show {displayResults.length} {displayResults.length === 1 ? "school" : "schools"}
              </button>
            </div>
            </aside>
          </div>

          <div className="school-results" ref={schoolResultsRef}>
            {requiresIndiaRegion && !geoRegion && (
              <div className="listing-region-hint" role="status">
                <MapPin size={18} aria-hidden />
                <div>
                  <strong>Browse all of India</strong>
                  <p>
                    Schools load below. Optional: pick a region to narrow results faster.
                  </p>
                </div>
                <button type="button" className="listing-region-hint__action" onClick={() => setRegionPickerOpen(true)}>
                  Choose region
                </button>
              </div>
            )}
            {!isHomePage && (
              <div className="school-results__search">
                <SchoolSearchAutocomplete
                  variant="inline"
                  placeholder="Search a school, city, state, or board"
                  ariaLabel="Search schools and locations"
                  initialQuery={search}
                  onFreeTextSubmit={(value) => {
                    setSearchInput(value);
                    setSearch(value);
                    rememberSearch(value);
                    trackSearchEvent(
                      "search_query_submitted",
                      { query_length: value.length },
                      true
                    );
                  }}
                />
              </div>
            )}
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
                  {loading || directoryRecommendationsLoading
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

            {(loading && results.length === 0 || directoryRecommendationsLoading) && (
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

            {!loading &&
              !directoryRecommendationsLoading &&
              !error &&
              displayResults.length === 0 &&
              !hasMoreResults && (
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

            {!error && (results.length > 0 || displayResults.length > 0) && (
              <>
                <div className={`school-list school-list--${schoolView} school-list--listing`}>
                  {displayResults.map((school, index) => (
                    <SchoolCard
                      key={school.school_id}
                      school={school}
                      selectedBoards={board}
                      selectedSchoolTypes={schoolType}
                      className={schoolView === "grid" && index >= (isHomePage ? 7 : 3) ? "school-card--continued-in-next-row" : ""}
                    />
                  ))}
                  {schoolView === "grid" && (
                    <TopBoardingSchools
                      category={topSchoolsCategory}
                      boardName={selectedTopBoardName ?? null}
                      boardingSchools={displayTopBoardingSchools}
                      daySchools={displayTopDaySchools}
                      loading={topBoardingSchoolsLoading}
                      error={topBoardingSchoolsError}
                    />
                  )}
                </div>
              </>
            )}
            {schoolView === "grid" && displayResults.length > (isHomePage ? 7 : 3) && (
              <div className="school-list school-list--grid school-list--listing school-list--continuation">
                {displayResults.slice(isHomePage ? 7 : 3).map((school) => (
                  <SchoolCard
                    key={`continuation-${school.school_id}`}
                    school={school}
                    selectedBoards={board}
                    selectedSchoolTypes={schoolType}
                  />
                ))}
              </div>
            )}
            {(schoolView === "list" || error || displayResults.length === 0) && (
              <TopBoardingSchools
                category={topSchoolsCategory}
                boardName={selectedTopBoardName ?? null}
                boardingSchools={displayTopBoardingSchools}
                daySchools={displayTopDaySchools}
                loading={topBoardingSchoolsLoading}
                error={topBoardingSchoolsError}
              />
            )}
            {!isHomePage && loadMoreContent}
          </div>
        </div>
        {isHomePage && loadMoreContent}

        {!topBoardingSchoolsLoading && !topBoardingSchoolsError && topPickSchools.length > 0 && (
          <section className="listing-top-picks-cards" aria-labelledby="listing-top-picks-cards-heading">
            <div className="listing-top-picks-cards__heading">
              <span className="section-eyebrow">TOP PICKS</span>
              <h2 id="listing-top-picks-cards-heading">Explore top {topSchoolsCategory === "residential-school" ? "boarding" : "day"} schools</h2>
              <p>Get a closer look at our top picks and compare school details.</p>
            </div>
            <FeaturedSchoolCards schools={topPickSchools.slice(0, 4)} />
          </section>
        )}

        {guidesError && isHomePage && (
          <p className="home-guides-error" role="status">
            The latest guide articles could not be loaded; saved guide content is shown.
            <span className="sr-only"> {guidesError}</span>
          </p>
        )}
        {isHomePage && publishedGuides[0] && (
          <FeaturedGuide guide={publishedGuides[0]} />
        )}
        <GuideBrowser
          guides={publishedGuides}
          compact={isHomePage}
          featuredSlug={isHomePage ? publishedGuides[0]?.slug : undefined}
        />

        <ReviewsCollection
          mode="section"
          heading={
            activeCountryId || activeStateId || activeCityId
              ? `Parent reviews for ${listingTypeLabel} in ${listingPlaceLabel}`
              : `Parent reviews for ${listingTypeLabel} schools`
          }
          description="Ratings and published reviews are filtered to match the school type, location, and board selected in this listing."
          schoolTypes={schoolType}
          filters={{
            ...(activeCountryId ? { country: activeCountryId } : {}),
            ...(activeStateId ? { state: activeStateId } : {}),
            ...(activeCityId ? { city: activeCityId } : {}),
            ...(geoLocation || initialLocation
              ? { location: geoLocation || initialLocation }
              : {}),
            boards: board,
          }}
        />

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
      {allStatesOpen && (
        <div className="state-explorer" role="presentation">
          <button className="state-explorer__backdrop" type="button" aria-label="Close state explorer" onClick={() => setAllStatesOpen(false)} />
          <section className="state-explorer__dialog" role="dialog" aria-modal="true" aria-labelledby="all-states-title">
            <div className="state-explorer__header">
              <div>
                <span className="section-eyebrow">STATES AND UNION TERRITORIES</span>
                <h2 id="all-states-title">Explore all states</h2>
                <p>Active states and union territories are shown with their current school-listing counts.</p>
              </div>
              <button className="state-explorer__close" type="button" aria-label="Close" onClick={() => setAllStatesOpen(false)}><X size={19} /></button>
            </div>
            <label className="state-explorer__search">
              <Search size={17} aria-hidden />
              <span className="sr-only">Search states</span>
              <input type="search" value={allStateQuery} onChange={(event) => setAllStateQuery(event.target.value)} placeholder="Search states" />
            </label>
            <p className="state-explorer__result-count" role="status" aria-live="polite">
              Showing {visibleStates.length} {visibleStates.length === 1 ? "state" : "states"} with school listings
            </p>
            <div className="state-explorer__cities">
              {visibleStates.map((state) => (
                <Link
                  key={state.state_id}
                  className="state-city-card"
                  href={placeListingPath({ countrySlug: state.country_slug, stateSlug: state.state_slug })}
                  onClick={(event) => {
                    event.preventDefault();
                    setAllStatesOpen(false);
                    openTypePicker({
                      title: `Schools in ${state.state_name}`,
                      subtitle: "Choose the school type you want to explore.",
                      hrefFor: (category) => placeListingPath({
                        countrySlug: state.country_slug,
                        stateSlug: state.state_slug,
                        category,
                      }),
                      showAllOption: false,
                    });
                  }}
                >
                  <div className="state-city-card__heading">
                    <span className="state-city-card__icon"><MapPin size={17} aria-hidden /></span>
                    <span>
                      <strong>{state.state_name}</strong>
                      <small>{state.count.toLocaleString()} school listings</small>
                    </span>
                  </div>
                </Link>
              ))}
              {!visibleStates.length && <p className="state-explorer__empty">No states match that search.</p>}
            </div>
          </section>
        </div>
      )}
      {allCitiesOpen && (
        <div className="state-explorer" role="presentation">
          <button className="state-explorer__backdrop" type="button" aria-label="Close city explorer" onClick={() => setAllCitiesOpen(false)} />
          <section className="state-explorer__dialog" role="dialog" aria-modal="true" aria-labelledby="all-cities-title">
            <div className="state-explorer__header">
              <div>
                <span className="section-eyebrow">CITIES</span>
                <h2 id="all-cities-title">Explore all cities</h2>
                <p>Each city stays linked to its state. Counts come from published schools.</p>
              </div>
              <button className="state-explorer__close" type="button" aria-label="Close" onClick={() => setAllCitiesOpen(false)}><X size={19} /></button>
            </div>
            <label className="state-explorer__search">
              <Search size={17} aria-hidden />
              <span className="sr-only">Filter by state</span>
              <select
                value={allCityStateId}
                onChange={(event) => {
                  setAllCityStateId(event.target.value);
                  setAllCityQuery("");
                }}
                aria-label="Filter cities by state"
              >
                <option value="">All states</option>
                {rankedStates.map((state) => (
                  <option key={state.state_id} value={state.state_id}>
                    {state.state_name} ({state.count.toLocaleString()} listings)
                  </option>
                ))}
              </select>
            </label>
            <label className="state-explorer__search">
              <Search size={17} aria-hidden />
              <span className="sr-only">Search cities</span>
              <input type="search" value={allCityQuery} onChange={(event) => setAllCityQuery(event.target.value)} placeholder="Search cities" />
            </label>
            <p className="state-explorer__result-count" role="status" aria-live="polite">
              {visibleCities.length} {visibleCities.length === 1 ? "city" : "cities"} with school listings
              {allCityStateId
                ? ` in ${rankedStates.find((state) => state.state_id === allCityStateId)?.state_name ?? "the selected state"}`
                : ""}
            </p>
            <div className="state-explorer__cities">
              {visibleCities.map((city) => (
                <Link
                  key={city.city_id}
                  className="state-city-card"
                  href={placeListingPath({
                    countrySlug: city.country_slug ?? city.country_name,
                    stateSlug: city.state_slug ?? city.state_name,
                    citySlug: city.slug,
                  })}
                  onClick={(event) => {
                    event.preventDefault();
                    setAllCitiesOpen(false);
                    const place = {
                      countrySlug: city.country_slug ?? city.country_name,
                      stateSlug: city.state_slug ?? city.state_name,
                      citySlug: city.slug,
                    };
                    openTypePicker({
                      title: `Schools in ${city.city_name}`,
                      subtitle: `Choose the school type you want to explore in ${city.city_name}.`,
                      hrefFor: (category) => placeListingPath({ ...place, category }),
                      showAllOption: false,
                    });
                  }}
                >
                  <div className="state-city-card__heading">
                    <span className="state-city-card__icon"><MapPin size={17} aria-hidden /></span>
                    <span>
                      <strong>{city.city_name}</strong>
                      <small>{city.state_name} · {city.schools_count ?? 0} schools</small>
                    </span>
                  </div>
                </Link>
              ))}
              {!visibleCities.length && <p className="state-explorer__empty">No cities match that search.</p>}
            </div>
          </section>
        </div>
      )}
      <IndiaRegionPickerModal
        open={regionPickerOpen}
        regions={indiaRegionCards}
        onChoose={(region) => {
          window.sessionStorage.setItem("boardingedu:region-prompt", "dismissed");
          setRegionPickerOpen(false);
          selectIndiaRegion(region);
        }}
        onClose={() => {
          window.sessionStorage.setItem("boardingedu:region-prompt", "dismissed");
          setRegionPickerOpen(false);
        }}
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
