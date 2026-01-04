// components/voice/VoiceSelectionModal.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { BlandVoice } from '@/lib/voices/types';
import { BLAND_VOICES } from '@/lib/voices/bland-voices';
import {
  determineGender,
  determineCategory,
  getSampleText,
  getLanguageCode,
  getRecommendedVoices,
  getVoiceCharacteristics,
} from '@/lib/voices/voice-utils';

interface VoiceSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVoiceId: string;
  onVoiceSelect: (voiceId: string) => void;
}

type ViewMode = 'recommended' | 'explore';
type FilterType = 'country' | 'language' | 'accent' | 'characteristic';

export default function VoiceSelectionModal({
  isOpen,
  onClose,
  selectedVoiceId,
  onVoiceSelect,
}: VoiceSelectionModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('recommended');
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const [audioCache, setAudioCache] = useState<Map<string, Blob>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Filters for explore mode
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedAccent, setSelectedAccent] = useState<string>('all');
  const [selectedCharacteristic, setSelectedCharacteristic] = useState<string>('all');

  const recommended = getRecommendedVoices();

  // Get unique values for filters
  const countries = Array.from(new Set(BLAND_VOICES.map(v => determineCategory(v).country))).sort();
  const languages = Array.from(new Set(BLAND_VOICES.map(v => determineCategory(v).language))).sort();
  const accents = Array.from(new Set(BLAND_VOICES.map(v => determineCategory(v).accent))).sort();
  const characteristics = Array.from(
    new Set(BLAND_VOICES.flatMap(v => getVoiceCharacteristics(v)))
  ).sort();

  // Filter voices based on selected filters
  const filteredVoices = BLAND_VOICES.filter(voice => {
    const category = determineCategory(voice);
    const chars = getVoiceCharacteristics(voice);

    if (selectedCountry !== 'all' && category.country !== selectedCountry) return false;
    if (selectedLanguage !== 'all' && category.language !== selectedLanguage) return false;
    if (selectedAccent !== 'all' && category.accent !== selectedAccent) return false;
    if (selectedCharacteristic !== 'all' && !chars.includes(selectedCharacteristic)) return false;

    return true;
  }).sort((a, b) => b.average_rating - a.average_rating);

  const handlePlaySample = async (voice: BlandVoice) => {
    if (playingVoice === voice.id) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingVoice(null);
      return;
    }

    setLoadingVoice(voice.id);

    try {
      // Check cache first
      let audioBlob = audioCache.get(voice.id);

      if (!audioBlob) {
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

        if (!response.ok) throw new Error('Failed to generate sample');

        audioBlob = await response.blob();

        // Cache it
        setAudioCache(prev => new Map(prev).set(voice.id, audioBlob!));
      }

      // Play it
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setPlayingVoice(null);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
      setPlayingVoice(voice.id);
    } catch (error) {
      console.error('Error playing sample:', error);
    } finally {
      setLoadingVoice(null);
    }
  };

  const handleSelectVoice = (voiceId: string) => {
    onVoiceSelect(voiceId);
    onClose();
  };

  const resetFilters = () => {
    setSelectedCountry('all');
    setSelectedLanguage('all');
    setSelectedAccent('all');
    setSelectedCharacteristic('all');
  };

  useEffect(() => {
    // Clean up audio when modal closes
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Select Voice</h2>
            <p className="text-sm text-slate-600 mt-1">
              Choose the perfect voice for your AI agent
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/80 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-2 p-4 border-b border-slate-200 bg-slate-50">
          <button
            onClick={() => setViewMode('recommended')}
            className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${
              viewMode === 'recommended'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            ⭐ Recommended
          </button>
          <button
            onClick={() => setViewMode('explore')}
            className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${
              viewMode === 'explore'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            🔍 Explore All Voices
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === 'recommended' ? (
            <RecommendedVoices
              recommended={recommended}
              selectedVoiceId={selectedVoiceId}
              playingVoice={playingVoice}
              loadingVoice={loadingVoice}
              onPlaySample={handlePlaySample}
              onSelectVoice={handleSelectVoice}
            />
          ) : (
            <>
              {/* Filters */}
              <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black text-slate-900 uppercase">Filters</h3>
                  <button
                    onClick={resetFilters}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                  >
                    Reset All
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <FilterSelect
                    label="Country"
                    value={selectedCountry}
                    onChange={setSelectedCountry}
                    options={countries}
                  />
                  <FilterSelect
                    label="Language"
                    value={selectedLanguage}
                    onChange={setSelectedLanguage}
                    options={languages}
                  />
                  <FilterSelect
                    label="Accent"
                    value={selectedAccent}
                    onChange={setSelectedAccent}
                    options={accents}
                  />
                  <FilterSelect
                    label="Characteristic"
                    value={selectedCharacteristic}
                    onChange={setSelectedCharacteristic}
                    options={characteristics}
                  />
                </div>
              </div>

              {/* All Voices Grid */}
              <AllVoicesGrid
                voices={filteredVoices}
                selectedVoiceId={selectedVoiceId}
                playingVoice={playingVoice}
                loadingVoice={loadingVoice}
                onPlaySample={handlePlaySample}
                onSelectVoice={handleSelectVoice}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Recommended Voices Component
function RecommendedVoices({
  recommended,
  selectedVoiceId,
  playingVoice,
  loadingVoice,
  onPlaySample,
  onSelectVoice,
}: {
  recommended: ReturnType<typeof getRecommendedVoices>;
  selectedVoiceId: string;
  playingVoice: string | null;
  loadingVoice: string | null;
  onPlaySample: (voice: BlandVoice) => void;
  onSelectVoice: (voiceId: string) => void;
}) {
  const categories = [
    { key: 'american', label: 'American', flag: '🇺🇸', color: 'from-blue-500 to-indigo-600' },
    { key: 'british', label: 'British', flag: '🇬🇧', color: 'from-purple-500 to-pink-600' },
    { key: 'australian', label: 'Australian', flag: '🇦🇺', color: 'from-emerald-500 to-teal-600' },
    { key: 'spanish', label: 'Spanish', flag: '🇪🇸', color: 'from-amber-500 to-orange-600' },
  ];

  return (
    <div className="space-y-8">
      {categories.map(category => (
        <div key={category.key} className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{category.flag}</span>
            <h3 className={`text-xl font-black bg-gradient-to-r ${category.color} bg-clip-text text-transparent`}>
              {category.label}
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Females */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-500 uppercase">Female</div>
              {recommended[category.key as keyof typeof recommended].female.map(voice => (
                <VoiceCard
                  key={voice.id}
                  voice={voice}
                  isSelected={selectedVoiceId === voice.id}
                  isPlaying={playingVoice === voice.id}
                  isLoading={loadingVoice === voice.id}
                  onPlay={() => onPlaySample(voice)}
                  onSelect={() => onSelectVoice(voice.id)}
                />
              ))}
            </div>
            {/* Males */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-500 uppercase">Male</div>
              {recommended[category.key as keyof typeof recommended].male.map(voice => (
                <VoiceCard
                  key={voice.id}
                  voice={voice}
                  isSelected={selectedVoiceId === voice.id}
                  isPlaying={playingVoice === voice.id}
                  isLoading={loadingVoice === voice.id}
                  onPlay={() => onPlaySample(voice)}
                  onSelect={() => onSelectVoice(voice.id)}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// All Voices Grid Component
function AllVoicesGrid({
  voices,
  selectedVoiceId,
  playingVoice,
  loadingVoice,
  onPlaySample,
  onSelectVoice,
}: {
  voices: BlandVoice[];
  selectedVoiceId: string;
  playingVoice: string | null;
  loadingVoice: string | null;
  onPlaySample: (voice: BlandVoice) => void;
  onSelectVoice: (voiceId: string) => void;
}) {
  if (voices.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">No voices found matching your filters</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {voices.map(voice => (
        <VoiceCard
          key={voice.id}
          voice={voice}
          isSelected={selectedVoiceId === voice.id}
          isPlaying={playingVoice === voice.id}
          isLoading={loadingVoice === voice.id}
          onPlay={() => onPlaySample(voice)}
          onSelect={() => onSelectVoice(voice.id)}
        />
      ))}
    </div>
  );
}

// Voice Card Component
function VoiceCard({
  voice,
  isSelected,
  isPlaying,
  isLoading,
  onPlay,
  onSelect,
}: {
  voice: BlandVoice;
  isSelected: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  onPlay: () => void;
  onSelect: () => void;
}) {
  const gender = determineGender(voice);
  const category = determineCategory(voice);
  const characteristics = getVoiceCharacteristics(voice);

  return (
    <div
      className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-lg ${
        isSelected
          ? 'border-indigo-600 bg-indigo-50'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-bold text-slate-900">{voice.name}</h4>
          <p className="text-xs text-slate-500 mt-0.5">{category.accent} {category.language}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Gender Badge */}
          <span
            className={`px-2 py-0.5 rounded text-xs font-bold ${
              gender === 'female'
                ? 'bg-pink-100 text-pink-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {gender === 'female' ? '♀' : '♂'}
          </span>
          {/* Selected Badge */}
          {isSelected && (
            <span className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
        </div>
      </div>

      {/* Characteristics */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {characteristics.slice(0, 3).map(char => (
          <span
            key={char}
            className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium"
          >
            {char}
          </span>
        ))}
      </div>

      {/* Play Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPlay();
        }}
        disabled={isLoading}
        className={`w-full py-2 px-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
          isPlaying
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg'
        }`}
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Loading...
          </>
        ) : isPlaying ? (
          <>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
            Stop
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Play Sample
          </>
        )}
      </button>
    </div>
  );
}

// Filter Select Component
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white outline-none transition-all text-sm"
      >
        <option value="all">All {label}s</option>
        {options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
