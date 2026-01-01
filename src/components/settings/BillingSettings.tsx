'use client';

import { useState, useEffect } from 'react';

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
  features: string[];
}

interface Subscription {
  id: string;
  plan: Plan;
  billing_cycle: 'monthly' | 'annual';
  status: string;
  current_period_end: string;
}

interface Usage {
  minutes_used: number;
  minutes_included: number;
}

interface BillingSettingsProps {
  companyId: string;
}

export default function BillingSettings({ companyId }: BillingSettingsProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const [success, setSuccess] = useState('');

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

    try {
      setChanging(true);
      setSuccess('');

      const response = await fetch('/api/billing/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, planId, billingCycle })
      });

      if (response.ok) {
        setSuccess('Plan updated successfully!');
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
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price);
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
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-slate-900">
                  {formatPrice(subscription.billing_cycle === 'monthly' ? currentPlan.price_monthly : currentPlan.price_annual)}
                </div>
                <div className="text-sm text-slate-500">/{subscription.billing_cycle === 'monthly' ? 'month' : 'year'}</div>
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

            {subscription.current_period_end && (
              <div className="mt-4 pt-4 border-t border-indigo-100">
                <p className="text-xs text-slate-600">
                  Renews on <span className="font-semibold text-slate-900">{formatDate(subscription.current_period_end)}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Available Plans */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Available Plans</h3>

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
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Save up to 20%</span>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div key={plan.id} className="relative">
                {/* Popular Badge - Outside the card */}
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-full shadow-lg uppercase tracking-wide">
                      ⭐ Most Popular
                    </div>
                  </div>
                )}

                <div
                  className={`rounded-xl p-5 transition-all flex flex-col h-full ${
                    isCurrentPlan
                      ? 'border-2 border-indigo-200 bg-indigo-50/30'
                      : isPopular
                      ? 'border-[3px] border-indigo-500 bg-white shadow-lg shadow-indigo-500/20'
                      : 'border border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-grow">
                      <h4 className="font-bold text-slate-900 mb-1">{plan.name}</h4>
                      <p className="text-xs text-slate-600 min-h-[32px]">{plan.description}</p>
                    </div>
                    {isCurrentPlan && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 ml-2 flex-shrink-0">
                        Current
                      </span>
                    )}
                  </div>

                  {/* Pricing */}
                  <div className="mb-4">
                    <div className="flex items-baseline gap-1 mb-1">
                      {isEnterprise && <span className="text-sm text-slate-500 font-medium mr-1">From</span>}
                      <span className="text-3xl font-black text-slate-900">{formatPrice(monthlyPrice)}</span>
                      <span className="text-sm text-slate-500">/mo</span>
                    </div>

                    {/* Show yearly total in small text for annual plans */}
                    {!isEnterprise && billingCycle === 'annual' && (
                      <div className="text-xs text-slate-500 mb-2">
                        {formatPrice(yearlyTotal)} billed annually
                      </div>
                    )}

                    {/* Show discount badge for annual billing */}
                    {!isEnterprise && billingCycle === 'annual' && discountPercent > 0 && (
                      <div className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md bg-green-100 text-green-700 border border-green-200">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                        </svg>
                        Save {discountPercent}% annually
                      </div>
                    )}
                  </div>

                  {/* Features - Fixed height section */}
                  <div className="flex-grow mb-4">
                    <div className="space-y-2 text-xs">
                      {/* Minutes */}
                      <div className="flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-slate-700">
                          <span className="font-semibold text-slate-900">{plan.minutes_included.toLocaleString()}</span> minutes/month (~{getApproxCalls(plan.minutes_included, plan.max_call_duration)} calls)
                        </span>
                      </div>

                      {/* Max call duration */}
                      <div className="flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-slate-700">
                          <span className="font-semibold text-slate-900">{plan.max_call_duration} min</span> max per call
                        </span>
                      </div>

                      {/* Extra minute price */}
                      <div className="flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-slate-700">
                          <span className="font-semibold text-slate-900">${plan.price_per_extra_minute.toFixed(2)}</span> per extra minute
                        </span>
                      </div>

                      {/* Users */}
                      <div className="flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-slate-700">
                          {isEnterprise ? (
                            <span className="font-semibold text-slate-900">Unlimited</span>
                          ) : plan.max_users === -1 ? (
                            <span className="font-semibold text-slate-900">Unlimited</span>
                          ) : (
                            <span><span className="font-semibold text-slate-900">{plan.max_users}</span> user{plan.max_users > 1 ? 's' : ''}</span>
                          )}
                          {' '}(dashboard access)
                        </span>
                      </div>

                      {/* Plan-specific features */}
                      {plan.slug === 'starter' && (
                        <>
                          <div className="flex items-start gap-2">
                            <svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-slate-700">Best for testing & validation</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-slate-700">CSV/Excel data export</span>
                          </div>
                        </>
                      )}

                      {plan.slug === 'business' && (
                        <>
                          <div className="flex items-start gap-2">
                            <svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-slate-700">Automated follow-ups</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-slate-700">Multiple agents in parallel</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-slate-700">All enriched data is yours</span>
                          </div>
                        </>
                      )}

                      {plan.slug === 'teams' && (
                        <>
                          <div className="flex items-start gap-2">
                            <svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-slate-700">Team collaboration & permissions</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-slate-700">Advanced retry & voicemail logic</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-slate-700">Governance & audit logs</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-slate-700">Priority support</span>
                          </div>
                        </>
                      )}

                      {isEnterprise && (
                        <>
                          <div className="flex items-start gap-2">
                            <svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-slate-700">Custom agents & workflows</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-slate-700">Dedicated account manager</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-slate-700">SLA & compliance support</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <svg className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-slate-700 italic">Volume-based usage pricing</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Button - Always at bottom */}
                  <button
                    onClick={() => handleChangePlan(plan.id)}
                    disabled={isCurrentPlan || changing}
                    className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all mt-auto ${
                      isCurrentPlan
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : isPopular
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/30'
                        : 'bg-slate-700 text-white hover:bg-slate-800'
                    }`}
                  >
                    {changing ? 'Processing...' : isCurrentPlan ? 'Current Plan' : isEnterprise ? 'Contact Sales' : 'Select Plan'}
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
