import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ApiError, fetchAllPages, geography, schools } from "@/lib/api";
import type { CityListItem, CountryListItem, LocationListItem, SchoolDetail, SchoolTypeListItem, StateListItem } from "@/lib/api";
import { schoolTypePath, toSeoSlug } from "@/lib/seo-slugs";
import SchoolProfile, { schoolProfilePath } from "@/components/SchoolProfile";
import SchoolLocationResults from "@/components/SchoolLocationResults";

export const dynamic = "force-dynamic";

type Place = { country: CountryListItem; state: StateListItem; city: CityListItem; location?: LocationListItem };
type Props = { params: { segments?: string[] } };

async function resolvePlace(slugs: string[], includeLocation: boolean): Promise<Place> {
  const [countrySlug, stateSlug, citySlug, locationSlug] = slugs;
  const countries = await fetchAllPages(await geography.countries());
  const country = countries.find((row) => row.status && row.slug === countrySlug);
  if (!country) notFound();
  const states = await fetchAllPages(await geography.statesOf(country.country_id));
  const state = states.find((row) => row.status && row.slug === stateSlug && row.country_id === country.country_id);
  if (!state) notFound();
  const cities = await fetchAllPages(await geography.citiesOf(state.state_id));
  const city = cities.find((row) => row.status && row.slug === citySlug && row.state_id === state.state_id);
  if (!city) notFound();
  if (!includeLocation) return { country, state, city };
  const locations = await fetchAllPages(await geography.locationsOf(city.city_id));
  const location = locations.find((row) => row.status && row.slug === locationSlug && row.city_id === city.city_id);
  if (!location) notFound();
  return { country, state, city, location };
}

async function resolveSchoolType(slug: string): Promise<SchoolTypeListItem> {
  const types = await fetchAllPages(await schools.types());
  const expected = slug === "day-school" ? "DAY" : slug === "residential-school" ? "RESIDENTIAL" : "";
  const type = types.find((row) => row.status && (
    row.slug === slug || row.type_code.toUpperCase() === expected ||
    (expected === "RESIDENTIAL" && /^(FULL-BOARDING|BOARDING)$/.test(row.type_code.toUpperCase()))
  ));
  if (!type) notFound();
  return type;
}

function displayType(type: SchoolTypeListItem) {
  return schoolTypePath(type.type_code) === "day-school" ? "Day School" : "Residential School";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const segments = params.segments ?? [];
  if (segments.length < 4) return { title: "BoardingEdu" };
  try {
    if (segments.length === 5) {
      try {
        const school = await schools.bySlug(segments[4]);
        const requestedPath = `/${segments.join("/")}`;
        return {
          title: `${school.school_name} | BoardingEdu`,
          description: `${school.school_name} in ${school.city_detail.city_name}, ${school.state_detail.state_name}. Explore verified school information and admissions details on BoardingEdu.`,
          alternates: { canonical: schoolProfilePath(school) },
          ...(requestedPath === schoolProfilePath(school) ? {} : { robots: { index: false, follow: true } }),
        };
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) throw error;
      }
    }
    const [type, place] = await Promise.all([
      resolveSchoolType(segments[0]),
      resolvePlace(segments.slice(1, 4), segments.length === 5),
    ]);
    const locality = place.location?.location_name;
    const location = [locality, place.city.city_name, place.state.state_name, place.country.country_name].filter(Boolean).join(", ");
    const canonical = `/${schoolTypePath(type.type_code)}/${segments.slice(1).map(toSeoSlug).join("/")}`;
    return { title: `${displayType(type)} in ${location} | BoardingEdu`, description: `Explore ${displayType(type).toLowerCase()} options in ${location}. Compare verified school information on BoardingEdu.`, alternates: { canonical } };
  } catch { return { title: "School discovery | BoardingEdu", robots: { index: false, follow: true } }; }
}

export default async function LocationRoute({ params }: Props) {
  const segments = params.segments ?? [];
  if (segments[0] === "schools" && segments.length === 2) {
    try {
      const school = await schools.bySlug(segments[1]);
      redirect(schoolProfilePath(school));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }
  }

  if ((segments.length === 4 || segments.length === 5) && segments[0] && ["day-school", "residential-school"].includes(segments[0])) {
    // A five-part path may be a canonical school URL or a locality listing.
    if (segments.length === 5) {
      try {
        const school: SchoolDetail = await schools.bySlug(segments[4]);
        const path = schoolProfilePath(school);
        const oldPath = `/${segments.join("/")}`;
        if (oldPath !== path) redirect(path);
        return <SchoolProfile school={school} />;
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) throw error;
      }
    }
    const [type, place] = await Promise.all([
      resolveSchoolType(segments[0]),
      resolvePlace(segments.slice(1, 4), segments.length === 5),
    ]);
    const expected = `/${schoolTypePath(type.type_code)}/${[place.country.slug, place.state.slug, place.city.slug, ...(place.location ? [place.location.slug] : [])].join("/")}`;
    if (`/${segments.join("/")}` !== expected) redirect(expected);
    const results = await schools.list({
      country: place.country.country_id,
      state: place.state.state_id,
      city: place.city.city_id,
      location: place.location?.location_id,
      school_type: type.school_type_id,
    });
    return <SchoolLocationResults type={type} place={place} rows={results.results} />;
  }

  // Retain the historical /country/state/city/school-slug URLs.
  if (segments.length === 4) {
    try {
      const school = await schools.bySlug(segments[3]);
      redirect(schoolProfilePath(school));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }
  }
  notFound();
}
