"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { fetchAllPages, geography } from "@/lib/api";
import type { CityListItem, CountryListItem, LocationListItem, SchoolTypeListItem, StateListItem } from "@/lib/api";
import { schoolTypeCategory, toSeoSlug, type SchoolTypeCategory } from "@/lib/seo-slugs";

export type HeroFinderValue = { country: string; state: string; city: string; location: string; board: string[]; schoolType: string[] };
type Props = { value: HeroFinderValue; schoolTypes: SchoolTypeListItem[]; locationMessage: string | null; locationError: string | null; onChange: (next: HeroFinderValue, path: string) => void; onSubmit: (path: string) => void };

const categories: { id: SchoolTypeCategory; label: string }[] = [
  { id: "day-school", label: "Day School" },
  { id: "boarding-school", label: "Boarding School" },
  { id: "full-boarding-school", label: "Full Boarding School" },
];

export default function HeroFinder({ value, schoolTypes, locationMessage, locationError, onChange, onSubmit }: Props) {
  const [countries, setCountries] = useState<CountryListItem[]>([]);
  const [states, setStates] = useState<StateListItem[]>([]);
  const [cities, setCities] = useState<CityListItem[]>([]);
  const [locations, setLocations] = useState<LocationListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [countrySearch, setCountrySearch] = useState("");

  const options = schoolTypes.filter((type) => type.status && schoolTypeCategory(type.type_code, type.slug, type.type_name));
  const selectedCategory = schoolTypes.find((type) => value.schoolType.includes(type.school_type_id));
  const activeCategory = selectedCategory ? schoolTypeCategory(selectedCategory.type_code, selectedCategory.slug, selectedCategory.type_name) : null;
  const residential = activeCategory === "boarding-school" || activeCategory === "full-boarding-school";
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
    if (!residential && city) parts.push(toSeoSlug(city.slug));
    if (!residential && city && locality) parts.push(toSeoSlug(locality.slug));
    const pathname = !country ? "/home" : parts.length === 1 ? `/home/${parts[0]}` : `/${parts.join("/")}`;
    const typeQuery = activeCategory && activeCategory !== "day-school" ? `?type=${activeCategory}` : "";
    return `${pathname}${typeQuery}`;
  }, [country, state, city, locality, residential, activeCategory]);

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
    if (!value.state || residential) { setCities([]); return; }
    setCities([]);
    geography.citiesOf(value.state).then(fetchAllPages).then((rows) => { if (active) setCities(rows.filter((row) => row.status && row.state_id === value.state)); }).catch(() => { if (active) { setCities([]); setError("Cities could not be loaded. Please try again."); } });
    return () => { active = false; };
  }, [value.state, residential, retryCount]);
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
    if (partial.schoolType && partial.schoolType.some((id) => {
      const type = schoolTypes.find((item) => item.school_type_id === id);
      const category = type && schoolTypeCategory(type.type_code, type.slug, type.type_name);
      return category === "boarding-school" || category === "full-boarding-school";
    })) {
      next.city = "";
      next.location = "";
    }
    onChange(next, pathFor(next));
  }
  function pathFor(next: HeroFinderValue) {
    const selected = schoolTypes.find((type) => next.schoolType.includes(type.school_type_id));
    const selectedType = selected ? schoolTypeCategory(selected.type_code, selected.slug, selected.type_name) : null;
    const isResidential = selectedType === "boarding-school" || selectedType === "full-boarding-school";
    const nextCountry = countries.find((item) => item.country_id === next.country);
    const nextState = states.find((item) => item.state_id === next.state);
    const nextCity = cities.find((item) => item.city_id === next.city);
    const nextLocality = locations.find((item) => item.location_id === next.location);
    const parts = nextCountry ? [toSeoSlug(nextCountry.slug)] : [];
    if (nextState) parts.push(toSeoSlug(nextState.slug));
    if (!isResidential && nextCity) parts.push(toSeoSlug(nextCity.slug));
    if (!isResidential && nextCity && nextLocality) parts.push(toSeoSlug(nextLocality.slug));
    const pathname = !nextCountry ? "/home" : parts.length === 1 ? `/home/${parts[0]}` : `/${parts.join("/")}`;
    const typeQuery = selectedType && selectedType !== "day-school" ? `?type=${selectedType}` : "";
    return `${pathname}${typeQuery}`;
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!activeCategory || !country || (value.state && !state) || (!residential && value.city && !city) || (!residential && value.location && !locality)) return;
    onSubmit(path);
  }

  return <form className="hero-finder" onSubmit={submit} role="search">
    <fieldset className="finder-group">
      <legend><span>01</span> Select a school type</legend>
      <div className="school-type-choices" role="group" aria-label="School type">
        {categories.map(({ id, label }) => {
          const ids = options.filter((type) => schoolTypeCategory(type.type_code, type.slug, type.type_name) === id).map((type) => type.school_type_id);
          const selected = activeCategory === id;
          return <button key={id} type="button" aria-pressed={selected} disabled={!ids.length} className={selected ? "is-selected" : ""} onClick={() => patch({ schoolType: ids, city: "", location: "" })}>{label}</button>;
        })}
      </div>
    </fieldset>
    <fieldset className="finder-group" disabled={!activeCategory}>
      <legend><span>02</span> Select a location</legend>
      <div className={`finder-group__fields${residential ? " finder-group__fields--regional" : ""}`}>
        <label className="finder-field"><span>Country</span><input list="hero-country-options" value={countrySearch} disabled={!activeCategory} placeholder="Search countries" autoComplete="country-name" onChange={(event) => {
          const query = event.target.value;
          setCountrySearch(query);
          const match = countries.find((row) => row.country_name.toLowerCase() === query.trim().toLowerCase());
          if (match && match.country_id !== value.country) patch({ country: match.country_id, state: "", city: "", location: "" });
        }} onBlur={() => {
          const match = countries.find((row) => row.country_name.toLowerCase() === countrySearch.trim().toLowerCase());
          if (!match) setCountrySearch(country?.country_name ?? "");
        }} /><datalist id="hero-country-options">{countries.map((row) => <option value={row.country_name} key={row.country_id} />)}</datalist></label>
        <label className="finder-field"><span>State</span><select value={value.state} disabled={!value.country || loading} onChange={(event) => patch({ state: event.target.value, city: "", location: "" })}><option value="">All states</option>{states.map((row) => <option value={row.state_id} key={row.state_id}>{row.state_name}</option>)}</select></label>
        {!residential && <>
          <label className="finder-field"><span>City (optional)</span><select value={value.city} disabled={!value.state} onChange={(event) => patch({ city: event.target.value, location: "" })}><option value="">All cities</option>{cities.map((row) => <option value={row.city_id} key={row.city_id}>{row.city_name}</option>)}</select></label>
          <label className="finder-field"><span>Locality (optional)</span><select value={value.location} disabled={!value.city || locations.length === 0} onChange={(event) => patch({ location: event.target.value })}><option value="">Any locality</option>{locations.map((row) => <option value={row.location_id} key={row.location_id}>{row.location_name}</option>)}</select></label>
        </>}
      </div>
      {locationMessage && <p role="status">{locationMessage}</p>}{locationError && <p role="alert">{locationError}</p>}{error && <p role="alert">{error} <button type="button" onClick={() => setRetryCount((count) => count + 1)}>Retry</button></p>}{loading && <p role="status">Loading locations…</p>}
      {activeCategory && <p className="finder-location-summary">{[country?.country_name, state?.state_name, !residential && city?.city_name, !residential && locality?.location_name].filter(Boolean).join(" · ")}</p>}
    </fieldset>
    <div className="finder-actions"><button className="hero-finder__submit" type="submit" disabled={!activeCategory || !country || Boolean(value.state && !state) || Boolean(!residential && value.city && !city) || Boolean(!residential && value.location && !locality)}><Search size={16} /> Search Schools</button></div>
  </form>;
}
