/** Single source of truth for legal versioning + country/currency mapping. */

export const TERMS_VERSION = "2026-09-02";
export const LEGAL_LAST_UPDATED = "2 September 2026";

export const COMPANY = {
  name: "StudySync",
  legalName: "StudySync",
  email: "supportstudysync@gmail.com",
  jurisdiction: "South Africa",
  courts: "Cape Town, South Africa",
};

export type CountryCode = "ZA" | "ZW" | "GB" | "OTHER";
export type CurrencyCode = "ZAR" | "USD" | "GBP";

export interface CountryConfig {
  code: CountryCode;
  name: string;
  flag: string; // emoji
  currency: CurrencyCode;
  defaultCurriculum: "NSC" | "ZIMSEC" | "CAMB" | "OTHER";
}

export const COUNTRIES: CountryConfig[] = [
  { code: "ZA", name: "South Africa", flag: "🇿🇦", currency: "ZAR", defaultCurriculum: "NSC" },
  { code: "ZW", name: "Zimbabwe",     flag: "🇿🇼", currency: "USD", defaultCurriculum: "ZIMSEC" },
  { code: "GB", name: "United Kingdom",flag: "🇬🇧", currency: "GBP", defaultCurriculum: "CAMB" },
  { code: "OTHER", name: "Other / International", flag: "🌍", currency: "USD", defaultCurriculum: "CAMB" },
];

export function detectCountry(): CountryCode {
  try {
    const lang = (navigator.language || "").toUpperCase();
    const region = (Intl.DateTimeFormat().resolvedOptions().timeZone || "").toUpperCase();
    if (lang.includes("ZA") || region.includes("JOHANNESBURG")) return "ZA";
    if (lang.includes("ZW") || region.includes("HARARE")) return "ZW";
    if (lang.includes("GB") || region.includes("LONDON")) return "GB";
  } catch {/* ignore */}
  return "ZA";
}

export function countryByCode(code: string | null | undefined): CountryConfig {
  return COUNTRIES.find((c) => c.code === code) || COUNTRIES[0];
}
