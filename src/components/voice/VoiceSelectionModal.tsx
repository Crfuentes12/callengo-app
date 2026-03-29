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
  const [ambientEnabled, setAmbientEnabled] = useState(true);
  const ambientRef = useRef<HTMLAudioElement | null>(null);

  // Filters for explore mode
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

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setFavoritesLoaded(true); return; }
        const { data, error } = await supabase.from('users').select('fav_voices').eq('id', user.id).single();
        if (error) { setFavoritesLoaded(true); return; }
        if (data && (data as unknown as Record<string, unknown>).fav_voices) {
          setFavorites(new Set((data as unknown as Record<string, string[]>).fav_voices));
        }
        setFavoritesLoaded(true);
      } catch { setFavoritesLoaded(true); }
    };
    if (isOpen && !favoritesLoaded) loadFavorites();
  }, [isOpen, favoritesLoaded, supabase]);

  const isRecommended = (voiceId: string): boolean => {
    return Object.values(recommended).some(cat => cat.female.some(v => v.id === voiceId) || cat.male.some(v => v.id === voiceId));
  };

  const toggleFavorite = async (voiceId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setFavorites(prev => {
        const next = new Set(prev);
        if (next.has(voiceId)) next.delete(voiceId); else next.add(voiceId);
        supabase.from('users').update({ fav_voices: [...next] } as unknown as Record<string, unknown>).eq('id', user.id).then(({ error }) => {
          if (error) console.warn('Could not save favorites:', error.message);
        });
        return next;
      });
    } catch (err) { console.warn('Error toggling favorite:', err); }
  };

  // Filter options
  const accents = Array.from(new Set(BLAND_VOICES.map(v => determineCategory(v).accent))).sort();
  const characteristics = Array.from(new Set(BLAND_VOICES.flatMap(v => getVoiceCharacteristics(v)))).sort();
  const ages = ['young', 'adult', 'mature'];
  const useCases = Object.keys(USE_CASE_LABELS) as Array<keyof typeof USE_CASE_LABELS>;
  const hasFilters = selectedGender !== 'all' || selectedAge !== 'all' || selectedAccent !== 'all' || selectedCharacteristic !== 'all' || selectedUseCase !== 'all';

  const filteredVoices = BLAND_VOICES.filter(voice => {
    const category = determineCategory(voice);
    const chars = getVoiceCharacteristics(voice);
    const gender = determineGender(voice);
    const profile = getVoiceProfile(voice);
    if (selectedAccent !== 'all' && category.accent !== selectedAccent) return false;
    if (selectedCharacteristic !== 'all' && !chars.includes(selectedCharacteristic)) return false;
    if (selectedGender !== 'all' && gender !== selectedGender) return false;
    if (selectedAge !== 'all' && profile.age !== selectedAge) return false;
    if (selectedUseCase !== 'all' && !profile.bestFor.includes(selectedUseCase as keyof typeof USE_CASE_LABELS)) return false;
    return true;
  }).sort((a, b) => b.average_rating - a.average_rating);

  const handlePlaySample = async (voice: BlandVoice) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
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
        const response = await fetch('/api/voices/sample', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voiceId: voice.id, text: getSampleText(voice), language: getLanguageCode(voice) }),
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
        if (ambientRef.current) ambientRef.current.pause();
      };
      await audio.play();
      setPlayingVoice(voice.id);
      if (ambientEnabled) startAmbient();
    } catch (error) {
      console.error('Error playing sample:', error);
    } finally {
      setLoadingVoice(null);
    }
  };

  const handleSelectVoice = (voiceId: string) => { onVoiceSelect(voiceId); onClose(); };

  const startAmbient = () => {
    if (!ambientRef.current) {
      const ambient = new Audio('/sounds/office-ambient.mp3');
      ambient.loop = true;
      ambient.volume = 0.40;
      ambientRef.current = ambient;
    }
    ambientRef.current.currentTime = Math.random() * 285;
    ambientRef.current.play().catch(() => {});
  };

  const toggleAmbient = () => {
    setAmbientEnabled(prev => {
      const next = !prev;
      if (next && playingVoice) startAmbient();
      else if (!next && ambientRef.current) ambientRef.current.pause();
      return next;
    });
  };

  const resetFilters = () => {
    setSelectedAccent('all');
    setSelectedCharacteristic('all');
    setSelectedGender('all');
    setSelectedAge('all');
    setSelectedUseCase('all');
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (ambientRef.current) { ambientRef.current.pause(); ambientRef.current = null; }
    };
  }, [isOpen]);

  if (!isOpen || !favoritesLoaded) return null;

  const containerSize = fullscreen
    ? 'w-full max-w-3xl max-h-[70vh] rounded-2xl'
    : 'w-full max-w-5xl max-h-[70vh] rounded-2xl';

  const wrapperClass = 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md';

  const modalContent = (
    <div className={wrapperClass} style={{ isolation: 'isolate', willChange: 'transform' }}>
      <div className={`relative bg-white shadow-2xl border border-[var(--border-default)] overflow-hidden flex flex-col ${containerSize}`} style={{ transform: 'translateZ(0)' }}>

        {/* ── Header: Tabs + Ambient + Close ── */}
        <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-[var(--border-default)]">
          <button
            onClick={() => setViewMode('recommended')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              viewMode === 'recommended'
                ? 'gradient-bg text-white shadow-sm'
                : 'text-[var(--color-neutral-500)] hover:text-[var(--color-ink)] hover:bg-[var(--color-neutral-100)]'
            }`}
          >
            Top Picks
          </button>
          <button
            onClick={() => setViewMode('explore')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              viewMode === 'explore'
                ? 'gradient-bg text-white shadow-sm'
                : 'text-[var(--color-neutral-500)] hover:text-[var(--color-ink)] hover:bg-[var(--color-neutral-100)]'
            }`}
          >
            All Voices
          </button>

          <div className="w-px h-5 bg-[var(--border-default)] mx-1" />

          {/* Ambient toggle */}
          <div className="relative group/ambient">
            <button
              onClick={toggleAmbient}
              className={`px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 ${
                ambientEnabled
                  ? 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100'
                  : 'text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)]'
              }`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
              Office
            </button>
            <div className="absolute bottom-full left-0 mb-2 w-52 bg-[var(--color-neutral-800)] text-white text-[11px] rounded-lg p-2.5 opacity-0 invisible group-hover/ambient:opacity-100 group-hover/ambient:visible transition-all z-50 shadow-xl leading-relaxed pointer-events-none">
              Hear how voices sound during a real call with office background noise.
              <div className="absolute top-full left-6 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-transparent border-t-[var(--color-neutral-800)]" />
            </div>
          </div>

          <div className="flex-1" />

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)] transition-all flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarGutter: 'stable', scrollbarWidth: 'thin' }}>
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
              {/* Filter pills */}
              <div className="flex flex-wrap items-center gap-1.5 mb-4">
                <PillSelect label="Gender" value={selectedGender} onChange={setSelectedGender} options={['male', 'female']} />
                <PillSelect label="Age" value={selectedAge} onChange={setSelectedAge} options={ages} displayMap={AGE_LABELS} />
                <PillSelect label="Accent" value={selectedAccent} onChange={setSelectedAccent} options={accents} />
                <PillSelect label="Style" value={selectedCharacteristic} onChange={setSelectedCharacteristic} options={characteristics} />
                <PillSelect label="Best For" value={selectedUseCase} onChange={setSelectedUseCase} options={useCases} displayMap={USE_CASE_LABELS} />
                {hasFilters && (
                  <button onClick={resetFilters} className="px-2 py-1 rounded-full text-[10px] font-bold text-[var(--color-primary-light)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all">
                    Clear
                  </button>
                )}
                <span className="text-[10px] text-[var(--color-neutral-400)] ml-auto">{filteredVoices.length} voice{filteredVoices.length !== 1 ? 's' : ''}</span>
              </div>
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

// ── Recommended Voices ──────────────────────────────────────────────
function RecommendedVoices({
  recommended, selectedVoiceId, playingVoice, loadingVoice, favorites,
  onPlaySample, onSelectVoice, onToggleFavorite,
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
    { key: 'american', label: 'American', flag: '🇺🇸', sub: '19 voices' },
    { key: 'british', label: 'British', flag: '🇬🇧', sub: '24 voices' },
    { key: 'australian', label: 'Australian', flag: '🇦🇺', sub: '5 voices' },
    { key: 'spanish-europe', label: 'Spanish (Spain)', flag: '🇪🇸', sub: '1 voice' },
    { key: 'spanish-latam', label: 'Spanish (LatAm)', flag: '🌎', sub: '2 voices' },
  ];

  return (
    <div className="space-y-5">
      {/* Favorites */}
      {favorites.size > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-[var(--color-neutral-500)] uppercase tracking-wide">Favorites ({favorites.size})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {favoriteVoices.map(voice => (
              <VoiceCard key={voice.id} voice={voice} isSelected={selectedVoiceId === voice.id} isPlaying={playingVoice === voice.id} isLoading={loadingVoice === voice.id} isFavorite={true} isRecommended={false} onPlay={() => onPlaySample(voice)} onSelect={() => onSelectVoice(voice.id)} onToggleFavorite={() => onToggleFavorite(voice.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Categories */}
      {categories.map(category => {
        const voices = [
          ...recommended[category.key as keyof typeof recommended].female,
          ...recommended[category.key as keyof typeof recommended].male,
        ];
        if (voices.length === 0) return null;
        return (
          <div key={category.key} className="space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{category.flag}</span>
              <h3 className="text-xs font-bold text-[var(--color-ink)] uppercase tracking-wide">{category.label}</h3>
              <span className="text-[10px] text-[var(--color-neutral-400)]">{category.sub}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {voices.map(voice => (
                <VoiceCard key={voice.id} voice={voice} isSelected={selectedVoiceId === voice.id} isPlaying={playingVoice === voice.id} isLoading={loadingVoice === voice.id} isFavorite={favorites.has(voice.id)} isRecommended={true} onPlay={() => onPlaySample(voice)} onSelect={() => onSelectVoice(voice.id)} onToggleFavorite={() => onToggleFavorite(voice.id)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── All Voices Grid ─────────────────────────────────────────────────
function AllVoicesGrid({
  voices, selectedVoiceId, playingVoice, loadingVoice, favorites,
  onPlaySample, onSelectVoice, onToggleFavorite, isRecommended,
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
    return <div className="text-center py-12 text-sm text-[var(--color-neutral-400)]">No voices match your filters</div>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
      {voices.map(voice => (
        <VoiceCard key={voice.id} voice={voice} isSelected={selectedVoiceId === voice.id} isPlaying={playingVoice === voice.id} isLoading={loadingVoice === voice.id} isFavorite={favorites.has(voice.id)} isRecommended={isRecommended(voice.id)} onPlay={() => onPlaySample(voice)} onSelect={() => onSelectVoice(voice.id)} onToggleFavorite={() => onToggleFavorite(voice.id)} />
      ))}
    </div>
  );
}

// ── Voice Card ──────────────────────────────────────────────────────
function VoiceCard({
  voice, isSelected, isPlaying, isLoading, isFavorite, isRecommended: _isRecommended,
  onPlay, onSelect, onToggleFavorite,
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
  const profile = getVoiceProfile(voice);
  const characteristics = getVoiceCharacteristics(voice);
  const ageLabel = AGE_LABELS[profile.age];

  return (
    <div
      className={`group/card p-2.5 rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 shadow-sm'
          : 'border-[var(--border-default)] hover:border-[var(--border-strong)] hover:shadow-sm'
      }`}
      onClick={onSelect}
    >
      {/* Row 1: Name + meta */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <h4 className="font-bold text-sm text-[var(--color-ink)] truncate">{voice.name}</h4>
          <span className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
            gender === 'female' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'
          }`}>
            {gender === 'female' ? '♀' : '♂'}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            className="p-0.5 rounded transition-colors hover:bg-[var(--surface-hover)]"
          >
            <svg className={`w-3.5 h-3.5 ${isFavorite ? 'text-yellow-400' : 'text-[var(--color-neutral-300)]'}`} fill={isFavorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
          {isSelected && (
            <span className="w-4 h-4 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Accent + Age + Tags */}
      <div className="flex flex-wrap items-center gap-1 mb-2">
        <span className="text-[10px] text-[var(--color-neutral-500)]">{category.accent}</span>
        <span className="text-[10px] text-[var(--color-neutral-300)]">/</span>
        <span className="text-[10px] text-[var(--color-neutral-500)]">{ageLabel}</span>
        {characteristics.slice(0, 2).map(c => (
          <span key={c} className="px-1.5 py-0.5 bg-[var(--color-deep-indigo)]/5 text-[var(--color-deep-indigo)] rounded text-[9px] font-medium">{c}</span>
        ))}
        {profile.bestFor.slice(0, 1).map(u => (
          <span key={u} className="px-1.5 py-0.5 bg-[var(--color-electric)]/10 text-[var(--color-electric)] rounded text-[9px] font-medium">{USE_CASE_LABELS[u]}</span>
        ))}
      </div>

      {/* Play button */}
      <button
        onClick={(e) => { e.stopPropagation(); onPlay(); }}
        disabled={isLoading}
        className={`w-full py-1.5 rounded-lg font-bold text-[11px] transition-all flex items-center justify-center gap-1.5 ${
          isPlaying
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'gradient-bg text-white hover:shadow-md'
        }`}
      >
        {isLoading ? (
          <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Loading...</>
        ) : isPlaying ? (
          <><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg> Stop</>
        ) : (
          <><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg> Play Sample</>
        )}
      </button>
    </div>
  );
}

// ── Pill Select ─────────────────────────────────────────────────────
function PillSelect({
  label, value, onChange, options, displayMap,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  displayMap?: Record<string, string>;
}) {
  const isActive = value !== 'all';
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`appearance-none px-2.5 py-1 rounded-full text-[10px] font-bold outline-none cursor-pointer transition-all border ${
        isActive
          ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
          : 'bg-white text-[var(--color-neutral-600)] border-[var(--border-default)] hover:border-[var(--border-strong)]'
      }`}
      style={{ backgroundImage: 'none' }}
    >
      <option value="all">{label}</option>
      {options.map(option => (
        <option key={option} value={option}>
          {displayMap ? displayMap[option] || option : option}
        </option>
      ))}
    </select>
  );
}
