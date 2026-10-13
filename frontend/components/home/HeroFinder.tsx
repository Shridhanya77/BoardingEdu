"use client";

import { ChevronDown, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  fetchAllPages,
  geography,
  type BoardListItem,
  type CityListItem,
  type CountryListItem,
  type LocationListItem,
  type SchoolTypeListItem,
  type StateListItem,
} from "@/lib/api";
import { isBoardingOnlySelection } from "@/lib/location-preferences";

export type HeroFinderValue = {
  country: string;
  state: string;
  city: string;
  location: string;
  board: string[];
  schoolType: string[];
};

type Props = {
  value: HeroFinderValue;
  boards: BoardListItem[];
  schoolTypes: SchoolTypeListItem[];
  locationMessage: string | null;
  locationError: string | null;
  onChange: (next: HeroFinderValue) => void;
  onSubmit: () => void;
};

function useClickOutside(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);
  return ref;
}

function SelectMenu({
  label,
  placeholder,
  disabled,
  valueLabel,
  open,
  onToggle,
  children,
}: {
  label: string;
  placeholder: string;
  disabled?: boolean;
  valueLabel?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const ref = useClickOutside(open, () => {
    if (open) onToggle();
  });
  return (
    <div className={`finder-field${disabled ? " is-disabled" : ""}`} ref={ref}>
      <span>{label}</span>
      <button
        type="button"
        disabled={disabled}
        aria-label={valueLabel ? `${label}: ${valueLabel}` : label}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={onToggle}
      >
        <em>{valueLabel || placeholder}</em>
        <ChevronDown size={14} />
      </button>
      {open && !disabled && <div className="finder-menu">{children}</div>}
    </div>
  );
}

export default function HeroFinder({
  value,
  boards,
  schoolTypes,
  locationMessage,
  locationError,
  onChange,
  onSubmit,
}: Props) {
  const [countries, setCountries] = useState<CountryListItem[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [countriesError, setCountriesError] = useState<string | null>(null);
  const [states, setStates] = useState<StateListItem[]>([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [statesError, setStatesError] = useState<string | null>(null);
  const [cities, setCities] = useState<CityListItem[]>([]);
  const [locations, setLocations] = useState<LocationListItem[]>([]);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCountriesLoading(true);
    setCountriesError(null);
    geography
      .countries()
      .then((page) => fetchAllPages(page))
      .then((rows) => {
        if (!cancelled) setCountries(rows.filter((row) => row.status));
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setCountriesError(
            reason instanceof Error ? reason.message : "Countries could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCountriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!value.country) {
      setStates([]);
      setStatesLoading(false);
      setStatesError(null);
      return;
    }
    let cancelled = false;
    setStatesLoading(true);
    setStatesError(null);
    geography
      .statesOf(value.country)
      .then((page) => fetchAllPages(page))
      .then((rows) => {
        if (!cancelled) {
          setStates(
            rows.filter(
              (row) => row.status && row.country_id === value.country,
            ),
          );
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setStates([]);
          setStatesError(
            reason instanceof Error ? reason.message : "States could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setStatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [value.country]);

  useEffect(() => {
    if (!value.state) {
      setCities([]);
      return;
    }
    let cancelled = false;
    geography
      .citiesOf(value.state)
      .then((page) => fetchAllPages(page))
      .then((rows) => {
        if (!cancelled) setCities(rows.filter((row) => row.status));
      })
      .catch(() => {
        if (!cancelled) setCities([]);
      });
    return () => {
      cancelled = true;
    };
  }, [value.state]);

  useEffect(() => {
    if (!value.city) {
      setLocations([]);
      return;
    }
    let cancelled = false;
    geography
      .locationsOf(value.city)
      .then((page) => fetchAllPages(page))
      .then((rows) => {
        if (!cancelled) setLocations(rows.filter((row) => row.status));
      })
      .catch(() => {
        if (!cancelled) setLocations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [value.city]);

  const countryName = countries.find((row) => row.country_id === value.country)?.country_name;
  const stateName = states.find((row) => row.state_id === value.state)?.state_name;
  const cityName = cities.find((row) => row.city_id === value.city)?.city_name;
  const locationName = locations.find((row) => row.location_id === value.location)?.location_name;
  const boardLabel =
    value.board.length === 0
      ? ""
      : value.board.length === 1
        ? boards.find((row) => row.board_id === value.board[0])?.board_name
        : `${value.board.length} boards`;
  const typeLabel =
    value.schoolType.length === 0
      ? ""
      : value.schoolType.length === 1
        ? schoolTypes.find((row) => row.school_type_id === value.schoolType[0])?.type_name
        : `${value.schoolType.length} types`;
  const boardingOnly = isBoardingOnlySelection(value.schoolType, schoolTypes);
  function patch(partial: Partial<HeroFinderValue>) {
    onChange({ ...value, ...partial });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setOpenMenu(null);
    onSubmit();
  }

  return (
    <form className="hero-finder" onSubmit={submit} role="search">
      <fieldset className="finder-group">
        <legend>
          <span>01</span> Choose a location
        </legend>
        <div
          className={`finder-group__fields${boardingOnly ? " finder-group__fields--regional" : ""}`}
        >
          <SelectMenu
            label="Country"
            placeholder="Select"
            valueLabel={countryName}
            open={openMenu === "country"}
            onToggle={() => setOpenMenu(openMenu === "country" ? null : "country")}
          >
            {countriesLoading ? (
              <p role="status">Loading countries…</p>
            ) : countriesError ? (
              <p role="alert">{countriesError}</p>
            ) : countries.map((row) => (
                <button
                  type="button"
                  key={row.country_id}
                  onClick={() => {
                    patch({
                      country: row.country_id,
                      state: "",
                      city: "",
                      location: "",
                    });
                    setOpenMenu("state");
                  }}
                >
                  {row.country_name}
                </button>
              ))}
          </SelectMenu>

          <SelectMenu
            label="State"
            placeholder="Select"
            disabled={!value.country}
            valueLabel={stateName}
            open={openMenu === "state"}
            onToggle={() => setOpenMenu(openMenu === "state" ? null : "state")}
          >
            {statesLoading ? (
              <p role="status">Loading states…</p>
            ) : statesError ? (
              <p role="alert">{statesError}</p>
            ) : states.length === 0 ? (
              <p>No states for this country yet.</p>
            ) : (
              states.map((row) => (
                <button
                  type="button"
                  key={row.state_id}
                  onClick={() => {
                    patch({ state: row.state_id, city: "", location: "" });
                    setOpenMenu(boardingOnly ? null : "city");
                  }}
                >
                  {row.state_name}
                </button>
              ))
            )}
          </SelectMenu>

          {!boardingOnly && (
            <>
              <SelectMenu
                label="City"
                placeholder="Select"
                disabled={!value.state}
                valueLabel={cityName}
                open={openMenu === "city"}
                onToggle={() => setOpenMenu(openMenu === "city" ? null : "city")}
              >
                {cities.length === 0 ? (
                  <p>No cities for this state yet.</p>
                ) : (
                  cities.map((row) => (
                    <button
                      type="button"
                      key={row.city_id}
                      onClick={() => {
                        patch({ city: row.city_id, location: "" });
                        setOpenMenu("location");
                      }}
                    >
                      {row.city_name}
                    </button>
                  ))
                )}
              </SelectMenu>

              <SelectMenu
                label="Locality"
                placeholder={value.city && locations.length === 0 ? "No localities listed" : "Select"}
                disabled={!value.city || locations.length === 0}
                valueLabel={locationName}
                open={openMenu === "location"}
                onToggle={() => setOpenMenu(openMenu === "location" ? null : "location")}
              >
                {locations.map((row) => (
                  <button
                    type="button"
                    key={row.location_id}
                    onClick={() => {
                      patch({ location: row.location_id });
                      setOpenMenu(null);
                    }}
                  >
                    {row.location_name}
                  </button>
                ))}
              </SelectMenu>
            </>
          )}
        </div>
        {locationMessage && <p className="finder-message" role="status">{locationMessage}</p>}
        {locationError && <p className="finder-error" role="alert">{locationError}</p>}
      </fieldset>

      <fieldset className="finder-group">
        <legend>
          <span>02</span> Refine your search
        </legend>
        <div className="finder-group__fields">
          <SelectMenu
            label="Board"
            placeholder="Select"
            valueLabel={boardLabel}
            open={openMenu === "board"}
            onToggle={() => setOpenMenu(openMenu === "board" ? null : "board")}
          >
            {boards.map((row) => {
              const checked = value.board.includes(row.board_id);
              return (
                <label key={row.board_id} className="finder-check">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      patch({
                        board: checked
                          ? value.board.filter((id) => id !== row.board_id)
                          : [...value.board, row.board_id],
                      })
                    }
                  />
                  {row.board_name}
                </label>
              );
            })}
          </SelectMenu>

          <SelectMenu
            label="School type"
            placeholder="Select"
            valueLabel={typeLabel}
            open={openMenu === "type"}
            onToggle={() => setOpenMenu(openMenu === "type" ? null : "type")}
          >
            {schoolTypes.map((row) => {
              const checked = value.schoolType.includes(row.school_type_id);
              return (
                <label key={row.school_type_id} className="finder-check">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      patch({
                        schoolType: checked
                          ? value.schoolType.filter((id) => id !== row.school_type_id)
                          : [...value.schoolType, row.school_type_id],
                      })
                    }
                  />
                  {row.type_name}
                </label>
              );
            })}
          </SelectMenu>
        </div>
      </fieldset>

      <div className="finder-actions">
        <button className="hero-finder__submit" type="submit">
          <Search size={16} /> Find Schools
        </button>
      </div>
    </form>
  );
}
