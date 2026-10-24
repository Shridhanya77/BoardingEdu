import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ApiError, fetchAllPages, geography, schools } from "@/lib/api";
import type { BoardListItem, CityListItem, CountryListItem, LocationListItem, SchoolDetail, SchoolTypeListItem, StateListItem } from "@/lib/api";
import { homeSchoolCategoryFromValue, homeSchoolTypeIds, schoolCategorySegment, schoolTypeCategory, schoolTypeLabel, toSeoSlug, withTrailingSlash, type HomeSchoolCategory } from "@/lib/seo-slugs";
import SchoolProfile, { schoolProfilePath } from "@/components/SchoolProfile";
import SchoolDiscovery from "@/components/SchoolDiscovery";
import { listingCopy, pageMetadata } from "@/lib/seo";
import { boardListingPath, schoolDirectoryPath, schoolSearchPath } from "@/lib/school-urls";
import { isSchoolSectionId, schoolSectionPath, schoolSectionSeo, type SchoolSectionId } from "@/lib/school-sections";
import { breadcrumbJsonLd } from "@/lib/structured-data";
import JsonLd from "@/components/JsonLd";

export const dynamic = "force-dynamic";

type Place = { country: CountryListItem; state?: StateListItem; city?: CityListItem; location?: LocationListItem };
type Props = {
  params: { segments?: string[] };
  searchParams?: Record<string, string | string[] | undefined> & {
    type?: string;
    home_category?: string;
  };
};

function placeBreadcrumbs(place: Place, category?: HomeSchoolCategory) {
  const country = toSeoSlug(place.country.slug);
  const items = [
    { name: "Home", url: "/" },
    { name: place.country.country_name, url: withTrailingSlash(`/home/${country}`) },
  ];
  if (place.state) {
    const state = toSeoSlug(place.state.slug);
    items.push({ name: place.state.state_name, url: withTrailingSlash(`/${country}/${state}`) });
    if (place.city) {
      const city = toSeoSlug(place.city.slug);
      items.push({ name: place.city.city_name, url: withTrailingSlash(`/${country}/${state}/${city}`) });
      if (place.location) {
        items.push({
          name: place.location.location_name,
          url: withTrailingSlash(`/${country}/${state}/${city}/${toSeoSlug(place.location.slug)}`),
        });
      }
    }
  }
  if (category) {
    items.push({
      name: category === "day-school" ? "Day Schools" : "Boarding Schools",
      url: withTrailingSlash(`/${placePath(place)}/${schoolCategorySegment(category)}`),
    });
  }
  return items;
}

async function resolvePlace(slugs: string[]): Promise<Place> {
  const [countrySlug, stateSlug, citySlug, localitySlug] = slugs;
  const countries = await fetchAllPages(await geography.countries());
  const country = countries.find((row) => row.status && toSeoSlug(row.slug) === toSeoSlug(countrySlug));
  if (!country) notFound();
  if (!stateSlug) return { country };
  const states = await fetchAllPages(await geography.statesOf(country.country_id));
  const state = states.find((row) => row.status && toSeoSlug(row.slug) === toSeoSlug(stateSlug) && row.country_id === country.country_id);
  if (!state) notFound();
  if (!citySlug) return { country, state };
  const cities = await fetchAllPages(await geography.citiesOf(state.state_id));
  const city = cities.find((row) => row.status && toSeoSlug(row.slug) === toSeoSlug(citySlug) && row.state_id === state.state_id);
  if (!city) notFound();
  if (!localitySlug) return { country, state, city };
  const locations = await fetchAllPages(await geography.locationsOf(city.city_id));
  const location = locations.find((row) => row.status && toSeoSlug(row.slug) === toSeoSlug(localitySlug) && row.city_id === city.city_id);
  if (!location) notFound();
  return { country, state, city, location };
}

async function resolveTypes(typeSlug?: string): Promise<SchoolTypeListItem[]> {
  const allTypes = (await fetchAllPages(await schools.types())).filter((row) => row.status);
  const category = typeSlug === "full-boarding-school"
    ? "boarding-school"
    : typeSlug === "boarding-schools"
      ? "residential-school"
      : typeSlug ?? "day-school";
  const types = allTypes.filter((row) => schoolTypeCategory(row.type_code, row.slug, row.type_name) === category);
  if (types.length) return types;
  if (category === "residential-school") {
    const residential = allTypes.filter((row) => {
      const resolved = schoolTypeCategory(row.type_code, row.slug, row.type_name);
      return resolved === "boarding-school" || resolved === "day-boarding-school";
    });
    if (residential.length) return residential;
  }
  notFound();
}

async function resolveHomeTypes(category: HomeSchoolCategory): Promise<SchoolTypeListItem[]> {
  const allTypes = (await fetchAllPages(await schools.types())).filter((row) => row.status);
  const ids = new Set(homeSchoolTypeIds(allTypes, category));
  const types = allTypes.filter((type) => ids.has(type.school_type_id));
  if (!types.length) notFound();
  return types;
}

async function findActiveBoard(slug: string): Promise<BoardListItem | undefined> {
  const boards = await fetchAllPages(await schools.boards());
  return boards.find(
    (row) =>
      row.status &&
      [row.slug, row.board_code, row.board_name].some(
        (value) => toSeoSlug(value) === toSeoSlug(slug),
      ),
  );
}

function schoolRoutePath(
  school: SchoolDetail,
  section?: SchoolSectionId,
  enquiry = false,
) {
  const profilePath = schoolProfilePath(school);
  if (enquiry) return `${profilePath}enquiry/`;
  return schoolSectionPath(profilePath, section);
}

function legacyBoardSlug(segment: string | undefined): string | undefined {
  if (!segment) return undefined;
  const prefix = /^board(?:=|%3d)/i;
  return prefix.test(segment) ? segment.replace(prefix, "") : undefined;
}

/**
 * Legacy `?type=` values map onto the two canonical listing families. Day
 * Boarding belongs to both families, so it resolves to the day-school family —
 * matching `homeSchoolCategoryForIds` on the client.
 */
function legacyTypeCategory(value?: string): HomeSchoolCategory | null {
  if (!value) return null;
  if (value === "day-school" || value === "day-boarding-school") return "day-school";
  return homeSchoolCategoryFromValue(value);
}

function placePath(place: Place) {
  return [place.country.slug, place.state?.slug, place.city?.slug, place.location?.slug].filter(Boolean).map((slug) => toSeoSlug(slug!)).join("/");
}

function placeLabel(place: Place) {
  return place.location?.location_name ?? place.city?.city_name ?? place.state?.state_name ?? place.country.country_name;
}

function relatedSearchesFor(
  place: Place,
  options: { currentCategory?: HomeSchoolCategory | null; includeBase?: boolean },
) {
  if (options.currentCategory) return [];
  const label = placeLabel(place);
  const base = place.state ? `/${placePath(place)}` : `/home/${toSeoSlug(place.country.slug)}`;
  const candidates: { label: string; href: string }[] = [];
  if (options.includeBase ?? true) candidates.push({ label: `Schools in ${label}`, href: base });
  const categories: { category: HomeSchoolCategory; label: string }[] = [
    { category: "day-school", label: "Day Schools" },
    { category: "residential-school", label: "Boarding Schools" },
  ];
  for (const option of categories) {
    candidates.push({
      label: `${option.label} in ${label}`,
      href: withTrailingSlash(`/${placePath(place)}/${schoolCategorySegment(option.category)}`),
    });
  }
  const seen = new Set<string>();
  return candidates.filter((item) => (seen.has(item.href) ? false : (seen.add(item.href), true)));
}

/** Accept section-first canonical paths and trailing-section legacy URLs. */
function splitSchoolSection(segments: string[]): { schoolSegments: string[]; section?: SchoolSectionId } {
  const canonicalSection = segments[1]?.toLowerCase();
  if (canonicalSection && isSchoolSectionId(canonicalSection)) {
    return {
      schoolSegments: [segments[0]!, ...segments.slice(2)],
      section: canonicalSection,
    };
  }

  const candidate = segments[segments.length - 1]?.toLowerCase();
  if (candidate && isSchoolSectionId(candidate)) {
    return { schoolSegments: segments.slice(0, -1), section: candidate };
  }
  return { schoolSegments: segments };
}

/**
 * School profiles use [school-slug, localitySlug?, citySlug, stateSlug, countrySlug].
 * Six-segment paths with a type suffix are accepted only to redirect old URLs.
 */
function isNewSchoolPath(segments: string[]): boolean {
  if (segments.length === 4 || segments.length === 5) return true;
  const last = segments[segments.length - 1]?.toLowerCase();
  return segments.length === 6 && (last === "boarding-school" || last === "day-school");
}

/**
 * Request path normalised with a trailing slash. `params.segments` never carries a
 * trailing empty segment, so it must be slashed before comparing against a canonical
 * path — otherwise every school request would redirect onto itself.
 */
function requestedSchoolPath(segments: string[]): string {
  return withTrailingSlash(`/${segments.join("/")}`);
}

function schoolPageMetadata(school: SchoolDetail, section?: SchoolSectionId): Metadata {
  const city = school.city_detail.city_name;
  const state = school.state_detail.state_name;
  const boards = school.boards_detail.map((board) => board.board_name);
  const types = school.school_types_detail.map((type) =>
    schoolTypeLabel(type.type_code, type.slug, type.type_name),
  );
  const schoolSummary = school.tagline || school.about?.replace(/\s+/g, " ").trim();
  const schoolTypeText = types.length ? types.join(" and ").toLowerCase() : "school";
  const description = (
    schoolSummary
      ? `${school.school_name} is a ${schoolTypeText} in ${city}, ${state}. ${schoolSummary}`
      : `Explore ${school.school_name}, a ${schoolTypeText} in ${city}, ${state}${boards.length ? `, following ${boards.join(" and ")}` : ""}. View fees, facilities and admissions information.`
  );
  const sectionCopy = schoolSectionSeo({
    schoolName: school.school_name,
    city,
    section,
    overviewDescription: description,
  });
  return pageMetadata({
    title: sectionCopy.title,
    description: sectionCopy.description,
    path: schoolSectionPath(schoolProfilePath(school), section),
    image: school.school_image_url,
    keywords: [
      ...(school.seo_keywords ?? []),
      ...sectionCopy.keywords,
      ...boards.map((board) => `${board} schools in ${city}`),
      ...types.map((type) => `${type} in ${city}`),
    ],
  });
}

function unavailableMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: true } };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const segments = params.segments ?? [];
  const enquiryRoute = segments[segments.length - 1]?.toLowerCase() === "enquiry";
  if (segments[segments.length - 1]?.toLowerCase() === "sitemap.xml") {
    return { title: "Sitemap | BoardingEdu", robots: { index: false, follow: true } };
  }
  if (segments[0] === "schools" && segments[1] === "search" && segments.length === 3) {
    return {
      title: `School search: ${segments[2]?.replace(/-/g, " ")} | BoardingEdu`,
      description: "Search schools by name, location, board, and other details.",
      robots: { index: false, follow: true },
      alternates: { canonical: `/schools/search/${toSeoSlug(segments[2] ?? "")}/` },
    };
  }
  if (segments.length > 1) {
    const requestedBoards = segments[0]!.split(",").filter(Boolean);
    const matchedBoards = await Promise.all(requestedBoards.map(findActiveBoard));
    const category = homeSchoolCategoryFromValue(segments[segments.length - 1]);
    if (requestedBoards.length && matchedBoards.every(Boolean) && (category || segments.length === 2)) {
      const boards = matchedBoards.filter((board): board is BoardListItem => Boolean(board));
      const categoryLabel = category === "day-school"
        ? "Day schools"
        : category
          ? "Boarding schools"
          : "Schools";
      const boardNames = boards.map((board) => board.board_name).join(", ");
      return pageMetadata({
        title: `${boardNames} ${categoryLabel} | BoardingEdu`,
        description: `Explore ${boardNames} ${categoryLabel.toLowerCase()} and compare school details.`,
        path: `/${segments.join("/")}`,
        keywords: boards.map((board) => `${board.board_name} schools`),
      });
    }
  }
  const boardMetaCategory = homeSchoolCategoryFromValue(segments[2]?.toLowerCase());
  if (segments[0] === "board" && (segments.length === 2 || (segments.length === 3 && Boolean(boardMetaCategory)))) {
    try {
      const board = await findActiveBoard(segments[1]);
      if (board) {
        const homeCategory = boardMetaCategory ?? homeSchoolCategoryFromValue(searchParams?.home_category);
        const categoryLabel = homeCategory === "day-school"
          ? "Day School"
          : homeCategory === "residential-school"
            ? "Boarding School"
            : undefined;
        const copy = listingCopy({ boardName: board.board_name, categoryLabel, place: "India" });
        return pageMetadata({
          title: copy.title,
          description: copy.description,
          path: boardListingPath(board.slug, homeCategory),
          keywords: [board.board_name, `${board.board_name} schools in India`],
        });
      }
    } catch {
      return unavailableMetadata("School directory | BoardingEdu");
    }
    return unavailableMetadata("Education board not found | BoardingEdu");
  }
  const oldBoardSegment = segments.length === 1 ? segments[0] : undefined;
  const oldBoardSlug = oldBoardSegment
    ? legacyBoardSlug(oldBoardSegment) ?? oldBoardSegment
    : undefined;
  if (oldBoardSlug !== undefined) {
    try {
      const board = await findActiveBoard(oldBoardSlug);
      if (board) {
        const homeCategory = homeSchoolCategoryFromValue(searchParams?.home_category);
        const categoryLabel = homeCategory === "day-school"
          ? "Day School"
          : homeCategory
            ? "Boarding School"
            : undefined;
        const copy = listingCopy({ boardName: board.board_name, categoryLabel, place: "India" });
        return pageMetadata({
          title: copy.title,
          description: copy.description,
          path: `/${board.slug}`,
          keywords: [board.board_name, `${board.board_name} schools in India`],
        });
      }
    } catch {
      return unavailableMetadata("School directory | BoardingEdu");
    }
    if (legacyBoardSlug(oldBoardSegment)) {
      return unavailableMetadata("Education board not found | BoardingEdu");
    }
  }
  if (segments[0] === "schools" && segments.length === 1) {
    return pageMetadata({
      title: "School directory | BoardingEdu",
      description: "Explore and compare schools by location, education board, school type, and annual fees.",
      path: "/schools",
      keywords: ["school directory", "schools in India", "boarding schools", "day schools"],
    });
  }
  // Typed directory listings: /schools/day-school/ and /schools/boarding-school/.
  if (segments[0] === "schools" && segments.length === 2) {
    const directoryCategory = homeSchoolCategoryFromValue(segments[1]?.toLowerCase());
    if (directoryCategory) {
      const label = directoryCategory === "day-school" ? "Day School" : "Boarding School";
      const copy = listingCopy({ categoryLabel: label, place: "India" });
      return pageMetadata({
        title: copy.title,
        description: copy.description,
        path: schoolDirectoryPath(directoryCategory),
        keywords: [copy.heading, label, "schools in India"],
      });
    }
  }
  const schoolRouteSegments = enquiryRoute ? segments.slice(0, -1) : segments;
  const { schoolSegments, section: schoolSection } = splitSchoolSection(schoolRouteSegments);
  if (isNewSchoolPath(schoolSegments)) {
    try {
      return schoolPageMetadata(await schools.bySlug(schoolSegments[0]!), schoolSection);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) {
        return unavailableMetadata("School profile | BoardingEdu");
      }
    }
  }
  if (schoolSegments.length === 4 && ["boarding", "dayschool", "fullboarding"].includes(schoolSegments[2] ?? "")) {
    try {
      return schoolPageMetadata(await schools.bySlug(schoolSegments[3]!), schoolSection);
    } catch {
      return unavailableMetadata("School profile | BoardingEdu");
    }
  }
  // Trailing school-type suffixes (…/boarding-school, …/day-school) are listings, not school slugs.
  const isCategorySuffix = ["day-school", "boarding-school", "boarding-schools", "residential-school"].includes(schoolSegments[schoolSegments.length - 1]?.toLowerCase() ?? "");
  if (
    !isCategorySuffix &&
    (schoolSegments.length === 4 || schoolSegments.length === 5) &&
    !["boarding", "dayschool", "fullboarding"].includes(schoolSegments[2] ?? "")
  ) {
    try {
      return schoolPageMetadata(await schools.bySlug(schoolSegments[schoolSegments.length - 1]!), schoolSection);
    } catch {
      return unavailableMetadata("School profile | BoardingEdu");
    }
  }
  const category = homeSchoolCategoryFromValue(segments[segments.length - 1]?.toLowerCase());
  if (category) {
    const placeSlugs = segments.slice(0, -1);
    try {
      const place = await resolvePlace(placeSlugs);
      const location = [place.location?.location_name, place.city?.city_name, place.state?.state_name, place.country.country_name].filter(Boolean).join(", ");
      const label = category === "day-school" ? "Day School" : "Boarding School";
      const copy = listingCopy({ categoryLabel: label, place: location });
      return pageMetadata({
        title: copy.title,
        description: copy.description,
        path: `/${placePath(place)}/${schoolCategorySegment(category)}`,
        keywords: [copy.heading, location, label],
      });
    } catch {
      return unavailableMetadata("School discovery | BoardingEdu");
    }
  }
  const isHomePrefix = segments[0] === "home";
  const isLegacyTypePrefix = ["day-school", "residential-school"].includes(segments[0] ?? "");
  const slugs = isHomePrefix ? segments.slice(1) : isLegacyTypePrefix ? segments.slice(1, 5) : segments.slice(0, 4);
  if (!slugs.length) return { title: "BoardingEdu" };
  try {
    const place = await resolvePlace(slugs);
    const location = [place.location?.location_name, place.city?.city_name, place.state?.state_name, place.country.country_name].filter(Boolean).join(", ");
    const base = `${isHomePrefix && slugs.length === 1 ? "/home/" : "/"}${placePath(place)}`;
    const category = isLegacyTypePrefix
      ? homeSchoolCategoryFromValue(segments[0])
      : legacyTypeCategory(searchParams?.type);
    if (!category) {
      const copy = listingCopy({ place: location });
      return pageMetadata({
        title: copy.title,
        description: copy.description,
        path: base,
        keywords: [copy.heading, location],
      });
    }
    const label = category === "day-school" ? "Day School" : "Boarding School";
    const copy = listingCopy({ categoryLabel: label, place: location });
    return pageMetadata({
      title: copy.title,
      description: copy.description,
      path: `${base}/${schoolCategorySegment(category)}`,
      keywords: [copy.heading, location, label],
    });
  } catch {
    return unavailableMetadata("School discovery | BoardingEdu");
  }
}

export default async function LocationRoute({ params, searchParams }: Props) {
  const segments = params.segments ?? [];
  const enquiryRoute = segments[segments.length - 1]?.toLowerCase() === "enquiry";
  if (segments[segments.length - 1]?.toLowerCase() === "sitemap.xml") {
    redirect("/sitemap.xml");
  }
  const schoolRouteSegments = enquiryRoute ? segments.slice(0, -1) : segments;
  const { schoolSegments, section: schoolSection } = splitSchoolSection(schoolRouteSegments);
  if (segments.length > 1) {
    const requestedBoards = segments[0]!.split(",").filter(Boolean);
    const matchedBoards = await Promise.all(requestedBoards.map(findActiveBoard));
    const category = homeSchoolCategoryFromValue(segments[segments.length - 1]);
    const hasCategory = Boolean(category);
    if (
      requestedBoards.length &&
      matchedBoards.every(Boolean) &&
      (hasCategory || segments.length === 2)
    ) {
      const boards = matchedBoards.filter((board): board is BoardListItem => Boolean(board));
      const placeSegments = segments.slice(1, hasCategory ? -1 : undefined);
      const placeSlugs = new Set(placeSegments.map(toSeoSlug));
      const cityRows = await fetchAllPages(await geography.cities());
      const city = cityRows.find(
        (item) =>
          item.status &&
          (placeSlugs.has(toSeoSlug(item.slug)) || placeSlugs.has(toSeoSlug(item.city_name))),
      );
      const stateCity = cityRows.find(
        (item) =>
          item.status &&
          (placeSlugs.has(toSeoSlug(item.state_slug ?? "")) ||
            placeSlugs.has(toSeoSlug(item.state_name))),
      );
      const countryCity = cityRows.find(
        (item) =>
          item.status &&
          (placeSlugs.has(toSeoSlug(item.country_slug ?? "")) ||
            placeSlugs.has(toSeoSlug(item.country_name))),
      );
      const placeCity = city ?? stateCity ?? countryCity;
      const placeName = city?.city_name ?? stateCity?.state_name ?? countryCity?.country_name;
      const breadcrumbPlaceName = city
        ? `${city.city_name}, ${city.state_name}`
        : stateCity
          ? `${stateCity.state_name}, ${stateCity.country_name}`
          : countryCity?.country_name;
      const types = category ? await resolveHomeTypes(category) : [];
      const breadcrumbs = [
        { name: "Home", url: "/" },
        { name: "School directory", url: schoolDirectoryPath(category) },
        ...(breadcrumbPlaceName ? [{ name: breadcrumbPlaceName, url: `/${segments.join("/")}/` }] : []),
        {
          name: `${boards.map((board) => board.board_name).join(", ")} ${category === "day-school" ? "day" : category ? "boarding" : ""} schools`.replace(/\s+/g, " ").trim(),
          url: `/${segments.join("/")}/`,
        },
      ];
      return (
        <>
          <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
          <SchoolDiscovery
            initialFilter={{
              ...(city ? {
                country: city.country_id,
                state: city.state_id,
                city: city.city_id,
              } : stateCity ? {
                country: stateCity.country_id,
                state: stateCity.state_id,
              } : countryCity ? {
                country: countryCity.country_id,
              } : placeSegments.length ? {
                search: placeSegments.join(" "),
              } : {}),
              ...(placeCity ? { placeName } : {}),
              boardIds: boards.map((board) => board.board_id),
              ...(boards.length === 1 ? { boardSlug: boards[0]!.slug } : {}),
              schoolTypes: types.map((type) => type.school_type_id),
              homeCategory: category ?? undefined,
            }}
            breadcrumbs={breadcrumbs}
          />
        </>
      );
    }
  }
  if (isNewSchoolPath(schoolSegments)) {
    try {
      const school = await schools.bySlug(schoolSegments[0]!);
      const expectedPath = schoolRoutePath(school, schoolSection, enquiryRoute);
      if (requestedSchoolPath(segments) !== expectedPath) redirect(expectedPath);
      return (
        <SchoolProfile
          school={school}
          initialSection={schoolSection ?? "overview"}
          initialEnquiryOpen={enquiryRoute}
        />
      );
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error;
    }
  }
  const boardPathCategory = segments.length === 3 ? homeSchoolCategoryFromValue(segments[2]?.toLowerCase()) : null;
  if (segments[0] === "board" && (segments.length === 2 || (segments.length === 3 && Boolean(boardPathCategory)))) {
    const board = await findActiveBoard(segments[1]);
    if (!board) notFound();
    const queryCategory = homeSchoolCategoryFromValue(searchParams?.home_category);
    // Legacy `?home_category=` board links fold into the typed path URL.
    if (queryCategory) redirect(boardListingPath(board.slug, boardPathCategory ?? queryCategory));
    const homeCategory = boardPathCategory;
    const types = homeCategory ? await resolveHomeTypes(homeCategory) : [];
    const breadcrumbs = [
      { name: "Home", url: "/" },
      { name: "School directory", url: "/schools" },
      {
        name: `${board.board_name} ${homeCategory === "day-school" ? "Day" : homeCategory ? "Boarding" : ""} schools`.replace(/\s+/g, " ").trim(),
        url: boardListingPath(board.slug, homeCategory),
      },
    ];
    return (
      <>
        <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
        <SchoolDiscovery
          initialFilter={{
            boardIds: [board.board_id],
            boardSlug: board.slug,
            schoolTypes: types.map((type) => type.school_type_id),
            homeCategory: homeCategory ?? undefined,
          }}
          breadcrumbs={breadcrumbs}
        />
      </>
    );
  }
  if (segments[0] === "schools" && segments[1] === "search" && segments.length === 3) {
    const searchSlug = toSeoSlug(segments[2] ?? "");
    if (!searchSlug) redirect(schoolDirectoryPath());
    const searchQuery = searchSlug.replace(/-/g, " ");
    const breadcrumbs = [
      { name: "Home", url: "/" },
      { name: "School directory", url: schoolDirectoryPath() },
      { name: `Search: ${searchQuery}`, url: `/schools/search/${searchSlug}/` },
    ];
    return (
      <>
        <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
        <SchoolDiscovery
          initialFilter={{ search: searchQuery }}
          breadcrumbs={breadcrumbs}
        />
      </>
    );
  }
  const legacyBoardSegment = segments.length === 1 ? segments[0] : undefined;
  const oldBoardSlug = legacyBoardSegment
    ? legacyBoardSlug(legacyBoardSegment) ?? legacyBoardSegment
    : undefined;
  if (oldBoardSlug !== undefined) {
    const board = await findActiveBoard(oldBoardSlug);
    if (board) {
      const category = homeSchoolCategoryFromValue(searchParams?.home_category);
      const types = category ? await resolveHomeTypes(category) : [];
      const breadcrumbs = [
        { name: "Home", url: "/" },
        { name: "School directory", url: schoolDirectoryPath(category) },
        {
          name: `${board.board_name} ${category === "day-school" ? "Day" : category ? "Boarding" : ""} schools`.replace(/\s+/g, " ").trim(),
          url: `/${legacyBoardSegment}/`,
        },
      ];
      return (
        <>
          <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
          <SchoolDiscovery
            initialFilter={{
              boardIds: [board.board_id],
              boardSlug: board.slug,
              schoolTypes: types.map((type) => type.school_type_id),
              homeCategory: category ?? undefined,
            }}
            breadcrumbs={breadcrumbs}
          />
        </>
      );
    }
    if (legacyBoardSlug(legacyBoardSegment)) notFound();
  }
  if (segments[0] === "schools" && segments.length === 1) {
    const searchQuery = Array.isArray(searchParams?.search)
      ? searchParams.search[0]
      : searchParams?.search;
    if (searchQuery?.trim()) {
      const remainingParams = new URLSearchParams();
      Object.entries(searchParams ?? {}).forEach(([key, value]) => {
        if (key === "search" || value === undefined) return;
        (Array.isArray(value) ? value : [value]).forEach((item) => {
          remainingParams.append(key, item);
        });
      });
      const query = remainingParams.toString();
      redirect(`${schoolSearchPath(searchQuery)}${query ? `?${query}` : ""}`);
    }
    // Legacy `?home_category=` directory links fold into the typed path URL.
    const legacyCategory = homeSchoolCategoryFromValue(searchParams?.home_category);
    if (legacyCategory) redirect(schoolDirectoryPath(legacyCategory));
    const breadcrumbs = [
      { name: "Home", url: "/" },
      { name: "School directory", url: "/schools" },
    ];
    return (
      <>
        <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
        <SchoolDiscovery initialFilter={{}} breadcrumbs={breadcrumbs} />
      </>
    );
  }
  if (segments[0] === "home" && segments.length === 1) {
    const homeCategory = searchParams?.home_category;
    const category = homeSchoolCategoryFromValue(homeCategory);
    if (category) redirect(schoolDirectoryPath(category));
    if (!searchParams?.type) return <SchoolDiscovery />;
    const types = await resolveTypes(searchParams.type);
    return <SchoolDiscovery initialFilter={{ schoolTypes: types.map((type) => type.school_type_id) }} />;
  }

  // Typed directory listings: /schools/day-school/ and /schools/boarding-school/.
  if (segments[0] === "schools" && segments.length === 2) {
    const directoryCategory = homeSchoolCategoryFromValue(segments[1]?.toLowerCase());
    if (directoryCategory) {
      if (searchParams?.home_category) redirect(schoolDirectoryPath(directoryCategory));
      const types = await resolveHomeTypes(directoryCategory);
      const breadcrumbs = [
        { name: "Home", url: "/" },
        { name: "School directory", url: "/schools" },
        {
          name: directoryCategory === "day-school" ? "Day Schools" : "Boarding Schools",
          url: schoolDirectoryPath(directoryCategory),
        },
      ];
      return (
        <>
          <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
          <SchoolDiscovery
            initialFilter={{
              schoolTypes: types.map((type) => type.school_type_id),
              homeCategory: directoryCategory,
            }}
            breadcrumbs={breadcrumbs}
          />
        </>
      );
    }
    try {
      const school = await schools.bySlug(segments[1]!);
      redirect(schoolProfilePath(school));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }
  }

  if (
    (schoolSegments.length === 4 || schoolSegments.length === 5) &&
    !["boarding", "dayschool", "fullboarding"].includes(schoolSegments[2] ?? "")
  ) {
    try {
      const school = await schools.bySlug(schoolSegments[schoolSegments.length - 1]!);
      const expectedPath = schoolRoutePath(school, schoolSection, enquiryRoute);
      if (requestedSchoolPath(segments) !== expectedPath) redirect(expectedPath);
      return (
        <SchoolProfile
          school={school}
          initialSection={schoolSection ?? "overview"}
          initialEnquiryOpen={enquiryRoute}
        />
      );
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error;
    }
  }

  if (schoolSegments.length === 4 && ["boarding", "dayschool", "fullboarding"].includes(schoolSegments[2] ?? "")) {
    try {
      const school = await schools.bySlug(schoolSegments[3]!);
      const expectedPath = schoolRoutePath(school, schoolSection, enquiryRoute);
      if (requestedSchoolPath(segments) !== expectedPath) redirect(expectedPath);
      return (
        <SchoolProfile
          school={school}
          initialSection={schoolSection ?? "overview"}
          initialEnquiryOpen={enquiryRoute}
        />
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }
  }

  // Legacy /day-school/... and /residential-school/... listings fold into the
  // canonical /{place}/{day-school|boarding-school}/ form.
  if (["day-school", "residential-school"].includes(schoolSegments[0] ?? "") && (schoolSegments.length === 4 || schoolSegments.length === 5)) {
    if (schoolSegments.length === 5) {
      try {
        const school: SchoolDetail = await schools.bySlug(schoolSegments[4]!);
        const expectedPath = schoolRoutePath(school, schoolSection, enquiryRoute);
        if (requestedSchoolPath(segments) !== expectedPath) redirect(expectedPath);
        return (
          <SchoolProfile
            school={school}
            initialSection={schoolSection ?? "overview"}
            initialEnquiryOpen={enquiryRoute}
          />
        );
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) throw error;
      }
    }
    const place = await resolvePlace(schoolSegments.slice(1, 5));
    const category: HomeSchoolCategory = schoolSegments[0] === "day-school" ? "day-school" : "residential-school";
    redirect(`/${placePath(place)}/${schoolCategorySegment(category)}`);
  }

  const category = homeSchoolCategoryFromValue(segments[segments.length - 1]?.toLowerCase());
  if (category) {
    const placeSlugs = segments.slice(0, -1);
    if (!placeSlugs.length || placeSlugs.length > 4) notFound();
    // Historical /country/state/city/school-slug links retain priority over suffix routes.
    if (segments.length === 4) {
      try {
        const school = await schools.bySlug(segments[3]);
        redirect(schoolProfilePath(school));
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) throw error;
      }
    }
    const [place, types] = await Promise.all([resolvePlace(placeSlugs), resolveHomeTypes(category)]);
    const path = `/${placePath(place)}/${schoolCategorySegment(category)}`;
    if (`/${segments.join("/")}` !== path) redirect(path);
    const breadcrumbs = placeBreadcrumbs(place, category);
    return (
      <>
        <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
        <SchoolDiscovery
          breadcrumbs={breadcrumbs}
          relatedSearches={relatedSearchesFor(place, { currentCategory: category })}
          initialFilter={{
            country: place.country.country_id,
            state: place.state?.state_id,
            city: place.city?.city_id,
            location: place.location?.location_id,
            placeName: place.location?.location_name ?? place.city?.city_name ?? place.state?.state_name ?? place.country.country_name,
            schoolTypes: types.map((type) => type.school_type_id),
            homeCategory: category,
          }}
        />
      </>
    );
  }

  // Place landing pages: /home/country, /country/state[/city[/locality]].
  // These ask for a school type first; the typed URL is the filtered listing.
  const isHomePrefix = segments[0] === "home";
  const slugs = isHomePrefix ? segments.slice(1) : segments;
  if (slugs.length >= 1 && slugs.length <= 4) {
    // Historical /country/state/city/school-slug links continue to resolve first.
    if (!isHomePrefix && slugs.length === 4) {
      try {
        const school = await schools.bySlug(slugs[3]);
        redirect(schoolProfilePath(school));
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) throw error;
      }
    }
    const place = await resolvePlace(slugs);
    const path = slugs.length === 1 ? `/home/${toSeoSlug(place.country.slug)}` : `/${placePath(place)}`;
    // Legacy ?type= listings fold into the canonical typed URL.
    const requestedType = legacyTypeCategory(searchParams?.type);
    if (requestedType) {
      const typedPath = `/${placePath(place)}/${schoolCategorySegment(requestedType)}`;
      if (`/${segments.join("/")}${searchParams?.type ? `?type=${searchParams.type}` : ""}` !== typedPath) redirect(typedPath);
    }
    if (`/${segments.join("/")}` !== path) redirect(path);
    const breadcrumbs = placeBreadcrumbs(place);
    return (
      <>
        <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />
        <SchoolDiscovery
          breadcrumbs={breadcrumbs}
          relatedSearches={relatedSearchesFor(place, { includeBase: false })}
          initialFilter={{
            country: place.country.country_id,
            state: place.state?.state_id,
            city: place.city?.city_id,
            location: place.location?.location_id,
            placeName: place.location?.location_name ?? place.city?.city_name ?? place.state?.state_name ?? place.country.country_name,
            place: {
              countrySlug: place.country.slug ?? place.country.country_name,
              stateSlug: place.state?.slug ?? place.state?.state_name,
              citySlug: place.city?.slug ?? place.city?.city_name,
              locationSlug: place.location?.slug ?? place.location?.location_name,
            },
          }}
        />
      </>
    );
  }
  notFound();
}