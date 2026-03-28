// lib/bland/tts.ts
// Bland AI Text-to-Speech via /v1/speak endpoint
// Global caching in Supabase Storage + cost tracking in tts_usage_logs

import { supabaseAdminRaw } from '@/lib/supabase/service';

const BLAND_SPEAK_URL = 'https://api.bland.ai/v1/speak';
const BLAND_SAMPLE_URL = 'https://api.bland.ai/v1/voices'; // fallback: /v1/voices/{id}/sample
const STORAGE_BUCKET = 'voice-samples';
const MAX_GENERATIONS_PER_COMPANY = 51; // Aligned with total voice count

interface TTSResult {
  audio: Buffer;
  fromCache: boolean;
  cost: number;
  characters: number;
}

// ── Check if a cached sample exists in Supabase Storage ─────────────
export async function getCachedSample(voiceId: string): Promise<Buffer | null> {
  try {
    const { data, error } = await supabaseAdminRaw
      .storage
      .from(STORAGE_BUCKET)
      .download(`${voiceId}.wav`);

    if (error || !data) return null;

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

// ── Get public URL for a cached sample ──────────────────────────────
export function getCachedSampleUrl(voiceId: string): string {
  const { data } = supabaseAdminRaw
    .storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(`${voiceId}.wav`);

  return data.publicUrl;
}

// ── Check how many uncached TTS generations a company has used ──────
export async function getCompanyGenerationCount(companyId: string): Promise<number> {
  const { count, error } = await supabaseAdminRaw
    .from('tts_usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('cached', false);

  if (error) {
    console.warn('Failed to check TTS generation count:', error.message);
    return 0;
  }

  return count || 0;
}

// ── Check if company is within generation limit ─────────────────────
export async function canGenerate(companyId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const used = await getCompanyGenerationCount(companyId);
  return {
    allowed: used < MAX_GENERATIONS_PER_COMPANY,
    used,
    limit: MAX_GENERATIONS_PER_COMPANY,
  };
}

// ── Generate TTS audio via Bland AI ─────────────────────────────────
// Tries /v1/speak first (Beige voices). Falls back to /v1/voices/{id}/sample
// for cloned voices that aren't supported by the /v1/speak endpoint.
export async function generateTTS(voiceId: string, text: string, language?: string): Promise<{ audio: Buffer; cost: number; characters: number }> {
  const blandApiKey = process.env.BLAND_API_KEY;
  if (!blandApiKey) {
    throw new Error('BLAND_API_KEY not configured');
  }

  // Try /v1/speak first (works for Beige voices, per-character billing)
  const speakResponse = await fetch(BLAND_SPEAK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'authorization': blandApiKey,
    },
    body: JSON.stringify({
      voice_id: voiceId,
      text,
    }),
  });

  if (speakResponse.ok) {
    const cost = parseFloat(speakResponse.headers.get('x-cost') || '0');
    const audioArrayBuffer = await speakResponse.arrayBuffer();
    return { audio: Buffer.from(audioArrayBuffer), cost, characters: text.length };
  }

  // Fallback to /v1/voices/{id}/sample for cloned/non-Beige voices
  const sampleResponse = await fetch(`${BLAND_SAMPLE_URL}/${voiceId}/sample`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'authorization': blandApiKey,
    },
    body: JSON.stringify({
      text,
      language: language || 'ENG',
    }),
  });

  if (!sampleResponse.ok) {
    const errorText = await sampleResponse.text();
    throw new Error(`Bland TTS error (${sampleResponse.status}): ${errorText}`);
  }

  const cost = parseFloat(sampleResponse.headers.get('x-cost') || '0');
  const audioArrayBuffer = await sampleResponse.arrayBuffer();
  return { audio: Buffer.from(audioArrayBuffer), cost, characters: text.length };
}

// ── Store audio in Supabase Storage global cache ────────────────────
export async function cacheSample(voiceId: string, audio: Buffer): Promise<void> {
  const { error } = await supabaseAdminRaw
    .storage
    .from(STORAGE_BUCKET)
    .upload(`${voiceId}.wav`, audio, {
      contentType: 'audio/wav',
      upsert: true,
    });

  if (error) {
    console.warn(`Failed to cache voice sample ${voiceId}:`, error.message);
  }
}

// ── Log TTS generation cost ─────────────────────────────────────────
export async function logTTSUsage(params: {
  companyId: string | null;
  userId: string | null;
  voiceId: string;
  voiceName: string;
  characters: number;
  cost: number;
  cached: boolean;
}): Promise<void> {
  const { error } = await supabaseAdminRaw
    .from('tts_usage_logs')
    .insert({
      company_id: params.companyId,
      user_id: params.userId,
      voice_id: params.voiceId,
      voice_name: params.voiceName,
      characters_count: params.characters,
      cost_usd: params.cost,
      cached: params.cached,
    });

  if (error) {
    console.warn('Failed to log TTS usage:', error.message);
  }
}

// ── Full flow: get sample (cached or generate) ──────────────────────
export async function getVoiceSample(params: {
  voiceId: string;
  voiceName: string;
  text: string;
  language?: string;
  companyId: string | null;
  userId: string | null;
}): Promise<TTSResult> {
  const { voiceId, voiceName, text, language, companyId, userId } = params;

  // 1. Check global cache first
  const cached = await getCachedSample(voiceId);
  if (cached) {
    return { audio: cached, fromCache: true, cost: 0, characters: 0 };
  }

  // 2. Check company generation limit
  if (companyId) {
    const { allowed, used, limit } = await canGenerate(companyId);
    if (!allowed) {
      throw new GenerationLimitError(used, limit);
    }
  }

  // 3. Generate via Bland /v1/speak (with fallback to /v1/voices/{id}/sample)
  const { audio, cost, characters } = await generateTTS(voiceId, text, language);

  // 4. Cache globally (fire and forget — don't block response)
  cacheSample(voiceId, audio).catch(err =>
    console.warn('Background cache failed:', err)
  );

  // 5. Log the cost
  logTTSUsage({
    companyId,
    userId,
    voiceId,
    voiceName,
    characters,
    cost,
    cached: false,
  }).catch(err =>
    console.warn('Background TTS log failed:', err)
  );

  return { audio, fromCache: false, cost, characters };
}

// ── Custom error for generation limit ───────────────────────────────
export class GenerationLimitError extends Error {
  public used: number;
  public limit: number;

  constructor(used: number, limit: number) {
    super(`TTS generation limit reached: ${used}/${limit}`);
    this.name = 'GenerationLimitError';
    this.used = used;
    this.limit = limit;
  }
}
