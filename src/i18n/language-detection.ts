/**
 * Language Detection Service
 * Detects user's preferred language based on geographic location (country code).
 * This runs silently without showing detection to the user.
 */

import type { SupportedLanguage } from './translations';

/**
 * Country code to language mapping.
 * Maps ISO 3166-1 alpha-2 country codes to supported languages.
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

  // German-speaking countries
  DE: 'de', // Germany
  AT: 'de', // Austria
  LI: 'de', // Liechtenstein
  // Switzerland - German is most spoken, but it's multilingual
  CH: 'de', // Switzerland (default to German - largest language group)
  LU: 'de', // Luxembourg (multilingual, German is one of 3 official)

  // Dutch-speaking countries
  NL: 'nl', // Netherlands
  BE: 'nl', // Belgium (Flemish/Dutch-speaking majority)
  SR: 'nl', // Suriname
  AW: 'nl', // Aruba
  CW: 'nl', // Curaçao
  SX: 'nl', // Sint Maarten
  BQ: 'nl', // Caribbean Netherlands

  // French-speaking countries
  FR: 'fr', // France
  // Quebec is handled via region detection (see below)
  MC: 'fr', // Monaco
  SN: 'fr', // Senegal
  CI: 'fr', // Côte d'Ivoire
  ML: 'fr', // Mali
  BF: 'fr', // Burkina Faso
  NE: 'fr', // Niger
  TD: 'fr', // Chad
  GN: 'fr', // Guinea
  RW: 'fr', // Rwanda
  BJ: 'fr', // Benin
  BI: 'fr', // Burundi
  TG: 'fr', // Togo
  CF: 'fr', // Central African Republic
  CG: 'fr', // Republic of the Congo
  CD: 'fr', // Democratic Republic of the Congo
  GA: 'fr', // Gabon
  DJ: 'fr', // Djibouti
  KM: 'fr', // Comoros
  MG: 'fr', // Madagascar
  CM: 'fr', // Cameroon
  HT: 'fr', // Haiti
  MU: 'fr', // Mauritius
  SC: 'fr', // Seychelles
  VU: 'fr', // Vanuatu
  NC: 'fr', // New Caledonia
  PF: 'fr', // French Polynesia
  WF: 'fr', // Wallis and Futuna
  GP: 'fr', // Guadeloupe
  MQ: 'fr', // Martinique
  GF: 'fr', // French Guiana
  RE: 'fr', // Réunion
  YT: 'fr', // Mayotte
  BL: 'fr', // Saint Barthélemy
  MF: 'fr', // Saint Martin

  // Italian-speaking countries
  IT: 'it', // Italy
  SM: 'it', // San Marino
  VA: 'it', // Vatican City

  // English-speaking countries (default fallback)
  US: 'en', // United States
  GB: 'en', // United Kingdom
  CA: 'en', // Canada (default to English; Quebec handled separately)
  AU: 'en', // Australia
  NZ: 'en', // New Zealand
  IE: 'en', // Ireland
  ZA: 'en', // South Africa
  JM: 'en', // Jamaica
  TT: 'en', // Trinidad and Tobago
  BB: 'en', // Barbados
  GY: 'en', // Guyana
  BZ: 'en', // Belize
  BS: 'en', // Bahamas
  PH: 'en', // Philippines
  SG: 'en', // Singapore
  IN: 'en', // India
  PK: 'en', // Pakistan
  NG: 'en', // Nigeria
  GH: 'en', // Ghana
  KE: 'en', // Kenya
  TZ: 'en', // Tanzania
  UG: 'en', // Uganda
  ZW: 'en', // Zimbabwe
  BW: 'en', // Botswana
  NA: 'en', // Namibia
  MW: 'en', // Malawi
  ZM: 'en', // Zambia
  FJ: 'en', // Fiji
  MT: 'en', // Malta
  CY: 'en', // Cyprus
  HK: 'en', // Hong Kong
  MY: 'en', // Malaysia
};

/**
 * Special region-based overrides.
 * For countries with multiple languages, we can use the region/province
 * to determine the correct language.
 */
const REGION_OVERRIDES: Record<string, Record<string, SupportedLanguage>> = {
  CA: {
    // Canadian provinces - Quebec is French
    QC: 'fr',
    Quebec: 'fr',
  },
  BE: {
    // Belgium regions
    // Flanders (Dutch)
    VLG: 'nl',
    Flanders: 'nl',
    // Wallonia (French)
    WAL: 'fr',
    Wallonia: 'fr',
    // Brussels is bilingual, default to French
    BRU: 'fr',
    Brussels: 'fr',
  },
  CH: {
    // Swiss cantons - simplified
    // French-speaking
    GE: 'fr', // Geneva
    VD: 'fr', // Vaud
    NE: 'fr', // Neuchâtel
    JU: 'fr', // Jura
    FR: 'fr', // Fribourg
    VS: 'fr', // Valais
    // Italian-speaking
    TI: 'it', // Ticino
    GR: 'de', // Graubünden (mixed, default German)
    // Rest defaults to German (majority)
  },
};

/**
 * Detect language from country code and optional region.
 * Returns the best matching supported language.
 */
export function detectLanguageFromGeo(
  countryCode: string,
  region?: string
): SupportedLanguage {
  const country = countryCode.toUpperCase();

  // Check region-specific overrides first
  if (region && REGION_OVERRIDES[country]) {
    const regionOverride = REGION_OVERRIDES[country][region];
    if (regionOverride) {
      return regionOverride;
    }
  }

  // Check country-level mapping
  if (COUNTRY_TO_LANGUAGE[country]) {
    return COUNTRY_TO_LANGUAGE[country];
  }

  // Default to English for any unmapped country
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
    if (['en', 'es', 'de', 'nl', 'fr', 'it'].includes(code)) {
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
      de: 'Deutsch',
      nl: 'Nederlands',
      fr: 'Français',
      it: 'Italiano',
    };
    return fallback[langCode] || langCode;
  }
}
