import Link from "next/link";
import type { SchoolListItem, SchoolTypeListItem } from "@/lib/api";
import type { CityListItem, CountryListItem, LocationListItem, StateListItem } from "@/lib/api";
import { schoolTypePath } from "@/lib/seo-slugs";

type Place = { country: CountryListItem; state: StateListItem; city: CityListItem; location?: LocationListItem };

export default function SchoolLocationResults({ type, place, rows }: { type: SchoolTypeListItem; place: Place; rows: SchoolListItem[] }) {
  const typeSlug = schoolTypePath(type.type_code);
  const location = [place.location?.location_name, place.city.city_name, place.state.state_name, place.country.country_name].filter(Boolean).join(", ");
  return <main className="location-results">
    <nav aria-label="Breadcrumb"><Link href="/">Home</Link> / <span>{typeSlug === "day-school" ? "Day School" : "Residential School"}</span> / <span>{location}</span></nav>
    <h1>{typeSlug === "day-school" ? "Day Schools" : "Residential Schools"} in {place.location?.location_name ? `${place.location.location_name}, ` : ""}{place.city.city_name}</h1>
    <p>{location}</p>
    {rows.length === 0 && <p>No schools are listed for this type and location yet.</p>}
    <div className="school-list">{rows.map((school) => <article className="school-card" key={school.school_id}>
      <h2><Link href={`/${typeSlug}/${place.country.slug}/${place.state.slug}/${place.city.slug}/${school.slug}`}>{school.school_name}</Link></h2>
      <p>{school.city_name}, {school.state_name}</p>
      <p>{school.school_types_detail.map((item) => item.type_name).join(", ")} · {school.boards_detail.map((item) => item.board_name).join(", ")}</p>
    </article>)}</div>
  </main>;
}
