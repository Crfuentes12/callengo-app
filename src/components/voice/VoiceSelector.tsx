// components/voice/VoiceSelector.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { getCuratedVoices, getVoicesByCategory, getSampleText, getLanguageCode, searchVoices } from '@/lib/voices/voice-utils';
import { BlandVoice, VoiceCategory } from '@/lib/voices/types';

interface VoiceSelectorProps {
  selectedVoiceId?: string;
  onVoiceSelect: (voiceId: string, voiceName: string) => void;
  className?: string;
}

export default function VoiceSelector({ selectedVoiceId, onVoiceSelect, className = '' }: VoiceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<VoiceCategory | null>(null);
  const [showAllVoices, setShowAllVoices] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [audioCache, setAudioCache] = useState<Map<string, string>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const curatedVoices = getCuratedVoices();
  const selectedVoice = selectedVoiceId
    ? curatedVoices.flatMap(cat => [...cat.voices.male, ...cat.voices.female]).find(v => v.id === selectedVoiceId)
    : null;

  // Play voice sample
  const playVoiceSample = async (voice: BlandVoice) => {
    try {
      // Stop current audio if playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      setLoadingVoiceId(voice.id);
      setPlayingVoiceId(null);

      // Check cache first
      let audioUrl = audioCache.get(voice.id);

      if (!audioUrl) {
        // Generate sample
        const sampleText = getSampleText(voice);
        const language = getLanguageCode(voice);

        const response = await fetch('/api/voices/sample', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voiceId: voice.id,
            text: sampleText,
            language,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate voice sample');
        }

        const audioBlob = await response.blob();
        audioUrl = URL.createObjectURL(audioBlob);

        // Cache the URL
        setAudioCache(prev => new Map(prev).set(voice.id, audioUrl!));
      }

      // Play audio
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        setLoadingVoiceId(null);
        setPlayingVoiceId(voice.id);
        audio.play();
      };

      audio.onended = () => {
        setPlayingVoiceId(null);
      };

      audio.onerror = () => {
        setLoadingVoiceId(null);
        setPlayingVoiceId(null);
        alert('Failed to play voice sample');
      };
    } catch (error) {
      console.error('Error playing voice sample:', error);
      setLoadingVoiceId(null);
      alert('Failed to load voice sample');
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingVoiceId(null);
  };

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      // Revoke cached URLs
      audioCache.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const renderVoiceCard = (voice: BlandVoice, gender: 'male' | 'female') => {
    const isSelected = voice.id === selectedVoiceId;
    const isPlaying = playingVoiceId === voice.id;
    const isLoading = loadingVoiceId === voice.id;

    return (
      <div
        key={voice.id}
        className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer ${
          isSelected
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md'
        }`}
        onClick={() => {
          onVoiceSelect(voice.id, voice.name);
          if (!showAllVoices) {
            setIsOpen(false);
          }
        }}
      >
        {/* Gender Badge */}
        <div className="absolute -top-2 -right-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            gender === 'male'
              ? 'bg-blue-100 text-blue-700 border border-blue-200'
              : 'bg-pink-100 text-pink-700 border border-pink-200'
          }`}>
            {gender === 'male' ? (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
              </svg>
            )}
            {gender}
          </span>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-slate-900 mb-1 truncate">{voice.name}</h4>
            <p className="text-xs text-slate-600 line-clamp-2 mb-2">{voice.description}</p>

            {/* Rating */}
            <div className="flex items-center gap-1 mb-2">
              <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-xs text-slate-600">
                {voice.average_rating.toFixed(1)} ({voice.total_ratings})
              </span>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1">
              {voice.tags.slice(0, 2).map((tag, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Play Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isPlaying) {
                stopAudio();
              } else {
                playVoiceSample(voice);
              }
            }}
            disabled={isLoading}
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              isPlaying
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-indigo-500 hover:bg-indigo-600 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg`}
            title={isPlaying ? 'Stop' : 'Play sample'}
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>

        {/* Selected Checkmark */}
        {isSelected && (
          <div className="absolute top-2 left-2">
            <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`w-full p-4 border-2 border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all text-left ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {selectedVoice ? (
              <>
                <div className="font-semibold text-slate-900">{selectedVoice.name}</div>
                <div className="text-sm text-slate-600">{selectedVoice.description}</div>
              </>
            ) : (
              <div className="text-slate-500">Select a voice</div>
            )}
          </div>
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
    );
  }

  return (
    <div className={`border-2 border-indigo-300 rounded-xl bg-white shadow-xl ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-900">Select Voice</h3>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setSelectedCategory(null);
              setShowAllVoices(false);
              setSearchQuery('');
            }}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        {(showAllVoices || selectedCategory) && (
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search voices..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
            <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 max-h-[600px] overflow-y-auto">
        {!selectedCategory && !showAllVoices ? (
          // Show categories
          <div className="space-y-3">
            {curatedVoices.map((category) => (
              <button
                key={`${category.language}-${category.accent}`}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className="w-full p-4 border-2 border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{category.language} - {category.accent}</div>
                    <div className="text-sm text-slate-600">
                      {category.voices.male.length} male, {category.voices.female.length} female
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowAllVoices(true)}
              className="w-full p-4 border-2 border-indigo-500 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-all text-indigo-700 font-semibold"
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Explore All Voices
              </div>
            </button>
          </div>
        ) : (
          // Show voices for selected category or all voices
          <>
            {selectedCategory && !showAllVoices && (
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="mb-4 flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to categories
              </button>
            )}

            <div className="space-y-4">
              {selectedCategory && !searchQuery ? (
                <>
                  {/* Male voices */}
                  {selectedCategory.voices.male.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-2">Male Voices</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedCategory.voices.male.map(voice => renderVoiceCard(voice, 'male'))}
                      </div>
                    </div>
                  )}

                  {/* Female voices */}
                  {selectedCategory.voices.female.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-2">Female Voices</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedCategory.voices.female.map(voice => renderVoiceCard(voice, 'female'))}
                      </div>
                    </div>
                  )}

                  {/* Explore more button */}
                  <button
                    type="button"
                    onClick={() => {
                      const allVoices = getVoicesByCategory(selectedCategory.language, selectedCategory.accent);
                      setShowAllVoices(true);
                    }}
                    className="w-full p-3 border-2 border-slate-300 rounded-lg hover:border-indigo-300 hover:bg-slate-50 transition-all text-slate-700 font-medium"
                  >
                    View all {selectedCategory.language} - {selectedCategory.accent} voices
                  </button>
                </>
              ) : (
                // Search results or all voices
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {searchQuery
                    ? searchVoices(searchQuery).slice(0, 20).map(voice => {
                        const tags = voice.tags.map(t => t.toLowerCase());
                        const description = (voice.description || '').toLowerCase();
                        const gender = tags.includes('male') || description.includes(' male') ? 'male' : 'female';
                        return renderVoiceCard(voice, gender);
                      })
                    : selectedCategory
                    ? getVoicesByCategory(selectedCategory.language, selectedCategory.accent).map(voice => {
                        const tags = voice.tags.map(t => t.toLowerCase());
                        const description = (voice.description || '').toLowerCase();
                        const gender = tags.includes('male') || description.includes(' male') ? 'male' : 'female';
                        return renderVoiceCard(voice, gender);
                      })
                    : curatedVoices.flatMap(cat => [
                        ...cat.voices.male.map(v => ({ ...v, gender: 'male' as const })),
                        ...cat.voices.female.map(v => ({ ...v, gender: 'female' as const }))
                      ]).slice(0, 20).map(({ gender, ...voice }) => renderVoiceCard(voice, gender))
                  }
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
