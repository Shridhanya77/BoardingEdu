"use client";

import { BedDouble, GraduationCap, House, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import IndiaRegionPickerModal from "@/components/home/IndiaRegionPickerModal";
import { fetchAllPages, geography } from "@/lib/api";
import type { CityListItem, CountryListItem, LocationListItem, SchoolTypeListItem, StateListItem } from "@/lib/api";
import { INDIA_REGIONS, indiaRegionById, indiaRegionForState } from "@/lib/india-regions";
import { homeSchoolCategory, homeSchoolCategoryForIds, homeSchoolTypeIds, schoolTypeCategory, toSeoSlug, type HomeSchoolCategory, type SchoolTypeCategory } from "@/lib/seo-slugs";
import { indiaRegionListingPath, placeListingPath } from "@/lib/school-urls";

export type HeroFinderValue = { country: string; region: string; state: string; city: string; location: string; board: string[]; schoolType: string[] };
type FinderCategory = HomeSchoolCategory | SchoolTypeCategory;
type Props = { value: HeroFinderValue; schoolTypes: SchoolTypeListItem[]; locationMessage: string | null; locationError: string | null; homeSearch?: boolean; mobileCategory?: HomeSchoolCategory | null; onChange: (next: HeroFinderValue) => void; onSubmit: (path: string) => void };
type LocationOption = { id: string; name: string };

function LocationCombobox({
  id,
  label,
  value,
  options,
  disabled,
  required,
  placeholder,
  onSelect,
}: {
  id: string;
  label: string;
  value: string;
  options: LocationOption[];
  disabled?: boolean;
  required?: boolean;
  placeholder: string;
  onSelect: (id: string) => void;
}) {
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  function updateValue(nextValue: string) {
    setInputValue(nextValue);
    const match = options.find(
      (option) => option.name.toLocaleLowerCase() === nextValue.trim().toLocaleLowerCase(),
    );
    onSelect(match?.id ?? "");
  }

  return (
    <label className="finder-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        list={`${id}-options`}
        value={inputValue}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-required={required || undefined}
        autoComplete="off"
        aria-autocomplete="list"
        onChange={(event) => updateValue(event.target.value)}
        onBlur={() => {
          const match = options.find(
            (option) => option.name.toLocaleLowerCase() === inputValue.trim().toLocaleLowerCase(),
          );
          if (!match) setInputValue(value);
        }}
      />
      <datalist id={`${id}-options`}>
        {options.map((option) => (
          <option value={option.name} key={option.id} />
        ))}
      </datalist>
    </label>
  );
}

const homeCategories: { id: HomeSchoolCategory; label: string }[] = [
  { id: "day-school", label: "Day Schools" },
  { id: "residential-school", label: "Boarding Schools" },
];
// Explore Schools hero only offers the two parent families. Day boarding
// schools are still discoverable because they belong to both families.
const schoolTypeCategories: { id: SchoolTypeCategory; label: string }[] = [
  { id: "day-school", label: "Day School" },
  { id: "boarding-school", label: "Boarding School" },
];

export default function HeroFinder({ value, schoolTypes, locationMessage, locationError, homeSearch = true, mobileCategory = null, onChange, onSubmit }: Props) {
  const [countries, setCountries] = useState<CountryListItem[]>([]);
  const [states, setStates] = useState<StateListItem[]>([]);
  const [cities, setCities] = useState<CityListItem[]>([]);
  const [locations, setLocations] = useState<LocationListItem[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [countryError, setCountryError] = useState<string | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);
  const [localityError, setLocalityError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [dismissedRegionPickerFor, setDismissedRegionPickerFor] = useState("");

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
  const regionalSelection = residential || (homeSearch && activeCategory === "day-school");
  const country = countries.find((item) => item.country_id === value.country);
  const state = states.find((item) => item.state_id === value.state);
  const city = cities.find((item) => item.city_id === value.city);
  const locality = locations.find((item) => item.location_id === value.location);
  const isIndia = country
    ? toSeoSlug(country.slug || country.country_name) === "india"
    : false;
  const availableRegions = INDIA_REGIONS.filter((region) =>
    states.some((item) => item.status && indiaRegionForState(item.state_name, item.slug)?.id === region.id),
  ).map((region) => ({ id: region.id, label: region.label }));
  useEffect(() => {
    if (!isIndia || value.state || value.region) {
      setRegionPickerOpen(false);
      if (!isIndia) setDismissedRegionPickerFor("");
      return;
    }
    if (
      !loadingStates &&
      availableRegions.length > 0 &&
      dismissedRegionPickerFor !== value.country
    ) {
      setRegionPickerOpen(true);
    }
  }, [
    availableRegions.length,
    dismissedRegionPickerFor,
    isIndia,
    loadingStates,
    value.country,
    value.region,
    value.state,
  ]);
  const listingCategory: HomeSchoolCategory | null = activeCategory === "day-school"
    ? "day-school"
    : activeCategory === "residential-school" || activeCategory === "boarding-school"
      ? "residential-school"
      : null;
  const regionStates = useMemo(() => {
    const region = isIndia ? indiaRegionById(value.region) : undefined;
    return states.filter((item) =>
      item.status && (!region || indiaRegionForState(item.state_name, item.slug)?.id === region.id),
    );
  }, [isIndia, states, value.region]);
  const path = useMemo(() => {
    const selectedRegion = isIndia ? indiaRegionById(value.region) : undefined;
    if (!country) return "/india/";
    if (selectedRegion && !state) return indiaRegionListingPath(selectedRegion.id, listingCategory);
    return placeListingPath({
      countrySlug: country.slug,
      stateSlug: state?.slug,
      citySlug: regionalSelection ? undefined : city?.slug,
      locationSlug: regionalSelection ? undefined : locality?.slug,
      category: listingCategory,
    });
  }, [country, state, city, locality, regionalSelection, listingCategory, value.region, isIndia]);

  useEffect(() => {
    let active = true;
    setCountryError(null);
    setLoadingCountries(true);
    geography.countries().then(fetchAllPages).then((rows) => { if (active) setCountries(rows.filter((row) => row.status)); }).catch((reason: unknown) => { if (active) setCountryError(reason instanceof Error ? reason.message : "Countries could not be loaded."); }).finally(() => { if (active) setLoadingCountries(false); });
    return () => { active = false; };
  }, [retryCount]);
  useEffect(() => {
    let active = true;
    setStateError(null);
    if (!value.country) { setStates([]); setLoadingStates(false); return; }
    setStates([]);
    setLoadingStates(true);
    geography.statesOf(value.country).then(fetchAllPages).then((rows) => { if (active) setStates(rows.filter((row) => row.status && row.country_id === value.country)); }).catch((reason: unknown) => { if (active) { setStates([]); setStateError(reason instanceof Error ? reason.message : "States could not be loaded."); } }).finally(() => { if (active) setLoadingStates(false); });
    return () => { active = false; };
  }, [value.country, retryCount]);
  useEffect(() => {
    let active = true;
    setCityError(null);
    if (!value.state || regionalSelection) { setCities([]); setLoadingCities(false); return; }
    setCities([]);
    setLoadingCities(true);
    geography.citiesOf(value.state).then(fetchAllPages).then((rows) => { if (active) setCities(rows.filter((row) => row.status && row.state_id === value.state)); }).catch((reason: unknown) => { if (active) { setCities([]); setCityError(reason instanceof Error ? reason.message : "Cities could not be loaded."); } }).finally(() => { if (active) setLoadingCities(false); });
    return () => { active = false; };
  }, [value.state, regionalSelection, retryCount]);
  useEffect(() => {
    let active = true;
    setLocalityError(null);
    if (!value.city || regionalSelection) { setLocations([]); setLoadingLocations(false); return; }
    setLocations([]);
    setLoadingLocations(true);
    geography.locationsOf(value.city).then(fetchAllPages).then((rows) => { if (active) setLocations(rows.filter((row) => row.status && row.city_id === value.city)); }).catch((reason: unknown) => { if (active) { setLocations([]); setLocalityError(reason instanceof Error ? reason.message : "Localities could not be loaded."); } }).finally(() => { if (active) setLoadingLocations(false); });
    return () => { active = false; };
  }, [value.city, regionalSelection, retryCount]);

  function patch(partial: Partial<HeroFinderValue>) {
    const next = { ...value, ...partial };
    const selectedCategory = categoryForIds(partial.schoolType ?? next.schoolType);
    if (partial.schoolType && (homeSearch
      ? selectedCategory === "residential-school" || selectedCategory === "day-school"
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
    if (isIndia && !value.state && !value.region) return;
    if (!activeCategory || !country || (value.state && !state) || (!regionalSelection && value.city && !city) || (!regionalSelection && value.location && !locality)) return;
    onSubmit(path);
  }
  function clearSelections() {
    onChange({ country: "", region: "", state: "", city: "", location: "", board: [], schoolType: [] });
  }
  const apiError = countryError ?? stateError ?? cityError ?? localityError;

  return <form className={`hero-finder${mobileCategory ? " hero-finder--mobile-category" : ""}`} onSubmit={submit} role="search">
    <fieldset className="finder-group finder-group--school-type">
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
              ? "Explore day boarding and full boarding schools."
              : id === "day-boarding-school"
                ? "Your child returns home each evening."
                : "Your child stays at school.";
          return <label key={id} className={`school-type-choice${id === "day-boarding-school" ? " school-type-choice--day-boarding" : ""}${selected ? " is-selected" : ""}`}>
            <input
              type="radio"
              name={homeSearch ? "homepage-school-category" : "school-category"}
              value={id}
              checked={selected}
              required
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
      <p className="finder-instruction" role="status">
        Choose Day Schools or Boarding Schools to continue to location selection.
      </p>
    ) : <fieldset className="finder-group finder-group--location">
      <legend><span>02</span> Select a location</legend>
      {mobileCategory && (
        <p className="finder-selected-category">
          Showing {mobileCategory === "day-school" ? "Day Schools" : "Boarding Schools"}
        </p>
      )}
      <div className={`finder-group__fields${regionalSelection ? " finder-group__fields--regional" : ""}`}>
        <LocationCombobox
          id="hero-country"
          label="Country"
          value={country?.country_name ?? ""}
          options={countries.map((row) => ({ id: row.country_id, name: row.country_name }))}
          disabled={loadingCountries}
          required
          placeholder={loadingCountries ? "Loading countries…" : "Search countries"}
          onSelect={(countryId) => patch({ country: countryId, region: "", state: "", city: "", location: "" })}
        />
        {isIndia && (
          <label className={`finder-field${value.country ? "" : " is-disabled"}`} htmlFor="hero-region">
            <span>Region</span>
            <select
              id="hero-region"
              value={value.region}
              disabled={!value.country || loadingStates}
              required
              aria-required="true"
              onChange={(event) => patch({ region: event.target.value, state: "", city: "", location: "" })}
            >
              <option value="">{loadingStates ? "Loading regions…" : "Choose a region"}</option>
              {availableRegions.map((region) => (
                <option value={region.id} key={region.id}>{region.label}</option>
              ))}
            </select>
          </label>
        )}
        {(value.country && (!isIndia || value.region)) && (
        <LocationCombobox
          id="hero-state"
          label="State"
          value={state?.state_name ?? ""}
          options={regionStates.map((row) => ({ id: row.state_id, name: row.state_name }))}
          disabled={!value.country || loadingStates || (isIndia && !value.region)}
          placeholder={loadingStates ? "Loading states…" : "Choose a state"}
          onSelect={(stateId) => patch({ state: stateId, city: "", location: "" })}
        />
        )}
        {regionalSelection ? null : <>
          <LocationCombobox
            id="hero-city"
            label="City"
            value={city?.city_name ?? ""}
            options={cities.map((row) => ({ id: row.city_id, name: row.city_name }))}
            disabled={!value.state || loadingCities}
            placeholder={loadingCities ? "Loading cities…" : "Search cities"}
            onSelect={(cityId) => patch({ city: cityId, location: "" })}
          />
          <LocationCombobox
            id="hero-locality"
            label="Locality (optional)"
            value={locality?.location_name ?? ""}
            options={locations.map((row) => ({ id: row.location_id, name: row.location_name }))}
            disabled={!value.city || loadingLocations}
            placeholder={loadingLocations ? "Loading localities…" : "Search localities"}
            onSelect={(locationId) => patch({ location: locationId })}
          />
        </>}
      </div>
      {locationMessage && <p className="finder-message" role="status">{locationMessage}</p>}
      {locationError && <p className="finder-error" role="alert">{locationError}</p>}
      {apiError && (
        <p className="finder-error" role="alert">
          {apiError}{" "}
          <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
            Retry
          </button>
        </p>
      )}
      {!country && !loadingCountries && !countryError && (
        <p className="finder-instruction" role="status">
          Choose a country. Region and state become available next.
        </p>
      )}
      {value.state && !loadingStates && !states.length && !stateError && (
        <p className="finder-message" role="status">No active states are available for this country.</p>
      )}
      {value.city && !loadingLocations && !locations.length && !localityError && !regionalSelection && (
        <p className="finder-message" role="status">No localities are listed for this city. You can still search the whole city.</p>
      )}
      {(loadingCountries || loadingStates || loadingCities || loadingLocations) && (
        <p className="finder-message" role="status">Loading location options…</p>
      )}
      <p className="finder-location-summary" aria-live="polite">
        {[country?.country_name, indiaRegionById(value.region)?.label, state?.state_name, !regionalSelection && city?.city_name, !regionalSelection && locality?.location_name].filter(Boolean).join(" · ") || "No location selected"}
      </p>
    </fieldset>}
    <div className="finder-actions">
      <button className="finder-clear" type="button" onClick={clearSelections}>
        Clear selections
      </button>
      <button className="hero-finder__submit" type="submit" disabled={!activeCategory || !country || Boolean(value.state && !state) || Boolean(!regionalSelection && value.city && !city) || Boolean(!regionalSelection && value.location && !locality)}>
        <Search size={16} /> Find Schools
      </button>
    </div>
    <IndiaRegionPickerModal
      open={regionPickerOpen}
      regions={availableRegions}
      onChoose={(region) => {
        setRegionPickerOpen(false);
        setDismissedRegionPickerFor(value.country);
        patch({ region, state: "", city: "", location: "" });
      }}
      onClose={() => {
        setRegionPickerOpen(false);
        setDismissedRegionPickerFor(value.country);
      }}
    />
  </form>;
}
