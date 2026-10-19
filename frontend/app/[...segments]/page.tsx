import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ApiError, fetchAllPages, geography, schools } from "@/lib/api";
import type { BoardListItem, CityListItem, CountryListItem, LocationListItem, SchoolDetail, SchoolTypeListItem, StateListItem } from "@/lib/api";
import { homeSchoolTypeIds, schoolTypeCategory, schoolTypeLabel, toSeoSlug, type HomeSchoolCategory } from "@/lib/seo-slugs";
import SchoolProfile, { schoolProfilePath } from "@/components/SchoolProfile";
import SchoolDiscovery from "@/components/SchoolDiscovery";
import { listingCopy, pageMetadata } from "@/lib/seo";
import { boardListingPath } from "@/lib/school-urls";

export const dynamic = "force-dynamic";

type Place = { country: CountryListItem; state?: StateListItem; city?: CityListItem; location?: LocationListItem };
type Props = { params: { segments?: string[] }; searchParams?: { type?: string; home_category?: string } };

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
  const category = typeSlug === "full-boarding-school" ? "boarding-school" : typeSlug ?? "day-school";
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
  return boards.find((row) => row.status && toSeoSlug(row.slug) === toSeoSlug(slug));
}

function legacyBoardSlug(segment: string | undefined): string | undefined {
  if (!segment) return undefined;
  const prefix = /^board(?:=|%3d)/i;
  return prefix.test(segment) ? segment.replace(prefix, "") : undefined;
}

function placePath(place: Place) {
  return [place.country.slug, place.state?.slug, place.city?.slug, place.location?.slug].filter(Boolean).map((slug) => toSeoSlug(slug!)).join("/");
}

function schoolPageMetadata(school: SchoolDetail): Metadata {
  const city = school.city_detail.city_name;
  const state = school.state_detail.state_name;
  const boards = school.boards_detail.map((board) => board.board_name);
  return pageMetadata({
    title: `${school.school_name}, ${city} | BoardingEdu`,
    description: `Explore ${school.school_name} in ${city}, ${state}. Compare boards, fees, and facilities, then send an enquiry or request counselling.`,
    path: schoolProfilePath(school),
    image: school.school_image_url,
    keywords: [school.school_name, city, state, ...boards, "school admissions"],
  });
}

function unavailableMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: true } };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const segments = params.segments ?? [];
  if (segments[0] === "board" && segments.length === 2) {
    try {
      const board = await findActiveBoard(segments[1]);
      if (board) {
        const copy = listingCopy({ boardName: board.board_name, place: "India" });
        return pageMetadata({
          title: copy.title,
          description: copy.description,
          path: boardListingPath(board.slug),
          keywords: [board.board_name, `${board.board_name} schools in India`],
        });
      }
    } catch {
      return unavailableMetadata("School directory | BoardingEdu");
    }
    return unavailableMetadata("Education board not found | BoardingEdu");
  }
  const oldBoardSlug = segments.length === 1 ? legacyBoardSlug(segments[0]) : undefined;
  if (oldBoardSlug !== undefined) {
    try {
      const board = await findActiveBoard(oldBoardSlug);
      if (board) {
        const copy = listingCopy({ boardName: board.board_name, place: "India" });
        return pageMetadata({
          title: copy.title,
          description: copy.description,
          path: boardListingPath(board.slug),
          keywords: [board.board_name, `${board.board_name} schools in India`],
        });
      }
    } catch {
      return unavailableMetadata("School directory | BoardingEdu");
    }
    return unavailableMetadata("Education board not found | BoardingEdu");
  }
  if (segments[0] === "schools" && segments.length === 1) {
    return pageMetadata({
      title: "School directory | BoardingEdu",
      description: "Explore and compare schools by location, education board, school type, and annual fees.",
      path: "/schools",
      keywords: ["school directory", "schools in India", "boarding schools", "day schools"],
    });
  }
  if (segments.length === 4 && ["boarding", "dayschool", "fullboarding"].includes(segments[2])) {
    try {
      return schoolPageMetadata(await schools.bySlug(segments[3]));
    } catch {
      return unavailableMetadata("School profile | BoardingEdu");
    }
  }
  if (
    (segments.length === 4 || segments.length === 5) &&
    !["boarding", "dayschool", "fullboarding"].includes(segments[2])
  ) {
    try {
      return schoolPageMetadata(await schools.bySlug(segments[segments.length - 1]!));
    } catch {
      return unavailableMetadata("School profile | BoardingEdu");
    }
  }
  if (
    segments.length === 1 &&
    segments[0] === "home" &&
    (searchParams?.home_category === "day-school" || searchParams?.home_category === "residential-school")
  ) {
    const label = searchParams.home_category === "day-school" ? "Day School" : "Residential School";
    const copy = listingCopy({ categoryLabel: label, place: "India" });
    return pageMetadata({
      title: copy.title,
      description: `Choose a location to explore ${label.toLowerCase()}s across India.`,
      path: `/home?home_category=${searchParams.home_category}`,
    });
  }
  const homeCategory = segments[segments.length - 1]?.toLowerCase();
  if (homeCategory === "day-school" || homeCategory === "residential-school") {
    const category = homeCategory as HomeSchoolCategory;
    const placeSlugs = segments.slice(0, -1);
    try {
      const place = await resolvePlace(placeSlugs);
      const location = [place.location?.location_name, place.city?.city_name, place.state?.state_name, place.country.country_name].filter(Boolean).join(", ");
      const label = category === "day-school" ? "Day School" : "Residential School";
      const copy = listingCopy({ categoryLabel: label, place: location });
      return pageMetadata({
        title: copy.title,
        description: copy.description,
        path: `/${placePath(place)}/${category}`,
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
    const [types, place] = await Promise.all([resolveTypes(isLegacyTypePrefix ? segments[0] : searchParams?.type), resolvePlace(slugs)]);
    const label = schoolTypeLabel(types[0].type_code, types[0].slug, types[0].type_name);
    const location = [place.location?.location_name, place.city?.city_name, place.state?.state_name, place.country.country_name].filter(Boolean).join(", ");
    const prefix = isLegacyTypePrefix ? `/${segments[0]}/` : isHomePrefix && slugs.length === 1 ? "/home/" : "/";
    const category = schoolTypeCategory(types[0].type_code, types[0].slug, types[0].type_name);
    const typeQuery = !isLegacyTypePrefix && category !== "day-school" ? `?type=${category}` : "";
    const canonical = `${prefix}${placePath(place)}${typeQuery}`;
    const copy = listingCopy({ categoryLabel: label, place: location });
    return pageMetadata({
      title: copy.title,
      description: copy.description,
      path: canonical,
      keywords: [copy.heading, location, label],
    });
  } catch {
    return unavailableMetadata("School discovery | BoardingEdu");
  }
}

export default async function LocationRoute({ params, searchParams }: Props) {
  const segments = params.segments ?? [];
  if (segments[0] === "board" && segments.length === 2) {
    const board = await findActiveBoard(segments[1]);
    if (!board) notFound();
    return <SchoolDiscovery initialFilter={{ boardIds: [board.board_id] }} />;
  }
  const oldBoardSlug = segments.length === 1 ? legacyBoardSlug(segments[0]) : undefined;
  if (oldBoardSlug !== undefined) {
    const board = await findActiveBoard(oldBoardSlug);
    if (!board) notFound();
    redirect(boardListingPath(board.slug));
  }
  if (segments[0] === "schools" && segments.length === 1) {
    return <SchoolDiscovery initialFilter={{}} />;
  }
  if (segments[0] === "home" && segments.length === 1) {
    const homeCategory = searchParams?.home_category;
    if (homeCategory === "day-school" || homeCategory === "residential-school") {
      const types = await resolveHomeTypes(homeCategory);
      return <SchoolDiscovery initialFilter={{ schoolTypes: types.map((type) => type.school_type_id), homeCategory }} />;
    }
    if (!searchParams?.type) return <SchoolDiscovery />;
    const types = await resolveTypes(searchParams.type);
    return <SchoolDiscovery initialFilter={{ schoolTypes: types.map((type) => type.school_type_id) }} />;
  }

  if (segments[0] === "schools" && segments.length === 2) {
    try {
      const school = await schools.bySlug(segments[1]);
      redirect(schoolProfilePath(school));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }
  }

  if (
    (segments.length === 4 || segments.length === 5) &&
    !["boarding", "dayschool", "fullboarding"].includes(segments[2])
  ) {
    try {
      const school = await schools.bySlug(segments[segments.length - 1]!);
      const canonicalPath = schoolProfilePath(school);
      if (`/${segments.join("/")}` !== canonicalPath) redirect(canonicalPath);
      return <SchoolProfile school={school} />;
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error;
    }
  }

  if (segments.length === 4 && ["boarding", "dayschool", "fullboarding"].includes(segments[2])) {
    try {
      const school = await schools.bySlug(segments[3]);
      const path = schoolProfilePath(school);
      if (`/${segments.join("/")}` !== path) redirect(path);
      return <SchoolProfile school={school} />;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }
  }

  // Keep existing /day-school/... and /residential-school/... listing and school URLs.
  if (["day-school", "residential-school"].includes(segments[0] ?? "") && (segments.length === 4 || segments.length === 5)) {
    if (segments.length === 5) {
      try {
        const school: SchoolDetail = await schools.bySlug(segments[4]);
        const path = schoolProfilePath(school);
        if (`/${segments.join("/")}` !== path) redirect(path);
        return <SchoolProfile school={school} />;
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) throw error;
      }
    }
    const place = await resolvePlace(segments.slice(1, 5));
    const types = await resolveTypes(segments[0]);
    return <SchoolDiscovery initialFilter={{
      country: place.country.country_id,
      state: place.state?.state_id,
      city: place.city?.city_id,
      location: place.location?.location_id,
      placeName: place.location?.location_name ?? place.city?.city_name ?? place.state?.state_name ?? place.country.country_name,
      schoolTypes: types.map((type) => type.school_type_id),
    }} />;
  }

  const homeType = segments[segments.length - 1]?.toLowerCase();
  if (homeType === "day-school" || homeType === "residential-school") {
    const category = homeType as HomeSchoolCategory;
    const placeSlugs = segments.slice(0, -1);
    if (!placeSlugs.length || (category === "residential-school" && placeSlugs.length > 3) || (category === "day-school" && placeSlugs.length > 4)) {
      notFound();
    }
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
    const path = `/${placePath(place)}/${category}`;
    if (`/${segments.join("/")}` !== path) redirect(path);
    return <SchoolDiscovery initialFilter={{
      country: place.country.country_id,
      state: place.state?.state_id,
      city: place.city?.city_id,
      location: place.location?.location_id,
      placeName: place.location?.location_name ?? place.city?.city_name ?? place.state?.state_name ?? place.country.country_name,
      schoolTypes: types.map((type) => type.school_type_id),
      homeCategory: category,
    }} />;
  }

  // New hierarchy routes: /home/country, /country/state[/city[/locality]].
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
    const types = await resolveTypes(searchParams?.type);
    if (types.some((type) => {
      const category = schoolTypeCategory(type.type_code, type.slug, type.type_name);
      return category === "boarding-school" || category === "day-boarding-school";
    }) && (place.city || place.location)) notFound();
    const path = slugs.length === 1 ? `/home/${toSeoSlug(place.country.slug)}` : `/${placePath(place)}`;
    const category = schoolTypeCategory(types[0].type_code, types[0].slug, types[0].type_name);
    const canonicalPath = `${path}${category === "day-school" ? "" : `?type=${category}`}`;
    const requestedPath = `/${segments.join("/")}${searchParams?.type ? `?type=${searchParams.type}` : ""}`;
    if (requestedPath !== canonicalPath) redirect(canonicalPath);
    return <SchoolDiscovery initialFilter={{
      country: place.country.country_id,
      state: place.state?.state_id,
      city: place.city?.city_id,
      location: place.location?.location_id,
      placeName: place.location?.location_name ?? place.city?.city_name ?? place.state?.state_name ?? place.country.country_name,
      schoolTypes: types.map((type) => type.school_type_id),
    }} />;
  }
  notFound();
}