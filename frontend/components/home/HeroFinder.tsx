"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { fetchAllPages, geography } from "@/lib/api";
import type { CityListItem, CountryListItem, LocationListItem, SchoolTypeListItem, StateListItem } from "@/lib/api";
import { toSeoSlug, isDiscoverableSchoolType } from "@/lib/seo-slugs";

export type HeroFinderValue = { country: string; state: string; city: string; location: string; board: string[]; schoolType: string[] };
type Props = { value: HeroFinderValue; schoolTypes: SchoolTypeListItem[]; locationMessage: string | null; locationError: string | null; onChange: (next: HeroFinderValue) => void; onSubmit: (path: string) => void };

function isDay(type: SchoolTypeListItem) { return type.type_code.toUpperCase() === "DAY" || type.slug === "day-school"; }
function isResidential(type: SchoolTypeListItem) { return /^(FULL-BOARDING|BOARDING|RESIDENTIAL)$/i.test(type.type_code) || /residential|boarding/i.test(`${type.slug} ${type.type_name}`); }

export default function HeroFinder({ value, schoolTypes, locationMessage, locationError, onChange, onSubmit }: Props) {
  const [countries, setCountries] = useState<CountryListItem[]>([]);
  const [states, setStates] = useState<StateListItem[]>([]);
  const [cities, setCities] = useState<CityListItem[]>([]);
  const [locations, setLocations] = useState<LocationListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const options = schoolTypes.filter((type) => type.status && isDiscoverableSchoolType(type.type_code, type.slug, type.type_name));
  const selectedType = options.find((type) => value.schoolType.includes(type.school_type_id));
  const residentialType = options.find(isResidential);
  const dayType = options.find(isDay);

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
    if (!value.city) { setLocations([]); return; }
    setLocations([]);
    geography.locationsOf(value.city).then(fetchAllPages).then((rows) => { if (active) setLocations(rows.filter((row) => row.status && row.city_id === value.city)); }).catch(() => { if (active) { setLocations([]); setError("Localities could not be loaded. Please try again."); } });
    return () => { active = false; };
  }, [value.city, retryCount]);

  function patch(partial: Partial<HeroFinderValue>) { onChange({ ...value, ...partial }); }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedType || !country || !state || !city) return;
    const parts = [selectedType === dayType ? "day-school" : "residential-school", country.slug, state.slug, city.slug, ...(locality ? [locality.slug] : [])];
    onSubmit(`/${parts.map(toSeoSlug).join("/")}`);
  }
  const country = countries.find((item) => item.country_id === value.country);
  const state = states.find((item) => item.state_id === value.state);
  const city = cities.find((item) => item.city_id === value.city);
  const locality = locations.find((item) => item.location_id === value.location);
  const valid = Boolean(selectedType && country && state && city);

  return <form className="hero-finder" onSubmit={submit} role="search">
    <fieldset className="finder-group">
      <legend><span>01</span> Select a school type</legend>
      <div className="school-type-choices" role="group" aria-label="School type">
        <button type="button" aria-pressed={selectedType === dayType} disabled={!dayType} className={selectedType === dayType ? "is-selected" : ""} onClick={() => dayType && patch({ schoolType: [dayType.school_type_id], country: "", state: "", city: "", location: "", board: [] })}>Day School</button>
        <button type="button" aria-pressed={selectedType === residentialType} disabled={!residentialType} className={selectedType === residentialType ? "is-selected" : ""} onClick={() => residentialType && patch({ schoolType: [residentialType.school_type_id], country: "", state: "", city: "", location: "", board: [] })}>Residential School</button>
      </div>
    </fieldset>
    <fieldset className="finder-group" disabled={!selectedType}>
      <legend><span>02</span> Select a location</legend>
      <div className="finder-group__fields">
        <label className="finder-field"><span>Country</span><select value={value.country} disabled={!selectedType} onChange={(event) => patch({ country: event.target.value, state: "", city: "", location: "" })}><option value="">Select country</option>{countries.map((row) => <option value={row.country_id} key={row.country_id}>{row.country_name}</option>)}</select></label>
        <label className="finder-field"><span>State</span><select value={value.state} disabled={!value.country} onChange={(event) => patch({ state: event.target.value, city: "", location: "" })}><option value="">Select state</option>{states.map((row) => <option value={row.state_id} key={row.state_id}>{row.state_name}</option>)}</select></label>
        <label className="finder-field"><span>City</span><select value={value.city} disabled={!value.state} onChange={(event) => patch({ city: event.target.value, location: "" })}><option value="">Select city</option>{cities.map((row) => <option value={row.city_id} key={row.city_id}>{row.city_name}</option>)}</select></label>
        <label className="finder-field"><span>Locality (optional)</span><select value={value.location} disabled={!value.city || locations.length === 0} onChange={(event) => patch({ location: event.target.value })}><option value="">Any locality</option>{locations.map((row) => <option value={row.location_id} key={row.location_id}>{row.location_name}</option>)}</select></label>
      </div>
      {locationMessage && <p role="status">{locationMessage}</p>}{locationError && <p role="alert">{locationError}</p>}{error && <p role="alert">{error} <button type="button" onClick={() => setRetryCount((count) => count + 1)}>Retry</button></p>}{loading && <p role="status">Loading locations…</p>}
      {selectedType && <p className="finder-location-summary">{[country?.country_name, state?.state_name, city?.city_name, locality?.location_name].filter(Boolean).join(" · ")}</p>}
    </fieldset>
    <div className="finder-actions"><button className="hero-finder__submit" type="submit" disabled={!valid}><Search size={16} /> Search Schools</button></div>
  </form>;
}
