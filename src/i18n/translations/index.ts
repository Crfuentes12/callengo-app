import en from './en';
import type { TranslationKeys } from './en';

// Lazy-load non-English translations to keep bundle size down
const translationLoaders: Record<string, () => Promise<{ default: TranslationKeys }>> = {
  es: () => import('./es'),
  de: () => import('./de'),
  nl: () => import('./nl'),
  fr: () => import('./fr'),
  it: () => import('./it'),
};

export type SupportedLanguage = 'en' | 'es' | 'de' | 'nl' | 'fr' | 'it';

export const SUPPORTED_LANGUAGES: { code: SupportedLanguage; name: string; nativeName: string; flag: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
];

// Cache loaded translations
const loadedTranslations: Record<string, TranslationKeys> = { en };

export async function loadTranslation(lang: SupportedLanguage): Promise<TranslationKeys> {
  if (loadedTranslations[lang]) {
    return loadedTranslations[lang];
  }

  if (lang === 'en') {
    return en;
  }

  const loader = translationLoaders[lang];
  if (!loader) {
    console.warn(`[i18n] No translation found for language: ${lang}, falling back to English`);
    return en;
  }

  try {
    const translationModule = await loader();
    loadedTranslations[lang] = translationModule.default;
    return translationModule.default;
  } catch (error) {
    console.error(`[i18n] Failed to load translation for ${lang}:`, error);
    return en;
  }
}

export function getTranslationSync(lang: SupportedLanguage): TranslationKeys {
  return loadedTranslations[lang] || en;
}

export { en };
export type { TranslationKeys };
