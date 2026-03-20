/**
 * Bland AI Sub-Account Manager
 * Handles creation, credit allocation, recovery, and lifecycle of Bland sub-accounts.
 *
 * AUDIT FIX: This service was completely missing. The bland_subaccount_id column existed
 * in company_settings but no code created or managed sub-accounts.
 */

import { supabaseAdmin } from '@/lib/supabase/service';

const BLAND_API_URL = 'https://api.bland.ai/v1';
const BLAND_MASTER_KEY = process.env.BLAND_API_KEY!;

// Cost per minute from Bland — should match the actual Bland plan (Start/Build/Scale)
// Default to Scale plan ($0.11/min). Override via env var if on a different plan.
const BLAND_COST_PER_MINUTE = Number(process.env.BLAND_COST_PER_MINUTE || '0.11');

// Buffer percentage for credit allocation (5% extra to absorb rounding)
const CREDIT_BUFFER_PERCENT = 0.05;

interface SubAccountCreateResult {
  subAccountId: string;
  apiKey: string;
}

interface CreditAllocationResult {
  allocated: number;
  minutesCovered: number;
}

/**
 * Create a Bland AI sub-account for a company.
 * Should be called AFTER Stripe confirms payment (webhook: checkout.session.completed).
 */
export async function createBlandSubAccount(
  companyId: string,
  companyName: string
): Promise<SubAccountCreateResult> {
  // Check if sub-account already exists
  const { data: settings } = await supabaseAdmin
    .from('company_settings')
    .select('bland_subaccount_id, bland_api_key')
    .eq('company_id', companyId)
    .single();

  if (settings?.bland_subaccount_id && settings?.bland_api_key) {
    console.log(`Sub-account already exists for company ${companyId}`);
    return {
      subAccountId: settings.bland_subaccount_id,
      apiKey: settings.bland_api_key,
    };
  }

  try {
    const response = await fetch(`${BLAND_API_URL}/accounts`, {
      method: 'POST',
      headers: {
        'Authorization': BLAND_MASTER_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: companyName,
        // Bland sub-accounts inherit the parent's per-minute rate
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Bland sub-account creation failed: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const subAccountId = data.account_id || data.id;
    const apiKey = data.api_key || data.key;

    if (!subAccountId || !apiKey) {
      throw new Error(`Bland API returned incomplete sub-account data: ${JSON.stringify(data)}`);
    }

    // Save to company_settings
    await supabaseAdmin
      .from('company_settings')
      .update({
        bland_subaccount_id: subAccountId,
        bland_api_key: apiKey,
      })
      .eq('company_id', companyId);

    console.log(`✅ Bland sub-account created for company ${companyId}: ${subAccountId}`);

    return { subAccountId, apiKey };
  } catch (error) {
    console.error(`❌ Failed to create Bland sub-account for company ${companyId}:`, error);
    throw error;
  }
}

/**
 * Calculate credit amount for a given plan's minutes.
 * Formula: credits = (minutes × cost_per_minute) × (1 + buffer)
 */
export function calculateCreditAmount(minutesIncluded: number): number {
  const baseCost = minutesIncluded * BLAND_COST_PER_MINUTE;
  const withBuffer = baseCost * (1 + CREDIT_BUFFER_PERCENT);
  // Round up to nearest cent
  return Math.ceil(withBuffer * 100) / 100;
}

/**
 * Allocate Bland credits to a company's sub-account.
 * Called on:
 *  - Initial subscription (checkout.session.completed)
 *  - Monthly renewal (invoice.payment_succeeded with billing_reason=subscription_cycle)
 *  - Plan upgrade (differential credits for remaining period)
 *  - Calls Booster activation (additional 225 minutes worth of credits)
 */
export async function allocateBlandCredits(
  companyId: string,
  minutesIncluded: number
): Promise<CreditAllocationResult> {
  const { data: settings } = await supabaseAdmin
    .from('company_settings')
    .select('bland_subaccount_id')
    .eq('company_id', companyId)
    .single();

  if (!settings?.bland_subaccount_id) {
    console.warn(`No Bland sub-account for company ${companyId} — skipping credit allocation`);
    return { allocated: 0, minutesCovered: 0 };
  }

  const creditAmount = calculateCreditAmount(minutesIncluded);

  try {
    const response = await fetch(
      `${BLAND_API_URL}/accounts/${settings.bland_subaccount_id}/credits/add`,
      {
        method: 'POST',
        headers: {
          'Authorization': BLAND_MASTER_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: creditAmount,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Bland credit allocation failed: ${JSON.stringify(error)}`);
    }

    // Log the allocation
    await supabaseAdmin.from('billing_events').insert({
      company_id: companyId,
      event_type: 'bland_credits_allocated',
      event_data: {
        amount: creditAmount,
        minutes_covered: minutesIncluded,
        cost_per_minute: BLAND_COST_PER_MINUTE,
        buffer_percent: CREDIT_BUFFER_PERCENT,
      },
      minutes_consumed: 0,
      cost_usd: creditAmount,
    });

    console.log(`✅ Allocated $${creditAmount} Bland credits for company ${companyId} (${minutesIncluded} min)`);

    return { allocated: creditAmount, minutesCovered: minutesIncluded };
  } catch (error) {
    console.error(`❌ Failed to allocate Bland credits for company ${companyId}:`, error);
    throw error;
  }
}

/**
 * Get the current Bland credit balance for a company's sub-account.
 */
export async function getBlandCreditBalance(companyId: string): Promise<number> {
  const { data: settings } = await supabaseAdmin
    .from('company_settings')
    .select('bland_subaccount_id')
    .eq('company_id', companyId)
    .single();

  if (!settings?.bland_subaccount_id) {
    return 0;
  }

  try {
    const response = await fetch(
      `${BLAND_API_URL}/accounts/${settings.bland_subaccount_id}`,
      {
        method: 'GET',
        headers: { 'Authorization': BLAND_MASTER_KEY },
      }
    );

    if (!response.ok) return 0;

    const data = await response.json();
    return data.credits || data.balance || 0;
  } catch {
    return 0;
  }
}

/**
 * Reclaim unused Bland credits from a company's sub-account back to the master account.
 * Called before:
 *  - Monthly renewal top-up (reclaim leftover, then allocate fresh)
 *  - Cancellation
 *  - Downgrade
 */
export async function reclaimBlandCredits(companyId: string): Promise<number> {
  const { data: settings } = await supabaseAdmin
    .from('company_settings')
    .select('bland_subaccount_id')
    .eq('company_id', companyId)
    .single();

  if (!settings?.bland_subaccount_id) {
    return 0;
  }

  try {
    // Get current balance
    const balance = await getBlandCreditBalance(companyId);
    if (balance <= 0) return 0;

    // Reclaim credits back to master account
    const response = await fetch(
      `${BLAND_API_URL}/accounts/${settings.bland_subaccount_id}/credits/remove`,
      {
        method: 'POST',
        headers: {
          'Authorization': BLAND_MASTER_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: balance,
        }),
      }
    );

    if (!response.ok) {
      console.warn(`Failed to reclaim credits for company ${companyId}`);
      return 0;
    }

    // Log the reclaim
    await supabaseAdmin.from('billing_events').insert({
      company_id: companyId,
      event_type: 'bland_credits_reclaimed',
      event_data: {
        amount: balance,
        reason: 'cycle_renewal_or_lifecycle',
      },
      minutes_consumed: 0,
      cost_usd: balance,
    });

    console.log(`✅ Reclaimed $${balance} Bland credits from company ${companyId}`);
    return balance;
  } catch (error) {
    console.error(`❌ Failed to reclaim Bland credits for company ${companyId}:`, error);
    return 0;
  }
}

/**
 * Deactivate a company's Bland sub-account.
 * Called on subscription cancellation or company deletion.
 */
export async function deactivateBlandSubAccount(companyId: string): Promise<void> {
  // Reclaim any remaining credits first
  await reclaimBlandCredits(companyId);

  const { data: settings } = await supabaseAdmin
    .from('company_settings')
    .select('bland_subaccount_id')
    .eq('company_id', companyId)
    .single();

  if (!settings?.bland_subaccount_id) return;

  try {
    // Bland doesn't have a "deactivate" endpoint — we zero out credits
    // and mark the sub-account as inactive in our DB
    await supabaseAdmin
      .from('company_settings')
      .update({
        bland_subaccount_id: null,
        bland_api_key: null,
      })
      .eq('company_id', companyId);

    await supabaseAdmin.from('billing_events').insert({
      company_id: companyId,
      event_type: 'bland_subaccount_deactivated',
      event_data: {
        subaccount_id: settings.bland_subaccount_id,
      },
      minutes_consumed: 0,
      cost_usd: 0,
    });

    console.log(`✅ Deactivated Bland sub-account for company ${companyId}`);
  } catch (error) {
    console.error(`❌ Failed to deactivate Bland sub-account for company ${companyId}:`, error);
  }
}

/**
 * Handle plan upgrade: allocate differential credits for remaining period.
 */
export async function handlePlanUpgradeCredits(
  companyId: string,
  oldMinutesIncluded: number,
  newMinutesIncluded: number,
  daysRemainingInPeriod: number,
  totalDaysInPeriod: number
): Promise<CreditAllocationResult> {
  if (newMinutesIncluded <= oldMinutesIncluded) {
    return { allocated: 0, minutesCovered: 0 };
  }

  const extraMinutes = newMinutesIncluded - oldMinutesIncluded;
  // Pro-rate the extra minutes for remaining period
  const proRatedMinutes = Math.ceil(extraMinutes * (daysRemainingInPeriod / totalDaysInPeriod));

  return await allocateBlandCredits(companyId, proRatedMinutes);
}

/**
 * Cycle renewal: reclaim old credits, allocate fresh for new period.
 */
export async function handleCycleRenewalCredits(
  companyId: string,
  minutesIncluded: number
): Promise<CreditAllocationResult> {
  // Step 1: Reclaim any unused credits from the previous cycle
  await reclaimBlandCredits(companyId);

  // Step 2: Allocate fresh credits for the new cycle
  return await allocateBlandCredits(companyId, minutesIncluded);
}

// Export the cost per minute for use in unit economics calculations
export { BLAND_COST_PER_MINUTE };
