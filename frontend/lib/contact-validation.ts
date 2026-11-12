export const COUNTRY_DIAL_CODES = [
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

const UNIQUE_DIAL_CODES = [...new Set(COUNTRY_DIAL_CODES.map((item) => item.code))]
  .sort((left, right) => right.length - left.length);

export function dialCodeFromValue(value: string): string | undefined {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!trimmed.startsWith("+") && digits.length <= 10) return undefined;

  return UNIQUE_DIAL_CODES.find((code) => {
    const prefix = code.slice(1);
    const nationalDigits = digits.length - prefix.length;
    return digits.startsWith(prefix) && nationalDigits > 0 && nationalDigits <= 10;
  });
}

export function normalizePhoneNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  const dialCode = dialCodeFromValue(trimmed);
  return dialCode && digits.length - (dialCode.length - 1) === 10 ? digits : null;
}

export function isValidEmailAddress(value: string): boolean {
  const email = value.trim();
  return (
    email.length <= 254 &&
    /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i.test(
      email,
    )
  );
}
