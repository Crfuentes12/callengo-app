'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStripe } from '@/hooks/useStripe';
import { getCampaignFeatureAccess, getPhoneNumberFeatures } from '@/config/plan-features';
import { useUserCurrency } from '@/hooks/useAutoGeolocation';
import { useTranslation } from '@/i18n';

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
  addon_dedicated_number?: boolean;
  addon_recording_vault?: boolean;
  addon_calls_booster?: boolean;
  addon_calls_booster_count?: number;
}

interface Usage {
  minutes_used: number;
  minutes_included: number;
  overage_minutes: number;
}

interface BillingSettingsProps {
  companyId: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '\u20AC',
  GBP: '\u00A3',
};

type CancelStep = 'hidden' | 'confirm' | 'feedback' | 'retention' | 'final';

export default function BillingSettings({ companyId }: BillingSettingsProps) {
  const { t } = useTranslation();

  const CANCELLATION_REASONS = [
    { id: 'too_expensive', label: t.billing.cancelReasons.tooExpensive },
    { id: 'missing_features', label: t.billing.cancelReasons.missingFeatures },
    { id: 'found_alternative', label: t.billing.cancelReasons.foundAlternative },
    { id: 'not_needed', label: t.billing.cancelReasons.notNeeded },
    { id: 'too_complicated', label: t.billing.cancelReasons.tooComplicated },
    { id: 'poor_quality', label: t.billing.cancelReasons.poorQuality },
    { id: 'temporary_pause', label: t.billing.cancelReasons.temporaryPause },
    { id: 'other', label: t.billing.cancelReasons.other },
  ];

  // Get translated plan features (non-duplicate: excludes minutes, overage, concurrent, users shown from DB)
  const getTranslatedFeatures = (slug: string): string[] => {
    const featureMap = (t.billing.planFeatures as Record<string, Record<string, string>>)[slug];
    if (!featureMap) return [];
    return Object.values(featureMap);
  };

  // Extra seat pricing per plan (null = no extra seats available)
  const EXTRA_SEAT_PRICE: Record<string, number | null> = { free: null, starter: null, growth: null, business: 49, teams: 49, enterprise: null };

  const { createCheckoutSession, createAddonCheckout, openBillingPortal, loading: stripeLoading } = useStripe();
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

  // Add-on state
  const [activeAddons, setActiveAddons] = useState<string[]>([]);
  const [addonLoading, setAddonLoading] = useState<string | null>(null);

  // Billing details expandable section
  const [showBillingDetails, setShowBillingDetails] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  // Cancellation flow state
  const [cancelStep, setCancelStep] = useState<CancelStep>('hidden');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelDetails, setCancelDetails] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [retentionEligible, setRetentionEligible] = useState(false);
  const [retentionApplied, setRetentionApplied] = useState(false);
  const [retentionLoading, setRetentionLoading] = useState(false);

  const formatPrice = (price: number) => {
    const symbol = CURRENCY_SYMBOLS[currency] || CURRENCY_SYMBOLS.USD;
    return `${symbol}${Math.round(price)}`;
  };

  const formatPriceWithDecimals = (price: number) => {
    const symbol = CURRENCY_SYMBOLS[currency] || CURRENCY_SYMBOLS.USD;
    const formatted = price.toFixed(2).replace(/\.?0+$/, '');
    return `${symbol}${formatted}`;
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [plansRes, subRes] = await Promise.all([
        fetch(`/api/billing/plans?currency=${currency}`),
        fetch(`/api/billing/subscription?companyId=${companyId}`)
      ]);
      if (plansRes.ok) setPlans(await plansRes.json());
      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscription(subData.subscription);
        setUsage(subData.usage);
        // Read addon flags from subscription
        const sub = subData.subscription;
        const active: string[] = [];
        if (sub?.addon_dedicated_number) active.push('dedicated_number');
        if (sub?.addon_recording_vault) active.push('recording_vault');
        if (sub?.addon_calls_booster) active.push('calls_booster');
        setActiveAddons(active);
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId, currency]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const isSuccess = searchParams.get('success') === 'true';
    if (!isSuccess) return;
    setSuccess(t.common.success);
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
      alert(t.common.error);
      setChanging(false);
    }
  };

  const handleToggleOverage = async (enabled: boolean) => {
    if (!subscription) return;
    if (enabled && overageBudget <= 0) { alert(t.common.error); return; }
    try {
      const response = await fetch('/api/billing/update-overage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, subscriptionId: subscription.id, enabled, budget: enabled ? overageBudget : 0 })
      });
      if (response.ok) {
        setSuccess(enabled ? `${t.billing.overageCost} ${t.common.enabled.toLowerCase()}` : `${t.billing.overageCost} ${t.common.disabled.toLowerCase()}`);
        await fetchData();
        setShowOverageModal(false);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || 'Failed to update overage'}`);
      }
    } catch (error) {
      console.error('Error updating overage:', error);
      alert(t.common.error);
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
          <p className="text-sm text-slate-500">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  const currentPlan = subscription?.plan;
  const isFreePlan = currentPlan?.slug === 'free';
  const isPaidPlan = currentPlan && !isFreePlan;
  const usagePercent = usage ? Math.min((usage.minutes_used / usage.minutes_included) * 100, 100) : 0;
  // 1.5 min effective average per call attempt (mix of no-answer 0.5, voicemail 1.5, connected 2.5)
  const getApproxCalls = (minutes: number) => Math.floor(minutes / 1.5);

  // Plan tier ordering for filtering higher tiers only
  const PLAN_TIER_ORDER: Record<string, number> = { free: 0, starter: 1, growth: 2, business: 3, teams: 4, enterprise: 5 };
  const currentTier = PLAN_TIER_ORDER[currentPlan?.slug || 'free'] ?? 0;
  const higherPlans = plans.filter(p => (PLAN_TIER_ORDER[p.slug] ?? 0) > currentTier);
  const comparisonPlans = plans.filter(p => (PLAN_TIER_ORDER[p.slug] ?? 0) >= currentTier);

  // ══════════════════════════════════════════════════
  //  PAID PLAN VIEW — Management + upgrade options
  // ══════════════════════════════════════════════════
  if (isPaidPlan && subscription) {
    const planFeatures = getTranslatedFeatures(currentPlan.slug);

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
              <p className="text-sm text-emerald-700 font-semibold">{t.billing.retentionBannerTitle}</p>
              <p className="text-xs text-emerald-600 mt-0.5">{t.billing.retentionBannerDesc}</p>
            </div>
          </div>
        )}

        {/* ── Your Subscription Card ── */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4">{t.billing.currentPlan}</h3>
          <div className="gradient-bg-subtle border border-slate-200 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-2xl font-bold text-slate-900">{currentPlan.name}</h4>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                    {subscription.status === 'trial' ? t.billing.free : t.billing.paid}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{currentPlan.description}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-slate-900">
                  {formatPrice(subscription.billing_cycle === 'monthly' ? currentPlan.price_monthly : currentPlan.price_annual)}
                </div>
                <div className="text-sm text-slate-500">{subscription.billing_cycle === 'monthly' ? t.billing.perMonth : t.billing.perYear}</div>
              </div>
            </div>

            {usage && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{t.billing.minutesUsed}</span>
                  <span className="font-bold text-slate-900">{usage.minutes_used.toLocaleString()} / {usage.minutes_included.toLocaleString()} min</span>
                </div>
                <div className="h-2 bg-white/80 rounded-full overflow-hidden">
                  <div className="h-full gradient-bg transition-all duration-500" style={{ width: `${usagePercent}%` }} />
                </div>
                <p className="text-xs text-slate-600">~{getApproxCalls(usage.minutes_used)} calls used · ~{getApproxCalls(usage.minutes_included - usage.minutes_used)} remaining</p>
              </div>
            )}

            {subscription.current_period_end && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-600">{t.billing.renewsOn} <span className="font-semibold text-slate-900">{formatDate(subscription.current_period_end)}</span></p>
              </div>
            )}
          </div>
        </div>

        {/* ── Overage Controls (right after subscription) ── */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4">{t.billing.overageCost}</h3>
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">{t.billing.overageCost}</h4>
                <p className="text-sm text-slate-600">{t.billing.overageMinutes}</p>
              </div>
              <button onClick={() => setShowOverageModal(true)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${subscription.overage_enabled ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                {subscription.overage_enabled ? t.common.enabled : t.common.disabled}
              </button>
            </div>
            {subscription.overage_enabled && (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center"><span className="text-sm text-slate-600">{t.billing.overageCost}</span><span className="text-sm font-semibold text-slate-900">{formatPrice(subscription.overage_budget)}</span></div>
                <div className="flex justify-between items-center"><span className="text-sm text-slate-600">{t.billing.overageCost}</span><span className="text-sm font-semibold text-slate-900">{formatPrice(subscription.overage_spent)}</span></div>
                <div className="space-y-1">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-500 ${subscription.overage_spent >= subscription.overage_budget ? 'bg-red-500' : subscription.overage_spent >= subscription.overage_budget * 0.85 ? 'bg-orange-500' : 'bg-green-500'}`} style={{ width: `${Math.min((subscription.overage_spent / subscription.overage_budget) * 100, 100)}%` }} />
                  </div>
                  <p className="text-xs text-slate-500">{formatPrice(subscription.overage_budget - subscription.overage_spent)} {t.billing.remaining}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Add-ons ── */}
        {!isFreePlan && (
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Add-ons</h3>
            <p className="text-sm text-slate-500 mb-4">Supercharge your plan with powerful extras. Cancel anytime.</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  key: 'dedicated_number' as const,
                  icon: '📞',
                  title: 'Dedicated Phone Number',
                  desc: 'Your own caller ID — better deliverability, consistent brand.',
                  price: 15,
                  badge: 'Better pickup rates',
                  badgeColor: 'blue',
                },
                {
                  key: 'recording_vault' as const,
                  icon: '🔒',
                  title: 'Recording Vault',
                  desc: 'Keep recordings for 12 months instead of 30 days. Searchable & downloadable.',
                  price: 12,
                  badge: '12-month retention',
                  badgeColor: 'purple',
                },
                {
                  key: 'calls_booster' as const,
                  icon: '🚀',
                  title: 'Calls Booster',
                  desc: '+150 calls (~+225 min) added to your plan each month. Stackable.',
                  price: 35,
                  badge: '+150 calls/mo',
                  badgeColor: 'green',
                },
              ].map((addon) => {
                const isActive = activeAddons.includes(addon.key);
                const isLoadingThis = addonLoading === addon.key;
                const badgeClasses: Record<string, string> = {
                  blue: 'bg-blue-100 text-blue-700',
                  purple: 'bg-purple-100 text-purple-700',
                  green: 'bg-emerald-100 text-emerald-700',
                };
                return (
                  <div key={addon.key} className={`rounded-xl border p-5 flex flex-col gap-3 transition-all ${isActive ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <div className="flex items-start justify-between">
                      <div className="text-2xl">{addon.icon}</div>
                      {isActive ? (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">Active</span>
                      ) : (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeClasses[addon.badgeColor]}`}>{addon.badge}</span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">{addon.title}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">{addon.desc}</p>
                    </div>
                    <div className="mt-auto">
                      <div className="text-xl font-bold text-slate-900 mb-2">{formatPrice(addon.price)}<span className="text-xs font-normal text-slate-500">/mo</span></div>
                      {isActive ? (
                        <button
                          onClick={() => openBillingPortal()}
                          className="w-full py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                        >
                          Manage in Portal
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            setAddonLoading(addon.key);
                            try {
                              await createAddonCheckout({ addonType: addon.key, currency: currency as 'USD' | 'EUR' | 'GBP' });
                            } catch {
                              setAddonLoading(null);
                            }
                          }}
                          disabled={isLoadingThis || stripeLoading}
                          className="w-full py-2 rounded-lg text-xs font-semibold gradient-bg text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoadingThis ? 'Loading...' : `Add ${addon.title}`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Plans Comparison (current + upgrades) ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">{t.billing.changePlan}</h3>
              <p className="text-sm text-slate-500">{higherPlans.length > 0 ? t.billing.upgradePlan : t.billing.currentPlan}</p>
            </div>
            <div className="inline-flex items-center gap-2 p-1 bg-slate-100 rounded-lg">
              <button onClick={() => setBillingCycle('monthly')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${billingCycle === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{t.billing.monthly}</button>
              <button onClick={() => setBillingCycle('annual')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${billingCycle === 'annual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                {t.billing.annual}<span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">{t.billing.saveUpTo}</span>
              </button>
            </div>
          </div>

          <div className={`grid gap-4 ${comparisonPlans.length === 1 ? 'grid-cols-1 max-w-md' : comparisonPlans.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : comparisonPlans.length === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
            {comparisonPlans.map((plan) => {
              const isEnterprise = plan.slug === 'enterprise';
              const isCurrent = plan.slug === currentPlan.slug;
              const isRecommended = !isCurrent && higherPlans.length > 0 && plan === higherPlans[0];
              const monthlyPrice = isEnterprise ? plan.price_monthly : (billingCycle === 'monthly' ? plan.price_monthly : Math.round(plan.price_annual / 12));
              // price_annual is the total annual charge
              const yearlyTotal = plan.price_annual;
              const discountPercent = !isEnterprise && billingCycle === 'annual' ? Math.round(((plan.price_monthly * 12 - yearlyTotal) / (plan.price_monthly * 12)) * 100) : 0;

              return (
                <div key={plan.id} className="relative flex pt-6">
                  {isCurrent && (
                    <div className="absolute -top-0 left-1/2 -translate-x-1/2 z-10">
                      <div className="bg-slate-800 text-white text-[9px] font-bold px-3 py-1 rounded-full shadow-md uppercase tracking-wide whitespace-nowrap">{t.billing.current}</div>
                    </div>
                  )}
                  {isRecommended && (
                    <div className="absolute -top-0 left-1/2 -translate-x-1/2 z-10">
                      <div className="gradient-bg text-white text-[9px] font-bold px-3 py-1 rounded-full shadow-md uppercase tracking-wide whitespace-nowrap">{t.billing.popular}</div>
                    </div>
                  )}
                  <div className={`rounded-xl p-5 transition-all flex flex-col h-full w-full ${isCurrent ? 'border-2 border-slate-800 bg-white shadow-lg' : isRecommended ? 'border-2 border-[var(--color-primary)] bg-white shadow-xl shadow-[var(--color-primary)]/10' : 'border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'}`}>
                    {/* Plan name + description */}
                    <div className="mb-3">
                      <h4 className="text-lg font-bold text-slate-900 mb-1">{plan.name}</h4>
                      <p className="text-xs text-slate-600 min-h-[2rem]">{plan.description}</p>
                    </div>
                    {/* Price — same height for all */}
                    <div className="mb-4 pb-4 border-b border-slate-100 min-h-[4.5rem]">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-slate-900">{formatPrice(monthlyPrice)}</span>
                        <span className="text-sm text-slate-500">{t.billing.mo}</span>
                      </div>
                      {!isEnterprise && billingCycle === 'annual' && <div className="text-xs text-slate-500 mt-1">{formatPrice(yearlyTotal)}{t.billing.yr}</div>}
                      {!isEnterprise && billingCycle === 'annual' && discountPercent > 0 && (
                        <div className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 mt-1">{t.billing.save} {discountPercent}%</div>
                      )}
                    </div>
                    {/* Metrics — same rows for all plans */}
                    <div className="mb-4 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between"><span className="text-slate-500">Calls/month</span><span className="font-semibold text-slate-900">~{getApproxCalls(plan.minutes_included).toLocaleString()}</span></div>
                      <div className="flex items-center justify-between"><span className="text-slate-500">{t.billing.minutesIncludedLabel}</span><span className="font-semibold text-slate-900">{plan.minutes_included.toLocaleString()}</span></div>
                      <div className="flex items-center justify-between"><span className="text-slate-500">{t.billing.usersLabel}</span><span className="font-semibold text-slate-900">{plan.max_users === -1 ? t.billing.unlimited : plan.max_users}{EXTRA_SEAT_PRICE[plan.slug] ? ` (${formatPrice(EXTRA_SEAT_PRICE[plan.slug]!)}${t.billing.perSeat})` : ''}</span></div>
                      <div className="flex items-center justify-between"><span className="text-slate-500">{t.billing.concurrentCallsLabel}</span><span className="font-semibold text-slate-900">{plan.max_concurrent_calls === 999 ? '∞' : plan.max_concurrent_calls}</span></div>
                      <div className="flex items-center justify-between"><span className="text-slate-500">{t.billing.overageRateLabel}</span><span className="font-semibold text-slate-900">{plan.price_per_extra_minute > 0 ? `${formatPriceWithDecimals(plan.price_per_extra_minute)}${t.billing.min}` : '—'}</span></div>
                    </div>
                    {/* Key features — 3 highlights */}
                    <div className="flex-grow mb-4 pt-3 border-t border-slate-100">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{t.billing.keyFeatures}</p>
                      <div className="space-y-1.5 text-xs">
                        {getTranslatedFeatures(plan.slug).slice(0, 3).map((feature, idx) => (
                          <div key={idx} className="flex items-start gap-2"><svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span className="text-slate-700">{feature}</span></div>
                        ))}
                      </div>
                    </div>
                    {/* CTA */}
                    {isCurrent ? (
                      <div className="w-full py-2.5 rounded-lg text-sm font-semibold text-center text-slate-500 bg-slate-100 mt-auto">
                        {t.billing.currentPlan}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleChangePlan(plan.id)}
                        disabled={changing}
                        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all mt-auto ${isRecommended ? 'gradient-bg text-white hover:opacity-90 shadow-md' : isEnterprise ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white hover:from-purple-700 hover:to-fuchsia-700' : 'bg-slate-800 text-white hover:bg-slate-900'}`}
                      >
                        {changing ? t.common.loading : isEnterprise ? t.billing.changePlan : `${t.billing.upgradePlan} ${plan.name}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Detailed Comparison (expandable) ── */}
        {comparisonPlans.length > 1 && (
          <div className="border-t border-slate-100 pt-6">
            <button
              onClick={() => setShowComparison(!showComparison)}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              <svg className={`w-4 h-4 transition-transform ${showComparison ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span>{t.billing.seeDetailedComparison}</span>
            </button>

            {showComparison && (
              <div className="mt-4 animate-in slide-in-from-top-2 overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="text-left py-3 pr-4 text-slate-500 font-semibold min-w-[160px]">{t.billing.compareFeature}</th>
                      {comparisonPlans.map(plan => (
                        <th key={plan.id} className={`text-center py-3 px-3 font-bold text-slate-900 ${plan.slug === currentPlan.slug ? 'bg-slate-50 rounded-t-lg' : ''}`}>
                          {plan.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* ── Pricing & Limits ── */}
                    <tr><td colSpan={comparisonPlans.length + 1} className="pt-4 pb-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pricing & Limits</span></td></tr>
                    {[
                      { label: t.billing.plan, render: (p: Plan) => { const mp = p.slug === 'enterprise' ? p.price_monthly : (billingCycle === 'monthly' ? p.price_monthly : p.price_annual); return <span className="font-semibold">{formatPrice(mp)}{t.billing.mo}</span>; }},
                      { label: t.billing.minutesIncludedLabel, render: (p: Plan) => <span className="font-semibold">{p.minutes_included.toLocaleString()}</span> },
                      { label: t.billing.maxCallDuration, render: (p: Plan) => <>{p.max_call_duration} {t.billing.min}</> },
                      { label: t.billing.usersLabel, render: (p: Plan) => <>{p.max_users === -1 ? t.billing.unlimited : p.max_users}</> },
                      { label: t.billing.extraSeatCost, render: (p: Plan) => <>{EXTRA_SEAT_PRICE[p.slug] ? <span className="font-semibold">{formatPrice(EXTRA_SEAT_PRICE[p.slug]!)}{t.billing.perSeat}</span> : '—'}</> },
                      { label: t.billing.concurrentCallsLabel, render: (p: Plan) => <>{p.max_concurrent_calls}</> },
                      { label: t.billing.overageRateLabel, render: (p: Plan) => <>{p.price_per_extra_minute > 0 ? `${formatPriceWithDecimals(p.price_per_extra_minute)}/${t.billing.min}` : '—'}</> },
                      { label: t.billing.callsPerHourLabel, render: (p: Plan) => <>{p.max_calls_per_hour ?? t.billing.unlimited}</> },
                      { label: t.billing.callsPerDayLabel, render: (p: Plan) => <>{p.max_calls_per_day ?? t.billing.unlimited}</> },
                    ].map((row, i) => (
                      <tr key={`limit-${i}`} className={i % 2 === 0 ? 'bg-slate-50/50' : ''}>
                        <td className="py-2.5 pr-4 text-slate-600 font-medium">{row.label}</td>
                        {comparisonPlans.map(plan => (
                          <td key={plan.id} className={`text-center py-2.5 px-3 ${plan.slug === currentPlan.slug ? 'bg-slate-50' : ''}`}>{row.render(plan)}</td>
                        ))}
                      </tr>
                    ))}

                    {/* ── Calling Features ── */}
                    <tr><td colSpan={comparisonPlans.length + 1} className="pt-5 pb-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.billing.features}</span></td></tr>
                    {[
                      { label: t.billing.voicemailDetection, key: 'voicemailDetection' as const },
                      { label: t.billing.followUps, key: 'maxFollowUpAttempts' as const },
                      { label: t.billing.smartFollowUps, key: 'smartFollowUp' as const },
                      { label: 'Slack', key: 'slackNotifications' as const },
                      { label: 'Zoom', key: 'zoomMeetings' as const },
                      { label: 'Microsoft Outlook', key: 'microsoftOutlook' as const },
                      { label: 'Microsoft Teams', key: 'microsoftTeams' as const },
                      { label: t.billing.userPermissions, key: 'dataExport' as const },
                    ].map((row, i) => (
                      <tr key={`feat-${i}`} className={i % 2 === 0 ? 'bg-slate-50/50' : ''}>
                        <td className="py-2.5 pr-4 text-slate-600 font-medium">{row.label}</td>
                        {comparisonPlans.map(plan => {
                          const access = getCampaignFeatureAccess(plan.slug);
                          const val = access[row.key];
                          return (
                            <td key={plan.id} className={`text-center py-2.5 px-3 ${plan.slug === currentPlan.slug ? 'bg-slate-50' : ''}`}>
                              {typeof val === 'boolean' ? (
                                val ? <svg className="w-4 h-4 text-green-600 mx-auto" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                    : <span className="text-slate-300">—</span>
                              ) : typeof val === 'number' ? (
                                val === -1 ? <span className="font-semibold">{t.billing.unlimited}</span>
                                : val === 0 ? <span className="text-slate-300">—</span>
                                : <span className="font-semibold">{val} {t.billing.attempts}</span>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {/* ── Phone & Integrations ── */}
                    <tr><td colSpan={comparisonPlans.length + 1} className="pt-5 pb-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.billing.integrationsLabel}</span></td></tr>
                    {/* Phone numbers */}
                    <tr className="bg-slate-50/50">
                      <td className="py-2.5 pr-4 text-slate-600 font-medium">{t.billing.phoneNumbers}</td>
                      {comparisonPlans.map(plan => {
                        const phone = getPhoneNumberFeatures(plan.slug);
                        return (
                          <td key={plan.id} className={`text-center py-2.5 px-3 text-slate-700 ${plan.slug === currentPlan.slug ? 'bg-slate-50' : ''}`}>
                            {phone.dedicatedNumberAddon ? t.billing.autoRotatedByop : t.billing.autoRotated}
                          </td>
                        );
                      })}
                    </tr>
                    {/* CRM integrations per plan */}
                    {['Google Calendar & Meet', 'SimplyBook.me', 'HubSpot CRM', 'Pipedrive CRM', 'Zoho CRM', 'Salesforce CRM', 'Microsoft Dynamics 365', 'Clio'].map((integration, i) => {
                      const integrationsByPlan: Record<string, string[]> = {
                        free: ['Google Calendar & Meet'],
                        starter: ['Google Calendar & Meet', 'SimplyBook.me'],
                        growth: ['Google Calendar & Meet', 'SimplyBook.me'],
                        business: ['Google Calendar & Meet', 'SimplyBook.me', 'HubSpot CRM', 'Pipedrive CRM', 'Zoho CRM', 'Clio'],
                        teams: ['Google Calendar & Meet', 'SimplyBook.me', 'HubSpot CRM', 'Pipedrive CRM', 'Zoho CRM', 'Clio', 'Salesforce CRM', 'Microsoft Dynamics 365'],
                        enterprise: ['Google Calendar & Meet', 'SimplyBook.me', 'HubSpot CRM', 'Pipedrive CRM', 'Zoho CRM', 'Clio', 'Salesforce CRM', 'Microsoft Dynamics 365'],
                      };
                      return (
                        <tr key={`int-${i}`} className={i % 2 !== 0 ? 'bg-slate-50/50' : ''}>
                          <td className="py-2 pr-4 text-slate-600">{integration}</td>
                          {comparisonPlans.map(plan => (
                            <td key={plan.id} className={`text-center py-2 px-3 ${plan.slug === currentPlan.slug ? 'bg-slate-50' : ''}`}>
                              {(integrationsByPlan[plan.slug] || []).includes(integration) ? (
                                <svg className="w-4 h-4 text-green-600 mx-auto" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                    {/* Webhooks */}
                    <tr className="bg-slate-50/50">
                      <td className="py-2 pr-4 text-slate-600">Webhooks (Zapier, Make, n8n)</td>
                      {comparisonPlans.map(plan => (
                        <td key={plan.id} className={`text-center py-2 px-3 ${plan.slug === currentPlan.slug ? 'bg-slate-50' : ''}`}>
                          {plan.slug !== 'free' ? (
                            <svg className="w-4 h-4 text-green-600 mx-auto" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* ── Support ── */}
                    <tr><td colSpan={comparisonPlans.length + 1} className="pt-5 pb-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.billing.supportLabel}</span></td></tr>
                    {[
                      { label: t.billing.supportLabel, render: (slug: string) => {
                        const supportByPlan: Record<string, string> = { free: '—', starter: 'Email', growth: 'Priority email', business: 'Priority email', teams: 'Priority', enterprise: 'Dedicated manager' };
                        return supportByPlan[slug] || '—';
                      }},
                      { label: t.billing.slaGuarantee, render: (slug: string) => slug === 'enterprise' },
                      { label: t.billing.dedicatedManager, render: (slug: string) => slug === 'enterprise' },
                    ].map((row, i) => (
                      <tr key={`support-${i}`} className={i % 2 === 0 ? 'bg-slate-50/50' : ''}>
                        <td className="py-2.5 pr-4 text-slate-600 font-medium">{row.label}</td>
                        {comparisonPlans.map(plan => (
                          <td key={plan.id} className={`text-center py-2.5 px-3 ${plan.slug === currentPlan.slug ? 'bg-slate-50' : ''}`}>
                            {typeof row.render(plan.slug) === 'boolean' ? (
                              row.render(plan.slug) ? <svg className="w-4 h-4 text-green-600 mx-auto" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                : <span className="text-slate-300">—</span>
                            ) : (
                              <span className="text-slate-700">{row.render(plan.slug)}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Billing & Account Details (expandable, deeply buried) ── */}
        <div className="border-t border-slate-100 pt-6">
          <button
            onClick={() => setShowBillingDetails(!showBillingDetails)}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <svg className={`w-4 h-4 transition-transform ${showBillingDetails ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span>{t.billing.billingHistory}</span>
          </button>

          {showBillingDetails && (
            <div className="mt-4 space-y-6 animate-in slide-in-from-top-2">
              {/* Payment Information (no Stripe portal button) */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                  {t.billing.paymentMethod}
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">{t.billing.paymentMethod}</span>
                    <span className="text-sm text-slate-900 font-medium">{t.billing.managedViaStripe}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">{t.billing.monthly}</span>
                    <span className="text-sm text-slate-900 font-medium capitalize">{subscription.billing_cycle}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">{t.billing.currentPlan}</span>
                    <span className="text-sm text-slate-900 font-medium">{currentPlan.name}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">{t.billing.amount}</span>
                    <span className="text-sm text-slate-900 font-medium">
                      {formatPrice(subscription.billing_cycle === 'monthly' ? currentPlan.price_monthly : currentPlan.price_annual)}/{subscription.billing_cycle === 'monthly' ? t.billing.mo : t.billing.yr}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">{t.billing.nextBilling}</span>
                    <span className="text-sm text-slate-900 font-medium">{subscription.current_period_end ? formatDate(subscription.current_period_end) : t.billing.na}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">{t.billing.status}</span>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">{t.billing.paid}</span>
                  </div>
                </div>
              </div>

              {/* Account Details */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  {t.billing.accountDetails}
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">{t.billing.currentPlan}</span>
                    <span className="text-sm text-slate-900 font-medium">{currentPlan.name} {t.billing.plan}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">{t.billing.features}</span>
                    <span className="text-sm text-slate-900 font-medium">{currentPlan.max_users === -1 ? t.billing.unlimited : currentPlan.max_users}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">{t.billing.minutesIncluded}</span>
                    <span className="text-sm text-slate-900 font-medium">{currentPlan.minutes_included.toLocaleString()}/{t.billing.mo}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">{t.billing.features}</span>
                    <span className="text-sm text-slate-900 font-medium">{currentPlan.max_call_duration} {t.billing.min}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">{t.billing.features}</span>
                    <span className="text-sm text-slate-900 font-medium">{currentPlan.max_concurrent_calls}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-slate-600">{t.billing.overageCost}</span>
                    <span className="text-sm text-slate-900 font-medium">{formatPriceWithDecimals(currentPlan.price_per_extra_minute)}/{t.billing.perMin}</span>
                  </div>
                  {currentPlan.max_calls_per_hour && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-600">{t.billing.features}</span>
                      <span className="text-sm text-slate-900 font-medium">{currentPlan.max_calls_per_hour} {t.billing.callsPerHr}</span>
                    </div>
                  )}
                  {currentPlan.max_calls_per_day && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-600">{t.billing.features}</span>
                      <span className="text-sm text-slate-900 font-medium">{currentPlan.max_calls_per_day} {t.billing.callsPerDay}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Usage Summary */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                  {t.billing.usage}
                </h4>
                {usage ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-600">{t.billing.minutesUsed}</span>
                      <span className="text-sm text-slate-900 font-medium">{usage.minutes_used.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-600">{t.billing.minutesIncluded}</span>
                      <span className="text-sm text-slate-900 font-medium">{usage.minutes_included.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-600">{t.billing.overageMinutes}</span>
                      <span className="text-sm text-slate-900 font-medium">{usage.overage_minutes.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-600">{t.billing.minutesIncluded}</span>
                      <span className="text-sm text-slate-900 font-medium">{Math.max(0, usage.minutes_included - usage.minutes_used).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-600">{t.billing.usage}</span>
                      <span className="text-sm text-slate-900 font-medium">{usagePercent.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-600">{t.billing.usage}</span>
                      <span className="text-sm text-slate-900 font-medium">~{getApproxCalls(usage.minutes_used)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">{t.common.noData}</p>
                )}
              </div>

              {/* Terms and Legal */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h4 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                  {t.billing.termsAndPolicies}
                </h4>
                <div className="space-y-2 text-sm text-slate-600">
                  <p>{t.billing.termsAutoRenew}</p>
                  <p>Overage charges are calculated at {formatPriceWithDecimals(currentPlan.price_per_extra_minute)} per minute beyond your included {currentPlan.minutes_included.toLocaleString()} minutes, up to your set budget limit.</p>
                  <p>{t.billing.termsChanges}</p>
                  <p className="text-xs text-slate-400 mt-4">{t.billing.termsAgreement}</p>
                </div>
              </div>

              {/* Need help */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">{t.billing.needHelp}</p>
                    <p className="text-blue-700">{t.billing.contactUsAt} <a href="mailto:billing@callengo.ai" className="underline">billing@callengo.ai</a></p>
                  </div>
                </div>
              </div>

              {/* Cancel subscription — buried at the very bottom */}
              <div className="pt-8 border-t border-slate-100">
                <button
                  onClick={handleStartCancel}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors underline underline-offset-2"
                >
                  {t.billing.cancelPlan}
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
                <h3 className="text-xl font-bold text-slate-900 mb-2">{t.billing.cancelConfirmTitle}</h3>
                <p className="text-sm text-slate-600">
                  {t.billing.cancelCurrentPlan} <strong>{currentPlan.name}</strong> {t.billing.cancelPlanWith} <strong>{currentPlan.minutes_included.toLocaleString()}</strong> {t.billing.cancelMinutesMonth} {t.billing.cancelConsequence}
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                <div className="flex gap-2">
                  <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                  <div className="text-xs text-amber-900">
                    <p className="font-semibold">{t.billing.youWillLose}</p>
                    <ul className="mt-1 space-y-0.5 list-disc list-inside text-amber-800">
                      <li>{currentPlan.minutes_included.toLocaleString()} {t.billing.monthlyMinutes}</li>
                      <li>{currentPlan.max_concurrent_calls} {t.billing.concurrentCalls}</li>
                      <li>{t.billing.allPremiumFeatures}</li>
                      <li>{t.billing.prioritySupport}</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCloseCancelFlow}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold gradient-bg text-white hover:opacity-90 transition-all"
                >
                  {t.billing.keepMyPlan}
                </button>
                <button
                  onClick={handleConfirmCancel}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  {t.billing.yesCancelPlan}
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
                <h3 className="text-xl font-bold text-slate-900 mb-2">{t.billing.feedbackTitle}</h3>
                <p className="text-sm text-slate-600">
                  {t.billing.feedbackDesc}
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
                  {t.billing.feedbackAdditional}
                </label>
                <textarea
                  value={cancelDetails}
                  onChange={(e) => setCancelDetails(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                  placeholder={t.billing.feedbackPlaceholder}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCloseCancelFlow}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold gradient-bg text-white hover:opacity-90 transition-all"
                >
                  {t.billing.keepMyPlan}
                </button>
                <button
                  onClick={handleSubmitFeedback}
                  disabled={!cancelReason || cancelLoading}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cancelLoading ? t.common.loading : t.common.confirm}
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
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{t.billing.retentionTitle}</h3>
                    <p className="text-sm text-slate-600">
                      {t.billing.retentionDesc}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-emerald-900">{t.billing.retentionOfferTitle}</p>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          {t.billing.retentionOfferDesc}
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
                      {retentionLoading ? t.common.loading : t.billing.acceptOffer}
                    </button>
                    <button
                      onClick={handleDeclineRetention}
                      className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      {t.billing.declineOffer}
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
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{t.billing.retentionAppliedTitle}</h3>
                    <p className="text-sm text-slate-600">
                      {t.billing.retentionAppliedDesc}
                    </p>
                  </div>
                  <button
                    onClick={handleCloseCancelFlow}
                    className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold gradient-bg text-white hover:opacity-90 transition-all"
                  >
                    {t.common.back}
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
                <h3 className="text-xl font-bold text-slate-900 mb-2">{t.billing.finalCancelTitle}</h3>
                <p className="text-sm text-slate-600">
                  {t.billing.finalCancelDesc}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-6">
                <div className="text-xs text-slate-600 space-y-1">
                  <p>{currentPlan.name} {t.billing.planActiveUntil} <strong>{subscription.current_period_end ? formatDate(subscription.current_period_end) : t.billing.endOfPeriod}</strong>.</p>
                  <p>{t.billing.resubscribeAnytime}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCloseCancelFlow}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold gradient-bg text-white hover:opacity-90 transition-all"
                >
                  {t.common.back}
                </button>
                <button
                  onClick={handleFinalCancel}
                  disabled={stripeLoading}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
                >
                  {stripeLoading ? t.common.loading : t.billing.cancelPlan}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Overage Modal (Paid) */}
        {showOverageModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 min-h-screen">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative z-10">
              <h3 className="text-xl font-bold text-slate-900 mb-2">{subscription.overage_enabled ? t.common.disabled : t.common.enabled} {t.billing.overageCost}</h3>
              <p className="text-sm text-slate-600 mb-6">{t.billing.overageMinutes}</p>
              {!subscription.overage_enabled && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-900 mb-2">{t.billing.overageCost}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input type="number" min="0" step="50" value={overageBudget} onChange={(e) => setOverageBudget(Number(e.target.value))} className="w-full pl-8 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="100" />
                  </div>
                </div>
              )}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-6"><p className="text-xs text-blue-900"><span className="font-semibold">{t.billing.overageRate}</span> {formatPriceWithDecimals(currentPlan.price_per_extra_minute)}/{t.billing.perMinute}</p></div>
              <div className="flex gap-3">
                <button onClick={() => setShowOverageModal(false)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">{t.common.cancel}</button>
                <button onClick={() => handleToggleOverage(!subscription.overage_enabled)} className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors ${subscription.overage_enabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>{subscription.overage_enabled ? `${t.common.disabled} ${t.billing.overageCost}` : `${t.common.enabled} ${t.billing.overageCost}`}</button>
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

      {/* Trial Expired Banner */}
      {currentPlan && usage && usage.minutes_used >= usage.minutes_included && (
        <div className="relative overflow-hidden bg-gradient-to-r from-red-50 via-orange-50 to-red-50 border border-red-200 rounded-2xl p-6">
          <div className="relative z-10 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-red-900 mb-1">{t.billing.trialEnded}</h3>
              <p className="text-sm text-red-800 mb-3">
                {t.billing.trialEndedDesc}
              </p>
              <button
                onClick={() => {
                  const el = document.getElementById('plans-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-red-600 to-orange-600 text-white text-sm font-semibold hover:opacity-90 transition-all shadow-md"
              >
                {t.billing.upgradePlan}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Current Free Trial Plan */}
      {currentPlan && usage && (
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4">{t.billing.free}</h3>
          <div className="gradient-bg-subtle border border-slate-200 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-2xl font-bold text-slate-900">{t.billing.free}</h4>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${usage.minutes_used >= usage.minutes_included ? 'bg-red-100 text-red-700 border-red-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                    {usage.minutes_used >= usage.minutes_included ? t.billing.failed : t.billing.paid}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{t.billing.experienceFullPower}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-slate-900">$0</div>
                <div className="text-sm text-slate-500">{t.billing.oneTime}</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{t.billing.minutesUsed}</span>
                <span className="font-bold text-slate-900">{usage.minutes_used.toLocaleString()} / {usage.minutes_included.toLocaleString()} min</span>
              </div>
              <div className="h-2 bg-white/80 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-500 ${usagePercent >= 100 ? 'bg-red-500' : 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)]'}`} style={{ width: `${usagePercent}%` }} />
              </div>
              <p className="text-xs text-slate-600">~{getApproxCalls(usage.minutes_used)} calls used · {usage.minutes_used >= usage.minutes_included ? 'No minutes remaining' : `~${getApproxCalls(usage.minutes_included - usage.minutes_used)} remaining`}</p>
            </div>
            <div className="mt-4 pt-4 border-t border-amber-200 bg-amber-50/50 -m-6 p-4 rounded-b-xl">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div>
                  <p className="text-xs font-semibold text-amber-900">{t.billing.trialNoOverage}</p>
                  <p className="text-xs text-amber-800 mt-0.5">{t.billing.trialNoOverageDesc}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Choose Your Plan */}
      <div id="plans-section">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900 mb-1">{t.billing.upgradePlan}</h3>
            <p className="text-sm text-slate-600">{t.billing.changePlan}</p>
          </div>
          {plans.length > 0 && (
            <div className="inline-flex items-center gap-2 p-1 bg-slate-100 rounded-lg">
              <button onClick={() => setBillingCycle('monthly')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${billingCycle === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{t.billing.monthly}</button>
              <button onClick={() => setBillingCycle('annual')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${billingCycle === 'annual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                {t.billing.annual}<span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">{t.billing.saveUpTo}</span>
              </button>
            </div>
          )}
        </div>

        {plans.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-1">{t.billing.title}</h4>
            <p className="text-xs text-slate-500">{t.common.noData}</p>
          </div>
        ) : (
          <div className={`grid gap-4 ${higherPlans.length === 1 ? 'grid-cols-1 max-w-md' : higherPlans.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : higherPlans.length === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
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
                      <div className="gradient-bg text-white text-[9px] font-bold px-3 py-1 rounded-full shadow-md uppercase tracking-wide whitespace-nowrap">{t.billing.popular}</div>
                    </div>
                  )}
                  <div className={`rounded-xl p-4 transition-all flex flex-col h-full w-full ${isPopular ? 'border-2 border-[var(--color-primary)] bg-white shadow-xl shadow-[var(--color-primary)]/10 scale-105' : 'border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'}`}>
                    <div className="mb-3">
                      <h4 className="text-base font-bold text-slate-900 mb-2">{plan.name}</h4>
                      <p className="text-[11px] text-slate-600 leading-tight min-h-[2rem]">{plan.description}</p>
                    </div>
                    <div className="mb-3 pb-3 border-b border-slate-100 min-h-[4rem]">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-slate-900">{formatPrice(monthlyPrice)}</span>
                        <span className="text-xs text-slate-500">{t.billing.mo}</span>
                      </div>
                      {!isEnterprise && billingCycle === 'annual' && <div className="text-[10px] text-slate-500 mt-1">{formatPrice(yearlyTotal)}/{t.billing.yr}</div>}
                      {!isEnterprise && billingCycle === 'annual' && discountPercent > 0 && (
                        <div className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 mt-1">{t.billing.save} {discountPercent}%</div>
                      )}
                    </div>
                    <div className="mb-3 space-y-2 text-[11px]">
                      <div className="flex items-center justify-between"><span className="text-slate-500">Calls/month</span><span className="font-semibold text-slate-900">~{getApproxCalls(plan.minutes_included).toLocaleString()}</span></div>
                      <div className="flex items-center justify-between"><span className="text-slate-500">{t.billing.minutesIncludedLabel}</span><span className="font-semibold text-slate-900">{plan.minutes_included.toLocaleString()}</span></div>
                      <div className="flex items-center justify-between"><span className="text-slate-500">{t.billing.usersLabel}</span><span className="font-semibold text-slate-900">{plan.max_users === -1 ? t.billing.unlimited : plan.max_users}{EXTRA_SEAT_PRICE[plan.slug] ? ` (${formatPrice(EXTRA_SEAT_PRICE[plan.slug]!)}${t.billing.perSeat})` : ''}</span></div>
                      <div className="flex items-center justify-between"><span className="text-slate-500">{t.billing.concurrentCallsLabel}</span><span className="font-semibold text-slate-900">{plan.max_concurrent_calls === 999 ? '∞' : plan.max_concurrent_calls}</span></div>
                      <div className="flex items-center justify-between"><span className="text-slate-500">{t.billing.overageRateLabel}</span><span className="font-semibold text-slate-900">{plan.price_per_extra_minute > 0 ? `${formatPriceWithDecimals(plan.price_per_extra_minute)}${t.billing.min}` : '—'}</span></div>
                    </div>
                    <div className="flex-grow mb-3 pt-3 border-t border-slate-100">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{t.billing.keyFeatures}</p>
                      <div className="space-y-1.5 text-[11px]">
                        {getTranslatedFeatures(plan.slug).slice(0, 3).map((feature, idx) => (
                          <div key={idx} className="flex items-start gap-1.5"><svg className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span className="text-slate-700 leading-tight">{feature}</span></div>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => handleChangePlan(plan.id)} disabled={changing} className={`w-full py-2 rounded-lg text-xs font-semibold transition-all mt-auto ${isPopular ? 'gradient-bg text-white hover:opacity-90 shadow-md' : 'bg-slate-800 text-white hover:bg-slate-900'}`}>
                      {changing ? t.common.loading : isEnterprise ? t.billing.changePlan : t.billing.upgradePlan}
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
            <p className="font-semibold mb-1">{t.billing.needHelpChoosing}</p>
            <p className="text-blue-700">{t.billing.contactUsAt} <a href="mailto:billing@callengo.ai" className="underline">billing@callengo.ai</a> {t.billing.orViewOur} <a href="#" className="underline">{t.billing.pricingFaq}</a>.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
