// lib/openai/tracker.ts
// Centralised OpenAI client factory + usage tracker.
//
// Usage:
//   const openai = getOpenAIClient('call_analysis');
//   const completion = await openai.chat.completions.create(...);
//   trackOpenAIUsage({ featureKey: 'call_analysis', model: 'gpt-4o-mini', ... }); // fire-and-forget

import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabase/service';

// ─── Feature key type ────────────────────────────────────────────────────────

export type FeatureKey =
  | 'call_analysis'
  | 'contact_analysis'
  | 'cali_ai'
  | 'onboarding'
  | 'demo_analysis';

// ─── Model helpers ───────────────────────────────────────────────────────────

/** Default model for standard features. Override via OPENAI_MODEL env var. */
export const getDefaultModel = (): string =>
  process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

/** Premium model for high-accuracy production call analysis. Override via OPENAI_MODEL_PREMIUM env var. */
export const getPremiumModel = (): string =>
  process.env.OPENAI_MODEL_PREMIUM ?? process.env.OPENAI_MODEL ?? 'gpt-4o';

// ─── Human-readable labels for each feature key ──────────────────────────────

export const KEY_LABELS: Record<FeatureKey, string> = {
  call_analysis:    'Default Key',
  demo_analysis:    'Default Key',
  contact_analysis: 'Default Key',
  onboarding:       'Default Key',
  cali_ai:          'Cali AI Key',
};

// ─── Env var mapping: feature → preferred key env var ────────────────────────

const KEY_MAP: Record<FeatureKey, string> = {
  call_analysis:    'OPENAI_API_KEY',
  demo_analysis:    'OPENAI_API_KEY',
  contact_analysis: 'OPENAI_API_KEY',
  onboarding:       'OPENAI_API_KEY',
  cali_ai:          'OPENAI_API_KEY_CALI_AI',
};

// ─── Model pricing (USD per 1M tokens, as of early 2026) ─────────────────────

interface ModelPricing {
  inputPerM: number;   // USD per 1M input tokens
  outputPerM: number;  // USD per 1M output tokens
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-4o':                  { inputPerM: 2.50, outputPerM: 10.00 },
  'gpt-4o-2024-11-20':       { inputPerM: 2.50, outputPerM: 10.00 },
  'gpt-4o-mini':             { inputPerM: 0.15, outputPerM: 0.60 },
  'gpt-4o-mini-2024-07-18':  { inputPerM: 0.15, outputPerM: 0.60 },
};

// Default fallback pricing (gpt-4o-mini rates)
const DEFAULT_PRICING: ModelPricing = { inputPerM: 0.15, outputPerM: 0.60 };

// ─── calculateOpenAICost ──────────────────────────────────────────────────────

/**
 * Returns estimated cost in USD for a given model + token counts.
 * Falls back to gpt-4o-mini pricing for unknown models.
 */
export function calculateOpenAICost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  const cost =
    (inputTokens / 1_000_000) * pricing.inputPerM +
    (outputTokens / 1_000_000) * pricing.outputPerM;
  return Math.round(cost * 1_000_000) / 1_000_000; // round to 6 decimal places
}

// ─── getOpenAIClient ──────────────────────────────────────────────────────────

/**
 * Returns an OpenAI SDK instance using the per-feature key if set,
 * falling back to OPENAI_API_KEY. For cali_ai, tries OPENAI_API_KEY_CALI_AI
 * first for rate limit isolation, then falls back to OPENAI_API_KEY.
 */
export function getOpenAIClient(feature: FeatureKey): OpenAI {
  const preferredKeyVar = KEY_MAP[feature];
  const apiKey =
    process.env[preferredKeyVar] || process.env.OPENAI_API_KEY;
  return new OpenAI({ apiKey });
}

/**
 * Returns the label of the API key that would be used for a given feature.
 * Useful for logging/display without exposing the actual key value.
 */
export function getApiKeyLabel(feature: FeatureKey): string {
  const preferredKeyVar = KEY_MAP[feature];
  const usingSpecificKey = !!process.env[preferredKeyVar];
  if (usingSpecificKey) {
    return KEY_LABELS[feature];
  }
  return 'Default Key';
}

// ─── trackOpenAIUsage ────────────────────────────────────────────────────────

export interface TrackOpenAIUsageParams {
  featureKey: FeatureKey;
  model: string;
  inputTokens: number;
  outputTokens: number;
  openaiRequestId?: string;
  companyId?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget: inserts a row into openai_usage_logs.
 * NEVER throws. NEVER blocks the caller.
 */
export function trackOpenAIUsage(params: TrackOpenAIUsageParams): void {
  const {
    featureKey,
    model,
    inputTokens,
    outputTokens,
    openaiRequestId,
    companyId,
    userId,
    metadata,
  } = params;

  const totalTokens = inputTokens + outputTokens;
  const costUsd = calculateOpenAICost(model, inputTokens, outputTokens);
  const apiKeyLabel = getApiKeyLabel(featureKey);

  // Intentionally not awaited — fire-and-forget
  void (async () => {
    try {
      await supabaseAdmin.from('openai_usage_logs' as never).insert({
        feature_key:      featureKey,
        api_key_label:    apiKeyLabel,
        model,
        input_tokens:     inputTokens,
        output_tokens:    outputTokens,
        total_tokens:     totalTokens,
        cost_usd:         costUsd,
        openai_request_id: openaiRequestId ?? null,
        company_id:       companyId ?? null,
        user_id:          userId ?? null,
        metadata:         metadata ?? {},
      } as never);
    } catch (err) {
      // Non-fatal: log to console but never affect the caller
      console.error('[openai/tracker] Failed to log usage:', err);
    }
  })();
}
