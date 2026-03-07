'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { TranslationKeys } from './translations/en';
import { en, loadTranslation, getTranslationSync } from './translations';
import type { SupportedLanguage } from './translations';
import { detectLanguageFromGeo, detectLanguageFromBrowser } from './language-detection';

interface LanguageContextType {
  /** Current language code */
  language: SupportedLanguage;
  /** Current translation object */
  t: TranslationKeys;
  /** Change the language (loads translations and optionally persists) */
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  /** Whether translations are still loading */
  isLoading: boolean;
  /** Detected language from geolocation (may differ from active language) */
  detectedLanguage: SupportedLanguage | null;
  /** Detected country code */
  detectedCountry: string | null;
  /** Whether the language was auto-detected (not manually set) */
  isAutoDetected: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  t: en,
  setLanguage: async () => {},
  isLoading: false,
  detectedLanguage: null,
  detectedCountry: null,
  isAutoDetected: true,
});

const LANGUAGE_STORAGE_KEY = 'callengo_language';

/**
 * Get stored language from localStorage
 */
function getStoredLanguage(): SupportedLanguage | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && ['en', 'es', 'de', 'nl', 'fr', 'it'].includes(stored)) {
      return stored as SupportedLanguage;
    }
  } catch {
    // localStorage might be unavailable
  }
  return null;
}

/**
 * Store language preference in localStorage
 */
function storeLanguage(lang: SupportedLanguage): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // Silently fail
  }
}

interface LanguageProviderProps {
  children: React.ReactNode;
  /** Initial language from server (e.g., from user DB record) */
  initialLanguage?: SupportedLanguage;
  /** User's country code from geolocation */
  userCountryCode?: string;
  /** User's region for more precise detection */
  userRegion?: string;
}

export function LanguageProvider({
  children,
  initialLanguage,
  userCountryCode,
  userRegion,
}: LanguageProviderProps) {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    // Priority: initialLanguage (from DB) > localStorage > 'en'
    if (initialLanguage) return initialLanguage;
    return getStoredLanguage() || 'en';
  });
  const [translations, setTranslations] = useState<TranslationKeys>(
    getTranslationSync(language)
  );
  const [isLoading, setIsLoading] = useState(language !== 'en');
  const [detectedLanguage, setDetectedLanguage] = useState<SupportedLanguage | null>(null);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(userCountryCode || null);
  const [isAutoDetected, setIsAutoDetected] = useState(!initialLanguage && !getStoredLanguage());

  // Load translations when language changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      const t = await loadTranslation(language);
      if (!cancelled) {
        setTranslations(t);
        setIsLoading(false);
        // Update HTML lang attribute
        if (typeof document !== 'undefined') {
          document.documentElement.lang = language;
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [language]);

  // Auto-detect language from geolocation on mount (only if no explicit language set)
  useEffect(() => {
    if (initialLanguage || getStoredLanguage()) {
      // User has an explicit preference, don't auto-detect
      queueMicrotask(() => setIsAutoDetected(false));
      return;
    }

    if (userCountryCode) {
      const detected = detectLanguageFromGeo(userCountryCode, userRegion);
      queueMicrotask(() => {
        setDetectedLanguage(detected);
        setDetectedCountry(userCountryCode);
        if (detected !== language) {
          setLanguageState(detected);
          storeLanguage(detected);
        }
        setIsAutoDetected(true);
      });
    } else {
      // Fallback to browser language detection
      const browserLang = detectLanguageFromBrowser();
      queueMicrotask(() => {
        setDetectedLanguage(browserLang);
        if (browserLang !== language) {
          setLanguageState(browserLang);
          storeLanguage(browserLang);
        }
        setIsAutoDetected(true);
      });
    }
  }, [userCountryCode, userRegion, initialLanguage]);

  const setLanguage = useCallback(async (lang: SupportedLanguage) => {
    setLanguageState(lang);
    storeLanguage(lang);
    setIsAutoDetected(false);
  }, []);

  const value = useMemo(
    () => ({
      language,
      t: translations,
      setLanguage,
      isLoading,
      detectedLanguage,
      detectedCountry,
      isAutoDetected,
    }),
    [language, translations, setLanguage, isLoading, detectedLanguage, detectedCountry, isAutoDetected]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Hook to access translations and language settings
 */
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

/**
 * Hook that returns just the translation object (shorthand)
 */
export function useTranslation() {
  const { t, language } = useLanguage();
  return { t, language };
}
