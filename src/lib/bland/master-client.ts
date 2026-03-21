/**
 * Bland AI Master Client — Single API Key Architecture
 *
 * All calls go through ONE master Bland API key. No sub-accounts.
 * Company isolation is handled entirely in Supabase (company_id on every record).
 * Bland sees a single flat pool of calls — we correlate via metadata UUIDs.
 *
 * This replaces the old sub-account architecture (subaccount-manager.ts).
 */

const BLAND_API_URL = 'https://api.bland.ai/v1';
const BLAND_MASTER_KEY = process.env.BLAND_API_KEY!;

// Cost per minute from Bland — depends on your plan (Start=$0.14, Build=$0.12, Scale=$0.11)
// Default to highest tier cost ($0.14) for conservative cost estimates when env var not set.
// Set BLAND_COST_PER_MINUTE in production to match your actual Bland plan rate.
export const BLAND_COST_PER_MINUTE = Number(process.env.BLAND_COST_PER_MINUTE || '0.14');

// ================================================================
// Plan Detection — Fetch current Bland plan from /v1/me
// ================================================================

export interface BlandAccountInfo {
  status: string;
  balance: number;
  totalCalls: number;
  plan: string | null;
  dailyCap: number;
  hourlyCap: number;
  concurrentCap: number;
  voiceClones: number;
  costPerMinute: number;
  transferRate: number;
}

/**
 * Known Bland plan limits (as of Dec 2025 pricing update).
 * Used to infer plan from API response or set defaults.
 */
const BLAND_PLAN_LIMITS: Record<string, {
  dailyCap: number;
  hourlyCap: number;
  concurrentCap: number;
  voiceClones: number;
  costPerMinute: number;
  transferRate: number;
}> = {
  start: {
    dailyCap: 100,
    hourlyCap: 100,
    concurrentCap: 10,
    voiceClones: 1,
    costPerMinute: 0.14,
    transferRate: 0.05,
  },
  build: {
    dailyCap: 2000,
    hourlyCap: 1000,
    concurrentCap: 50,
    voiceClones: 5,
    costPerMinute: 0.12,
    transferRate: 0.04,
  },
  scale: {
    dailyCap: 5000,
    hourlyCap: 1000,
    concurrentCap: 100,
    voiceClones: 15,
    costPerMinute: 0.11,
    transferRate: 0.03,
  },
  enterprise: {
    dailyCap: 999999,
    hourlyCap: 999999,
    concurrentCap: 999999,
    voiceClones: 999,
    costPerMinute: 0.09,
    transferRate: 0.02,
  },
};

/**
 * Infer the Bland plan from the org data returned by /v1/me or /v1/org.
 * Bland doesn't always return the plan name explicitly, so we also check
 * rate limits and other indicators.
 */
function inferPlanFromOrgData(data: Record<string, unknown>): string {
  // Direct plan field
  if (typeof data.org_plan === 'string') return data.org_plan.toLowerCase();
  if (typeof data.plan === 'string') return data.plan.toLowerCase();

  // Check rate_limit to infer
  const rateLimit = (data.org_rate_limit as number) || 0;
  if (rateLimit >= 100) return 'scale';
  if (rateLimit >= 50) return 'build';

  return 'start';
}

/**
 * Fetch account info from Bland AI master account.
 * Tries /v1/me first, falls back to /v1/org.
 */
export async function getBlandAccountInfo(): Promise<BlandAccountInfo> {
  if (!BLAND_MASTER_KEY) {
    throw new Error('BLAND_API_KEY not configured');
  }

  const endpoints = [
    { url: `${BLAND_API_URL}/me`, type: 'me' },
    { url: `${BLAND_API_URL}/org`, type: 'org' },
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        method: 'GET',
        headers: { 'Authorization': BLAND_MASTER_KEY },
      });

      if (!response.ok) continue;

      const data = await response.json();
      const plan = inferPlanFromOrgData(data);
      const limits = BLAND_PLAN_LIMITS[plan] || BLAND_PLAN_LIMITS.start;

      // Extract balance from various possible response shapes
      let balance = 0;
      if (typeof data.billing?.current_balance === 'number') {
        balance = data.billing.current_balance;
      } else if (typeof data.credits === 'number') {
        balance = data.credits;
      } else if (typeof data.balance === 'number') {
        balance = data.balance;
      }

      return {
        status: data.status || 'unknown',
        balance,
        totalCalls: data.total_calls || 0,
        plan,
        dailyCap: limits.dailyCap,
        hourlyCap: limits.hourlyCap,
        concurrentCap: limits.concurrentCap,
        voiceClones: limits.voiceClones,
        costPerMinute: limits.costPerMinute,
        transferRate: limits.transferRate,
      };
    } catch {
      continue;
    }
  }

  // Fallback if all endpoints fail — use env-based defaults
  const fallbackPlan = BLAND_COST_PER_MINUTE <= 0.11 ? 'scale'
    : BLAND_COST_PER_MINUTE <= 0.12 ? 'build' : 'start';
  const limits = BLAND_PLAN_LIMITS[fallbackPlan];

  return {
    status: 'unknown',
    balance: 0,
    totalCalls: 0,
    plan: fallbackPlan,
    ...limits,
  };
}

// ================================================================
// Call Dispatch — Single master API key
// ================================================================

export interface BlandCallPayload {
  phone_number: string;
  task: string;
  voice?: string;
  first_sentence?: string;
  wait_for_greeting?: boolean;
  record?: boolean;
  max_duration?: number;
  voicemail_action?: 'leave_message' | 'hangup' | 'ignore';
  voicemail_message?: string;
  answered_by_enabled?: boolean;
  webhook?: string;
  metadata?: Record<string, unknown>;
  from?: string; // Dedicated number if company has one
  background_track?: string;
  model?: string;
  language?: string;
  temperature?: number;
}

export interface BlandCallResult {
  success: boolean;
  callId?: string;
  message?: string;
  error?: string;
  statusCode?: number;
}

/**
 * Dispatch a call via the master Bland API key.
 * The `from` field is set if the company has a dedicated number.
 */
export async function dispatchCall(payload: BlandCallPayload): Promise<BlandCallResult> {
  if (!BLAND_MASTER_KEY) {
    return { success: false, error: 'BLAND_API_KEY not configured', statusCode: 500 };
  }

  try {
    const blandPayload: Record<string, unknown> = {
      phone_number: payload.phone_number,
      task: payload.task,
      voice: payload.voice || 'maya',
      wait_for_greeting: payload.wait_for_greeting ?? true,
      record: payload.record ?? true,
      max_duration: payload.max_duration || 5,
      voicemail_action: payload.voicemail_action || 'leave_message',
      answered_by_enabled: payload.answered_by_enabled ?? true,
      model: payload.model || 'enhanced',
      language: payload.language || 'en',
      temperature: payload.temperature ?? 0.7,
      background_track: payload.background_track || 'office',
    };

    if (payload.first_sentence) blandPayload.first_sentence = payload.first_sentence;
    if (payload.voicemail_message) blandPayload.voicemail_message = payload.voicemail_message;
    if (payload.webhook) blandPayload.webhook = payload.webhook;
    if (payload.metadata) blandPayload.metadata = payload.metadata;
    // Dedicated number: set the `from` field so Bland uses this number as caller ID
    if (payload.from) blandPayload.from = payload.from;

    const response = await fetch(`${BLAND_API_URL}/calls`, {
      method: 'POST',
      headers: {
        'Authorization': BLAND_MASTER_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(blandPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'Bland API error',
        statusCode: response.status,
      };
    }

    return {
      success: true,
      callId: data.call_id,
      message: data.message || 'Call initiated',
    };
  } catch (error) {
    console.error('[bland/master-client] dispatchCall error:', error);
    return { success: false, error: 'Failed to connect to Bland API', statusCode: 500 };
  }
}

/**
 * Get call details from Bland via master key.
 * Company ownership must be verified at the API route level (via call_logs.company_id).
 */
export async function getCallDetails(callId: string): Promise<Record<string, unknown> | null> {
  if (!BLAND_MASTER_KEY) return null;

  try {
    const response = await fetch(`${BLAND_API_URL}/calls/${callId}`, {
      method: 'GET',
      headers: { 'Authorization': BLAND_MASTER_KEY },
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Get the master API key (for admin use only — never expose to clients).
 */
export function getMasterApiKey(): string {
  return BLAND_MASTER_KEY;
}

/**
 * Get the Bland plan limits (for admin monitoring).
 */
export function getBlandPlanLimits(plan: string) {
  return BLAND_PLAN_LIMITS[plan] || BLAND_PLAN_LIMITS.start;
}

export { BLAND_PLAN_LIMITS };
