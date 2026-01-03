'use client';

import { useState, useEffect } from 'react';
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

// Currency conversion rates (same as in stripe-sync.ts)
const CURRENCY_RATES = {
  USD: { symbol: '$', multiplier: 1 },
  EUR: { symbol: '€', multiplier: 0.92 },
  GBP: { symbol: '£', multiplier: 0.79 },
};

export default function BillingSettings({ companyId }: BillingSettingsProps) {
  const { createCheckoutSession, openBillingPortal, loading: stripeLoading } = useStripe();
  const { currency, loading: currencyLoading } = useUserCurrency();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const [success, setSuccess] = useState('');
  const [showOverageModal, setShowOverageModal] = useState(false);
  const [overageBudget, setOverageBudget] = useState(10);

  // Helper functions for currency
  const convertPrice = (usdPrice: number) => {
    const rate = CURRENCY_RATES[currency] || CURRENCY_RATES.USD;
    return Math.round(usdPrice * rate.multiplier);
  };

  const formatPrice = (usdPrice: number) => {
    const rate = CURRENCY_RATES[currency] || CURRENCY_RATES.USD;
    const converted = Math.round(usdPrice * rate.multiplier);
    return `${rate.symbol}${converted}`;
  };

  const formatPriceWithDecimals = (usdPrice: number) => {
    const rate = CURRENCY_RATES[currency] || CURRENCY_RATES.USD;
    const converted = usdPrice * rate.multiplier;
    // Show up to 2 decimals, remove trailing zeros
    const formatted = converted.toFixed(2).replace(/\.?0+$/, '');
    return `${rate.symbol}${formatted}`;
  };

  const getCurrencySymbol = () => {
    return CURRENCY_RATES[currency]?.symbol || '$';
  };

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [plansRes, subRes] = await Promise.all([
        fetch('/api/billing/plans'),
        fetch(`/api/billing/subscription?companyId=${companyId}`)
      ]);

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData);
      }

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
  };

  const handleChangePlan = async (planId: string) => {
    const selectedPlan = plans.find(p => p.id === planId);
    if (selectedPlan?.slug === 'enterprise') {
      window.open('mailto:sales@callengo.ai?subject=Enterprise Plan Inquiry', '_blank');
      return;
    }

    // If it's the Free plan, use the old API
    if (selectedPlan?.slug === 'free') {
      try {
        setChanging(true);
        setSuccess('');

        const response = await fetch('/api/billing/change-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, planId, billingCycle })
        });

        if (response.ok) {
          setSuccess('Switched to Free plan successfully!');
          await fetchData();
        } else {
          alert('Failed to change plan');
        }
      } catch (error) {
        console.error('Error changing plan:', error);
        alert('Failed to change plan');
      } finally {
        setChanging(false);
      }
      return;
    }

    // For paid plans, redirect to Stripe Checkout
    try {
      setChanging(true);
      setSuccess('');

      await createCheckoutSession({
        planId,
        billingCycle,
        currency,
      });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to start checkout process');
      setChanging(false);
    }
  };

  const handleToggleOverage = async (enabled: boolean) => {
    if (!subscription) return;

    // Validate budget when enabling
    if (enabled && overageBudget <= 0) {
      alert('Please set a budget greater than $0');
      return;
    }

    try {
      const response = await fetch('/api/billing/update-overage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          subscriptionId: subscription.id,
          enabled,
          budget: enabled ? overageBudget : 0
        })
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
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-500">Loading billing information...</p>
        </div>
      </div>
    );
  }

  const currentPlan = subscription?.plan;
  const usagePercent = usage ? Math.min((usage.minutes_used / usage.minutes_included) * 100, 100) : 0;

  // Calculate approximate calls based on average duration
  const getApproxCalls = (minutes: number, avgDuration: number = 3) => {
    return Math.floor(minutes / avgDuration);
  };

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {success && (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-emerald-700 font-medium">{success}</p>
        </div>
      )}

      {/* Current Plan */}
      {currentPlan && usage && (
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4">Current Plan</h3>
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-2xl font-bold text-slate-900">{currentPlan.name}</h4>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                    {subscription.status === 'trial' ? 'Trial' : 'Active'}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{currentPlan.description}</p>

                {/* Billing Portal Button - Only show for paid plans with Stripe */}
                {currentPlan.slug !== 'free' && subscription.status === 'active' && (
                  <button
                    onClick={() => openBillingPortal()}
                    disabled={stripeLoading}
                    className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {stripeLoading ? 'Loading...' : 'Manage Subscription & Payment'}
                  </button>
                )}
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-slate-900">
                  {formatPrice(subscription.billing_cycle === 'monthly' ? currentPlan.price_monthly : currentPlan.price_annual)}
                </div>
                <div className="text-sm text-slate-500">/{subscription.billing_cycle === 'monthly' ? 'month' : 'year'}</div>
                {subscription.current_period_end && (
                  <div className="text-xs text-slate-500 mt-1">
                    Renews {formatDate(subscription.current_period_end)}
                  </div>
                )}
              </div>
            </div>

            {/* Usage Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">Minutes Used</span>
                <span className="font-bold text-slate-900">
                  {usage.minutes_used.toLocaleString()} / {usage.minutes_included.toLocaleString()} min
                </span>
              </div>
              <div className="h-2 bg-white/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-600">
                ~{getApproxCalls(usage.minutes_used)} calls made • ~{getApproxCalls(usage.minutes_included - usage.minutes_used)} remaining
              </p>
            </div>

            {/* Free Plan Notice */}
            {currentPlan.slug === 'free' && (
              <div className="mt-4 pt-4 border-t border-amber-200 bg-amber-50/50 -m-6 p-4 rounded-b-xl">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-amber-900">One-Time Credit</p>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Your 15 free minutes are for testing only and <strong>do not renew</strong>.
                      For ongoing use, please upgrade to a paid plan.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Paid Plan Renewal */}
            {currentPlan.slug !== 'free' && subscription.current_period_end && (
              <div className="mt-4 pt-4 border-t border-indigo-100">
                <p className="text-xs text-slate-600">
                  Renews on <span className="font-semibold text-slate-900">{formatDate(subscription.current_period_end)}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overage Controls */}
      {subscription && (
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-4">Overage Controls</h3>
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            {/* Free Plan Warning */}
            {currentPlan?.slug === 'free' && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h5 className="font-semibold text-amber-900 text-sm mb-1">Free Plan Notice</h5>
                    <p className="text-xs text-amber-800">
                      Your 15 free minutes are <strong>one-time only</strong>, not monthly. Overage rate: <strong>$0.80/min</strong>. Max budget: <strong>$20</strong>.
                      For ongoing use, upgrade to a paid plan.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">Auto-Overage Billing</h4>
                <p className="text-sm text-slate-600">
                  {currentPlan?.slug === 'free'
                    ? 'Continue making calls after your 15 free minutes run out'
                    : 'Continue making calls even after your monthly minutes run out'}
                </p>
              </div>
              <button
                onClick={() => setShowOverageModal(true)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  subscription.overage_enabled
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {subscription.overage_enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            {subscription.overage_enabled && (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Overage Budget</span>
                  <span className="text-sm font-semibold text-slate-900">{formatPrice(subscription.overage_budget)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Overage Spent This Period</span>
                  <span className="text-sm font-semibold text-slate-900">{formatPrice(subscription.overage_spent)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Alert Level</span>
                  <span className="text-sm font-semibold text-slate-900">{subscription.overage_alert_level}%</span>
                </div>

                {/* Overage Progress Bar */}
                <div className="space-y-1">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        subscription.overage_spent >= subscription.overage_budget
                          ? 'bg-red-500'
                          : subscription.overage_spent >= subscription.overage_budget * 0.85
                          ? 'bg-orange-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((subscription.overage_spent / subscription.overage_budget) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    {formatPrice(subscription.overage_budget - subscription.overage_spent)} remaining
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overage Modal */}
      {showOverageModal && subscription && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 min-h-screen">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative z-10">
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              {subscription.overage_enabled ? 'Disable' : 'Enable'} Auto-Overage
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              {subscription.overage_enabled
                ? 'Disabling auto-overage will stop all calls once you reach your plan limits.'
                : 'Enable auto-overage to continue making calls beyond your plan limits. You\'ll be charged at your plan\'s overage rate.'}
            </p>

            {!subscription.overage_enabled && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  {currentPlan?.slug === 'free' ? 'Overage Budget (Max $20)' : 'Monthly Overage Budget'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    type="number"
                    min="0"
                    max={currentPlan?.slug === 'free' ? 20 : undefined}
                    step={currentPlan?.slug === 'free' ? '5' : '50'}
                    value={overageBudget}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      const maxBudget = currentPlan?.slug === 'free' ? 20 : value;
                      setOverageBudget(Math.min(value, maxBudget));
                    }}
                    className="w-full pl-8 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={currentPlan?.slug === 'free' ? '10' : '100'}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {currentPlan?.slug === 'free'
                    ? 'Free plan has a maximum overage budget of $20. Set to 0 to disable overage.'
                    : 'Calls will stop when you reach this overage limit. Set to 0 for unlimited.'}
                </p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-6">
              <p className="text-xs text-blue-900">
                <span className="font-semibold">Current overage rate:</span> {formatPriceWithDecimals(currentPlan?.price_per_extra_minute || 0)}/minute
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowOverageModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleToggleOverage(!subscription.overage_enabled)}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors ${
                  subscription.overage_enabled
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {subscription.overage_enabled ? 'Disable Overage' : 'Enable Overage'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Available Plans */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900 mb-1">Choose Your Plan</h3>
            <p className="text-sm text-slate-600">Select the perfect plan for your needs</p>
          </div>

          {/* Billing Cycle Toggle */}
          {plans.length > 0 && (
            <div className="inline-flex items-center gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  billingCycle === 'annual'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Annual
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Save up to 12%</span>
              </button>
            </div>
          )}
        </div>

        {/* Plans Grid */}
        {plans.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
            <svg className="w-12 h-12 text-slate-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h4 className="text-sm font-semibold text-slate-700 mb-1">Billing Setup Required</h4>
            <p className="text-xs text-slate-500 mb-4">The billing tables need to be created in your database.</p>
            <p className="text-xs text-slate-600">Run the <code className="px-2 py-1 bg-slate-200 rounded font-mono">supabase-billing-migration.sql</code> script in your Supabase SQL editor.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {plans.map((plan) => {
            const isEnterprise = plan.slug === 'enterprise';
            const isPopular = plan.slug === 'business';
            const isCurrentPlan = currentPlan?.id === plan.id;

            // price_annual is the monthly rate when paid annually, NOT the yearly total
            const monthlyPrice = billingCycle === 'monthly' ? plan.price_monthly : plan.price_annual;
            const yearlyTotal = plan.price_annual * 12;

            // Calculate discount percentage
            const discountPercent = !isEnterprise && billingCycle === 'annual'
              ? Math.round(((plan.price_monthly * 12 - yearlyTotal) / (plan.price_monthly * 12)) * 100)
              : 0;

            return (
              <div key={plan.id} className="relative flex">
                {/* Popular Badge - Corner ribbon */}
                {isPopular && (
                  <div className="absolute top-0 right-0 z-10 overflow-hidden w-16 h-16 pointer-events-none">
                    <div className="absolute top-3 -right-6 w-20 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[9px] font-bold py-0.5 transform rotate-45 shadow-md text-center">
                      BEST VALUE
                    </div>
                  </div>
                )}

                <div
                  className={`rounded-xl p-4 transition-all flex flex-col h-full w-full overflow-hidden ${
                    isCurrentPlan
                      ? 'border-2 border-indigo-200 bg-indigo-50/30'
                      : isPopular
                      ? 'border-2 border-indigo-500 bg-white shadow-xl shadow-indigo-500/10 scale-105'
                      : 'border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  {/* Header */}
                  <div className="mb-3">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-base font-bold text-slate-900">{plan.name}</h4>
                      {isCurrentPlan && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-tight">{plan.description}</p>
                  </div>

                  {/* Pricing */}
                  <div className="mb-3 pb-3 border-b border-slate-100">
                    <div className="flex items-baseline gap-1">
                      {isEnterprise && <span className="text-xs text-slate-500 font-medium">From</span>}
                      <span className="text-2xl font-black text-slate-900">{formatPrice(monthlyPrice)}</span>
                      <span className="text-xs text-slate-500">/mo</span>
                    </div>

                    {/* Show yearly total in small text for annual plans */}
                    {!isEnterprise && billingCycle === 'annual' && (
                      <div className="text-[10px] text-slate-500 mt-1">
                        {formatPrice(yearlyTotal)}/year
                      </div>
                    )}

                    {/* Show discount badge for annual billing */}
                    {!isEnterprise && billingCycle === 'annual' && discountPercent > 0 && (
                      <div className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 mt-1">
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                        </svg>
                        Save {discountPercent}%
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <div className="flex-grow mb-3">
                    <div className="space-y-1.5 text-[11px]">
                      {/* Minutes */}
                      <div className="flex items-start gap-1.5">
                        <svg className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-slate-700 leading-tight">
                          <span className="font-semibold text-slate-900">{plan.minutes_included.toLocaleString()}</span> min/mo
                        </span>
                      </div>

                      {/* Max call duration */}
                      <div className="flex items-start gap-1.5">
                        <svg className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-slate-700 leading-tight">
                          <span className="font-semibold text-slate-900">{plan.max_call_duration} min</span> max call
                        </span>
                      </div>

                      {/* Extra minute price */}
                      <div className="flex items-start gap-1.5">
                        <svg className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-slate-700 leading-tight">
                          <span className="font-semibold text-slate-900">{formatPriceWithDecimals(plan.price_per_extra_minute)}</span> overage
                        </span>
                      </div>

                      {/* Concurrent calls */}
                      <div className="flex items-start gap-1.5">
                        <svg className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-slate-700 leading-tight">
                          <span className="font-semibold text-slate-900">{plan.max_concurrent_calls}</span> concurrent
                        </span>
                      </div>

                      {/* Call limits (if any) */}
                      {(plan.max_calls_per_hour || plan.max_calls_per_day) && (
                        <div className="flex items-start gap-1.5">
                          <svg className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-slate-700 leading-tight">
                            {plan.max_calls_per_hour && <span><span className="font-semibold text-slate-900">{plan.max_calls_per_hour}</span>/hr</span>}
                            {plan.max_calls_per_hour && plan.max_calls_per_day && ', '}
                            {plan.max_calls_per_day && <span><span className="font-semibold text-slate-900">{plan.max_calls_per_day}</span>/day</span>}
                          </span>
                        </div>
                      )}

                      {/* Plan-specific features - Dynamically loaded */}
                      {getPlanFeatures(plan.slug).map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <svg className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-slate-700 leading-tight">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Button - Always at bottom */}
                  <button
                    onClick={() => handleChangePlan(plan.id)}
                    disabled={isCurrentPlan || changing}
                    className={`w-full py-2 rounded-lg text-xs font-semibold transition-all mt-auto ${
                      isCurrentPlan
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : isPopular
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-md'
                        : 'bg-slate-800 text-white hover:bg-slate-900'
                    }`}
                  >
                    {changing ? 'Processing...' : isCurrentPlan ? 'Current' : isEnterprise ? 'Contact Sales' : 'Get Started'}
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
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Need help choosing a plan?</p>
            <p className="text-blue-700">Contact us at <a href="mailto:billing@callengo.ai" className="underline">billing@callengo.ai</a> or view our <a href="#" className="underline">pricing FAQ</a>.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
