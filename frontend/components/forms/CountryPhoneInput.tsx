"use client";

import { useEffect, useState } from "react";

const COUNTRY_DIAL_CODES = [
  { country: "India", code: "+91" },
  { country: "United States / Canada", code: "+1" },
  { country: "United Kingdom", code: "+44" },
  { country: "United Arab Emirates", code: "+971" },
  { country: "Australia", code: "+61" },
  { country: "Argentina", code: "+54" },
  { country: "Austria", code: "+43" },
  { country: "Bangladesh", code: "+880" },
  { country: "Belgium", code: "+32" },
  { country: "Brazil", code: "+55" },
  { country: "Chile", code: "+56" },
  { country: "China", code: "+86" },
  { country: "Colombia", code: "+57" },
  { country: "Denmark", code: "+45" },
  { country: "Egypt", code: "+20" },
  { country: "France", code: "+33" },
  { country: "Germany", code: "+49" },
  { country: "Ghana", code: "+233" },
  { country: "Greece", code: "+30" },
  { country: "Israel", code: "+972" },
  { country: "Indonesia", code: "+62" },
  { country: "Ireland", code: "+353" },
  { country: "Italy", code: "+39" },
  { country: "Japan", code: "+81" },
  { country: "Kenya", code: "+254" },
  { country: "Kuwait", code: "+965" },
  { country: "Malaysia", code: "+60" },
  { country: "Mexico", code: "+52" },
  { country: "Nepal", code: "+977" },
  { country: "Netherlands", code: "+31" },
  { country: "New Zealand", code: "+64" },
  { country: "Nigeria", code: "+234" },
  { country: "Norway", code: "+47" },
  { country: "Peru", code: "+51" },
  { country: "Pakistan", code: "+92" },
  { country: "Philippines", code: "+63" },
  { country: "Poland", code: "+48" },
  { country: "Portugal", code: "+351" },
  { country: "Qatar", code: "+974" },
  { country: "Russia", code: "+7" },
  { country: "Saudi Arabia", code: "+966" },
  { country: "Singapore", code: "+65" },
  { country: "South Korea", code: "+82" },
  { country: "Spain", code: "+34" },
  { country: "South Africa", code: "+27" },
  { country: "Sri Lanka", code: "+94" },
  { country: "Sweden", code: "+46" },
  { country: "Switzerland", code: "+41" },
  { country: "Thailand", code: "+66" },
  { country: "Turkey", code: "+90" },
  { country: "Uganda", code: "+256" },
  { country: "Ukraine", code: "+380" },
  { country: "Vietnam", code: "+84" },
] as const;

function dialCodeFromValue(value: string): string | undefined {
  if (value.replace(/\D/g, "").length <= 10) return undefined;
  const digits = value.replace(/\D/g, "");
  return [...new Set(COUNTRY_DIAL_CODES.map((item) => item.code))]
    .sort((left, right) => right.length - left.length)
    .find((code) => digits.startsWith(code.slice(1)));
}

export default function CountryPhoneInput({
  id,
  label,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [fallbackDialCode, setFallbackDialCode] = useState("+91");
  const dialCode = dialCodeFromValue(value) ?? fallbackDialCode;
  const nationalNumber = value.replace(/\D/g, "").startsWith(dialCode.slice(1))
    ? value.replace(/\D/g, "").slice(dialCode.length - 1, dialCode.length - 1 + 10)
    : value.replace(/\D/g, "").slice(-10);

  useEffect(() => {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 10) onChange(`${fallbackDialCode}${digits}`);
  }, [fallbackDialCode, onChange, value]);

  return (
    <div className="country-phone-field">
      <label className="country-phone-field__label" htmlFor={`${id}-number`}>{label}</label>
      <div className="country-phone-field__controls">
        <label className="sr-only" htmlFor={`${id}-code`}>Country calling code</label>
        <select
          id={`${id}-code`}
          value={dialCode}
          disabled={disabled}
          onChange={(event) => {
            const nextCode = event.target.value;
            setFallbackDialCode(nextCode);
            onChange(`${nextCode}${nationalNumber}`);
          }}
        >
          {[...new Map(COUNTRY_DIAL_CODES.map((item) => [item.code, item])).values()].map((item) => (
            <option value={item.code} key={item.code}>{item.country} ({item.code})</option>
          ))}
        </select>
        <input
          id={`${id}-number`}
          type="tel"
          value={nationalNumber}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="10-digit phone number"
          pattern="[0-9]{10}"
          minLength={10}
          maxLength={10}
          required
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 10);
            onChange(`${dialCode}${digits}`);
          }}
        />
      </div>
    </div>
  );
}
