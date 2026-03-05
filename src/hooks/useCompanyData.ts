import { useAPI } from './useSWRFetch';
import type { SWRConfiguration } from 'swr';

// ============================================================================
// Billing hooks
// ============================================================================

interface BillingSubscriptionResponse {
  subscription: {
    id: string;
    plan: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      price_monthly: number;
      price_annual: number;
      minutes_included: number;
      max_call_duration: number;
      price_per_extra_minute: number;
      max_users: number;
      max_concurrent_calls: number;
      max_calls_per_hour: number | null;
      max_calls_per_day: number | null;
      features: string[];
    };
    billing_cycle: 'monthly' | 'annual';
    status: string;
    current_period_end: string;
    overage_enabled: boolean;
    overage_budget: number;
    overage_spent: number;
    overage_alert_level: number;
  } | null;
  usage: {
    minutes_used: number;
    minutes_included: number;
    overage_minutes: number;
  } | null;
}

export function useBillingSubscription(companyId: string | null, config?: SWRConfiguration) {
  return useAPI<BillingSubscriptionResponse>(
    companyId ? `/api/billing/subscription?companyId=${companyId}` : null,
    config
  );
}

export function useBillingPlans(currency: string | null, config?: SWRConfiguration) {
  return useAPI(
    currency ? `/api/billing/plans?currency=${currency}` : null,
    config
  );
}

// ============================================================================
// Admin hooks
// ============================================================================

export function useAdminFinances(period: string, config?: SWRConfiguration) {
  return useAPI<{ finances: unknown[] }>(
    `/api/admin/finances?period=${period}`,
    config
  );
}

// ============================================================================
// Contact hooks
// ============================================================================

export function useContactDetail(contactId: string | null, config?: SWRConfiguration) {
  return useAPI(
    contactId ? `/api/contacts/${contactId}` : null,
    config
  );
}

// ============================================================================
// Integration hooks
// ============================================================================

export function useHubSpotContacts(connected: boolean, config?: SWRConfiguration) {
  return useAPI<{ contacts: unknown[]; mappings: unknown[] }>(
    connected ? `/api/integrations/hubspot/contacts?limit=200` : null,
    config
  );
}
