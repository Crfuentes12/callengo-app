// Re-export everything from the i18n module
export { LanguageProvider, useLanguage, useTranslation } from './context';
export { detectLanguageFromGeo, detectLanguageFromBrowser, getCountryDisplayName, getLanguageDisplayName } from './language-detection';
export { SUPPORTED_LANGUAGES, loadTranslation, getTranslationSync } from './translations';
export type { SupportedLanguage } from './translations';
export type { TranslationKeys } from './translations/en';
