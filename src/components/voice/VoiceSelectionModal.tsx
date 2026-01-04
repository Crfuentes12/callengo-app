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
import { createClient } from '@/lib/supabase/client';

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
  const [selectedGender, setSelectedGender] = useState<string>('all');

  // Favorites state (persisted in database)
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const supabase = createClient();

  const recommended = getRecommendedVoices();

  // Load favorites from database
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('users')
          .select('fav_voices')
          .eq('id', user.id)
          .single();

        // Silently handle if column doesn't exist yet (migration not run)
        if (error) {
          console.warn('Could not load favorites:', error.message);
          return;
        }

        if (data && (data as any).fav_voices) {
          setFavorites(new Set((data as any).fav_voices));
        }
      } catch (err) {
        console.warn('Error loading favorites:', err);
      }
    };

    if (isOpen) {
      loadFavorites();
    }
  }, [isOpen, supabase]);

  // Helper to check if a voice is recommended
  const isRecommended = (voiceId: string): boolean => {
    return Object.values(recommended).some(category =>
      category.female.some(v => v.id === voiceId) ||
      category.male.some(v => v.id === voiceId)
    );
  };

  // Toggle favorite
  const toggleFavorite = async (voiceId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setFavorites(prev => {
        const newFavorites = new Set(prev);
        if (newFavorites.has(voiceId)) {
          newFavorites.delete(voiceId);
        } else {
          newFavorites.add(voiceId);
        }

        // Persist to database (silently fail if column doesn't exist yet)
        supabase
          .from('users')
          .update({ fav_voices: [...newFavorites] } as any)
          .eq('id', user.id)
          .then(({ error }) => {
            if (error) {
              console.warn('Could not save favorites (migration may not be applied yet):', error.message);
            }
          });

        return newFavorites;
      });
    } catch (err) {
      console.warn('Error toggling favorite:', err);
    }
  };

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
    const gender = determineGender(voice);

    if (selectedCountry !== 'all' && category.country !== selectedCountry) return false;
    if (selectedLanguage !== 'all' && category.language !== selectedLanguage) return false;
    if (selectedAccent !== 'all' && category.accent !== selectedAccent) return false;
    if (selectedCharacteristic !== 'all' && !chars.includes(selectedCharacteristic)) return false;
    if (selectedGender !== 'all' && gender !== selectedGender) return false;

    return true;
  }).sort((a, b) => b.average_rating - a.average_rating);

  const handlePlaySample = async (voice: BlandVoice) => {
    // Always stop any currently playing audio first
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingVoice === voice.id) {
      // If clicking the same voice, just stop
      setPlayingVoice(null);
      return;
    }

    setLoadingVoice(voice.id);
    setPlayingVoice(null);

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
    setSelectedGender('all');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col border-2 border-slate-700/50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50 bg-gradient-to-r from-purple-600/20 to-pink-600/20">
          <div>
            <h2 className="text-2xl font-black text-white">Select Voice</h2>
            <p className="text-sm text-slate-400 mt-1">
              Choose the perfect voice for your AI agent
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-2 p-4 border-b border-slate-700/50 bg-slate-800/50">
          <button
            onClick={() => setViewMode('recommended')}
            className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${
              viewMode === 'recommended'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
            }`}
          >
            ⭐ Recommended
          </button>
          <button
            onClick={() => setViewMode('explore')}
            className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${
              viewMode === 'explore'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
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
              favorites={favorites}
              onPlaySample={handlePlaySample}
              onSelectVoice={handleSelectVoice}
              onToggleFavorite={toggleFavorite}
            />
          ) : (
            <>
              {/* Filters */}
              <div className="mb-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black text-white uppercase">Filters</h3>
                  <button
                    onClick={resetFilters}
                    className="text-xs font-bold text-purple-400 hover:text-purple-300"
                  >
                    Reset All
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <FilterSelect
                    label="Gender"
                    value={selectedGender}
                    onChange={setSelectedGender}
                    options={['male', 'female']}
                  />
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
                favorites={favorites}
                onPlaySample={handlePlaySample}
                onSelectVoice={handleSelectVoice}
                onToggleFavorite={toggleFavorite}
                isRecommended={isRecommended}
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
  favorites,
  onPlaySample,
  onSelectVoice,
  onToggleFavorite,
}: {
  recommended: ReturnType<typeof getRecommendedVoices>;
  selectedVoiceId: string;
  playingVoice: string | null;
  loadingVoice: string | null;
  favorites: Set<string>;
  onPlaySample: (voice: BlandVoice) => void;
  onSelectVoice: (voiceId: string) => void;
  onToggleFavorite: (voiceId: string) => void;
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
                  isFavorite={favorites.has(voice.id)}
                  isRecommended={true}
                  onPlay={() => onPlaySample(voice)}
                  onSelect={() => onSelectVoice(voice.id)}
                  onToggleFavorite={() => onToggleFavorite(voice.id)}
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
                  isFavorite={favorites.has(voice.id)}
                  isRecommended={true}
                  onPlay={() => onPlaySample(voice)}
                  onSelect={() => onSelectVoice(voice.id)}
                  onToggleFavorite={() => onToggleFavorite(voice.id)}
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
  favorites,
  onPlaySample,
  onSelectVoice,
  onToggleFavorite,
  isRecommended,
}: {
  voices: BlandVoice[];
  selectedVoiceId: string;
  playingVoice: string | null;
  loadingVoice: string | null;
  favorites: Set<string>;
  onPlaySample: (voice: BlandVoice) => void;
  onSelectVoice: (voiceId: string) => void;
  onToggleFavorite: (voiceId: string) => void;
  isRecommended: (voiceId: string) => boolean;
}) {
  if (voices.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">No voices found matching your filters</p>
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
          isFavorite={favorites.has(voice.id)}
          isRecommended={isRecommended(voice.id)}
          onPlay={() => onPlaySample(voice)}
          onSelect={() => onSelectVoice(voice.id)}
          onToggleFavorite={() => onToggleFavorite(voice.id)}
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
  isFavorite,
  isRecommended,
  onPlay,
  onSelect,
  onToggleFavorite,
}: {
  voice: BlandVoice;
  isSelected: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  isFavorite: boolean;
  isRecommended: boolean;
  onPlay: () => void;
  onSelect: () => void;
  onToggleFavorite: () => void;
}) {
  const gender = determineGender(voice);
  const category = determineCategory(voice);
  const characteristics = getVoiceCharacteristics(voice);

  return (
    <div
      className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-lg ${
        isSelected
          ? 'border-purple-600 bg-purple-600/10'
          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 flex items-start gap-2">
          <div className="flex-1">
            <h4 className="font-bold text-white">{voice.name}</h4>
            <p className="text-xs text-slate-400 mt-0.5">{category.accent} {category.language}</p>
          </div>
          {/* Star Icon for Recommended/Favorite */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
            title={isFavorite || isRecommended ? "Remove from favorites" : "Add to favorites"}
          >
            {isFavorite || isRecommended ? (
              <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* Gender Badge */}
          <span
            className={`px-2 py-0.5 rounded text-xs font-bold ${
              gender === 'female'
                ? 'bg-pink-600/30 text-pink-400 border border-pink-500/50'
                : 'bg-blue-600/30 text-blue-400 border border-blue-500/50'
            }`}
          >
            {gender === 'female' ? '♀' : '♂'}
          </span>
          {/* Selected Badge */}
          {isSelected && (
            <span className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center">
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
            className="px-2 py-0.5 bg-slate-700/50 text-slate-300 rounded text-xs font-medium border border-slate-600/50"
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
            : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg'
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
      <label className="block text-xs font-bold text-slate-400 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border-2 border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-slate-900/50 text-white outline-none transition-all text-sm"
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
