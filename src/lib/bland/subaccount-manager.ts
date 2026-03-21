/**
 * Bland AI — Single Master API Key Architecture (V2)
 *
 * REPLACES the old sub-account architecture. No more sub-accounts.
 * All calls go through ONE master Bland API key.
 * Company isolation is handled entirely in Supabase (company_id).
 *
 * This file now exports compatibility wrappers that:
 * - No-op where sub-account operations were needed
 * - Log billing events for audit trail
 * - Preserve the same export interface for backward compatibility
 *
 * Credit management is now internal bookkeeping only — Bland master
 * account balance is managed manually, not redistributed.
 */

import { supabaseAdmin } from '@/lib/supabase/service';

// Re-export from master-client for backward compatibility
export { BLAND_COST_PER_MINUTE } from './master-client';

/**
 * Calculate credit amount for a given plan's minutes.
 * Now used for internal bookkeeping / unit economics only.
 */
export function calculateCreditAmount(minutesIncluded: number): number {
  const costPerMinute = Number(process.env.BLAND_COST_PER_MINUTE || '0.14');
  const CREDIT_BUFFER_PERCENT = 0.05;
  const baseCost = minutesIncluded * costPerMinute;
  const withBuffer = baseCost * (1 + CREDIT_BUFFER_PERCENT);
  return Math.ceil(withBuffer * 100) / 100;
}

/**
 * NO-OP: Sub-accounts are no longer used.
 * Now simply ensures the company has the master API key stored for compatibility.
 * The `bland_api_key` field in company_settings stores the master key for all companies.
 */
export async function createBlandSubAccount(
  companyId: string,
  _companyName: string
): Promise<{ subAccountId: string; apiKey: string }> {
  const masterKey = process.env.BLAND_API_KEY!;

  // Store master key for this company (all companies share the same key)
  await supabaseAdmin
    .from('company_settings')
    .update({
      bland_api_key: masterKey,
      bland_subaccount_id: 'master', // Marker indicating single-key architecture
    })
    .eq('company_id', companyId);

  console.log(`[bland] Company ${companyId} configured with master API key (single-key architecture)`);

  return { subAccountId: 'master', apiKey: masterKey };
}

/**
 * NO-OP: Credits are no longer redistributed between sub-accounts.
 * Now just logs a billing event for bookkeeping purposes.
 */
export async function allocateBlandCredits(
  companyId: string,
  minutesIncluded: number,
  idempotencyKey?: string
): Promise<{ allocated: number; minutesCovered: number }> {
  // Idempotency check
  if (idempotencyKey) {
    const { data: existing } = await supabaseAdmin
      .from('billing_events')
      .select('id')
      .eq('company_id', companyId)
      .eq('event_type', 'bland_credits_allocated')
      .filter('event_data->>idempotency_key', 'eq', idempotencyKey)
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.log(`[bland] Credits already logged for company ${companyId} (key: ${idempotencyKey}), skipping`);
      return { allocated: 0, minutesCovered: minutesIncluded };
    }
  }

  const creditAmount = calculateCreditAmount(minutesIncluded);

  // Log for bookkeeping only — no actual Bland API call
  await supabaseAdmin.from('billing_events').insert({
    company_id: companyId,
    event_type: 'bland_credits_allocated',
    event_data: {
      amount: creditAmount,
      minutes_covered: minutesIncluded,
      architecture: 'single_master_key',
      note: 'Bookkeeping only — no sub-account credit transfer',
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    },
    minutes_consumed: 0,
    cost_usd: creditAmount,
  });

  console.log(`[bland] Logged ${minutesIncluded} min allocation for company ${companyId} (bookkeeping, no sub-account transfer)`);

  return { allocated: creditAmount, minutesCovered: minutesIncluded };
}

/**
 * NO-OP: No credits to reclaim without sub-accounts.
 * Returns 0 for backward compatibility.
 */
export async function getBlandCreditBalance(_companyId: string): Promise<number> {
  // In single-key architecture, balance is on the master account (shared)
  // Use getBlandAccountInfo() from master-client.ts for actual balance
  return 0;
}

/**
 * NO-OP: No credits to reclaim without sub-accounts.
 */
export async function reclaimBlandCredits(_companyId: string): Promise<number> {
  return 0;
}

/**
 * NO-OP: No sub-account to deactivate.
 * Clears the company's API key reference for cleanliness.
 */
export async function deactivateBlandSubAccount(companyId: string): Promise<void> {
  await supabaseAdmin
    .from('company_settings')
    .update({
      bland_api_key: null,
      bland_subaccount_id: null,
    })
    .eq('company_id', companyId);

  await supabaseAdmin.from('billing_events').insert({
    company_id: companyId,
    event_type: 'bland_subaccount_deactivated',
    event_data: {
      architecture: 'single_master_key',
      note: 'Company API key reference cleared',
    },
    minutes_consumed: 0,
    cost_usd: 0,
  });

  console.log(`[bland] Company ${companyId} API key reference cleared`);
}

/**
 * NO-OP: No credits to redistribute on upgrade.
 * Logs the event for bookkeeping.
 */
export async function handlePlanUpgradeCredits(
  companyId: string,
  oldMinutesIncluded: number,
  newMinutesIncluded: number,
  _daysRemainingInPeriod: number,
  _totalDaysInPeriod: number
): Promise<{ allocated: number; minutesCovered: number }> {
  if (newMinutesIncluded <= oldMinutesIncluded) {
    return { allocated: 0, minutesCovered: 0 };
  }

  await supabaseAdmin.from('billing_events').insert({
    company_id: companyId,
    event_type: 'plan_upgrade_credits',
    event_data: {
      old_minutes: oldMinutesIncluded,
      new_minutes: newMinutesIncluded,
      architecture: 'single_master_key',
      note: 'Bookkeeping only — usage tracked in usage_tracking table',
    },
    minutes_consumed: 0,
    cost_usd: 0,
  });

  return { allocated: 0, minutesCovered: newMinutesIncluded - oldMinutesIncluded };
}

/**
 * NO-OP: No credits to cycle.
 * Usage reset is handled by resetUsageForNewPeriod() in usage-tracker.ts.
 */
export async function handleCycleRenewalCredits(
  companyId: string,
  minutesIncluded: number,
  idempotencyKey?: string
): Promise<{ allocated: number; minutesCovered: number }> {
  return await allocateBlandCredits(companyId, minutesIncluded, idempotencyKey);
}
