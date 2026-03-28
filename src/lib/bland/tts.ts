// lib/bland/tts.ts
// Bland AI Text-to-Speech via /v1/speak endpoint
// Global caching in Supabase Storage + cost tracking in tts_usage_logs

import { supabaseAdminRaw } from '@/lib/supabase/service';

const BLAND_API_URL = 'https://api.bland.ai/v1/speak';
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

// ── Generate TTS audio via Bland AI /v1/speak ───────────────────────
export async function generateTTS(voiceId: string, text: string): Promise<{ audio: Buffer; cost: number; characters: number }> {
  const blandApiKey = process.env.BLAND_API_KEY;
  if (!blandApiKey) {
    throw new Error('BLAND_API_KEY not configured');
  }

  const response = await fetch(BLAND_API_URL, {
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bland TTS error (${response.status}): ${errorText}`);
  }

  // Read cost from Bland's response header
  const cost = parseFloat(response.headers.get('x-cost') || '0');
  const audioArrayBuffer = await response.arrayBuffer();
  const audio = Buffer.from(audioArrayBuffer);

  return { audio, cost, characters: text.length };
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
  companyId: string | null;
  userId: string | null;
}): Promise<TTSResult> {
  const { voiceId, voiceName, text, companyId, userId } = params;

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

  // 3. Generate via Bland /v1/speak
  const { audio, cost, characters } = await generateTTS(voiceId, text);

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
