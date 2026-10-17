"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  admissions,
  ApiError,
  fetchAllPages,
  geography,
  schools,
  type BoardListItem,
  type CityListItem,
  type CountryListItem,
  type GradeListItem,
  type SchoolTypeListItem,
  type StateListItem,
} from "@/lib/api";
import GradeMultiSelect from "./GradeMultiSelect";
import { schoolTypeLabel } from "@/lib/seo-slugs";

export default function CounsellingSection() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [homeCity, setHomeCity] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [preferredCountryId, setPreferredCountryId] = useState("");
  const [preferredStateId, setPreferredStateId] = useState("");
  const [preferredCityId, setPreferredCityId] = useState("");
  const [countries, setCountries] = useState<CountryListItem[]>([]);
  const [states, setStates] = useState<StateListItem[]>([]);
  const [availableCities, setAvailableCities] = useState<CityListItem[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [citiesOpen, setCitiesOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [preferred, setPreferred] = useState<CityListItem[]>([]);
  const [grades, setGrades] = useState<GradeListItem[]>([]);
  const [boards, setBoards] = useState<BoardListItem[]>([]);
  const [schoolTypes, setSchoolTypes] = useState<SchoolTypeListItem[]>([]);
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [selectedSchoolTypes, setSelectedSchoolTypes] = useState<string[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      schools.grades().then((page) => fetchAllPages(page)),
      schools.boards().then((page) => fetchAllPages(page)),
      schools.types().then((page) => fetchAllPages(page)),
      geography.countries().then((page) => fetchAllPages(page)),
    ])
      .then(([gradeRows, boardRows, typeRows, countryRows]) => {
        if (!cancelled) {
          setGrades(gradeRows.filter((row) => row.status));
          setBoards(boardRows.filter((row) => row.status));
          setSchoolTypes(typeRows.filter((row) => row.status));
          setCountries(countryRows.filter((row) => row.status));
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setOptionsError(reason instanceof Error ? reason.message : "Could not load counselling options.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!preferredCountryId) {
      setStates([]);
      setPreferredStateId("");
      setPreferredCityId("");
      setLoadingStates(false);
      return;
    }
    let cancelled = false;
    setStates([]);
    setPreferredStateId("");
    setPreferredCityId("");
    setLoadingStates(true);
    geography
      .statesOf(preferredCountryId)
      .then((page) => fetchAllPages(page))
      .then((rows) => {
        if (!cancelled) {
          setCityError(null);
          setStates(rows.filter((state) => state.status && state.country_id === preferredCountryId));
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setStates([]);
          setCityError(reason instanceof Error ? reason.message : "Could not load states.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingStates(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preferredCountryId]);

  useEffect(() => {
    if (!preferredStateId) {
      setAvailableCities([]);
      setPreferredCityId("");
      setLoadingCities(false);
      return;
    }
    let cancelled = false;
    setAvailableCities([]);
    setPreferredCityId("");
    setLoadingCities(true);
    geography
      .citiesOf(preferredStateId)
      .then(fetchAllPages)
      .then((rows) => {
        if (!cancelled) {
          setCityError(null);
          setAvailableCities(rows.filter(
            (city) => city.status && city.state_id === preferredStateId && city.country_id === preferredCountryId,
          ));
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setAvailableCities([]);
          setCityError(reason instanceof Error ? reason.message : "Could not load cities for this state.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCities(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preferredStateId, preferredCountryId]);

  const selectedNames = useMemo(
    () => preferred.map((city) => city.city_name).join(", "),
    [preferred]
  );

  function addPreferredCity() {
    const city = availableCities.find((item) => item.city_id === preferredCityId);
    if (!city || preferred.some((item) => item.city_id === city.city_id)) return;
    setPreferred((current) => [...current, city]);
    setPreferredCityId("");
    setCitySearch("");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Please enter a valid WhatsApp number.");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!selectedGrades.length) {
      setError("Please select at least one grade/class.");
      return;
    }
    if (preferred.length === 0) {
      setError("Please select at least one preferred city.");
      return;
    }
    setSubmitting(true);
    try {
      const allSameCountry = preferred.every((city) => city.country_id === preferred[0]!.country_id);
      const allSameState = preferred.every((city) => city.state_id === preferred[0]!.state_id);
      const result = await admissions.submitCounselling({
        parent_name: name.trim(),
        email: email.trim(),
        phone: digits,
        home_city: homeCity.trim(),
        preferred_country: allSameCountry ? preferred[0]!.country_id : undefined,
        preferred_state: allSameState ? preferred[0]!.state_id : undefined,
        preferred_cities: preferred.map((city) => city.city_id),
        grades: selectedGrades,
        boards: selectedBoards,
        school_types: selectedSchoolTypes,
        message: message.trim(),
      });
      setSuccess(result.reference);
      setName("");
      setEmail("");
      setPhone("");
      setSelectedGrades([]);
      setHomeCity("");
      setPreferred([]);
      setPreferredCountryId("");
      setPreferredStateId("");
      setPreferredCityId("");
      setCitySearch("");
      setSelectedBoards([]);
      setSelectedSchoolTypes([]);
      setMessage("");
    } catch (reason: unknown) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : reason instanceof Error
            ? reason.message
            : "We could not submit your request. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="home-section counselling" id="counselling">
      <div className="counselling__intro">
        <div className="section-eyebrow">100% FREE SERVICE</div>
        <h2>Get Free One-on-One Admission Counselling</h2>
        <p>
          Our expert counsellors connect with you to provide personalised guidance on school
          selection, fee structures, board differences, and everything you need for a confident
          admission decision.
        </p>
        <ul>
          <li>
            <span>🎓</span>
            <div>
              <strong>Expert Board Guidance</strong>
              <p>CBSE, ICSE, IB, Cambridge — understand every board difference.</p>
            </div>
          </li>
          <li>
            <span>🏫</span>
            <div>
              <strong>Personalised School Matching</strong>
              <p>We help you narrow your options based on your family&apos;s needs.</p>
            </div>
          </li>
          <li>
            <span>📋</span>
            <div>
              <strong>Application & Document Support</strong>
              <p>Forms, deadlines, fee planning, and admission strategy.</p>
            </div>
          </li>
        </ul>
      </div>

      <form className="counselling__form" onSubmit={onSubmit}>
        <h3>Book Free Counselling</h3>
        <p>Share your details to request personalised guidance.</p>

        <label>
          Your Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Ananya Kamath"
            autoComplete="name"
            required
          />
        </label>
        <label>
          Email Address
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>
        <label>
          WhatsApp Number
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="98765 43210"
            inputMode="tel"
            autoComplete="tel"
            required
          />
        </label>
        <GradeMultiSelect
          grades={grades}
          selectedIds={selectedGrades}
          onChange={setSelectedGrades}
          disabled={submitting}
        />
        {optionsError && <p className="counselling__error" role="alert">{optionsError}</p>}
        <label>
          Home City
          <input
            value={homeCity}
            onChange={(event) => setHomeCity(event.target.value)}
            placeholder="e.g. Mumbai"
          />
        </label>
        <div className="counselling__cities">
          <span id="preferred-cities-label">Preferred Cities *</span>
          <button
            type="button"
            className="counselling__cities-trigger"
            aria-expanded={citiesOpen}
            aria-controls="preferred-cities-picker"
            aria-labelledby="preferred-cities-label"
            onClick={() => setCitiesOpen((open) => !open)}
          >
            {citiesOpen ? "Hide state and city options" : "Choose states and cities"}
          </button>
          {preferred.length > 0 && (
            <div className="counselling__picked">
              {preferred.map((city) => (
                <button
                  type="button"
                  key={city.city_id}
                  aria-label={`Remove ${city.city_name}`}
                  onClick={() =>
                    setPreferred((current) =>
                      current.filter((item) => item.city_id !== city.city_id)
                    )
                  }
                >
                  {city.city_name} · {city.state_name}, {city.country_name} ×
                </button>
              ))}
              <button type="button" aria-label="Clear all preferred cities" onClick={() => setPreferred([])}>Clear all</button>
            </div>
          )}
          {citiesOpen && (
            <div className="counselling__city-picker" id="preferred-cities-picker">
              <label>
                Country
                <select
                  value={preferredCountryId}
                  onChange={(event) => {
                    setPreferredCountryId(event.target.value);
                    setPreferredStateId("");
                    setPreferredCityId("");
                    setPreferred([]);
                    setCitySearch("");
                    setCityError(null);
                  }}
                >
                  <option value="">Choose a country</option>
                  {countries.map((country) => (
                    <option value={country.country_id} key={country.country_id}>{country.country_name}</option>
                  ))}
                </select>
              </label>
              <div className="counselling__location-selects">
                <label>
                  State
                  <select
                    value={preferredStateId}
                    disabled={!preferredCountryId || loadingStates || !states.length}
                    onChange={(event) => {
                      setPreferredStateId(event.target.value);
                      setPreferredCityId("");
                      setCityError(null);
                    }}
                  >
                    <option value="">{loadingStates ? "Loading states…" : "Choose a state"}</option>
                    {states.map((state) => <option value={state.state_id} key={state.state_id}>{state.state_name}</option>)}
                  </select>
                </label>
                <label>
                  City
                  <select
                    value={preferredCityId}
                    disabled={!preferredStateId || loadingCities || !availableCities.length}
                    onChange={(event) => setPreferredCityId(event.target.value)}
                  >
                    <option value="">{loadingCities ? "Loading cities…" : "Choose a city"}</option>
                    {availableCities
                      .filter((city) => !preferred.some((item) => item.city_id === city.city_id))
                      .filter((city) => city.city_name.toLowerCase().includes(citySearch.trim().toLowerCase()))
                      .map((city) => <option value={city.city_id} key={city.city_id}>{city.city_name}</option>)}
                  </select>
                </label>
                <label className="counselling__city-search">
                  Find a city
                  <input value={citySearch} onChange={(event) => setCitySearch(event.target.value)} placeholder="Optional city search" disabled={!preferredStateId} />
                </label>
                <button
                  type="button"
                  className="counselling__add-city"
                  disabled={!preferredCityId}
                  onClick={addPreferredCity}
                >
                  Add city
                </button>
              </div>
              {!preferredCountryId && <p className="counselling__city-empty">Choose a country to see its states.</p>}
              {preferredCountryId && !loadingStates && !states.length && <p className="counselling__city-empty">No states are available for this country.</p>}
              {preferredStateId && !loadingCities && !availableCities.length && <p className="counselling__city-empty">No cities are available for this state.</p>}
            </div>
          )}
          {cityError && <p className="counselling__error" role="alert">{cityError}</p>}
          {selectedNames && <p className="sr-only" aria-live="polite">Selected: {selectedNames}</p>}
        </div>
        {boards.length > 0 && (
          <fieldset className="counselling__preferences">
            <legend>Preferred education boards</legend>
            {boards.map((board) => (
              <label key={board.board_id}>
                <input
                  type="checkbox"
                  checked={selectedBoards.includes(board.board_id)}
                  disabled={submitting}
                  onChange={(event) =>
                    setSelectedBoards((current) =>
                      event.target.checked
                        ? [...current, board.board_id]
                        : current.filter((id) => id !== board.board_id)
                    )
                  }
                />
                {board.board_name}
              </label>
            ))}
          </fieldset>
        )}
        {schoolTypes.length > 0 && (
          <fieldset className="counselling__preferences">
            <legend>Preferred school types</legend>
            {schoolTypes.map((type) => (
              <label key={type.school_type_id}>
                <input
                  type="checkbox"
                  checked={selectedSchoolTypes.includes(type.school_type_id)}
                  disabled={submitting}
                  onChange={(event) =>
                    setSelectedSchoolTypes((current) =>
                      event.target.checked
                        ? [...current, type.school_type_id]
                        : current.filter((id) => id !== type.school_type_id)
                    )
                  }
                />
                {schoolTypeLabel(type.type_code, type.slug, type.type_name)}
              </label>
            ))}
          </fieldset>
        )}
        <label>
          Additional requirements
          <textarea
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={submitting}
            placeholder="Optional details that will help our counsellor prepare."
          />
        </label>

        {error && <p className="counselling__error" role="alert">{error}</p>}
        {success && (
          <p className="counselling__ok" role="status">
            Request confirmed. Your counselling reference is <strong>{success}</strong>.
          </p>
        )}
        <button type="submit" disabled={submitting}>
          {submitting ? "Sending…" : "Get Free Counselling →"}
        </button>
        <p className="counselling__lock">
          🔒 Your information is private and never shared without consent.
        </p>
      </form>
    </section>
  );
}
