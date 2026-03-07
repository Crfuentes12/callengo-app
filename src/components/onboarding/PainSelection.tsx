// components/onboarding/PainSelection.tsx
'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n';

interface Pain {
  id: string;
  title: string;
  description: string;
  emoji: string;
  color: string;
  gradient: string;
  value: string;
  agentSlug: string;
}

interface PainSelectionProps {
  onSelect: (pain: Pain) => void;
  onSkip: () => void;
}

const PAINS_BASE = [
  {
    id: 'data-validation',
    emoji: '🧹',
    color: 'from-emerald-500 to-teal-600',
    gradient: 'from-emerald-500/20 to-teal-600/20',
    agentSlug: 'data-validation',
    titleKey: 'cleanDatabase' as const,
    descriptionKey: 'cleanDatabaseDesc' as const,
    valueKey: 'cleanDatabaseValue' as const,
  },
  {
    id: 'appointment-confirmation',
    emoji: '💰',
    color: 'from-blue-500 to-blue-700',
    gradient: 'from-blue-500/20 to-blue-700/20',
    agentSlug: 'appointment-confirmation',
    titleKey: 'stopNoShows' as const,
    descriptionKey: 'stopNoShowsDesc' as const,
    valueKey: 'stopNoShowsValue' as const,
  },
  {
    id: 'lead-qualification',
    emoji: '🎯',
    color: 'from-[var(--color-deep-indigo)] to-[var(--color-electric)]',
    gradient: 'from-[var(--color-primary)]/20 to-[var(--color-accent)]/20',
    agentSlug: 'lead-qualification',
    titleKey: 'qualifyLeads' as const,
    descriptionKey: 'qualifyLeadsDesc' as const,
    valueKey: 'qualifyLeadsValue' as const,
  },
];

export default function PainSelection({ onSelect, onSkip }: PainSelectionProps) {
  const { t } = useTranslation();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const PAINS: Pain[] = PAINS_BASE.map((p) => ({
    id: p.id,
    emoji: p.emoji,
    color: p.color,
    gradient: p.gradient,
    agentSlug: p.agentSlug,
    title: t.onboarding.painSelection[p.titleKey],
    description: t.onboarding.painSelection[p.descriptionKey],
    value: t.onboarding.painSelection[p.valueKey],
  }));

  const handleSelect = (pain: Pain) => {
    setSelectedId(pain.id);
    // Add a small delay for visual feedback
    setTimeout(() => {
      onSelect(pain);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-neutral-950)] via-[var(--color-neutral-900)] to-[var(--color-neutral-950)] flex items-center justify-center p-4">
      {/* Background */}

      <div className="relative z-10 max-w-6xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-bg mb-6 shadow-md">
            <span className="text-4xl">⚡</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            {t.onboarding.painSelection.title}
          </h1>
          <p className="text-xl text-[var(--color-neutral-400)] max-w-2xl mx-auto">
            {t.onboarding.painSelection.subtitle}
          </p>
        </div>

        {/* Pain Cards Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {PAINS.map((pain) => (
            <button
              key={pain.id}
              onClick={() => handleSelect(pain)}
              onMouseEnter={() => setHoveredId(pain.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`
                group relative overflow-hidden rounded-2xl p-8 text-left
                transition-all duration-300 ease-out
                ${selectedId === pain.id ? 'ring-2 ring-[var(--color-primary)]' : ''}
                ${hoveredId === pain.id ? 'shadow-2xl' : 'shadow-xl'}
                border border-[var(--color-neutral-800)] hover:border-[var(--color-neutral-700)]
                bg-gradient-to-br from-[var(--color-neutral-900)]/90 to-[var(--color-neutral-800)]/90
                backdrop-blur-sm
              `}
            >
              {/* Hover gradient effect */}
              <div className={`
                absolute inset-0 bg-gradient-to-br ${pain.gradient} opacity-0
                group-hover:opacity-100 transition-opacity duration-300
              `}></div>

              {/* Content */}
              <div className="relative z-10">
                {/* Emoji Icon */}
                <div className={`
                  inline-flex items-center justify-center w-16 h-16 rounded-xl mb-4
                  bg-gradient-to-br ${pain.color} shadow-lg
                  transition-transform duration-300
                `}>
                  <span className="text-3xl">{pain.emoji}</span>
                </div>

                {/* Title */}
                <h3 className="text-2xl font-bold text-white mb-3 transition-all duration-300">
                  {pain.title}
                </h3>

                {/* Description */}
                <p className="text-[var(--color-neutral-300)] mb-4 leading-relaxed">
                  {pain.description}
                </p>

                {/* Pain Points */}
                <div className="pt-4 border-t border-[var(--color-neutral-700)]/50">
                  <p className="text-xs text-[var(--color-neutral-500)] mb-2 font-semibold uppercase tracking-wide">
                    {t.onboarding.painSelection.dealingWith}
                  </p>
                  <p className="text-sm text-[var(--color-neutral-400)] leading-relaxed">
                    {pain.value}
                  </p>
                </div>

                {/* Selected indicator */}
                {selectedId === pain.id && (
                  <div className="absolute top-4 right-4">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${pain.color} flex items-center justify-center shadow-lg animate-bounce`}>
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>

            </button>
          ))}
        </div>

        {/* Skip Button */}
        <div className="text-center">
          <button
            onClick={onSkip}
            className="text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-400)] text-sm font-medium transition-colors underline"
          >
            {t.onboarding.painSelection.skipStep}
          </button>
        </div>

        {/* Bottom note */}
        <div className="mt-12 text-center">
          <p className="text-[var(--color-neutral-500)] text-sm">
            💡 {t.onboarding.painSelection.activateLater}
          </p>
        </div>
      </div>
    </div>
  );
}
