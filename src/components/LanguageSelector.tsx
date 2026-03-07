'use client';

import { useState, useRef, useEffect } from 'react';
import { useLanguage, SUPPORTED_LANGUAGES } from '@/i18n';
import type { SupportedLanguage } from '@/i18n';

interface LanguageSelectorProps {
  /** Compact mode for auth pages (just flag + dropdown) */
  compact?: boolean;
  /** Show in dark theme (for auth pages) */
  dark?: boolean;
  /** Callback when language changes */
  onChange?: (lang: SupportedLanguage) => void;
  /** Controlled value (for forms) */
  value?: SupportedLanguage;
  /** Disable the selector */
  disabled?: boolean;
}

export default function LanguageSelector({
  compact = false,
  dark = false,
  onChange,
  value,
  disabled = false,
}: LanguageSelectorProps) {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = value ?? language;
  const currentLangInfo = SUPPORTED_LANGUAGES.find(l => l.code === currentLang) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (lang: SupportedLanguage) => {
    setIsOpen(false);
    if (onChange) {
      onChange(lang);
    } else {
      await setLanguage(lang);
    }
  };

  if (compact) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all
            ${dark
              ? 'text-white/60 hover:text-white/80 hover:bg-white/10'
              : 'text-[var(--color-neutral-600)] hover:text-[var(--color-ink)] hover:bg-[var(--surface-hover)]'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <span className="text-base">{currentLangInfo.flag}</span>
          <span>{currentLangInfo.code.toUpperCase()}</span>
          <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className={`
            absolute right-0 top-full mt-1 w-48 rounded-xl shadow-lg border z-50 overflow-hidden
            ${dark
              ? 'bg-[var(--surface-dark-card)] border-white/10'
              : 'bg-white border-[var(--border-default)]'
            }
          `}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang.code)}
                className={`
                  w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all
                  ${lang.code === currentLang
                    ? dark
                      ? 'bg-white/10 text-white'
                      : 'bg-[var(--color-neutral-50)] text-[var(--color-ink)] font-medium'
                    : dark
                      ? 'text-white/70 hover:bg-white/5 hover:text-white'
                      : 'text-[var(--color-neutral-600)] hover:bg-[var(--surface-hover)] hover:text-[var(--color-ink)]'
                  }
                `}
              >
                <span className="text-base">{lang.flag}</span>
                <span>{lang.nativeName}</span>
                {lang.code === currentLang && (
                  <svg className="w-4 h-4 ml-auto text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full-size selector (for settings pages)
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all
          ${dark
            ? 'bg-white/5 border-white/10 text-white hover:bg-white/10'
            : 'bg-white border-[var(--border-default)] text-[var(--color-ink)] hover:border-[var(--border-strong)]'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <span className="text-xl">{currentLangInfo.flag}</span>
        <div className="flex-1 text-left">
          <div className="text-sm font-medium">{currentLangInfo.nativeName}</div>
          <div className={`text-xs ${dark ? 'text-white/40' : 'text-[var(--color-neutral-500)]'}`}>{currentLangInfo.name}</div>
        </div>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''} ${dark ? 'text-white/40' : 'text-[var(--color-neutral-400)]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className={`
          absolute left-0 right-0 top-full mt-2 rounded-xl shadow-lg border z-50 overflow-hidden
          ${dark
            ? 'bg-[var(--surface-dark-card)] border-white/10'
            : 'bg-white border-[var(--border-default)]'
          }
        `}>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang.code)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 text-sm transition-all
                ${lang.code === currentLang
                  ? dark
                    ? 'bg-white/10 text-white'
                    : 'bg-[var(--color-primary-50)] text-[var(--color-primary)]'
                  : dark
                    ? 'text-white/70 hover:bg-white/5 hover:text-white'
                    : 'text-[var(--color-neutral-600)] hover:bg-[var(--surface-hover)] hover:text-[var(--color-ink)]'
                }
              `}
            >
              <span className="text-xl">{lang.flag}</span>
              <div className="flex-1 text-left">
                <div className="font-medium">{lang.nativeName}</div>
                <div className={`text-xs ${dark ? 'text-white/40' : 'text-[var(--color-neutral-400)]'}`}>{lang.name}</div>
              </div>
              {lang.code === currentLang && (
                <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
