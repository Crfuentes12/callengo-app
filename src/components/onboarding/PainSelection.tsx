// components/onboarding/PainSelection.tsx
'use client';

import { useState } from 'react';

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

const PAINS: Pain[] = [
  {
    id: 'data-validation',
    title: 'Clean my database',
    description: 'Stop wasting money on bad data. Emails that bounce, wrong phone numbers, duplicated leads.',
    emoji: '🧹',
    color: 'from-emerald-500 to-teal-600',
    gradient: 'from-emerald-500/20 to-teal-600/20',
    value: 'Emails that bounce • Phone numbers that are wrong • Leads duplicated • CRM inflated with basura',
    agentSlug: 'data-validation'
  },
  {
    id: 'appointment-confirmation',
    title: 'Stop losing money from no-shows',
    description: 'Every missed appointment is money lost. Confirm automatically and reduce no-shows immediately.',
    emoji: '💰',
    color: 'from-blue-500 to-indigo-600',
    gradient: 'from-blue-500/20 to-indigo-600/20',
    value: 'Empty agendas • Wasted time • Teams waiting for people who never arrive',
    agentSlug: 'appointment-confirmation'
  },
  {
    id: 'lead-qualification',
    title: 'Qualify leads before sales touches them',
    description: 'Your sales team wastes time on junk leads. Filter automatically and save their energy.',
    emoji: '🎯',
    color: 'from-purple-500 to-pink-600',
    gradient: 'from-purple-500/20 to-pink-600/20',
    value: 'Junk leads • Burned out SDRs • Useless conversations',
    agentSlug: 'lead-qualification'
  },
];

export default function PainSelection({ onSelect, onSkip }: PainSelectionProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (pain: Pain) => {
    setSelectedId(pain.id);
    // Add a small delay for visual feedback
    setTimeout(() => {
      onSelect(pain);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      {/* Animated background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-500/10 to-pink-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 max-w-6xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-600 mb-6 shadow-2xl">
            <span className="text-4xl">⚡</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-purple-200">
            What do you want to fix first?
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Choose the problem that's costing you the most time or money right now
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
                ${selectedId === pain.id ? 'scale-105' : 'scale-100'}
                ${hoveredId === pain.id ? 'scale-105 shadow-2xl' : 'shadow-xl'}
                border-2 border-slate-800 hover:border-slate-700
                bg-gradient-to-br from-slate-900/90 to-slate-800/90
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
                  group-hover:scale-110 transition-transform duration-300
                `}>
                  <span className="text-3xl">{pain.emoji}</span>
                </div>

                {/* Title */}
                <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-cyan-200 transition-all duration-300">
                  {pain.title}
                </h3>

                {/* Description */}
                <p className="text-slate-300 mb-4 leading-relaxed">
                  {pain.description}
                </p>

                {/* Pain Points */}
                <div className="pt-4 border-t border-slate-700/50">
                  <p className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wide">
                    What you're dealing with:
                  </p>
                  <p className="text-sm text-slate-400 leading-relaxed">
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

              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-slate-700 group-hover:border-slate-600 transition-colors rounded-tl-2xl"></div>
              <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-slate-700 group-hover:border-slate-600 transition-colors rounded-br-2xl"></div>
            </button>
          ))}
        </div>

        {/* Skip Button */}
        <div className="text-center">
          <button
            onClick={onSkip}
            className="text-slate-500 hover:text-slate-400 text-sm font-medium transition-colors underline"
          >
            Skip this step for now
          </button>
        </div>

        {/* Bottom note */}
        <div className="mt-12 text-center">
          <p className="text-slate-500 text-sm">
            💡 Don't worry, you can activate all solutions later from your dashboard
          </p>
        </div>
      </div>
    </div>
  );
}
