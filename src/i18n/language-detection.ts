/**
 * Language Detection Service
 * Detects user's preferred language based on geographic location (country code).
 * Only English and Spanish are supported.
 */

import type { SupportedLanguage } from './translations';

/**
 * Country code to language mapping.
 * Maps ISO 3166-1 alpha-2 country codes to supported languages.
 * Only Spanish-speaking countries are mapped — all others default to English.
 */
const COUNTRY_TO_LANGUAGE: Record<string, SupportedLanguage> = {
  // Spanish-speaking countries
  ES: 'es', // Spain
  MX: 'es', // Mexico
  AR: 'es', // Argentina
  CO: 'es', // Colombia
  PE: 'es', // Peru
  VE: 'es', // Venezuela
  CL: 'es', // Chile
  EC: 'es', // Ecuador
  GT: 'es', // Guatemala
  CU: 'es', // Cuba
  BO: 'es', // Bolivia
  DO: 'es', // Dominican Republic
  HN: 'es', // Honduras
  PY: 'es', // Paraguay
  SV: 'es', // El Salvador
  NI: 'es', // Nicaragua
  CR: 'es', // Costa Rica
  PA: 'es', // Panama
  UY: 'es', // Uruguay
  PR: 'es', // Puerto Rico
  GQ: 'es', // Equatorial Guinea
};

/**
 * Detect language from country code.
 * Returns 'es' for Spanish-speaking countries, 'en' for everything else.
 */
export function detectLanguageFromGeo(
  countryCode: string,
  _region?: string
): SupportedLanguage {
  const country = countryCode.toUpperCase();

  if (COUNTRY_TO_LANGUAGE[country]) {
    return COUNTRY_TO_LANGUAGE[country];
  }

  return 'en';
}

/**
 * Detect language from browser's navigator.languages or navigator.language.
 * Fallback when geolocation is not available.
 */
export function detectLanguageFromBrowser(): SupportedLanguage {
  if (typeof navigator === 'undefined') return 'en';

  const languages = navigator.languages || [navigator.language];

  for (const lang of languages) {
    const code = lang.split('-')[0].toLowerCase();
    if (['en', 'es'].includes(code)) {
      return code as SupportedLanguage;
    }
  }

  return 'en';
}

/**
 * Get the display name for a country in the user's language.
 */
export function getCountryDisplayName(countryCode: string, locale: string = 'en'): string {
  try {
    const displayNames = new Intl.DisplayNames([locale], { type: 'region' });
    return displayNames.of(countryCode.toUpperCase()) || countryCode;
  } catch {
    return countryCode;
  }
}

/**
 * Get the language name in the target language.
 */
export function getLanguageDisplayName(langCode: SupportedLanguage, inLanguage: string = 'en'): string {
  try {
    const displayNames = new Intl.DisplayNames([inLanguage], { type: 'language' });
    return displayNames.of(langCode) || langCode;
  } catch {
    const fallback: Record<string, string> = {
      en: 'English',
      es: 'Español',
    };
    return fallback[langCode] || langCode;
  }
}
