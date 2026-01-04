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
}

export default function VoiceSelector({ selectedVoiceId, onVoiceSelect, className = '' }: VoiceSelectorProps) {
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

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={`w-full px-4 py-3 border-2 border-slate-200 rounded-xl hover:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white text-left ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`font-bold ${selectedVoice ? 'text-slate-900' : 'text-slate-500'}`}>
                {display.name}
              </span>
              {selectedVoice && display.gender && (
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    display.gender === 'female'
                      ? 'bg-pink-100 text-pink-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {display.gender === 'female' ? '♀' : '♂'}
                </span>
              )}
            </div>
            <p className={`text-xs mt-0.5 ${selectedVoice ? 'text-slate-600' : 'text-slate-400'}`}>
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
      />
    </>
  );
}
