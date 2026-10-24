"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  AtSign,
  Building2,
  CheckCircle2,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  ApiError,
  apiErrorMessage,
  fetchAllPages,
  geography,
  schools,
  type BoardListItem,
  type CityListItem,
  type SchoolRegistrationResult,
  type SchoolTypeListItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isValidEmailAddress, normalizePhoneNumber } from "@/lib/contact-validation";

type FormState = {
  school_name: string;
  city: string;
  address: string;
  pincode: string;
  school_phone: string;
  school_email: string;
  established_year: string;
  contact_full_name: string;
  designation: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  password_confirm: string;
};

const EMPTY: FormState = {
  school_name: "",
  city: "",
  address: "",
  pincode: "",
  school_phone: "",
  school_email: "",
  established_year: "",
  contact_full_name: "",
  designation: "",
  username: "",
  email: "",
  phone: "",
  password: "",
  password_confirm: "",
};

function fieldErrors(err: unknown, field: string): string[] | null {
  if (!(err instanceof ApiError)) return null;
  if (!err.body || typeof err.body !== "object") return null;
  const value = (err.body as Record<string, unknown>)[field];
  if (!value) return null;
  if (Array.isArray(value)) return value.map((item) => String(item));
  return [String(value)];
}

export default function SchoolSignupForm() {
  const { registerSchool, clearError } = useAuth();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [boards, setBoards] = useState<BoardListItem[]>([]);
  const [schoolTypes, setSchoolTypes] = useState<SchoolTypeListItem[]>([]);
  const [cities, setCities] = useState<CityListItem[]>([]);
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [apiErr, setApiErr] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SchoolRegistrationResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      schools.boards().then((page) => fetchAllPages(page)),
      schools.types().then((page) => fetchAllPages(page)),
      geography.cities().then((page) => fetchAllPages(page)),
    ])
      .then(([boardRows, typeRows, cityRows]) => {
        if (cancelled) return;
        setBoards(boardRows.filter((board) => board.status));
        setSchoolTypes(typeRows.filter((type) => type.status));
        setCities(
          cityRows
            .filter((city) => city.status && city.country_code.toUpperCase() === "IN")
            .sort(
              (left, right) =>
                left.city_name.localeCompare(right.city_name) ||
                left.state_name.localeCompare(right.state_name),
            ),
        );
      })
      .catch((reason: unknown) => {
        if (!cancelled) setOptionsError(apiErrorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const citiesByState = useMemo(() => {
    const groups = new Map<string, CityListItem[]>();
    for (const city of cities) {
      const key = city.state_name;
      const bucket = groups.get(key);
      if (bucket) bucket.push(city);
      else groups.set(key, [city]);
    }
    return [...groups.entries()];
  }, [cities]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setApiErr(null);
    setFormError(null);
    clearError?.();
  }

  function toggle(list: string[], setList: (next: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setApiErr(null);
    clearError?.();

    if (!form.school_name.trim() || !form.city || !form.address.trim()) {
      setFormError("School name, city and address are required.");
      return;
    }
    if (!form.contact_full_name.trim()) {
      setFormError("Please add the name of the person we should verify the school with.");
      return;
    }
    if (!form.username.trim() || !form.email.trim() || !form.phone.trim()) {
      setFormError("Username, email and phone are required for the school login.");
      return;
    }
    if (
      !isValidEmailAddress(form.email) ||
      (form.school_email.trim() && !isValidEmailAddress(form.school_email))
    ) {
      setFormError("Enter a valid email address for the school account and contact.");
      return;
    }
    const normalizedPhone = normalizePhoneNumber(form.phone);
    if (!normalizedPhone) {
      setFormError("Enter your country code followed by exactly 10 phone number digits.");
      return;
    }
    if (form.school_phone.trim() && !normalizePhoneNumber(form.school_phone)) {
      setFormError("Enter the school country code followed by exactly 10 phone number digits.");
      return;
    }
    if (form.password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.password_confirm) {
      setFormError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await registerSchool({
        school_name: form.school_name.trim(),
        city: form.city,
        address: form.address.trim(),
        pincode: form.pincode.trim() || undefined,
        school_phone: form.school_phone.trim() || undefined,
        school_email: form.school_email.trim() || undefined,
        established_year: form.established_year ? Number(form.established_year) : null,
        boards: selectedBoards,
        school_types: selectedTypes,
        contact_full_name: form.contact_full_name.trim(),
        designation: form.designation.trim() || undefined,
        username: form.username.trim(),
        email: form.email.trim(),
        phone: normalizedPhone,
        password: form.password,
        password_confirm: form.password_confirm,
      });
      setResult(response);
    } catch (err) {
      if (err instanceof ApiError) setApiErr(err);
      setFormError(
        err instanceof ApiError
          ? apiErrorMessage(err)
          : "We couldn't submit your registration. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <main className="account-page">
        <Link className="account-page__back" href="/">
          <ArrowLeft size={16} /> Back to BoardingEdu
        </Link>
        <section className="account-card">
          <span className="section-eyebrow">REGISTRATION RECEIVED</span>
          <h1>Your school is in review.</h1>
          <div className="school-signup__success" role="status">
            <CheckCircle2 size={22} aria-hidden />
            <div>
              <p>
                <strong>{result.school_name}</strong> has been registered with the school
                code <strong>{result.school_code}</strong>.
              </p>
              <p>
                Our team verifies every school before its dashboard unlocks. You will be
                able to sign in with the credentials you just created once the school is
                approved.
              </p>
            </div>
          </div>
          <p className="account-card__hint">
            Questions? Write to <a href="mailto:hello@boardingedu.com">hello@boardingedu.com</a>{" "}
            quoting {result.school_code}.
          </p>
          <p className="account-card__hint">
            <Link href="/login">Go to login</Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="account-page">
      <Link className="account-page__back" href="/">
        <ArrowLeft size={16} /> Back to BoardingEdu
      </Link>

      <section className="account-card account-card--wide">
        <span className="section-eyebrow">REGISTER YOUR SCHOOL</span>
        <h1>List your school on BoardingEdu.</h1>
        <p className="account-card__intro">
          Create your school profile and login. An admin verifies the school before the
          dashboard becomes available.
        </p>

        <form className="account-form account-form--grid" onSubmit={onSubmit} noValidate>
          {formError && <div className="form-error" role="alert">{formError}</div>}
          {optionsError && (
            <div className="form-error" role="alert">
              Some options could not be loaded: {optionsError}
            </div>
          )}

          <label className="field">
            <span className="field__label">School name <em>*</em></span>
            <span className="field__wrap">
              <Building2 size={18} className="field__icon" aria-hidden />
              <input
                type="text"
                value={form.school_name}
                onChange={(event) => setField("school_name", event.target.value)}
                placeholder="e.g. Doon Public School"
                disabled={submitting}
                required
              />
            </span>
            {fieldErrors(apiErr, "school_name")?.map((message, index) => (
              <span className="field__error" key={index}>{message}</span>
            ))}
          </label>

          <div className="row-2">
            <label className="field">
              <span className="field__label">City <em>*</em></span>
              <select
                value={form.city}
                onChange={(event) => setField("city", event.target.value)}
                disabled={submitting}
                required
              >
                <option value="">Select the school city</option>
                {citiesByState.map(([stateName, stateCities]) => (
                  <optgroup key={stateName} label={stateName}>
                    {stateCities.map((city) => (
                      <option key={city.city_id} value={city.city_id}>
                        {city.city_name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {fieldErrors(apiErr, "city")?.map((message, index) => (
                <span className="field__error" key={index}>{message}</span>
              ))}
            </label>

            <label className="field">
              <span className="field__label">Pincode</span>
              <span className="field__wrap">
                <MapPin size={18} className="field__icon" aria-hidden />
                <input
                  type="text"
                  value={form.pincode}
                  onChange={(event) => setField("pincode", event.target.value)}
                  placeholder="e.g. 248001"
                  disabled={submitting}
                />
              </span>
            </label>
          </div>

          <label className="field">
            <span className="field__label">Campus address <em>*</em></span>
            <span className="field__wrap">
              <MapPin size={18} className="field__icon" aria-hidden />
              <input
                type="text"
                value={form.address}
                onChange={(event) => setField("address", event.target.value)}
                placeholder="Street, area, landmark"
                disabled={submitting}
                required
              />
            </span>
            {fieldErrors(apiErr, "address")?.map((message, index) => (
              <span className="field__error" key={index}>{message}</span>
            ))}
          </label>

          <div className="row-2">
            <label className="field">
              <span className="field__label">School phone</span>
              <span className="field__wrap">
                <Phone size={18} className="field__icon" aria-hidden />
                <input
                  type="tel"
                  value={form.school_phone}
                  onChange={(event) => setField("school_phone", event.target.value)}
                  placeholder="+91 135 123 4567"
                  disabled={submitting}
                />
              </span>
            </label>
            <label className="field">
              <span className="field__label">School email</span>
              <span className="field__wrap">
                <Mail size={18} className="field__icon" aria-hidden />
                <input
                  type="email"
                  value={form.school_email}
                  onChange={(event) => setField("school_email", event.target.value)}
                  placeholder="admissions@school.edu.in"
                  disabled={submitting}
                />
              </span>
            </label>
          </div>

          <label className="field">
            <span className="field__label">Established year</span>
            <span className="field__wrap">
              <GraduationCap size={18} className="field__icon" aria-hidden />
              <input
                type="number"
                min={1800}
                max={2100}
                value={form.established_year}
                onChange={(event) => setField("established_year", event.target.value)}
                placeholder="e.g. 1985"
                disabled={submitting}
              />
            </span>
          </label>

          <fieldset className="school-signup__choices">
            <legend>Education boards offered</legend>
            <div className="school-signup__chips">
              {boards.map((board) => (
                <label className="school-signup__chip" key={board.board_id}>
                  <input
                    type="checkbox"
                    checked={selectedBoards.includes(board.board_id)}
                    onChange={() =>
                      toggle(selectedBoards, setSelectedBoards, board.board_id)
                    }
                    disabled={submitting}
                  />
                  <span>{board.board_name}</span>
                </label>
              ))}
              {boards.length === 0 && <p className="empty-state">Boards could not be loaded.</p>}
            </div>
          </fieldset>

          <fieldset className="school-signup__choices">
            <legend>School types</legend>
            <div className="school-signup__chips">
              {schoolTypes.map((type) => (
                <label className="school-signup__chip" key={type.school_type_id}>
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(type.school_type_id)}
                    onChange={() =>
                      toggle(selectedTypes, setSelectedTypes, type.school_type_id)
                    }
                    disabled={submitting}
                  />
                  <span>{type.type_name}</span>
                </label>
              ))}
              {schoolTypes.length === 0 && (
                <p className="empty-state">School types could not be loaded.</p>
              )}
            </div>
          </fieldset>

          <hr className="school-signup__divider" />

          <div className="row-2">
            <label className="field">
              <span className="field__label">Contact person <em>*</em></span>
              <span className="field__wrap">
                <UserRound size={18} className="field__icon" aria-hidden />
                <input
                  type="text"
                  value={form.contact_full_name}
                  onChange={(event) => setField("contact_full_name", event.target.value)}
                  placeholder="e.g. Rakesh Menon"
                  disabled={submitting}
                  required
                />
              </span>
              {fieldErrors(apiErr, "contact_full_name")?.map((message, index) => (
                <span className="field__error" key={index}>{message}</span>
              ))}
            </label>
            <label className="field">
              <span className="field__label">Designation</span>
              <span className="field__wrap">
                <AtSign size={18} className="field__icon" aria-hidden />
                <input
                  type="text"
                  value={form.designation}
                  onChange={(event) => setField("designation", event.target.value)}
                  placeholder="Principal, Admissions Officer"
                  disabled={submitting}
                />
              </span>
            </label>
          </div>

          <div className="row-2">
            <label className="field">
              <span className="field__label">Login username <em>*</em></span>
              <span className="field__wrap">
                <UserRound size={18} className="field__icon" aria-hidden />
                <input
                  type="text"
                  autoComplete="username"
                  value={form.username}
                  onChange={(event) => setField("username", event.target.value)}
                  placeholder="e.g. doonpublic_admin"
                  disabled={submitting}
                  required
                />
              </span>
              {fieldErrors(apiErr, "username")?.map((message, index) => (
                <span className="field__error" key={index}>{message}</span>
              ))}
            </label>
            <label className="field">
              <span className="field__label">Login phone <em>*</em></span>
              <span className="field__wrap">
                <Phone size={18} className="field__icon" aria-hidden />
                <input
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(event) => setField("phone", event.target.value)}
                  placeholder="+91 98765 43210"
                  disabled={submitting}
                  required
                />
              </span>
              {fieldErrors(apiErr, "phone")?.map((message, index) => (
                <span className="field__error" key={index}>{message}</span>
              ))}
            </label>
          </div>

          <label className="field">
            <span className="field__label">Login email <em>*</em></span>
            <span className="field__wrap">
              <Mail size={18} className="field__icon" aria-hidden />
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) => setField("email", event.target.value)}
                placeholder="admissions@school.edu.in"
                disabled={submitting}
                required
              />
            </span>
            {fieldErrors(apiErr, "email")?.map((message, index) => (
              <span className="field__error" key={index}>{message}</span>
            ))}
          </label>

          <div className="row-2">
            <label className="field">
              <span className="field__label">Password <em>*</em></span>
              <span className="field__wrap">
                <ShieldCheck size={18} className="field__icon" aria-hidden />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setField("password", event.target.value)}
                  placeholder="At least 8 characters"
                  disabled={submitting}
                  required
                />
              </span>
              {fieldErrors(apiErr, "password")?.map((message, index) => (
                <span className="field__error" key={index}>{message}</span>
              ))}
            </label>
            <label className="field">
              <span className="field__label">Confirm password <em>*</em></span>
              <span className="field__wrap">
                <ShieldCheck size={18} className="field__icon" aria-hidden />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.password_confirm}
                  onChange={(event) => setField("password_confirm", event.target.value)}
                  placeholder="Repeat the password"
                  disabled={submitting}
                  required
                />
              </span>
              {fieldErrors(apiErr, "password_confirm")?.map((message, index) => (
                <span className="field__error" key={index}>{message}</span>
              ))}
            </label>
          </div>

          <button type="submit" className="primary-button" disabled={submitting}>
            <ShieldCheck size={16} />
            {submitting ? "Submitting registration…" : "Register school for verification"}
          </button>

          <p className="account-card__hint">
            Already verified? <Link href="/login">Log in to your dashboard</Link>.
            Looking for a parent account? <Link href="/signup">Sign up as a parent</Link>.
          </p>
        </form>
      </section>
    </main>
  );
}
