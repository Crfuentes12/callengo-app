// components/voice/VoiceSelectionModal.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BlandVoice } from '@/lib/voices/types';
import { BLAND_VOICES } from '@/lib/voices/bland-voices';
import {
  determineGender,
  determineCategory,
  getSampleText,
  getLanguageCode,
  getRecommendedVoices,
  getVoiceCharacteristics,
  getVoiceProfile,
  USE_CASE_LABELS,
  AGE_LABELS,
  VOICE_CATALOG_STATS,
} from '@/lib/voices/voice-utils';
import { createClient } from '@/lib/supabase/client';

interface VoiceSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVoiceId: string;
  onVoiceSelect: (voiceId: string) => void;
  fullscreen?: boolean;
  defaultVoiceId?: string;
}

type ViewMode = 'recommended' | 'explore';

export default function VoiceSelectionModal({
  isOpen,
  onClose,
  selectedVoiceId,
  onVoiceSelect,
  fullscreen = false,
  defaultVoiceId: _defaultVoiceId,
}: VoiceSelectionModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('recommended');
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const [audioCache, setAudioCache] = useState<Map<string, Blob>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [ambientEnabled, setAmbientEnabled] = useState(false);
  const ambientRef = useRef<HTMLAudioElement | null>(null);

  // Filters for explore mode
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedAccent, setSelectedAccent] = useState<string>('all');
  const [selectedCharacteristic, setSelectedCharacteristic] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [selectedAge, setSelectedAge] = useState<string>('all');
  const [selectedUseCase, setSelectedUseCase] = useState<string>('all');

  // Favorites state (persisted in database)
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const supabase = createClient();

  const recommended = getRecommendedVoices();

  // Load favorites from database BEFORE opening modal to avoid flash
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setFavoritesLoaded(true);
          return;
        }

        const { data, error } = await supabase
          .from('users')
          .select('fav_voices')
          .eq('id', user.id)
          .single();

        if (error) {
          console.warn('Could not load favorites:', error.message);
          setFavoritesLoaded(true);
          return;
        }

        if (data && (data as unknown as Record<string, unknown>).fav_voices) {
          setFavorites(new Set((data as unknown as Record<string, string[]>).fav_voices));
        }
        setFavoritesLoaded(true);
      } catch (err) {
        console.warn('Error loading favorites:', err);
        setFavoritesLoaded(true);
      }
    };

    if (isOpen && !favoritesLoaded) {
      loadFavorites();
    }
  }, [isOpen, favoritesLoaded, supabase]);

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

        supabase
          .from('users')
          .update({ fav_voices: [...newFavorites] } as unknown as Record<string, unknown>)
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
  const ages = ['young', 'adult', 'mature'];
  const useCases = Object.keys(USE_CASE_LABELS) as Array<keyof typeof USE_CASE_LABELS>;

  // Filter voices based on selected filters
  const filteredVoices = BLAND_VOICES.filter(voice => {
    const category = determineCategory(voice);
    const chars = getVoiceCharacteristics(voice);
    const gender = determineGender(voice);
    const profile = getVoiceProfile(voice);

    if (selectedCountry !== 'all' && category.country !== selectedCountry) return false;
    if (selectedLanguage !== 'all' && category.language !== selectedLanguage) return false;
    if (selectedAccent !== 'all' && category.accent !== selectedAccent) return false;
    if (selectedCharacteristic !== 'all' && !chars.includes(selectedCharacteristic)) return false;
    if (selectedGender !== 'all' && gender !== selectedGender) return false;
    if (selectedAge !== 'all' && profile.age !== selectedAge) return false;
    if (selectedUseCase !== 'all' && !profile.bestFor.includes(selectedUseCase as keyof typeof USE_CASE_LABELS)) return false;

    return true;
  }).sort((a, b) => b.average_rating - a.average_rating);

  const handlePlaySample = async (voice: BlandVoice) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingVoice === voice.id) {
      setPlayingVoice(null);
      if (ambientRef.current) ambientRef.current.pause();
      return;
    }

    setLoadingVoice(voice.id);
    setPlayingVoice(null);

    try {
      let audioBlob = audioCache.get(voice.id);

      if (!audioBlob) {
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
        setAudioCache(prev => new Map(prev).set(voice.id, audioBlob!));
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setPlayingVoice(null);
        URL.revokeObjectURL(audioUrl);
        // Stop ambient when voice ends
        if (ambientRef.current) {
          ambientRef.current.pause();
        }
      };

      await audio.play();
      setPlayingVoice(voice.id);

      // Start ambient if enabled
      if (ambientEnabled) {
        startAmbient();
      }
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

  // Lazily create and start ambient audio
  const startAmbient = () => {
    if (!ambientRef.current) {
      const ambient = new Audio('/sounds/office-ambient.mp3');
      ambient.loop = true;
      ambient.volume = 0.15;
      ambientRef.current = ambient;
    }
    ambientRef.current.play().catch(() => {});
  };

  // Toggle ambient — if voice is playing, start/stop immediately
  const toggleAmbient = () => {
    setAmbientEnabled(prev => {
      const next = !prev;
      if (next && playingVoice) {
        startAmbient();
      } else if (!next && ambientRef.current) {
        ambientRef.current.pause();
      }
      return next;
    });
  };

  const resetFilters = () => {
    setSelectedCountry('all');
    setSelectedLanguage('all');
    setSelectedAccent('all');
    setSelectedCharacteristic('all');
    setSelectedGender('all');
    setSelectedAge('all');
    setSelectedUseCase('all');
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (ambientRef.current) {
        ambientRef.current.pause();
        ambientRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen || !favoritesLoaded) return null;

  const containerSize = fullscreen
    ? 'w-full max-w-3xl max-h-[70vh] rounded-2xl'
    : 'w-full max-w-5xl max-h-[70vh] rounded-2xl';

  const wrapperClass = fullscreen
    ? 'fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4'
    : 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md';

  const modalContent = (
    <div className={wrapperClass} style={{ isolation: 'isolate', willChange: 'transform' }}>
      <div className={`relative bg-white shadow-2xl border border-[var(--border-default)] overflow-hidden flex flex-col ${containerSize}`} style={{ transform: 'translateZ(0)' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-[var(--color-ink)]">Select Voice</h2>
            <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">
              {VOICE_CATALOG_STATS.totalVoices} voices &middot; {VOICE_CATALOG_STATS.accents} accents &middot; {VOICE_CATALOG_STATS.languages} languages
            </p>
          </div>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-50 w-9 h-9 rounded-lg bg-[var(--color-neutral-100)] backdrop-blur-sm border border-[var(--border-default)] text-[var(--color-neutral-500)] hover:text-white hover:bg-red-600 hover:border-red-500 transition-all duration-300 flex items-center justify-center group"
          >
            <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-2 p-3 border-b border-[var(--border-default)] bg-[var(--color-neutral-50)]">
          <button
            onClick={() => setViewMode('recommended')}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${
              viewMode === 'recommended'
                ? 'gradient-bg text-white shadow-lg'
                : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            Top Picks
          </button>
          <button
            onClick={() => setViewMode('explore')}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${
              viewMode === 'explore'
                ? 'gradient-bg text-white shadow-lg'
                : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <svg className="w-4 h-4 inline-block mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            Explore All ({VOICE_CATALOG_STATS.totalVoices})
          </button>
          <div className="flex-1" />
          <button
            onClick={toggleAmbient}
            className={`px-3 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 ${
              ambientEnabled
                ? 'bg-cyan-100 text-cyan-700 border border-cyan-300'
                : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)] hover:bg-[var(--surface-hover)] border border-transparent'
            }`}
            title="Toggle office background noise to hear how the voice sounds in a real call environment"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
            Office BG {ambientEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4" style={{
          scrollbarGutter: 'stable',
          scrollbarWidth: 'thin'
        }}>
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
              <div className="mb-4 p-3 bg-[var(--color-neutral-50)] rounded-xl border border-[var(--border-default)]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-[var(--color-ink)] uppercase">Filters</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--color-neutral-500)]">{filteredVoices.length} voice{filteredVoices.length !== 1 ? 's' : ''}</span>
                    <button
                      onClick={resetFilters}
                      className="text-xs font-bold text-[var(--color-primary-light)] hover:text-[var(--color-primary)]"
                    >
                      Reset All
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                  <FilterSelect
                    label="Gender"
                    value={selectedGender}
                    onChange={setSelectedGender}
                    options={['male', 'female']}
                  />
                  <FilterSelect
                    label="Age"
                    value={selectedAge}
                    onChange={setSelectedAge}
                    options={ages}
                    displayMap={AGE_LABELS}
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
                    label="Country"
                    value={selectedCountry}
                    onChange={setSelectedCountry}
                    options={countries}
                  />
                  <FilterSelect
                    label="Style"
                    value={selectedCharacteristic}
                    onChange={setSelectedCharacteristic}
                    options={characteristics}
                  />
                  <FilterSelect
                    label="Best For"
                    value={selectedUseCase}
                    onChange={setSelectedUseCase}
                    options={useCases}
                    displayMap={USE_CASE_LABELS}
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

  return typeof window !== 'undefined' ? createPortal(modalContent, document.body) : null;
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
  const favoriteVoices = BLAND_VOICES.filter(voice => favorites.has(voice.id));

  const categories = [
    { key: 'american', label: 'American English', flag: '🇺🇸', color: 'from-blue-500 to-blue-700', sub: '19 voices' },
    { key: 'british', label: 'British English', flag: '🇬🇧', color: 'from-[var(--color-deep-indigo)] to-[var(--color-electric)]', sub: '24 voices' },
    { key: 'australian', label: 'Australian English', flag: '🇦🇺', color: 'from-emerald-500 to-teal-600', sub: '5 voices' },
    { key: 'spanish-europe', label: 'Spanish (Spain)', flag: '🇪🇸', color: 'from-amber-500 to-orange-600', sub: '1 voice' },
    { key: 'spanish-latam', label: 'Spanish (Latin America)', flag: '🌎', color: 'from-rose-500 to-pink-600', sub: '2 voices' },
  ];

  return (
    <div className="space-y-6">
      {/* Quick tip */}
      <div className="p-3 bg-gradient-to-r from-[var(--color-primary)]/5 to-[var(--color-electric)]/5 rounded-xl border border-[var(--color-primary)]/10">
        <p className="text-xs text-[var(--color-neutral-600)]">
          <span className="font-bold text-[var(--color-ink)]">Tip:</span> Listen to each voice sample before choosing. Look for <span className="inline-flex items-center px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-medium">Best For</span> tags to find voices that match your use case.
        </p>
      </div>

      {/* User Favorites Section */}
      {favorites.size > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">&#9733;</span>
            <h3 className="text-base font-bold text-[var(--color-ink)]">
              Your Favorites
            </h3>
            <span className="text-xs text-[var(--color-neutral-400)]">({favorites.size})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {favoriteVoices.map(voice => (
              <VoiceCard
                key={voice.id}
                voice={voice}
                isSelected={selectedVoiceId === voice.id}
                isPlaying={playingVoice === voice.id}
                isLoading={loadingVoice === voice.id}
                isFavorite={true}
                isRecommended={false}
                onPlay={() => onPlaySample(voice)}
                onSelect={() => onSelectVoice(voice.id)}
                onToggleFavorite={() => onToggleFavorite(voice.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* System Recommended Voices */}
      {categories.map(category => {
        const categoryVoices = [
          ...recommended[category.key as keyof typeof recommended].female,
          ...recommended[category.key as keyof typeof recommended].male,
        ];

        if (categoryVoices.length === 0) return null;

        return (
          <div key={category.key} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{category.flag}</span>
              <div>
                <h3 className={`text-base font-bold bg-gradient-to-r ${category.color} bg-clip-text text-transparent`}>
                  {category.label}
                </h3>
                <p className="text-xs text-[var(--color-neutral-400)]">{category.sub}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {categoryVoices.map(voice => (
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
        );
      })}
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
      <div className="text-center py-8">
        <p className="text-[var(--color-neutral-500)]">No voices found matching your filters</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
  const profile = getVoiceProfile(voice);
  const ageLabel = AGE_LABELS[profile.age];

  // Age color mapping
  const ageColor = profile.age === 'young'
    ? 'bg-violet-50 text-violet-600'
    : profile.age === 'mature'
      ? 'bg-amber-50 text-amber-600'
      : 'bg-sky-50 text-sky-600';

  return (
    <div
      className={`p-3 rounded-xl border transition-all cursor-pointer hover:shadow-lg ${
        isSelected
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 shadow-md'
          : 'bg-white border-[var(--border-default)] hover:border-[var(--border-strong)]'
      }`}
      onClick={onSelect}
    >
      {/* Top row: name + badges */}
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <h4 className="font-bold text-[var(--color-ink)] text-sm">{voice.name}</h4>
            {isRecommended && (
              <span className="px-1 py-0.5 bg-yellow-50 text-yellow-600 rounded text-[10px] font-bold leading-none">TOP</span>
            )}
          </div>
          <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">
            {category.accent} {category.language}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {/* Favorite toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className="p-1 hover:bg-[var(--surface-hover)] rounded transition-colors"
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            {isFavorite ? (
              <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-[var(--color-neutral-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            )}
          </button>
          {/* Gender Badge */}
          <span
            className={`px-1.5 py-0.5 rounded text-xs font-bold ${
              gender === 'female'
                ? 'bg-pink-50 text-pink-600'
                : 'bg-blue-50 text-blue-600'
            }`}
          >
            {gender === 'female' ? '♀' : '♂'}
          </span>
          {/* Age Badge */}
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ageColor}`}>
            {ageLabel}
          </span>
          {/* Selected Badge */}
          {isSelected && (
            <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
        </div>
      </div>

      {/* Characteristics */}
      <div className="flex flex-wrap gap-1 mb-1.5">
        {characteristics.slice(0, 3).map(char => (
          <span
            key={char}
            className="px-1.5 py-0.5 bg-[var(--color-neutral-50)] text-[var(--color-neutral-600)] rounded text-[10px] font-medium"
          >
            {char}
          </span>
        ))}
      </div>

      {/* Best For */}
      <div className="flex flex-wrap gap-1 mb-2">
        {profile.bestFor.slice(0, 2).map(useCase => (
          <span
            key={useCase}
            className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-medium"
          >
            {USE_CASE_LABELS[useCase]}
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
        className={`w-full py-1.5 px-3 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${
          isPlaying
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'gradient-bg text-white hover:shadow-lg'
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
  displayMap,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  displayMap?: Record<string, string>;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-[var(--color-neutral-600)] mb-0.5 uppercase">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-[var(--border-default)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-white text-[var(--color-ink)] outline-none transition-all text-xs"
      >
        <option value="all">All</option>
        {options.map(option => (
          <option key={option} value={option}>
            {displayMap ? displayMap[option] || option : option}
          </option>
        ))}
      </select>
    </div>
  );
}
