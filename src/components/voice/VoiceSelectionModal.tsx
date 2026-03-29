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
type LayoutMode = 'grid' | 'list';

export default function VoiceSelectionModal({
  isOpen,
  onClose,
  selectedVoiceId,
  onVoiceSelect,
  fullscreen = false,
  defaultVoiceId: _defaultVoiceId,
}: VoiceSelectionModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('recommended');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const [audioCache, setAudioCache] = useState<Map<string, Blob>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [ambientEnabled, setAmbientEnabled] = useState(true);
  const ambientRef = useRef<HTMLAudioElement | null>(null);

  // Filters
  const [selectedAccent, setSelectedAccent] = useState<string>('all');
  const [selectedCharacteristic, setSelectedCharacteristic] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [selectedAge, setSelectedAge] = useState<string>('all');
  const [selectedUseCase, setSelectedUseCase] = useState<string>('all');

  // Favorites
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

  const isRecommendedVoice = (voiceId: string): boolean => {
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
    ? 'w-full max-w-3xl max-h-[75vh] rounded-2xl'
    : 'w-full max-w-5xl max-h-[75vh] rounded-2xl';

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" style={{ isolation: 'isolate', willChange: 'transform' }}>
      <div className={`relative bg-white shadow-2xl border border-[var(--border-default)] overflow-hidden flex flex-col ${containerSize}`} style={{ transform: 'translateZ(0)' }}>

        {/* ── Header ── */}
        <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-[var(--border-default)]">
          {/* Tabs */}
          <button
            onClick={() => setViewMode('recommended')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              viewMode === 'recommended'
                ? 'gradient-bg text-white shadow-sm'
                : 'text-[var(--color-neutral-500)] hover:text-[var(--color-ink)] hover:bg-[var(--color-neutral-100)]'
            }`}
          >Top Picks</button>
          <button
            onClick={() => setViewMode('explore')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              viewMode === 'explore'
                ? 'gradient-bg text-white shadow-sm'
                : 'text-[var(--color-neutral-500)] hover:text-[var(--color-ink)] hover:bg-[var(--color-neutral-100)]'
            }`}
          >All Voices</button>

          <div className="w-px h-5 bg-[var(--border-default)] mx-0.5" />

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
            {/* Tooltip opens DOWNWARD */}
            <div className="absolute top-full left-0 mt-2 w-52 bg-[var(--color-neutral-800)] text-white text-[11px] rounded-lg p-2.5 opacity-0 invisible group-hover/ambient:opacity-100 group-hover/ambient:visible transition-all z-50 shadow-xl leading-relaxed pointer-events-none">
              <div className="absolute bottom-full left-6 w-0 h-0 border-l-[5px] border-r-[5px] border-b-[5px] border-transparent border-b-[var(--color-neutral-800)]" />
              Hear how voices sound during a real call with office background noise.
            </div>
          </div>

          {/* Layout toggle (explore only) */}
          {viewMode === 'explore' && (
            <>
              <div className="w-px h-5 bg-[var(--border-default)] mx-0.5" />
              <button
                onClick={() => setLayoutMode(layoutMode === 'grid' ? 'list' : 'grid')}
                className="p-1.5 rounded-full text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)] transition-all"
                title={layoutMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
              >
                {layoutMode === 'grid' ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 5.25h16.5m-16.5-10.5h16.5" /></svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" /></svg>
                )}
              </button>
            </>
          )}

          <div className="flex-1" />

          {/* Close */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[var(--color-neutral-100)] border border-[var(--border-default)] text-[var(--color-neutral-500)] hover:text-white hover:bg-red-600 hover:border-red-500 transition-all duration-300 flex items-center justify-center group"
          >
            <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-1.5 mb-4">
                <FilterPill label="Gender" value={selectedGender} onChange={setSelectedGender} options={['male', 'female']} />
                <FilterPill label="Age" value={selectedAge} onChange={setSelectedAge} options={ages} displayMap={AGE_LABELS} />
                <FilterPill label="Accent" value={selectedAccent} onChange={setSelectedAccent} options={accents} />
                <FilterPill label="Style" value={selectedCharacteristic} onChange={setSelectedCharacteristic} options={characteristics} />
                <FilterPill label="Best For" value={selectedUseCase} onChange={setSelectedUseCase} options={useCases} displayMap={USE_CASE_LABELS} />
                {hasFilters && (
                  <button onClick={resetFilters} className="w-6 h-6 rounded-full bg-[var(--color-neutral-200)] hover:bg-red-100 text-[var(--color-neutral-500)] hover:text-red-500 flex items-center justify-center transition-all" title="Reset all filters">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
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
                isRecommended={isRecommendedVoice}
                layout={layoutMode}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );

  return typeof window !== 'undefined' ? createPortal(modalContent, document.body) : null;
}

// ── Recommended ─────────────────────────────────────────────────────
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
  const favoriteVoices = BLAND_VOICES.filter(v => favorites.has(v.id));

  const categories = [
    { key: 'american', label: 'American', flag: '🇺🇸', sub: '18 voices' },
    { key: 'british', label: 'British', flag: '🇬🇧', sub: '25 voices' },
    { key: 'australian', label: 'Australian', flag: '🇦🇺', sub: '5 voices' },
    { key: 'spanish-europe', label: 'Spanish (Spain)', flag: '🇪🇸', sub: '1 voice' },
    { key: 'spanish-latam', label: 'Spanish (Mexico)', flag: '🇲🇽', sub: '2 voices' },
  ];

  return (
    <div className="space-y-5">
      {favorites.size > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-[var(--color-neutral-500)] uppercase tracking-wide">Favorites ({favorites.size})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {favoriteVoices.map(v => (
              <VoiceCard key={v.id} voice={v} isSelected={selectedVoiceId === v.id} isPlaying={playingVoice === v.id} isLoading={loadingVoice === v.id} isFavorite onPlay={() => onPlaySample(v)} onSelect={() => onSelectVoice(v.id)} onToggleFavorite={() => onToggleFavorite(v.id)} />
            ))}
          </div>
        </div>
      )}
      {categories.map(cat => {
        const voices = [...recommended[cat.key as keyof typeof recommended].female, ...recommended[cat.key as keyof typeof recommended].male];
        if (!voices.length) return null;
        return (
          <div key={cat.key} className="space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{cat.flag}</span>
              <h3 className="text-xs font-bold text-[var(--color-ink)] uppercase tracking-wide">{cat.label}</h3>
              <span className="text-[10px] text-[var(--color-neutral-400)]">{cat.sub}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {voices.map(v => (
                <VoiceCard key={v.id} voice={v} isSelected={selectedVoiceId === v.id} isPlaying={playingVoice === v.id} isLoading={loadingVoice === v.id} isFavorite={favorites.has(v.id)} onPlay={() => onPlaySample(v)} onSelect={() => onSelectVoice(v.id)} onToggleFavorite={() => onToggleFavorite(v.id)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── All Voices ──────────────────────────────────────────────────────
function AllVoicesGrid({
  voices, selectedVoiceId, playingVoice, loadingVoice, favorites,
  onPlaySample, onSelectVoice, onToggleFavorite, isRecommended, layout,
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
  layout: LayoutMode;
}) {
  if (!voices.length) return <div className="text-center py-12 text-sm text-[var(--color-neutral-400)]">No voices match your filters</div>;

  if (layout === 'list') {
    return (
      <div className="space-y-1">
        {voices.map(v => (
          <VoiceListRow key={v.id} voice={v} isSelected={selectedVoiceId === v.id} isPlaying={playingVoice === v.id} isLoading={loadingVoice === v.id} isFavorite={favorites.has(v.id)} onPlay={() => onPlaySample(v)} onSelect={() => onSelectVoice(v.id)} onToggleFavorite={() => onToggleFavorite(v.id)} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {voices.map(v => (
        <VoiceCard key={v.id} voice={v} isSelected={selectedVoiceId === v.id} isPlaying={playingVoice === v.id} isLoading={loadingVoice === v.id} isFavorite={favorites.has(v.id)} onPlay={() => onPlaySample(v)} onSelect={() => onSelectVoice(v.id)} onToggleFavorite={() => onToggleFavorite(v.id)} />
      ))}
    </div>
  );
}

// ── Voice Card (Grid) ───────────────────────────────────────────────
function VoiceCard({
  voice, isSelected, isPlaying, isLoading, isFavorite,
  onPlay, onSelect, onToggleFavorite,
}: {
  voice: BlandVoice;
  isSelected: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  isFavorite: boolean;
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
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 shadow-sm'
          : 'border-[var(--border-default)] hover:border-[var(--border-strong)] hover:shadow-sm'
      }`}
      onClick={onSelect}
    >
      {/* Left: Info */}
      <div className="flex-1 min-w-0">
        {/* Name row */}
        <div className="flex items-center gap-1.5 mb-0.5">
          <h4 className="font-bold text-sm text-[var(--color-ink)] truncate">{voice.name}</h4>
          <span className={`text-sm ${gender === 'female' ? 'text-pink-400' : 'text-blue-400'}`}>
            {gender === 'female' ? '♀' : '♂'}
          </span>
          <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }} className="p-0.5 rounded hover:bg-[var(--surface-hover)] transition-colors shrink-0">
            <svg className={`w-4 h-4 ${isFavorite ? 'text-yellow-400' : 'text-[var(--color-neutral-300)]'}`} fill={isFavorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
          </button>
          {isSelected && (
            <span className="w-4 h-4 rounded-full bg-[var(--color-primary)] flex items-center justify-center shrink-0">
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </span>
          )}
        </div>
        {/* Accent / Age */}
        <p className="text-xs text-[var(--color-neutral-500)] mb-1.5">{category.accent} / {ageLabel}</p>
        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {characteristics.slice(0, 2).map(c => (
            <span key={c} className="px-2 py-0.5 bg-[var(--color-deep-indigo)]/5 text-[var(--color-deep-indigo)] rounded text-[11px] font-medium">{c}</span>
          ))}
          {profile.bestFor.slice(0, 1).map(u => (
            <span key={u} className="px-2 py-0.5 bg-[var(--color-electric)]/10 text-[var(--color-electric)] rounded text-[11px] font-medium">{USE_CASE_LABELS[u]}</span>
          ))}
        </div>
      </div>

      {/* Right: Play button */}
      <button
        onClick={(e) => { e.stopPropagation(); onPlay(); }}
        disabled={isLoading}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
          isPlaying
            ? 'bg-red-500 text-white hover:bg-red-600 shadow-md'
            : isLoading
              ? 'bg-[var(--color-neutral-200)] text-[var(--color-neutral-400)]'
              : 'gradient-bg text-white hover:shadow-lg hover:scale-105'
        }`}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : isPlaying ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>
    </div>
  );
}

// ── Voice List Row ──────────────────────────────────────────────────
function VoiceListRow({
  voice, isSelected, isPlaying, isLoading, isFavorite,
  onPlay, onSelect, onToggleFavorite,
}: {
  voice: BlandVoice;
  isSelected: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  isFavorite: boolean;
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
      className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all cursor-pointer ${
        isSelected
          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
          : 'border-transparent hover:bg-[var(--color-neutral-50)]'
      }`}
      onClick={onSelect}
    >
      {/* Play */}
      <button
        onClick={(e) => { e.stopPropagation(); onPlay(); }}
        disabled={isLoading}
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${
          isPlaying ? 'bg-red-500 text-white' : isLoading ? 'bg-[var(--color-neutral-200)] text-[var(--color-neutral-400)]' : 'gradient-bg text-white hover:shadow-md'
        }`}
      >
        {isLoading ? (
          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : isPlaying ? (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
        ) : (
          <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>

      {/* Name + gender */}
      <div className="flex items-center gap-1.5 w-28 shrink-0">
        <span className="font-bold text-sm text-[var(--color-ink)] truncate">{voice.name}</span>
        <span className={`text-[10px] shrink-0 ${gender === 'female' ? 'text-pink-500' : 'text-blue-500'}`}>{gender === 'female' ? '♀' : '♂'}</span>
      </div>

      {/* Accent / Age */}
      <span className="text-[10px] text-[var(--color-neutral-400)] w-24 shrink-0 hidden md:block">{category.accent} / {ageLabel}</span>

      {/* Tags */}
      <div className="flex-1 flex flex-wrap gap-1 min-w-0">
        {characteristics.slice(0, 2).map(c => (
          <span key={c} className="px-1.5 py-0.5 bg-[var(--color-deep-indigo)]/5 text-[var(--color-deep-indigo)] rounded text-[8px] font-medium leading-none">{c}</span>
        ))}
        {profile.bestFor.slice(0, 1).map(u => (
          <span key={u} className="px-1.5 py-0.5 bg-[var(--color-electric)]/10 text-[var(--color-electric)] rounded text-[8px] font-medium leading-none">{USE_CASE_LABELS[u]}</span>
        ))}
      </div>

      {/* Fav + Selected */}
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }} className="p-0.5 rounded hover:bg-[var(--surface-hover)] transition-colors">
          <svg className={`w-3.5 h-3.5 ${isFavorite ? 'text-yellow-400' : 'text-[var(--color-neutral-300)]'}`} fill={isFavorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
        </button>
        {isSelected && (
          <span className="w-4 h-4 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </span>
        )}
      </div>
    </div>
  );
}

// ── Filter Pill ─────────────────────────────────────────────────────
function FilterPill({
  label, value, onChange, options, displayMap,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  displayMap?: Record<string, string>;
}) {
  const isActive = value !== 'all';
  const displayValue = isActive ? (displayMap?.[value] || value) : label;
  return (
    <div className="relative flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none h-7 rounded-full text-[11px] font-bold outline-none cursor-pointer transition-all border text-center ${
          isActive
            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] pl-2.5 pr-6'
            : 'bg-white text-[var(--color-neutral-600)] border-[var(--border-default)] hover:border-[var(--border-strong)] px-2.5'
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
      {isActive && (
        <button
          onClick={(e) => { e.stopPropagation(); onChange('all'); }}
          className="absolute right-0.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-all"
        >
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );
}
