"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Bell, BellOff, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/DashboardShell";
import { PanelRowsSkeleton } from "@/components/ui/ContentSkeleton";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import {
  apiErrorMessage,
  geography,
  notificationPreferences,
  savedSearches,
  schools,
  type BoardListItem,
  type CityListItem,
  type CountryListItem,
  type FacilityListItem,
  type LocationListItem,
  type NotificationPreference,
  type SavedSearch,
  type SavedSearchAlertFrequency,
  type SavedSearchInput,
  type StateListItem,
} from "@/lib/api";

const ALERT_FREQUENCY_LABELS: Record<SavedSearchAlertFrequency, string> = {
  INSTANT: "Email me as soon as new schools are added",
  DAILY: "Daily email digest",
  WEEKLY: "Weekly email digest",
  OFF: "Paused — do not email me",
};

const HOME_CATEGORY_OPTIONS = [
  { value: "", label: "Any school type" },
  { value: "day-school", label: "Day schools" },
  { value: "boarding-schools", label: "Boarding schools" },
];

type FormState = {
  name: string;
  country: string;
  state: string;
  city: string;
  location: string;
  home_category: string;
  boards: string[];
  facilities: string[];
  min_fee: string;
  max_fee: string;
  keywords: string;
  alert_frequency: SavedSearchAlertFrequency;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  country: "",
  state: "",
  city: "",
  location: "",
  home_category: "",
  boards: [],
  facilities: [],
  min_fee: "",
  max_fee: "",
  keywords: "",
  alert_frequency: "WEEKLY",
  is_active: true,
};

function formFromSavedSearch(saved: SavedSearch): FormState {
  return {
    name: saved.name,
    country: saved.country ?? "",
    state: saved.state ?? "",
    city: saved.city ?? "",
    location: saved.location ?? "",
    home_category: saved.home_category,
    boards: saved.boards,
    facilities: saved.facilities,
    min_fee: saved.min_fee ?? "",
    max_fee: saved.max_fee ?? "",
    keywords: saved.keywords,
    alert_frequency: saved.alert_frequency,
    is_active: saved.is_active,
  };
}

function toPayload(form: FormState): SavedSearchInput {
  return {
    name: form.name.trim(),
    country: form.country || null,
    state: form.state || null,
    city: form.city || null,
    location: form.location || null,
    home_category: form.home_category,
    boards: form.boards,
    facilities: form.facilities,
    min_fee: form.min_fee || null,
    max_fee: form.max_fee || null,
    keywords: form.keywords.trim(),
    alert_frequency: form.alert_frequency,
    is_active: form.is_active,
  };
}

export function SavedSearches({ onError }: { onError: (message: string | null) => void }) {
  const [items, setItems] = useState<SavedSearch[] | null>(null);
  const [editing, setEditing] = useState<SavedSearch | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    onError(null);
    savedSearches
      .list()
      .then(setItems)
      .catch((reason: unknown) => onError(apiErrorMessage(reason)));
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    setBusy(id);
    onError(null);
    try {
      await savedSearches.remove(id);
      setItems((current) => (current ?? []).filter((row) => row.saved_search_id !== id));
    } catch (reason) {
      onError(apiErrorMessage(reason));
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(saved: SavedSearch) {
    setBusy(saved.saved_search_id);
    onError(null);
    try {
      const updated = await savedSearches.update(saved.saved_search_id, { is_active: !saved.is_active });
      setItems((current) =>
        (current ?? []).map((row) => (row.saved_search_id === updated.saved_search_id ? updated : row)),
      );
    } catch (reason) {
      onError(apiErrorMessage(reason));
    } finally {
      setBusy(null);
    }
  }

  function handleSaved(saved: SavedSearch) {
    setItems((current) => {
      const rows = current ?? [];
      const exists = rows.some((row) => row.saved_search_id === saved.saved_search_id);
      return exists
        ? rows.map((row) => (row.saved_search_id === saved.saved_search_id ? saved : row))
        : [saved, ...rows];
    });
    setCreating(false);
    setEditing(null);
  }

  const showForm = creating || editing !== null;

  return (
    <>
      <DashboardPanel
        title="Saved searches"
        subtitle="We email you when newly added schools match your search criteria."
        action={
          <button
            type="button"
            className="pd-primary-link"
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
          >
            <Plus size={16} aria-hidden /> Save a search
          </button>
        }
      >
        {items === null ? (
          <PanelRowsSkeleton rows={2} label="Loading your saved searches" />
        ) : items.length === 0 ? (
          <EmptyState
            className="be-empty--compact"
            icon={Search}
            title="No saved searches yet"
            description="Save your filters to get an email when a new matching school is added."
            action={<Button href="/dashboard/parent/finder/" size="sm">Find schools</Button>}
          />
        ) : (
          <ul className="pd-list pd-saved-search-list">
            {items.map((item) => (
              <li key={item.saved_search_id}>
                <div className="pd-saved-search-head">
                  <strong>{item.name || item.label}</strong>
                  <span className={`pd-badge ${item.is_active ? "pd-badge--accepted" : "pd-badge--pending"}`}>
                    {item.is_active ? ALERT_FREQUENCY_LABELS[item.alert_frequency] : "Paused"}
                  </span>
                </div>
                <span>{item.label}</span>
                <span className="pd-saved-search-meta">
                  {item.match_count} matching {item.match_count === 1 ? "school" : "schools"}
                  {item.last_notified_at
                    ? ` · last alert ${new Date(item.last_notified_at).toLocaleDateString()}`
                    : ""}
                </span>
                <div className="pd-saved-search-actions">
                  <button
                    type="button"
                    disabled={busy === item.saved_search_id}
                    onClick={() => {
                      setCreating(false);
                      setEditing(item);
                    }}
                  >
                    <Pencil size={14} aria-hidden /> Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy === item.saved_search_id}
                    onClick={() => void toggleActive(item)}
                  >
                    {item.is_active ? <BellOff size={14} aria-hidden /> : <Bell size={14} aria-hidden />}
                    {item.is_active ? "Pause" : "Resume"}
                  </button>
                  <button
                    type="button"
                    disabled={busy === item.saved_search_id}
                    onClick={() => void remove(item.saved_search_id)}
                  >
                    <Trash2 size={14} aria-hidden /> {busy === item.saved_search_id ? "Removing…" : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DashboardPanel>

      {showForm && (
        <SavedSearchForm
          initial={editing}
          onSaved={handleSaved}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
          onError={onError}
        />
      )}

      <NotificationPreferencesPanel onError={onError} />
    </>
  );
}

function SavedSearchForm({
  initial,
  onSaved,
  onCancel,
  onError,
}: {
  initial: SavedSearch | null;
  onSaved: (saved: SavedSearch) => void;
  onCancel: () => void;
  onError: (message: string | null) => void;
}) {
  const [form, setForm] = useState<FormState>(initial ? formFromSavedSearch(initial) : EMPTY_FORM);
  const [countries, setCountries] = useState<CountryListItem[]>([]);
  const [states, setStates] = useState<StateListItem[]>([]);
  const [cities, setCities] = useState<CityListItem[]>([]);
  const [locations, setLocations] = useState<LocationListItem[]>([]);
  const [boards, setBoards] = useState<BoardListItem[]>([]);
  const [facilities, setFacilities] = useState<FacilityListItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    geography.countries().then((page) => setCountries(page.results)).catch(() => setCountries([]));
    schools.boards().then((page) => setBoards(page.results)).catch(() => setBoards([]));
    schools.facilities().then((page) => setFacilities(page.results)).catch(() => setFacilities([]));
  }, []);

  useEffect(() => {
    if (!form.country) {
      setStates([]);
      return;
    }
    geography.statesOf(form.country).then((page) => setStates(page.results)).catch(() => setStates([]));
  }, [form.country]);

  useEffect(() => {
    if (!form.state) {
      setCities([]);
      return;
    }
    geography.citiesOf(form.state).then((page) => setCities(page.results)).catch(() => setCities([]));
  }, [form.state]);

  useEffect(() => {
    if (!form.city) {
      setLocations([]);
      return;
    }
    geography.locationsOf(form.city).then((page) => setLocations(page.results)).catch(() => setLocations([]));
  }, [form.city]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleId(key: "boards" | "facilities", id: string) {
    setForm((current) => {
      const next = current[key].includes(id)
        ? current[key].filter((value) => value !== id)
        : [...current[key], id];
      return { ...current, [key]: next };
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (form.min_fee && form.max_fee && Number(form.min_fee) > Number(form.max_fee)) {
      onError("Maximum fee must be greater than or equal to the minimum fee.");
      return;
    }
    setSaving(true);
    onError(null);
    try {
      const payload = toPayload(form);
      const saved = initial
        ? await savedSearches.update(initial.saved_search_id, payload)
        : await savedSearches.create(payload);
      onSaved(saved);
    } catch (reason) {
      onError(apiErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardPanel
      title={initial ? "Edit saved search" : "Save a search"}
      subtitle="Choose the filters you care about. We only email you when new schools match."
    >
      <form className="pd-form pd-saved-search-form" onSubmit={submit}>
        <label>
          Name (optional)
          <input
            type="text"
            value={form.name}
            maxLength={120}
            placeholder="e.g. CBSE boarding schools in Bengaluru"
            onChange={(event) => update("name", event.target.value)}
          />
        </label>

        <div className="pd-saved-search-grid">
          <label>
            Country
            <select
              value={form.country}
              onChange={(event) => {
                update("country", event.target.value);
                update("state", "");
                update("city", "");
                update("location", "");
              }}
            >
              <option value="">Any country</option>
              {countries.map((country) => (
                <option key={country.country_id} value={country.country_id}>{country.country_name}</option>
              ))}
            </select>
          </label>
          <label>
            State
            <select
              value={form.state}
              disabled={!form.country}
              onChange={(event) => {
                update("state", event.target.value);
                update("city", "");
                update("location", "");
              }}
            >
              <option value="">Any state</option>
              {states.map((state) => (
                <option key={state.state_id} value={state.state_id}>{state.state_name}</option>
              ))}
            </select>
          </label>
          <label>
            City
            <select
              value={form.city}
              disabled={!form.state}
              onChange={(event) => {
                update("city", event.target.value);
                update("location", "");
              }}
            >
              <option value="">Any city</option>
              {cities.map((city) => (
                <option key={city.city_id} value={city.city_id}>{city.city_name}</option>
              ))}
            </select>
          </label>
          <label>
            Location
            <select
              value={form.location}
              disabled={!form.city}
              onChange={(event) => update("location", event.target.value)}
            >
              <option value="">Any location</option>
              {locations.map((location) => (
                <option key={location.location_id} value={location.location_id}>
                  {location.location_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="pd-saved-search-grid">
          <label>
            School type
            <select value={form.home_category} onChange={(event) => update("home_category", event.target.value)}>
              {HOME_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Minimum annual fee (₹)
            <input
              type="number"
              min={0}
              value={form.min_fee}
              onChange={(event) => update("min_fee", event.target.value)}
            />
          </label>
          <label>
            Maximum annual fee (₹)
            <input
              type="number"
              min={0}
              value={form.max_fee}
              onChange={(event) => update("max_fee", event.target.value)}
            />
          </label>
          <label>
            Keyword in school name
            <input
              type="text"
              value={form.keywords}
              maxLength={200}
              placeholder="e.g. International"
              onChange={(event) => update("keywords", event.target.value)}
            />
          </label>
        </div>

        <fieldset className="pd-saved-search-choices">
          <legend>Education board</legend>
          {boards.length === 0 ? (
            <p className="dash-empty">No boards available.</p>
          ) : (
            <div className="pd-saved-search-chips">
              {boards.map((board) => (
                <label key={board.board_id} className={form.boards.includes(board.board_id) ? "is-selected" : ""}>
                  <input
                    type="checkbox"
                    checked={form.boards.includes(board.board_id)}
                    onChange={() => toggleId("boards", board.board_id)}
                  />
                  {board.board_name}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className="pd-saved-search-choices">
          <legend>Facilities</legend>
          {facilities.length === 0 ? (
            <p className="dash-empty">No facilities available.</p>
          ) : (
            <div className="pd-saved-search-chips">
              {facilities.map((facility) => (
                <label
                  key={facility.facility_id}
                  className={form.facilities.includes(facility.facility_id) ? "is-selected" : ""}
                >
                  <input
                    type="checkbox"
                    checked={form.facilities.includes(facility.facility_id)}
                    onChange={() => toggleId("facilities", facility.facility_id)}
                  />
                  {facility.facility_name}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <label>
          Alert frequency
          <select
            value={form.alert_frequency}
            onChange={(event) => update("alert_frequency", event.target.value as SavedSearchAlertFrequency)}
          >
            {(Object.keys(ALERT_FREQUENCY_LABELS) as SavedSearchAlertFrequency[]).map((frequency) => (
              <option key={frequency} value={frequency}>{ALERT_FREQUENCY_LABELS[frequency]}</option>
            ))}
          </select>
        </label>

        <label className="pd-saved-search-check">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(event) => update("is_active", event.target.checked)}
          />
          Keep this search active
        </label>

        <div className="pd-saved-search-form-actions">
          <button type="submit" className="pd-primary-link" disabled={saving}>
            {saving ? "Saving…" : initial ? "Save changes" : "Save search"}
          </button>
          <button type="button" className="dash-link dash-link--button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
    </DashboardPanel>
  );
}

function NotificationPreferencesPanel({ onError }: { onError: (message: string | null) => void }) {
  const [preference, setPreference] = useState<NotificationPreference | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    notificationPreferences
      .get()
      .then(setPreference)
      .catch((reason: unknown) => onError(apiErrorMessage(reason)));
  }, [onError]);

  async function toggle(key: "saved_search_alerts" | "admission_opening_alerts", value: boolean) {
    if (!preference) return;
    setSaving(true);
    onError(null);
    try {
      const updated = await notificationPreferences.update({ [key]: value });
      setPreference(updated);
    } catch (reason) {
      onError(apiErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  if (!preference) {
    return (
      <DashboardPanel title="Email preferences">
        <PanelRowsSkeleton rows={2} label="Loading your email preferences" />
      </DashboardPanel>
    );
  }

  return (
    <DashboardPanel
      title="Email preferences"
      subtitle={`Alerts are sent to ${preference.email}. You can change these at any time.`}
    >
      <ul className="pd-list pd-preference-list">
        <li>
          <label className="pd-saved-search-check">
            <input
              type="checkbox"
              disabled={saving}
              checked={preference.saved_search_alerts}
              onChange={(event) => void toggle("saved_search_alerts", event.target.checked)}
            />
            <span>
              <strong>New school matches</strong>
              <span>Email me when newly added schools match my saved searches.</span>
            </span>
          </label>
        </li>
        <li>
          <label className="pd-saved-search-check">
            <input
              type="checkbox"
              disabled={saving}
              checked={preference.admission_opening_alerts}
              onChange={(event) => void toggle("admission_opening_alerts", event.target.checked)}
            />
            <span>
              <strong>Admission openings</strong>
              <span>Email me when a shortlisted school opens admissions.</span>
            </span>
          </label>
        </li>
      </ul>
      {preference.unsubscribed_at && (
        <p className="dash-empty">
          You previously unsubscribed from these alerts. Turning a preference back on re-enables them.
        </p>
      )}
    </DashboardPanel>
  );
}
