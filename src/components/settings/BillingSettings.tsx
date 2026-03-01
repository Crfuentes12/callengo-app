'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStripe } from '@/hooks/useStripe';
import { getPlanFeatures } from '@/config/plan-features';
import { useUserCurrency } from '@/hooks/useAutoGeolocation';

interface Plan {
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
}

interface Subscription {
  id: string;
  plan: Plan;
  billing_cycle: 'monthly' | 'annual';
  status: string;
  current_period_end: string;
  overage_enabled: boolean;
  overage_budget: number;
  overage_spent: number;
  overage_alert_level: number;
}

interface Usage {
  minutes_used: number;
  minutes_included: number;
  overage_minutes: number;
}

interface BillingSettingsProps {
  companyId: string;
}

const CURRENCY_RATES: Record<string, { symbol: string; multiplier: number }> = {
  USD: { symbol: '$', multiplier: 1 },
  EUR: { symbol: '\u20AC', multiplier: 0.92 },
  GBP: { symbol: '\u00A3', multiplier: 0.79 },
};

const CANCELLATION_REASONS = [
  { id: 'too_expensive', label: 'The pricing is too high for my budget' },
  { id: 'missing_features', label: 'Missing features I need' },
  { id: 'found_alternative', label: 'I found a better alternative' },
  { id: 'not_needed', label: 'I no longer need this service' },
  { id: 'too_complicated', label: 'Too complicated to use' },
  { id: 'poor_quality', label: 'Call quality or accuracy issues' },
  { id: 'temporary_pause', label: 'I need to pause temporarily' },
  { id: 'other', label: 'Other reason' },
];

type CancelStep = 'hidden' | 'confirm' | 'feedback' | 'retention' | 'final';

export default function BillingSettings({ companyId }: BillingSettingsProps) {
  const { createCheckoutSession, openBillingPortal, loading: stripeLoading } = useStripe();
  const { currency } = useUserCurrency();
  const searchParams = useSearchParams();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const [success, setSuccess] = useState('');
  const [showOverageModal, setShowOverageModal] = useState(false);
  const [overageBudget, setOverageBudget] = useState(10);

  // Billing details expandable section
  const [showBillingDetails, setShowBillingDetails] = useState(false);

  // Cancellation flow state
  const [cancelStep, setCancelStep] = useState<CancelStep>('hidden');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelDetails, setCancelDetails] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [retentionEligible, setRetentionEligible] = useState(false);
  const [retentionApplied, setRetentionApplied] = useState(false);
  const [retentionLoading, setRetentionLoading] = useState(false);

  const formatPrice = (usdPrice: number) => {
    const rate = CURRENCY_RATES[currency] || CURRENCY_RATES.USD;
    const converted = Math.round(usdPrice * rate.multiplier);
    return `${rate.symbol}${converted}`;
  };

  const formatPriceWithDecimals = (usdPrice: number) => {
    const rate = CURRENCY_RATES[currency] || CURRENCY_RATES.USD;
    const converted = usdPrice * rate.multiplier;
    const formatted = converted.toFixed(2).replace(/\.?0+$/, '');
    return `${rate.symbol}${formatted}`;
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [plansRes, subRes] = await Promise.all([
        fetch('/api/billing/plans'),
        fetch(`/api/billing/subscription?companyId=${companyId}`)
      ]);
      if (plansRes.ok) setPlans(await plansRes.json());
      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscription(subData.subscription);
        setUsage(subData.usage);
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const isSuccess = searchParams.get('success') === 'true';
    if (!isSuccess) return;
    setSuccess('Your subscription has been upgraded successfully!');
    let attempts = 0;
    const maxAttempts = 6;
    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/billing/subscription?companyId=${companyId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.subscription?.plan?.slug !== 'free') {
            setSubscription(data.subscription);
            setUsage(data.usage);
            clearInterval(pollInterval);
          }
        }
      } catch { /* ignore */ }
      if (attempts >= maxAttempts) clearInterval(pollInterval);
    }, 2000);
    return () => clearInterval(pollInterval);
  }, [searchParams, companyId]);

  const handleChangePlan = async (planId: string) => {
    const selectedPlan = plans.find(p => p.id === planId);
    if (selectedPlan?.slug === 'enterprise') {
      window.open('mailto:sales@callengo.ai?subject=Enterprise Plan Inquiry', '_blank');
      return;
    }
    try {
      setChanging(true);
      setSuccess('');
      await createCheckoutSession({ planId, billingCycle, currency });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to start checkout process');
      setChanging(false);
    }
  };

  const handleToggleOverage = async (enabled: boolean) => {
    if (!subscription) return;
    if (enabled && overageBudget <= 0) { alert('Please set a budget greater than $0'); return; }
    try {
      const response = await fetch('/api/billing/update-overage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, subscriptionId: subscription.id, enabled, budget: enabled ? overageBudget : 0 })
      });
      if (response.ok) {
        setSuccess(enabled ? 'Overage enabled successfully' : 'Overage disabled');
        await fetchData();
        setShowOverageModal(false);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || 'Failed to update overage'}`);
      }
    } catch (error) {
      console.error('Error updating overage:', error);
      alert('Failed to update overage settings');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // ── Cancellation flow handlers ──

  const handleStartCancel = () => {
    setCancelStep('confirm');
  };

  const handleConfirmCancel = () => {
    setCancelStep('feedback');
  };

  const handleSubmitFeedback = async () => {
    if (!cancelReason) return;
    setCancelLoading(true);

    try {
      // Save feedback
      const res = await fetch('/api/billing/cancellation-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: cancelReason,
          reason_details: cancelDetails || null,
          outcome: 'pending',
        }),
      });

      const data = await res.json();
      if (data.feedback_id) {
        setFeedbackId(data.feedback_id);
      }

      // If reason is "too expensive", check retention eligibility
      if (cancelReason === 'too_expensive') {
        try {
          const retRes = await fetch('/api/billing/check-retention');
          const retData = await retRes.json();
          if (retData.eligible) {
            setRetentionEligible(true);
            setCancelStep('retention');
            setCancelLoading(false);
            return;
          }
        } catch (e) {
          console.error('Error checking retention:', e);
        }
      }

      // Not eligible or different reason → proceed to final step
      setCancelStep('final');
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleAcceptRetention = async () => {
    setRetentionLoading(true);
    try {
      const res = await fetch('/api/billing/check-retention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback_id: feedbackId }),
      });
      const data = await res.json();
      if (data.status === 'applied') {
        setRetentionApplied(true);
        // Update feedback outcome
        if (feedbackId) {
          await fetch('/api/billing/cancellation-feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reason: cancelReason,
              reason_details: cancelDetails,
              outcome: 'retained_with_offer',
            }),
          });
        }
      }
    } catch (error) {
      console.error('Error applying retention:', error);
    } finally {
      setRetentionLoading(false);
    }
  };

  const handleDeclineRetention = () => {
    setCancelStep('final');
  };

  const handleFinalCancel = async () => {
    // Update feedback to cancelled
    if (feedbackId) {
      try {
        await fetch('/api/billing/cancellation-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: cancelReason,
            reason_details: cancelDetails,
            outcome: 'cancelled',
          }),
        });
      } catch { /* best effort */ }
    }
    // Redirect to Stripe portal for actual cancellation
    await openBillingPortal();
  };

  const handleCloseCancelFlow = () => {
    setCancelStep('hidden');
    setCancelReason('');
    setCancelDetails('');
    setFeedbackId(null);
    setRetentionEligible(false);
    setRetentionApplied(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-500">Loading billing information...</p>
        </div>
      </div>
    );
  }

  const currentPlan = subscription?.plan;
  const isFreePlan = currentPlan?.slug === 'free';
  const isPaidPlan = currentPlan && !isFreePlan;
  const usagePercent = usage ? Math.min((usage.minutes_used / usage.minutes_included) * 100, 100) : 0;
  const getApproxCalls = (minutes: number, avgDuration: number = 3) => Math.floor(minutes / avgDuration);

  // Plan tier ordering for filtering higher tiers only
  const PLAN_TIER_ORDER: Record<string, number> = { free: 0, starter: 1, business: 2, teams: 3, enterprise: 4 };
  const currentTier = PLAN_TIER_ORDER[currentPlan?.slug || 'free'] ?? 0;
  const higherPlans = plans.filter(p => (PLAN_TIER_ORDER[p.slug] ?? 0) > currentTier);
  const comparisonPlans = plans.filter(p => (PLAN_TIER_ORDER[p.slug] ?? 0) >= currentTier);

  // ══════════════════════════════════════════════════
  //  PAID PLAN VIEW — Management + upgrade options
  // ══════════════════════════════════════════════════
  if (isPaidPlan && subscription) {
    const planFeatures = getPlanFeatures(currentPlan.slug);

    return (
      <div className="space-y-6">
        {success && (
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-sm text-emerald-700 font-medium">{success}</p>
          </div>
        )}

        {/* Retention success banner */}
        {retentionApplied && (
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
            </div>
            <div>
              <p className="text-sm text-emerald-700 font-semibold">Your free month has been applied!</p>
              <p className="text-xs text-emerald-600 mt-0.5">Your next billing cycle will be on us. Enjoy!</p>
            </div>
          </div>
        )}

        {/* ── Your Subscription Card ── */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4">Your Subscription</h3>
          <div className="gradient-bg-subtle border border-slate-200 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-2xl font-bold text-slate-900">{currentPlan.name}</h4>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                    {subscription.status === 'trial' ? 'Trial' : 'Active'}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{currentPlan.description}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-slate-900">
                  {formatPrice(subscription.billing_cycle === 'monthly' ? currentPlan.price_monthly : currentPlan.price_annual)}
                </div>
                <div className="text-sm text-slate-500">/{subscription.billing_cycle === 'monthly' ? 'month' : 'year'}</div>
              </div>
            </div>

            {usage && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">Minutes Used</span>
                  <span className="font-bold text-slate-900">{usage.minutes_used.toLocaleString()} / {usage.minutes_included.toLocaleString()} min</span>
                </div>
                <div className="h-2 bg-white/80 rounded-full overflow-hidden">
                  <div className="h-full gradient-bg transition-all duration-500" style={{ width: `${usagePercent}%` }} />
                </div>
                <p className="text-xs text-slate-600">~{getApproxCalls(usage.minutes_used)} calls made · ~{getApproxCalls(usage.minutes_included - usage.minutes_used)} remaining</p>
              </div>
            )}

            {subscription.current_period_end && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-600">Renews on <span className="font-semibold text-slate-900">{formatDate(subscription.current_period_end)}</span></p>
              </div>
            )}
          </div>
        </div>

        {/* ── Overage Controls (right after subscription) ── */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4">Overage Controls</h3>
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">Auto-Overage Billing</h4>
                <p className="text-sm text-slate-600">Continue making calls even after your monthly minutes run out</p>
              </div>
              <button onClick={() => setShowOverageModal(true)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${subscription.overage_enabled ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                {subscription.overage_enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            {subscription.overage_enabled && (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center"><span className="text-sm text-slate-600">Overage Budget</span><span className="text-sm font-semibold text-slate-900">{formatPrice(subscription.overage_budget)}</span></div>
                <div className="flex justify-between items-center"><span className="text-sm text-slate-600">Overage Spent</span><span className="text-sm font-semibold text-slate-900">{formatPrice(subscription.overage_spent)}</span></div>
                <div className="space-y-1">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-500 ${subscription.overage_spent >= subscription.overage_budget ? 'bg-red-500' : subscription.overage_spent >= subscription.overage_budget * 0.85 ? 'bg-orange-500' : 'bg-green-500'}`} style={{ width: `${Math.min((subscription.overage_spent / subscription.overage_budget) * 100, 100)}%` }} />
                  </div>
                  <p className="text-xs text-slate-500">{formatPrice(subscription.overage_budget - subscription.overage_spent)} remaining</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Plans Comparison (current + upgrades) ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Your Plan</h3>
              <p className="text-sm text-slate-500">{higherPlans.length > 0 ? 'Compare and upgrade your plan' : 'Your current plan details'}</p>
            </div>
            <div className="inline-flex items-center gap-2 p-1 bg-slate-100 rounded-lg">
              <button onClick={() => setBillingCycle('monthly')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${billingCycle === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Monthly</button>
              <button onClick={() => setBillingCycle('annual')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${billingCycle === 'annual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                Annual<span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Save up to 12%</span>
              </button>
            </div>
          </div>

          <div className={`grid gap-4 ${comparisonPlans.length === 1 ? 'grid-cols-1 max-w-md' : comparisonPlans.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : comparisonPlans.length === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
            {comparisonPlans.map((plan) => {
              const isEnterprise = plan.slug === 'enterprise';
              const isCurrent = plan.slug === currentPlan.slug;
              const isRecommended = !isCurrent && higherPlans.length > 0 && plan === higherPlans[0];
              const monthlyPrice = isEnterprise ? plan.price_monthly : (billingCycle === 'monthly' ? plan.price_monthly : plan.price_annual);
              const yearlyTotal = plan.price_annual * 12;
              const discountPercent = !isEnterprise && billingCycle === 'annual' ? Math.round(((plan.price_monthly * 12 - yearlyTotal) / (plan.price_monthly * 12)) * 100) : 0;

              return (
                <div key={plan.id} className="relative flex pt-6">
                  {isCurrent && (
                    <div className="absolute -top-0 left-1/2 -translate-x-1/2 z-10">
                      <div className="bg-slate-800 text-white text-[9px] font-bold px-3 py-1 rounded-full shadow-md uppercase tracking-wide whitespace-nowrap">CURRENT PLAN</div>
                    </div>
                  )}
                  {isRecommended && (
                    <div className="absolute -top-0 left-1/2 -translate-x-1/2 z-10">
                      <div className="gradient-bg text-white text-[9px] font-bold px-3 py-1 rounded-full shadow-md uppercase tracking-wide whitespace-nowrap">RECOMMENDED</div>
                    </div>
                  )}
                  <div className={`rounded-xl p-5 transition-all flex flex-col h-full w-full ${isCurrent ? 'border-2 border-slate-800 bg-white shadow-lg' : isRecommended ? 'border-2 border-[var(--color-primary)] bg-white shadow-xl shadow-[var(--color-primary)]/10' : 'border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'}`}>
                    <div className="mb-3">
                      <h4 className="text-lg font-bold text-slate-900 mb-1">{plan.name}</h4>
                      <p className="text-xs text-slate-600">{plan.description}</p>
                    </div>
                    <div className="mb-4 pb-4 border-b border-slate-100">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-slate-900">{formatPrice(monthlyPrice)}</span>
                        {!isEnterprise && <span className="text-sm text-slate-500">/mo</span>}
                        {isEnterprise && <span className="text-sm text-slate-500">/mo</span>}
                      </div>
                      {!isEnterprise && billingCycle === 'annual' && <div className="text-xs text-slate-500 mt-1">{formatPrice(yearlyTotal)}/year</div>}
                      {!isEnterprise && billingCycle === 'annual' && discountPercent > 0 && (
                        <div className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 mt-1">Save {discountPercent}%</div>
                      )}
                    </div>
                    <div className="flex-grow mb-4">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">What&apos;s included</p>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-start gap-2"><svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span className="text-slate-700"><strong>{plan.minutes_included.toLocaleString()}</strong> min/month</span></div>
                        <div className="flex items-start gap-2"><svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span className="text-slate-700"><strong>{plan.max_call_duration} min</strong> max call</span></div>
                        <div className="flex items-start gap-2"><svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span className="text-slate-700"><strong>{plan.max_concurrent_calls}</strong> concurrent calls</span></div>
                        <div className="flex items-start gap-2"><svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span className="text-slate-700"><strong>{plan.max_users === -1 ? 'Unlimited' : plan.max_users}</strong> users</span></div>
                        {getPlanFeatures(plan.slug).slice(0, 5).map((feature, idx) => (
                          <div key={idx} className="flex items-start gap-2"><svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span className="text-slate-700">{feature}</span></div>
                        ))}
                      </div>
                    </div>
                    {isCurrent ? (
                      <div className="w-full py-2.5 rounded-lg text-sm font-semibold text-center text-slate-500 bg-slate-100 mt-auto">
                        Current Plan
                      </div>
                    ) : (
                      <button
                        onClick={() => handleChangePlan(plan.id)}
                        disabled={changing}
                        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all mt-auto ${isRecommended ? 'gradient-bg text-white hover:opacity-90 shadow-md' : isEnterprise ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white hover:from-purple-700 hover:to-fuchsia-700' : 'bg-slate-800 text-white hover:bg-slate-900'}`}
                      >
                        {changing ? 'Processing...' : isEnterprise ? 'Contact Sales' : `Upgrade to ${plan.name}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Billing & Account Details (expandable, deeply buried) ── */}
        <div className="border-t border-slate-100 pt-6">
          <button
            onClick={() => setShowBillingDetails(!showBillingDetails)}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <svg className={`w-4 h-4 transition-transform ${showBillingDetails ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span>Billing & Account Details</span>
          </button>

          {showBillingDetails && (
            <div className="mt-4 space-y-6 animate-in slide-in-from-top-2">
              {/* Payment Information (no Stripe portal button) */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                  Payment Information
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Payment Method</span>
                    <span className="text-sm text-slate-900 font-medium">Managed via Stripe</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Billing Cycle</span>
                    <span className="text-sm text-slate-900 font-medium capitalize">{subscription.billing_cycle}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Current Plan</span>
                    <span className="text-sm text-slate-900 font-medium">{currentPlan.name}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Amount</span>
                    <span className="text-sm text-slate-900 font-medium">
                      {formatPrice(subscription.billing_cycle === 'monthly' ? currentPlan.price_monthly : currentPlan.price_annual)}/{subscription.billing_cycle === 'monthly' ? 'mo' : 'yr'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Next Payment</span>
                    <span className="text-sm text-slate-900 font-medium">{subscription.current_period_end ? formatDate(subscription.current_period_end) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Status</span>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">Active</span>
                  </div>
                </div>
              </div>

              {/* Account Details */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Account Details
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Account Type</span>
                    <span className="text-sm text-slate-900 font-medium">{currentPlan.name} Plan</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Max Users</span>
                    <span className="text-sm text-slate-900 font-medium">{currentPlan.max_users === -1 ? 'Unlimited' : currentPlan.max_users}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Minutes Included</span>
                    <span className="text-sm text-slate-900 font-medium">{currentPlan.minutes_included.toLocaleString()}/mo</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Max Call Duration</span>
                    <span className="text-sm text-slate-900 font-medium">{currentPlan.max_call_duration} min</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Concurrent Calls</span>
                    <span className="text-sm text-slate-900 font-medium">{currentPlan.max_concurrent_calls}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">Overage Rate</span>
                    <span className="text-sm text-slate-900 font-medium">{formatPriceWithDecimals(currentPlan.price_per_extra_minute)}/min</span>
                  </div>
                  {currentPlan.max_calls_per_hour && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-600">Rate Limit (hourly)</span>
                      <span className="text-sm text-slate-900 font-medium">{currentPlan.max_calls_per_hour} calls/hr</span>
                    </div>
                  )}
                  {currentPlan.max_calls_per_day && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-600">Rate Limit (daily)</span>
                      <span className="text-sm text-slate-900 font-medium">{currentPlan.max_calls_per_day} calls/day</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Usage Summary */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                  Usage Summary (Current Period)
                </h4>
                {usage ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-600">Minutes Used</span>
                      <span className="text-sm text-slate-900 font-medium">{usage.minutes_used.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-600">Minutes Included</span>
                      <span className="text-sm text-slate-900 font-medium">{usage.minutes_included.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-600">Overage Minutes</span>
                      <span className="text-sm text-slate-900 font-medium">{usage.overage_minutes.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-600">Minutes Remaining</span>
                      <span className="text-sm text-slate-900 font-medium">{Math.max(0, usage.minutes_included - usage.minutes_used).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-600">Usage Percentage</span>
                      <span className="text-sm text-slate-900 font-medium">{usagePercent.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-600">Approx Calls Made</span>
                      <span className="text-sm text-slate-900 font-medium">~{getApproxCalls(usage.minutes_used)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No usage data available for the current period.</p>
                )}
              </div>

              {/* Terms and Legal */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                  Terms & Policies
                </h4>
                <div className="space-y-2 text-sm text-slate-600">
                  <p>Your subscription automatically renews each billing cycle. Charges are processed through Stripe, our secure payment processor.</p>
                  <p>Overage charges are calculated at {formatPriceWithDecimals(currentPlan.price_per_extra_minute)} per minute beyond your included {currentPlan.minutes_included.toLocaleString()} minutes, up to your set budget limit.</p>
                  <p>Changes to your subscription take effect at the start of the next billing period. Downgrades and cancellations will continue until the end of the current period.</p>
                  <p className="text-xs text-slate-400 mt-4">By using Callengo, you agree to our Terms of Service and Privacy Policy.</p>
                </div>
              </div>

              {/* Need help */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Need help with your subscription?</p>
                    <p className="text-blue-700">Contact us at <a href="mailto:billing@callengo.ai" className="underline">billing@callengo.ai</a></p>
                  </div>
                </div>
              </div>

              {/* Cancel subscription — buried at the very bottom */}
              <div className="pt-8 border-t border-slate-100">
                <button
                  onClick={handleStartCancel}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors underline underline-offset-2"
                >
                  Cancel subscription
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════
            CANCELLATION FLOW MODALS
            ═══════════════════════════════════════════════════ */}

        {/* Step 1: Are you sure? */}
        {cancelStep === 'confirm' && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Are you sure you want to cancel?</h3>
                <p className="text-sm text-slate-600">
                  You&apos;re currently on the <strong>{currentPlan.name}</strong> plan with <strong>{currentPlan.minutes_included.toLocaleString()}</strong> minutes/month.
                  Cancelling will remove access to all premium features at the end of your current billing period.
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                <div className="flex gap-2">
                  <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                  <div className="text-xs text-amber-900">
                    <p className="font-semibold">You will lose access to:</p>
                    <ul className="mt-1 space-y-0.5 list-disc list-inside text-amber-800">
                      <li>{currentPlan.minutes_included.toLocaleString()} monthly minutes</li>
                      <li>{currentPlan.max_concurrent_calls} concurrent calls</li>
                      <li>All premium agent features</li>
                      <li>Priority support</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCloseCancelFlow}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold gradient-bg text-white hover:opacity-90 transition-all"
                >
                  Keep My Plan
                </button>
                <button
                  onClick={handleConfirmCancel}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Continue Cancelling
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Feedback form */}
        {cancelStep === 'feedback' && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-900 mb-2">We&apos;d love to hear why</h3>
                <p className="text-sm text-slate-600">
                  Your feedback is incredibly valuable and helps us improve Callengo for everyone.
                  Please tell us why you&apos;re considering cancelling.
                </p>
              </div>

              <div className="space-y-2 mb-6">
                {CANCELLATION_REASONS.map((reason) => (
                  <label
                    key={reason.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      cancelReason === reason.id
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancelReason"
                      value={reason.id}
                      checked={cancelReason === reason.id}
                      onChange={() => setCancelReason(reason.id)}
                      className="w-4 h-4 text-[var(--color-primary)] border-slate-300 focus:ring-[var(--color-primary)]"
                    />
                    <span className="text-sm text-slate-700">{reason.label}</span>
                  </label>
                ))}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Anything else you&apos;d like us to know? (optional)
                </label>
                <textarea
                  value={cancelDetails}
                  onChange={(e) => setCancelDetails(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                  placeholder="Share any additional details..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCloseCancelFlow}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold gradient-bg text-white hover:opacity-90 transition-all"
                >
                  Keep My Plan
                </button>
                <button
                  onClick={handleSubmitFeedback}
                  disabled={!cancelReason || cancelLoading}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cancelLoading ? 'Processing...' : 'Submit & Continue'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Retention offer (only for "too expensive" + eligible) */}
        {cancelStep === 'retention' && retentionEligible && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              {!retentionApplied ? (
                <>
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Wait! We have something for you</h3>
                    <p className="text-sm text-slate-600">
                      We understand pricing can be a concern. As a valued customer, we&apos;d like to offer you
                      <strong> one month completely free</strong> so you can continue using {currentPlan.name} without any commitment.
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-emerald-900">1 Month Free — No strings attached</p>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          Your next billing cycle ({formatPrice(subscription.billing_cycle === 'monthly' ? currentPlan.price_monthly : currentPlan.price_annual)}) will be waived.
                          You keep all your features and can cancel anytime after.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleAcceptRetention}
                      disabled={retentionLoading}
                      className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {retentionLoading ? 'Applying...' : 'Claim Free Month'}
                    </button>
                    <button
                      onClick={handleDeclineRetention}
                      className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      No thanks, cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Your free month is active!</h3>
                    <p className="text-sm text-slate-600">
                      Your next billing cycle will be completely free. We hope you enjoy the extra time with Callengo!
                    </p>
                  </div>
                  <button
                    onClick={handleCloseCancelFlow}
                    className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold gradient-bg text-white hover:opacity-90 transition-all"
                  >
                    Back to Settings
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Final confirmation before redirect to Stripe */}
        {cancelStep === 'final' && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">We&apos;re sorry to see you go</h3>
                <p className="text-sm text-slate-600">
                  Thank you for being a Callengo customer. You&apos;ll be redirected to our secure billing portal
                  to complete the cancellation process. Your plan will remain active until the end of your current billing period.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-6">
                <div className="text-xs text-slate-600 space-y-1">
                  <p>Your {currentPlan.name} plan will stay active until <strong>{subscription.current_period_end ? formatDate(subscription.current_period_end) : 'end of period'}</strong>.</p>
                  <p>You can resubscribe at any time from the billing page.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCloseCancelFlow}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold gradient-bg text-white hover:opacity-90 transition-all"
                >
                  I Changed My Mind
                </button>
                <button
                  onClick={handleFinalCancel}
                  disabled={stripeLoading}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
                >
                  {stripeLoading ? 'Redirecting...' : 'Proceed to Cancel'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Overage Modal (Paid) */}
        {showOverageModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 min-h-screen">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative z-10">
              <h3 className="text-xl font-bold text-slate-900 mb-2">{subscription.overage_enabled ? 'Disable' : 'Enable'} Auto-Overage</h3>
              <p className="text-sm text-slate-600 mb-6">{subscription.overage_enabled ? 'Disabling auto-overage will stop all calls once you reach your plan limits.' : 'Enable auto-overage to continue making calls beyond your plan limits.'}</p>
              {!subscription.overage_enabled && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Monthly Overage Budget</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input type="number" min="0" step="50" value={overageBudget} onChange={(e) => setOverageBudget(Number(e.target.value))} className="w-full pl-8 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="100" />
                  </div>
                </div>
              )}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-6"><p className="text-xs text-blue-900"><span className="font-semibold">Overage rate:</span> {formatPriceWithDecimals(currentPlan.price_per_extra_minute)}/minute</p></div>
              <div className="flex gap-3">
                <button onClick={() => setShowOverageModal(false)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">Cancel</button>
                <button onClick={() => handleToggleOverage(!subscription.overage_enabled)} className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors ${subscription.overage_enabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>{subscription.overage_enabled ? 'Disable Overage' : 'Enable Overage'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  //  FREE PLAN VIEW — Current plan + upgrade grid
  // ══════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {success && (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="text-sm text-emerald-700 font-medium">{success}</p>
        </div>
      )}

      {/* Current Free Trial */}
      {currentPlan && usage && (
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4">Free Trial</h3>
          <div className={`border rounded-xl p-6 ${usagePercent >= 100 ? 'bg-red-50 border-red-200' : 'gradient-bg-subtle border-slate-200'}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-2xl font-bold text-slate-900">Starter Experience</h4>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${usagePercent >= 100 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                    {usagePercent >= 100 ? 'Trial Ended' : 'Trial Active'}
                  </span>
                </div>
                <p className="text-sm text-slate-600">You have 15 free minutes to experience Callengo</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-slate-900">Free</div>
                <div className="text-sm text-slate-500">15 min trial</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">Minutes Used</span>
                <span className="font-bold text-slate-900">{usage.minutes_used.toLocaleString()} / {usage.minutes_included.toLocaleString()} min</span>
              </div>
              <div className="h-2 bg-white/80 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-500 ${usagePercent >= 100 ? 'bg-red-500' : usagePercent >= 80 ? 'bg-amber-500' : 'gradient-bg'}`} style={{ width: `${usagePercent}%` }} />
              </div>
              <p className="text-xs text-slate-600">
                {usagePercent >= 100
                  ? 'Your free trial minutes have been used. Upgrade to continue using Callengo.'
                  : `~${getApproxCalls(usage.minutes_used)} calls made · ~${getApproxCalls(usage.minutes_included - usage.minutes_used)} remaining`
                }
              </p>
            </div>

            {/* Trial ended upgrade CTA */}
            {usagePercent >= 100 && (
              <div className="mt-4 pt-4 border-t border-red-200 bg-red-50/50 -m-6 p-4 rounded-b-xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-900">Your trial has ended</p>
                    <p className="text-xs text-red-800 mt-0.5">All calling features are now blocked. Subscribe to a paid plan to unlock unlimited access to Callengo&apos;s AI calling platform.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Trial still active info */}
            {usagePercent < 100 && (
              <div className="mt-4 pt-4 border-t border-amber-200 bg-amber-50/50 -m-6 p-4 rounded-b-xl">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div>
                    <p className="text-xs font-semibold text-amber-900">One-Time Trial</p>
                    <p className="text-xs text-amber-800 mt-0.5">Your 15 free minutes are a one-time trial and <strong>do not renew</strong>. Once used, you&apos;ll need to upgrade to a paid plan.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Choose Your Plan */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900 mb-1">Choose Your Plan</h3>
            <p className="text-sm text-slate-600">Select the perfect plan for your needs</p>
          </div>
          {plans.length > 0 && (
            <div className="inline-flex items-center gap-2 p-1 bg-slate-100 rounded-lg">
              <button onClick={() => setBillingCycle('monthly')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${billingCycle === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Monthly</button>
              <button onClick={() => setBillingCycle('annual')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${billingCycle === 'annual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                Annual<span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Save up to 12%</span>
              </button>
            </div>
          )}
        </div>

        {plans.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-1">Billing Setup Required</h4>
            <p className="text-xs text-slate-500">Run the billing migration script in your Supabase SQL editor.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {higherPlans.map((plan) => {
              const isEnterprise = plan.slug === 'enterprise';
              const isPopular = plan.slug === 'business';
              const monthlyPrice = billingCycle === 'monthly' ? plan.price_monthly : plan.price_annual;
              const yearlyTotal = plan.price_annual * 12;
              const discountPercent = !isEnterprise && billingCycle === 'annual' ? Math.round(((plan.price_monthly * 12 - yearlyTotal) / (plan.price_monthly * 12)) * 100) : 0;

              return (
                <div key={plan.id} className="relative flex pt-6">
                  {isPopular && (
                    <div className="absolute -top-0 left-1/2 -translate-x-1/2 z-10">
                      <div className="gradient-bg text-white text-[9px] font-bold px-3 py-1 rounded-full shadow-md uppercase tracking-wide whitespace-nowrap">BEST VALUE</div>
                    </div>
                  )}
                  <div className={`rounded-xl p-4 transition-all flex flex-col h-full w-full ${isPopular ? 'border-2 border-[var(--color-primary)] bg-white shadow-xl shadow-[var(--color-primary)]/10 scale-105' : 'border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'}`}>
                    <div className="mb-3">
                      <h4 className="text-base font-bold text-slate-900 mb-2">{plan.name}</h4>
                      <p className="text-[11px] text-slate-600 leading-tight">{plan.description}</p>
                    </div>
                    <div className="mb-3 pb-3 border-b border-slate-100">
                      <div className="flex items-baseline gap-1">
                        {isEnterprise && <span className="text-xs text-slate-500 font-medium">From</span>}
                        <span className="text-2xl font-bold text-slate-900">{formatPrice(monthlyPrice)}</span>
                        {!isEnterprise && <span className="text-xs text-slate-500">/mo</span>}
                      </div>
                      {!isEnterprise && billingCycle === 'annual' && <div className="text-[10px] text-slate-500 mt-1">{formatPrice(yearlyTotal)}/year</div>}
                      {!isEnterprise && billingCycle === 'annual' && discountPercent > 0 && (
                        <div className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 mt-1">Save {discountPercent}%</div>
                      )}
                    </div>
                    <div className="flex-grow mb-3">
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex items-start gap-1.5"><svg className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span className="text-slate-700"><span className="font-semibold text-slate-900">{plan.minutes_included.toLocaleString()}</span> min/mo</span></div>
                        <div className="flex items-start gap-1.5"><svg className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span className="text-slate-700"><span className="font-semibold text-slate-900">{plan.max_call_duration} min</span> max call</span></div>
                        <div className="flex items-start gap-1.5"><svg className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span className="text-slate-700"><span className="font-semibold text-slate-900">{formatPriceWithDecimals(plan.price_per_extra_minute)}</span> overage</span></div>
                        <div className="flex items-start gap-1.5"><svg className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span className="text-slate-700"><span className="font-semibold text-slate-900">{plan.max_concurrent_calls}</span> concurrent</span></div>
                        {(plan.max_calls_per_hour || plan.max_calls_per_day) && (
                          <div className="flex items-start gap-1.5"><svg className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span className="text-slate-700">{plan.max_calls_per_hour && <><span className="font-semibold text-slate-900">{plan.max_calls_per_hour}</span>/hr</>}{plan.max_calls_per_hour && plan.max_calls_per_day && ', '}{plan.max_calls_per_day && <><span className="font-semibold text-slate-900">{plan.max_calls_per_day}</span>/day</>}</span></div>
                        )}
                        {getPlanFeatures(plan.slug).map((feature, idx) => (
                          <div key={idx} className="flex items-start gap-1.5"><svg className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span className="text-slate-700 leading-tight">{feature}</span></div>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => handleChangePlan(plan.id)} disabled={changing} className={`w-full py-2 rounded-lg text-xs font-semibold transition-all mt-auto ${isPopular ? 'gradient-bg text-white hover:opacity-90 shadow-md' : 'bg-slate-800 text-white hover:bg-slate-900'}`}>
                      {changing ? 'Processing...' : isEnterprise ? 'Contact Sales' : 'Get Started'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Need help choosing a plan?</p>
            <p className="text-blue-700">Contact us at <a href="mailto:billing@callengo.ai" className="underline">billing@callengo.ai</a> or view our <a href="#" className="underline">pricing FAQ</a>.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
