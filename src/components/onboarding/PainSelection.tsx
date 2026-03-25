// components/onboarding/PainSelection.tsx
'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { DataValidationIcon, AppointmentConfirmationIcon, LeadQualificationIcon } from '@/components/agents/AgentTypeIcon';

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

const PAIN_CONFIG = [
  {
    id: 'data-validation',
    agentSlug: 'data-validation',
    accentFrom: '#10b981', // emerald-500
    accentTo: '#0d9488',   // teal-600
    ringClass: 'ring-emerald-500',
    borderClass: 'border-emerald-200',
    hoverBorderClass: 'hover:border-emerald-400',
    bgHoverClass: 'group-hover:bg-emerald-50',
    iconColorClass: 'text-emerald-600',
    iconBgClass: 'bg-emerald-100 group-hover:bg-emerald-200',
    gradientClass: 'from-emerald-500 to-teal-600',
    titleKey: 'cleanDatabase' as const,
    descriptionKey: 'cleanDatabaseDesc' as const,
    valueKey: 'cleanDatabaseValue' as const,
    icon: <DataValidationIcon className="w-14 h-14" />,
  },
  {
    id: 'appointment-confirmation',
    agentSlug: 'appointment-confirmation',
    accentFrom: '#3b82f6',
    accentTo: '#1d4ed8',
    ringClass: 'ring-blue-500',
    borderClass: 'border-blue-200',
    hoverBorderClass: 'hover:border-blue-400',
    bgHoverClass: 'group-hover:bg-blue-50',
    iconColorClass: 'text-blue-600',
    iconBgClass: 'bg-blue-100 group-hover:bg-blue-200',
    gradientClass: 'from-blue-500 to-blue-700',
    titleKey: 'stopNoShows' as const,
    descriptionKey: 'stopNoShowsDesc' as const,
    valueKey: 'stopNoShowsValue' as const,
    icon: <AppointmentConfirmationIcon className="w-14 h-14" />,
  },
  {
    id: 'lead-qualification',
    agentSlug: 'lead-qualification',
    accentFrom: '#4f46e5',
    accentTo: '#7c3aed',
    ringClass: 'ring-indigo-500',
    borderClass: 'border-indigo-200',
    hoverBorderClass: 'hover:border-indigo-400',
    bgHoverClass: 'group-hover:bg-indigo-50',
    iconColorClass: 'text-indigo-600',
    iconBgClass: 'bg-indigo-100 group-hover:bg-indigo-200',
    gradientClass: 'from-indigo-500 to-violet-600',
    titleKey: 'qualifyLeads' as const,
    descriptionKey: 'qualifyLeadsDesc' as const,
    valueKey: 'qualifyLeadsValue' as const,
    icon: <LeadQualificationIcon className="w-14 h-14" />,
  },
];

export default function PainSelection({ onSelect, onSkip }: PainSelectionProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pains: (Pain & typeof PAIN_CONFIG[0])[] = PAIN_CONFIG.map((cfg) => ({
    ...cfg,
    emoji: '',
    color: cfg.gradientClass,
    gradient: cfg.bgHoverClass,
    title: t.onboarding.painSelection[cfg.titleKey],
    description: t.onboarding.painSelection[cfg.descriptionKey],
    value: t.onboarding.painSelection[cfg.valueKey],
  }));

  const handleSelect = (pain: typeof pains[0]) => {
    setSelectedId(pain.id);
    setTimeout(() => onSelect(pain), 250);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="text-center mb-8">
        {/* Callengo Logo */}
        <div className="flex justify-center mb-5">
          <img
            src="/callengo-logo.svg"
            alt="Callengo"
            className="h-10 w-auto"
          />
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--color-ink)] mb-2 tracking-tight leading-tight">
          {t.onboarding.painSelection.title}
        </h2>
        <p className="text-sm text-[var(--color-neutral-500)]">
          {t.onboarding.painSelection.subtitle}
        </p>
      </div>

      {/* Pain Cards */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {pains.map((pain) => {
          const isSelected = selectedId === pain.id;
          return (
            <button
              key={pain.id}
              onClick={() => handleSelect(pain)}
              className={`
                group relative text-left rounded-2xl border-2 bg-white
                transition-all duration-200 ease-out overflow-hidden
                flex flex-col p-6 min-h-[200px]
                ${isSelected ? `${pain.ringClass} ring-2 ${pain.borderClass} shadow-lg scale-[1.02]` : `${pain.borderClass} ${pain.hoverBorderClass}`}
                hover:shadow-lg hover:-translate-y-0.5
              `}
            >
              {/* Subtle bg fill on hover/select */}
              <div className={`
                absolute inset-0 transition-opacity duration-200
                ${pain.bgHoverClass} opacity-0 group-hover:opacity-100
                ${isSelected ? 'opacity-100' : ''}
              `} />

              {/* Icon */}
              <div className={`
                relative z-10 inline-flex items-center justify-center
                w-16 h-16 rounded-2xl mb-4 transition-all duration-200
                ${pain.iconBgClass} ${pain.iconColorClass}
              `}>
                {pain.icon}
              </div>

              {/* Headline */}
              <h3 className="relative z-10 text-lg font-extrabold text-[var(--color-ink)] leading-snug mb-2">
                {pain.title}
              </h3>

              {/* Description */}
              <p className="relative z-10 text-sm text-[var(--color-neutral-600)] leading-relaxed flex-1">
                {pain.description}
              </p>

              {/* Bottom row */}
              <div className="relative z-10 flex items-center justify-end mt-4">
                {isSelected ? (
                  <div className={`
                    flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full
                    bg-gradient-to-r ${pain.gradientClass} text-white shadow-sm
                  `}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Selected
                  </div>
                ) : (
                  <span className={`
                    text-xs font-semibold flex items-center gap-1
                    ${pain.iconColorClass} opacity-60 group-hover:opacity-100 transition-opacity
                  `}>
                    Select
                    <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Skip */}
      <div className="text-center">
        <button
          onClick={onSkip}
          className="text-sm text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)] transition-colors font-medium underline underline-offset-2"
        >
          {t.onboarding.painSelection.skipStep}
        </button>
      </div>
    </div>
  );
}
