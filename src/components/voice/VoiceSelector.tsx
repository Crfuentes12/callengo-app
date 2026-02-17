// components/voice/VoiceSelector.tsx
'use client';

import { useState } from 'react';
import { BLAND_VOICES } from '@/lib/voices/bland-voices';
import { determineGender, determineCategory } from '@/lib/voices/voice-utils';
import VoiceSelectionModal from './VoiceSelectionModal';

interface VoiceSelectorProps {
  selectedVoiceId?: string;
  onVoiceSelect: (voiceId: string) => void;
  className?: string;
  variant?: 'light' | 'dark';
}

export default function VoiceSelector({ selectedVoiceId, onVoiceSelect, className = '', variant = 'light' }: VoiceSelectorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const selectedVoice = selectedVoiceId
    ? BLAND_VOICES.find(v => v.id === selectedVoiceId)
    : null;

  const getVoiceDisplay = () => {
    if (!selectedVoice) {
      return {
        name: 'Select a voice...',
        details: 'Click to browse voices',
        gender: null,
        category: null,
      };
    }

    const gender = determineGender(selectedVoice);
    const category = determineCategory(selectedVoice);

    return {
      name: selectedVoice.name,
      details: `${category.accent} ${category.language} • ${gender === 'female' ? 'Female' : 'Male'}`,
      gender,
      category,
    };
  };

  const display = getVoiceDisplay();

  const buttonStyles = variant === 'dark'
    ? 'border-slate-700 bg-slate-900/50 hover:border-[var(--color-primary)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20'
    : 'border-slate-200 bg-white hover:border-[var(--color-primary)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20';

  const textStyles = variant === 'dark'
    ? { primary: selectedVoice ? 'text-white' : 'text-slate-400', secondary: selectedVoice ? 'text-slate-400' : 'text-slate-500' }
    : { primary: selectedVoice ? 'text-slate-900' : 'text-slate-500', secondary: selectedVoice ? 'text-slate-600' : 'text-slate-400' };

  const genderBadgeStyles = variant === 'dark'
    ? { female: 'bg-pink-600/30 text-pink-400 border border-pink-500/50', male: 'bg-blue-600/30 text-blue-400 border border-blue-500/50' }
    : { female: 'bg-pink-100 text-pink-700', male: 'bg-blue-100 text-blue-700' };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 outline-none transition-all text-left ${buttonStyles} ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`font-bold ${textStyles.primary}`}>
                {display.name}
              </span>
              {selectedVoice && display.gender && (
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    display.gender === 'female'
                      ? genderBadgeStyles.female
                      : genderBadgeStyles.male
                  }`}
                >
                  {display.gender === 'female' ? '♀' : '♂'}
                </span>
              )}
            </div>
            <p className={`text-xs mt-0.5 ${textStyles.secondary}`}>
              {display.details}
            </p>
          </div>
          <svg
            className="w-5 h-5 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 9l4-4 4 4m0 6l-4 4-4-4"
            />
          </svg>
        </div>
      </button>

      <VoiceSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedVoiceId={selectedVoiceId || ''}
        onVoiceSelect={onVoiceSelect}
        fullscreen={variant === 'dark'}
      />
    </>
  );
}
