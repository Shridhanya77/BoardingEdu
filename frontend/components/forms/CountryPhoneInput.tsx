"use client";

import { useEffect, useRef, useState } from "react";
import { COUNTRY_DIAL_CODES, dialCodeFromValue } from "@/lib/contact-validation";

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
  const onChangeRef = useRef(onChange);
  const lastEmittedValue = useRef<string | null>(null);
  const digits = value.replace(/\D/g, "");
  const detectedDialCode = dialCodeFromValue(value);
  const dialCode = detectedDialCode ?? fallbackDialCode;
  const dialCodeDigits = dialCode.slice(1);
  const hasEmittedDialCode = lastEmittedValue.current === value;
  const nationalNumber = detectedDialCode
    ? digits.slice(detectedDialCode.length - 1)
    : hasEmittedDialCode && digits.startsWith(dialCodeDigits)
      ? digits.slice(dialCodeDigits.length)
      : digits.length <= 10
        ? digits
        : digits.slice(-10);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (detectedDialCode) setFallbackDialCode(detectedDialCode);
  }, [detectedDialCode]);

  useEffect(() => {
    if (digits.length === 10 && !hasEmittedDialCode) {
      const normalizedValue = `${fallbackDialCode}${digits}`;
      lastEmittedValue.current = normalizedValue;
      onChangeRef.current(normalizedValue);
    }
  }, [digits, fallbackDialCode, hasEmittedDialCode]);

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
            const nextValue = `${nextCode}${nationalNumber}`;
            lastEmittedValue.current = nextValue;
            onChange(nextValue);
          }}
        >
          {[...new Map(COUNTRY_DIAL_CODES.map((item) => [item.code, item])).values()].map((item) => (
            <option value={item.code} key={item.code} title={item.country}>{item.code}</option>
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
          maxLength={20}
          required
          onChange={(event) => {
            const input = event.target.value;
            const inputDigits = input.replace(/\D/g, "");
            const pastedDialCode = dialCodeFromValue(input);
            const nextCode = pastedDialCode ?? dialCode;
            const nextNumber = pastedDialCode
              ? inputDigits.slice(pastedDialCode.length - 1)
              : inputDigits.slice(0, 10);
            if (pastedDialCode) setFallbackDialCode(pastedDialCode);
            const nextValue = `${nextCode}${nextNumber}`;
            lastEmittedValue.current = nextValue;
            onChange(nextValue);
          }}
        />
      </div>
    </div>
  );
}
