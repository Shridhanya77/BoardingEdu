"use client";

import { useMemo, useState } from "react";
import type { CityListItem, StateListItem } from "@/lib/api";

type Props = {
  states: StateListItem[];
  cities: CityListItem[];
  selectedStateIds: string[];
  selectedCityIds: string[];
  onStatesChange: (ids: string[]) => void;
  onCitiesChange: (ids: string[]) => void;
  disabled?: boolean;
  citiesRequired?: boolean;
};

const MAX_VISIBLE_CITIES = 100;

export default function CounsellingLocationMultiSelect({
  states,
  cities,
  selectedStateIds,
  selectedCityIds,
  onStatesChange,
  onCitiesChange,
  disabled = false,
  citiesRequired = true,
}: Props) {
  const [stateSearch, setStateSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const selectedStateSet = useMemo(() => new Set(selectedStateIds), [selectedStateIds]);
  const availableCities = useMemo(
    () => cities.filter((city) => selectedStateSet.has(city.state_id)),
    [cities, selectedStateSet],
  );
  const matchingStates = useMemo(() => {
    const query = stateSearch.trim().toLocaleLowerCase();
    return states.filter((state) => state.state_name.toLocaleLowerCase().includes(query));
  }, [stateSearch, states]);
  const matchingCities = useMemo(() => {
    const query = citySearch.trim().toLocaleLowerCase();
    return availableCities.filter((city) =>
      `${city.city_name} ${city.state_name}`.toLocaleLowerCase().includes(query),
    );
  }, [availableCities, citySearch]);
  const visibleCities = matchingCities.slice(0, MAX_VISIBLE_CITIES);

  function toggleState(stateId: string, checked: boolean) {
    const nextStateIds = checked
      ? [...selectedStateIds, stateId]
      : selectedStateIds.filter((id) => id !== stateId);
    onStatesChange(nextStateIds);
    onCitiesChange(
      selectedCityIds.filter((cityId) => {
        const city = cities.find((item) => item.city_id === cityId);
        return Boolean(city && nextStateIds.includes(city.state_id));
      }),
    );
  }

  function toggleCity(cityId: string, checked: boolean) {
    onCitiesChange(
      checked
        ? [...selectedCityIds, cityId]
        : selectedCityIds.filter((id) => id !== cityId),
    );
  }

  return (
    <div className="counselling-location-picker">
      <fieldset className="counselling-location-picker__group" disabled={disabled}>
        <legend>Preferred states <span aria-hidden="true">*</span></legend>
        <p className="counselling-location-picker__hint">Select every state you want the counsellor to consider.</p>
        <label className="counselling-location-picker__search">
          <span className="sr-only">Search states</span>
          <input
            type="search"
            value={stateSearch}
            onChange={(event) => setStateSearch(event.target.value)}
            placeholder="Search states"
          />
        </label>
        <div className="counselling-location-picker__actions">
          <button type="button" onClick={() => onStatesChange(states.map((state) => state.state_id))}>
            Select all states
          </button>
          <button
            type="button"
            onClick={() => {
              onStatesChange([]);
              onCitiesChange([]);
            }}
            disabled={!selectedStateIds.length}
          >
            Clear
          </button>
        </div>
        <div className="counselling-location-picker__options" role="group" aria-label="Preferred states">
          {matchingStates.map((state) => (
            <label key={state.state_id}>
              <input
                type="checkbox"
                checked={selectedStateSet.has(state.state_id)}
                onChange={(event) => toggleState(state.state_id, event.target.checked)}
              />
              <span>{state.state_name}</span>
            </label>
          ))}
          {!states.length && <p role="status">State list is still loading.</p>}
          {states.length > 0 && !matchingStates.length && <p role="status">No states match your search.</p>}
        </div>
        <span className="counselling-location-picker__summary" aria-live="polite">
          {selectedStateIds.length} state{selectedStateIds.length === 1 ? "" : "s"} selected
        </span>
      </fieldset>

      <fieldset
        className="counselling-location-picker__group"
        disabled={disabled || selectedStateIds.length === 0}
      >
        <legend>
          Preferred cities{citiesRequired ? <> <span aria-hidden="true">*</span></> : " (optional)"}
        </legend>
        <label className="counselling-location-picker__search">
          <span className="sr-only">Search cities</span>
          <input
            type="search"
            value={citySearch}
            onChange={(event) => setCitySearch(event.target.value)}
            placeholder={selectedStateIds.length ? "Search cities" : "Choose states first"}
          />
        </label>
        <div className="counselling-location-picker__options" role="group" aria-label="Preferred cities">
          {visibleCities.map((city) => (
            <label key={city.city_id}>
              <input
                type="checkbox"
                checked={selectedCityIds.includes(city.city_id)}
                onChange={(event) => toggleCity(city.city_id, event.target.checked)}
              />
              <span>{city.city_name}, {city.state_name}</span>
            </label>
          ))}
          {selectedStateIds.length > 0 && !matchingCities.length && (
            <p role="status">No cities match your search.</p>
          )}
          {selectedStateIds.length > 0 && matchingCities.length > visibleCities.length && (
            <p className="counselling-location-picker__hint">
              Showing the first {MAX_VISIBLE_CITIES} matches. Search to narrow the list.
            </p>
          )}
        </div>
        <div className="counselling-location-picker__actions">
          <button type="button" onClick={() => onCitiesChange([])} disabled={!selectedCityIds.length}>
            Clear cities
          </button>
        </div>
        <span className="counselling-location-picker__summary" aria-live="polite">
          {selectedCityIds.length} {selectedCityIds.length === 1 ? "city" : "cities"} selected
        </span>
      </fieldset>
    </div>
  );
}
