// lib/bland/tts.ts
// Bland AI Text-to-Speech via /v1/speak endpoint
// Global caching in Supabase Storage + cost tracking in tts_usage_logs

import { supabaseAdminRaw } from '@/lib/supabase/service';
import { BlandVoice } from '@/lib/voices/types';
import { determineCategory, determineGender } from '@/lib/voices/voice-utils';

const BLAND_SPEAK_URL = 'https://api.bland.ai/v1/speak';
const BLAND_SAMPLE_URL = 'https://api.bland.ai/v1/voices'; // fallback: /v1/voices/{id}/sample
const STORAGE_BUCKET = 'voice-samples';
const MAX_GENERATIONS_PER_COMPANY = 51; // Aligned with total voice count

// ── Bland Curated (Beige) voice IDs ─────────────────────────────────
// These are Bland's native voices that run on the Beige TTS engine.
// All other voices are community clones using the legacy engine.
const BLAND_CURATED_IDS = new Set([
  'b93a4030-8391-4c54-a35a-7983a3e7a16a', // Keelan
  'db93116d-b24b-48a6-863c-84afed20cac4', // Maeve
  '013813f0-e96f-4c55-8c2c-b36a6d4d7916', // Max
  '4f5222b2-230f-419b-b776-faa063392584', // Trixie
  'bdcad772-f6a8-4b63-95ca-3bae0d92f87e', // Chris
  '78c8543e-e5fe-448e-8292-20a7b8c45247', // Harper
  '27bd6e08-1d57-4ba8-a290-dcd58bfe78f2', // Violette
  'f380ad98-4ed6-4b9e-a0fa-37ba0ca9f558', // Marnie
  '5aff7b0c-92d7-4ce6-a502-39d33a401808', // Isabelle
  'f97aa643-19b2-4a65-8677-b41839be72bc', // Oscar
  'ef8a4528-12f1-41d3-b9d9-c6a4a6d4a6df', // Henry
  '035117be-dfb1-4f46-92d3-59255ac4d96b', // Heather
  '1c2e3ee2-9f5e-43e6-b128-a34b0af46b27', // Lucas
  '8aca12e4-a938-413a-88eb-c756ae91655a', // Sophie
  '63092d46-e154-4e8b-96e9-de85245e82ab', // Liam
  'd512400e-a3eb-4c01-9dfb-620be159cf91', // Casey
  '3f222e4d-2624-4bf7-849f-9841ce872015', // Clara
  'bc97a31e-b0b8-49e5-bcb8-393fcc6a86ea', // Willow
  '26b40c81-22af-4ff3-9821-2c8c6fd38c4d', // Ethan
  '31477d18-71c7-4ee0-b41f-d0714689536d', // Destiny
  '6277266e-01eb-44c6-b965-438566ef7076', // Alexandra
  '7b05d026-0d58-4d09-9887-dc45b4b12dcb', // Alyssa
  '955a02fb-57e1-418c-865c-d9c7bf9b209a', // Brady
  'e54a409c-daa9-4ee6-a954-2d81dec3476b', // Alena
  '77a066a7-0a91-4aa8-bf62-4745b00ff167', // Pryce
  'be3bffbd-c1f1-49a0-8575-58073bfcf9c4', // Gabriella
  '35571497-da9d-414b-b1b9-b1e68ef41f97', // Paige
  '922d6173-4567-480c-b9a0-bc7c421ad43d', // Amelia
]);

export function isBlandCurated(voiceId: string): boolean {
  return BLAND_CURATED_IDS.has(voiceId);
}

// ── Build descriptive filename for storage ──────────────────────────
// Format: name-language-accent-type-id.wav
// Example: david-english-american-cloned-ff2c405b.wav
//          max-english-british-curated-013813f0.wav
export function buildSampleFilename(voice: BlandVoice): string {
  const category = determineCategory(voice);
  const lang = category.language.toLowerCase();
  const accent = category.accent.toLowerCase().replace(/\s+/g, '-');
  const type = isBlandCurated(voice.id) ? 'curated' : 'cloned';
  const shortId = voice.id.split('-')[0]; // First segment of UUID
  const name = voice.name.trim().toLowerCase().replace(/\s+/g, '-');
  return `${name}-${lang}-${accent}-${type}-${shortId}.wav`;
}

interface TTSResult {
  audio: Buffer;
  fromCache: boolean;
  cost: number;
  characters: number;
}

// ── Check if a cached sample exists in Supabase Storage ─────────────
export async function getCachedSample(voice: BlandVoice): Promise<Buffer | null> {
  const filename = buildSampleFilename(voice);
  try {
    const { data, error } = await supabaseAdminRaw
      .storage
      .from(STORAGE_BUCKET)
      .download(filename);

    if (error || !data) return null;

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

// ── Get public URL for a cached sample ──────────────────────────────
export function getCachedSampleUrl(voice: BlandVoice): string {
  const filename = buildSampleFilename(voice);
  const { data } = supabaseAdminRaw
    .storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filename);

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
export async function cacheSample(voice: BlandVoice, audio: Buffer): Promise<void> {
  const filename = buildSampleFilename(voice);
  // Convert Buffer to Uint8Array for Supabase Storage compatibility
  const uint8 = new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength);
  const { error } = await supabaseAdminRaw
    .storage
    .from(STORAGE_BUCKET)
    .upload(filename, uint8, {
      contentType: 'application/octet-stream',
      upsert: true,
    });

  if (error) {
    console.error(`[TTS Cache] FAILED to upload ${filename} (${audio.byteLength} bytes):`, error.message, error);
  } else {
    console.log(`[TTS Cache] Stored ${filename} (${audio.byteLength} bytes)`);
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
  voice: BlandVoice;
  text: string;
  language?: string;
  companyId: string | null;
  userId: string | null;
}): Promise<TTSResult> {
  const { voice, text, language, companyId, userId } = params;

  // 1. Check global cache first
  const cached = await getCachedSample(voice);
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
  const { audio, cost, characters } = await generateTTS(voice.id, text, language);

  // 4. Cache globally (fire and forget — don't block response)
  cacheSample(voice, audio).catch(err =>
    console.warn('Background cache failed:', err)
  );

  // 5. Log the cost
  logTTSUsage({
    companyId,
    userId,
    voiceId: voice.id,
    voiceName: voice.name,
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
