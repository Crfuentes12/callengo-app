/**
 * Overage Manager Service — DEPRECATED
 *
 * Overage billing has been removed from Callengo.
 * Free trial users get 15 minutes and must upgrade.
 * Paid users use their plan-included minutes with no overage option.
 *
 * This file is kept as a stub to avoid import errors during transition.
 * All functions are no-ops that log deprecation warnings.
 */

export async function enableOverage(_params: {
  companyId: string;
  budget?: number;
}): Promise<void> {
  console.warn('[DEPRECATED] enableOverage called — overage has been removed');
}

export async function disableOverage(_companyId: string): Promise<void> {
  console.warn('[DEPRECATED] disableOverage called — overage has been removed');
}

export async function updateOverageBudget(_params: {
  companyId: string;
  budget: number;
}): Promise<void> {
  console.warn('[DEPRECATED] updateOverageBudget called — overage has been removed');
}

export async function syncAllMeteredUsage(): Promise<void> {
  console.warn('[DEPRECATED] syncAllMeteredUsage called — overage has been removed');
}
