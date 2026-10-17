"use client";

import { BedDouble, GraduationCap, House, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { fetchAllPages, geography } from "@/lib/api";
import type { CityListItem, CountryListItem, LocationListItem, SchoolTypeListItem, StateListItem } from "@/lib/api";
import { homeSchoolCategory, homeSchoolCategoryForIds, homeSchoolTypeIds, schoolTypeCategory, toSeoSlug, type HomeSchoolCategory, type SchoolTypeCategory } from "@/lib/seo-slugs";

export type HeroFinderValue = { country: string; state: string; city: string; location: string; board: string[]; schoolType: string[] };
type FinderCategory = HomeSchoolCategory | SchoolTypeCategory;
type Props = { value: HeroFinderValue; schoolTypes: SchoolTypeListItem[]; locationMessage: string | null; locationError: string | null; homeSearch?: boolean; onChange: (next: HeroFinderValue) => void; onSubmit: (path: string) => void };

const homeCategories: { id: HomeSchoolCategory; label: string }[] = [
  { id: "day-school", label: "Day School" },
  { id: "residential-school", label: "Residential School" },
];
const schoolTypeCategories: { id: SchoolTypeCategory; label: string }[] = [
  { id: "day-school", label: "Day School" },
  { id: "day-boarding-school", label: "Day Boarding School" },
  { id: "boarding-school", label: "Boarding School" },
];

export default function HeroFinder({ value, schoolTypes, locationMessage, locationError, homeSearch = true, onChange, onSubmit }: Props) {
  const [countries, setCountries] = useState<CountryListItem[]>([]);
  const [states, setStates] = useState<StateListItem[]>([]);
  const [cities, setCities] = useState<CityListItem[]>([]);
  const [locations, setLocations] = useState<LocationListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [countrySearch, setCountrySearch] = useState("");

  const options = schoolTypes.filter((type) => type.status && (homeSearch
    ? homeSchoolCategory(type.type_code, type.slug, type.type_name)
    : schoolTypeCategory(type.type_code, type.slug, type.type_name)));
  const categories: { id: FinderCategory; label: string }[] = homeSearch ? homeCategories : schoolTypeCategories;
  const selectedType = schoolTypes.find((type) => value.schoolType.includes(type.school_type_id));
  const activeCategory: FinderCategory | null = homeSearch
    ? homeSchoolCategoryForIds(value.schoolType, options)
    : selectedType ? schoolTypeCategory(selectedType.type_code, selectedType.slug, selectedType.type_name) : null;
  const residential = homeSearch
    ? activeCategory === "residential-school"
    : activeCategory === "day-boarding-school" || activeCategory === "boarding-school";
  const country = countries.find((item) => item.country_id === value.country);
  const state = states.find((item) => item.state_id === value.state);
  const city = cities.find((item) => item.city_id === value.city);
  const locality = locations.find((item) => item.location_id === value.location);
  useEffect(() => {
    setCountrySearch(country?.country_name ?? "");
  }, [country?.country_name, value.country]);
  const path = useMemo(() => {
    const parts = country ? [toSeoSlug(country.slug)] : [];
    if (state) parts.push(toSeoSlug(state.slug));
    if (city) parts.push(toSeoSlug(city.slug));
    if (!residential && city && locality) parts.push(toSeoSlug(locality.slug));
    if (!homeSearch) {
      const pathname = !country ? "/home" : parts.length === 1 ? `/home/${parts[0]}` : `/${parts.join("/")}`;
      const typeQuery = activeCategory && activeCategory !== "day-school" ? `?type=${activeCategory}` : "";
      return `${pathname}${typeQuery}`;
    }
    return activeCategory
      ? country ? `/${parts.join("/")}/${activeCategory}` : `/home?home_category=${activeCategory}`
      : "/home";
  }, [country, state, city, locality, residential, activeCategory, homeSearch]);

  useEffect(() => {
    let active = true;
    setError(null);
    geography.countries().then(fetchAllPages).then((rows) => { if (active) setCountries(rows.filter((row) => row.status)); }).catch(() => { if (active) setError("Countries could not be loaded. Please try again."); });
    return () => { active = false; };
  }, [retryCount]);
  useEffect(() => {
    let active = true;
    setError(null);
    if (!value.country) { setStates([]); return; }
    setStates([]);
    setLoading(true);
    geography.statesOf(value.country).then(fetchAllPages).then((rows) => { if (active) setStates(rows.filter((row) => row.status && row.country_id === value.country)); }).catch(() => { if (active) { setStates([]); setError("States could not be loaded. Please try again."); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [value.country, retryCount]);
  useEffect(() => {
    let active = true;
    setError(null);
    if (!value.state) { setCities([]); return; }
    setCities([]);
    geography.citiesOf(value.state).then(fetchAllPages).then((rows) => { if (active) setCities(rows.filter((row) => row.status && row.state_id === value.state)); }).catch(() => { if (active) { setCities([]); setError("Cities could not be loaded. Please try again."); } });
    return () => { active = false; };
  }, [value.state, retryCount]);
  useEffect(() => {
    let active = true;
    setError(null);
    if (!value.city || residential) { setLocations([]); return; }
    setLocations([]);
    geography.locationsOf(value.city).then(fetchAllPages).then((rows) => { if (active) setLocations(rows.filter((row) => row.status && row.city_id === value.city)); }).catch(() => { if (active) { setLocations([]); setError("Localities could not be loaded. Please try again."); } });
    return () => { active = false; };
  }, [value.city, residential, retryCount]);

  function patch(partial: Partial<HeroFinderValue>) {
    const next = { ...value, ...partial };
    const selectedCategory = categoryForIds(partial.schoolType ?? next.schoolType);
    if (partial.schoolType && (homeSearch
      ? selectedCategory === "residential-school"
      : selectedCategory === "day-boarding-school" || selectedCategory === "boarding-school")) {
      next.city = "";
      next.location = "";
    }
    onChange(next);
  }
  function categoryForIds(ids: string[]): FinderCategory | null {
    if (homeSearch) return homeSchoolCategoryForIds(ids, options);
    const selected = schoolTypes.find((type) => ids.includes(type.school_type_id));
    return selected ? schoolTypeCategory(selected.type_code, selected.slug, selected.type_name) : null;
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!activeCategory || !country || (value.state && !state) || (value.city && !city) || (!residential && value.location && !locality)) return;
    onSubmit(path);
  }

  return <form className="hero-finder" onSubmit={submit} role="search">
    <fieldset className="finder-group">
      <legend><span>01</span> Select a school type</legend>
      <div className={`school-type-choices${homeSearch ? " school-type-choices--cards" : ""}`} role="radiogroup" aria-label="School type">
        {categories.map(({ id, label }) => {
          const ids = homeSearch
            ? homeSchoolTypeIds(options, id as HomeSchoolCategory)
            : options.filter((type) => schoolTypeCategory(type.type_code, type.slug, type.type_name) === id).map((type) => type.school_type_id);
          const selected = activeCategory === id;
          const Icon = id === "day-school" ? GraduationCap : id === "day-boarding-school" ? BedDouble : House;
          const description = id === "day-school"
            ? "Students commute daily and return home after classes"
            : id === "residential-school"
              ? "Explore day boarding and boarding schools."
              : id === "day-boarding-school"
                ? "Your child returns home each evening."
                : "Your child stays at school.";
          return <label key={id} className={`school-type-choice${selected ? " is-selected" : ""}`}>
            <input
              type="radio"
              name={homeSearch ? "homepage-school-category" : "school-category"}
              value={id}
              checked={selected}
              disabled={!ids.length}
              onChange={() => patch({ schoolType: ids, city: "", location: "" })}
            />
            <span className="school-type-choice__indicator" aria-hidden="true" />
            <Icon className="school-type-choice__icon" size={24} aria-hidden="true" />
            <span className="school-type-choice__copy">
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
          </label>;
        })}
      </div>
    </fieldset>
    {!activeCategory ? (
      <p className="finder-instruction" role="status">First, choose the type of school</p>
    ) : <fieldset className="finder-group">
      <legend><span>02</span> Select a location</legend>
      <div className={`finder-group__fields${residential ? " finder-group__fields--regional" : ""}`}>
        <label className="finder-field"><span>Country</span><input list="hero-country-options" value={countrySearch} placeholder="Search countries" autoComplete="country-name" onChange={(event) => {
          const query = event.target.value;
          setCountrySearch(query);
          const match = countries.find((row) => row.country_name.toLowerCase() === query.trim().toLowerCase());
          if (match && match.country_id !== value.country) patch({ country: match.country_id, state: "", city: "", location: "" });
        }} onBlur={() => {
          const match = countries.find((row) => row.country_name.toLowerCase() === countrySearch.trim().toLowerCase());
          if (!match) setCountrySearch(country?.country_name ?? "");
        }} /><datalist id="hero-country-options">{countries.map((row) => <option value={row.country_name} key={row.country_id} />)}</datalist></label>
        <label className="finder-field"><span>State</span><select value={value.state} disabled={!value.country || loading} onChange={(event) => patch({ state: event.target.value, city: "", location: "" })}><option value="">All states</option>{states.map((row) => <option value={row.state_id} key={row.state_id}>{row.state_name}</option>)}</select></label>
        {residential ? (
          <label className="finder-field"><span>City (optional)</span><select value={value.city} disabled={!value.state} onChange={(event) => patch({ city: event.target.value, location: "" })}><option value="">All cities in state</option>{cities.map((row) => <option value={row.city_id} key={row.city_id}>{row.city_name}</option>)}</select></label>
        ) : <>
          <label className="finder-field"><span>City</span><select value={value.city} disabled={!value.state} onChange={(event) => patch({ city: event.target.value, location: "" })}><option value="">All cities</option>{cities.map((row) => <option value={row.city_id} key={row.city_id}>{row.city_name}</option>)}</select></label>
          <label className="finder-field"><span>Locality</span><select value={value.location} disabled={!value.city || locations.length === 0} onChange={(event) => patch({ location: event.target.value })}><option value="">Any locality</option>{locations.map((row) => <option value={row.location_id} key={row.location_id}>{row.location_name}</option>)}</select></label>
        </>}
      </div>
      {locationMessage && <p role="status">{locationMessage}</p>}{locationError && <p role="alert">{locationError}</p>}{error && <p role="alert">{error} <button type="button" onClick={() => setRetryCount((count) => count + 1)}>Retry</button></p>}{loading && <p role="status">Loading locations…</p>}
      <p className="finder-location-summary">{[country?.country_name, state?.state_name, city?.city_name, !residential && locality?.location_name].filter(Boolean).join(" · ")}</p>
    </fieldset>}
    <div className="finder-actions"><button className="hero-finder__submit" type="submit" disabled={!activeCategory || !country || Boolean(value.state && !state) || Boolean(!residential && value.city && !city) || Boolean(!residential && value.location && !locality)}><Search size={16} /> Search Schools</button></div>
  </form>;
}
