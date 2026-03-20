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
    gradient: 'from-emerald-50 to-teal-50',
    borderColor: 'border-emerald-200',
    hoverBorder: 'hover:border-emerald-400',
    selectedRing: 'ring-emerald-500',
    agentSlug: 'data-validation',
    titleKey: 'cleanDatabase' as const,
    descriptionKey: 'cleanDatabaseDesc' as const,
    valueKey: 'cleanDatabaseValue' as const,
  },
  {
    id: 'appointment-confirmation',
    emoji: '💰',
    color: 'from-blue-500 to-blue-700',
    gradient: 'from-blue-50 to-indigo-50',
    borderColor: 'border-blue-200',
    hoverBorder: 'hover:border-blue-400',
    selectedRing: 'ring-blue-500',
    agentSlug: 'appointment-confirmation',
    titleKey: 'stopNoShows' as const,
    descriptionKey: 'stopNoShowsDesc' as const,
    valueKey: 'stopNoShowsValue' as const,
  },
  {
    id: 'lead-qualification',
    emoji: '🎯',
    color: 'from-[var(--color-deep-indigo)] to-[var(--color-electric)]',
    gradient: 'from-[var(--color-primary-50)] to-indigo-50',
    borderColor: 'border-[var(--color-primary-200)]',
    hoverBorder: 'hover:border-[var(--color-primary)]',
    selectedRing: 'ring-[var(--color-primary)]',
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

  const PAINS: (Pain & { borderColor: string; hoverBorder: string; selectedRing: string })[] = PAINS_BASE.map((p) => ({
    id: p.id,
    emoji: p.emoji,
    color: p.color,
    gradient: p.gradient,
    borderColor: p.borderColor,
    hoverBorder: p.hoverBorder,
    selectedRing: p.selectedRing,
    agentSlug: p.agentSlug,
    title: t.onboarding.painSelection[p.titleKey],
    description: t.onboarding.painSelection[p.descriptionKey],
    value: t.onboarding.painSelection[p.valueKey],
  }));

  const handleSelect = (pain: Pain & { borderColor: string; hoverBorder: string; selectedRing: string }) => {
    setSelectedId(pain.id);
    setTimeout(() => {
      onSelect(pain);
    }, 300);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl gradient-bg mb-4 shadow-md">
          <span className="text-2xl">⚡</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-ink)] mb-2 tracking-tight">
          {t.onboarding.painSelection.title}
        </h2>
        <p className="text-sm text-[var(--color-neutral-500)] max-w-lg mx-auto">
          {t.onboarding.painSelection.subtitle}
        </p>
      </div>

      {/* Pain Cards */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {PAINS.map((pain) => (
          <button
            key={pain.id}
            onClick={() => handleSelect(pain)}
            onMouseEnter={() => setHoveredId(pain.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={`
              group relative overflow-hidden rounded-2xl p-5 text-left
              transition-all duration-300 ease-out
              bg-white border
              ${selectedId === pain.id ? `ring-2 ${pain.selectedRing} ${pain.borderColor}` : pain.borderColor}
              ${pain.hoverBorder}
              ${hoveredId === pain.id ? 'shadow-lg -translate-y-0.5' : 'shadow-sm'}
            `}
          >
            {/* Subtle gradient background on hover */}
            <div className={`
              absolute inset-0 bg-gradient-to-br ${pain.gradient} opacity-0
              group-hover:opacity-100 transition-opacity duration-300
            `}></div>

            {/* Content */}
            <div className="relative z-10">
              {/* Emoji Icon */}
              <div className={`
                inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3
                bg-gradient-to-br ${pain.color} shadow-sm
                transition-transform duration-300 group-hover:scale-105
              `}>
                <span className="text-2xl">{pain.emoji}</span>
              </div>

              {/* Title */}
              <h3 className="text-base font-bold text-[var(--color-ink)] mb-2">
                {pain.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-[var(--color-neutral-600)] mb-3 leading-relaxed">
                {pain.description}
              </p>

              {/* Pain Points */}
              <div className="pt-3 border-t border-[var(--border-default)]">
                <p className="text-[10px] text-[var(--color-neutral-400)] mb-1.5 font-bold uppercase tracking-wide">
                  {t.onboarding.painSelection.dealingWith}
                </p>
                <p className="text-xs text-[var(--color-neutral-500)] leading-relaxed">
                  {pain.value}
                </p>
              </div>

              {/* Selected indicator */}
              {selectedId === pain.id && (
                <div className="absolute top-3 right-3">
                  <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${pain.color} flex items-center justify-center shadow-md`}>
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Skip Button — prominent */}
      <div className="text-center">
        <button
          onClick={onSkip}
          className="px-6 py-2.5 bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-200)] text-sm font-semibold rounded-lg transition-all border border-[var(--border-default)]"
        >
          {t.onboarding.painSelection.skipStep}
        </button>
      </div>

      {/* Bottom note */}
      <div className="mt-6 text-center">
        <p className="text-[var(--color-neutral-400)] text-xs">
          💡 {t.onboarding.painSelection.activateLater}
        </p>
      </div>
    </div>
  );
}
