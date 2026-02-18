// app/(app)/billing/page.tsx
import { createServerClient } from '@/lib/supabase/server';
import BillingPage from '@/components/billing/BillingPage';

export default async function Billing() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user!.id)
    .single();

  // Fetch current subscription with plan details
  const { data: subscription } = await supabase
    .from('company_subscriptions')
    .select(`
      id, billing_cycle, status, current_period_start, current_period_end,
      cancel_at_period_end, trial_end,
      subscription_plans (name, minutes_included)
    `)
    .eq('company_id', userData!.company_id)
    .eq('status', 'active')
    .single();

  // Fetch usage tracking
  const { data: usage } = await supabase
    .from('usage_tracking')
    .select('id, period_start, period_end, minutes_used, minutes_included, overage_minutes, total_cost, created_at')
    .eq('company_id', userData!.company_id)
    .order('period_start', { ascending: false })
    .limit(12);

  // Fetch billing history
  const { data: billingHistory } = await supabase
    .from('billing_history')
    .select('id, amount, currency, description, status, invoice_url, payment_method, billing_date, created_at')
    .eq('company_id', userData!.company_id)
    .order('billing_date', { ascending: false })
    .limit(50);

  return (
    <BillingPage
      usage={usage || []}
      billingHistory={billingHistory || []}
      subscription={subscription}
    />
  );
}
