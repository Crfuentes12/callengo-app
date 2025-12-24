'use client';

import { useState, useEffect } from 'react';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_annual: number;
  calls_included: number;
  price_per_extra_call: number;
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
  calls_made: number;
  calls_included: number;
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
  const usagePercent = usage ? Math.min((usage.calls_made / usage.calls_included) * 100, 100) : 0;

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
                <span className="font-medium text-slate-700">Calls Used</span>
                <span className="font-bold text-slate-900">
                  {usage.calls_made.toLocaleString()} / {usage.calls_included.toLocaleString()}
                </span>
              </div>
              <div className="h-2 bg-white/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
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
            const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_annual;
            const isCurrentPlan = currentPlan?.id === plan.id;

            return (
              <div
                key={plan.id}
                className={`border rounded-xl p-5 transition-all ${
                  isCurrentPlan
                    ? 'border-indigo-200 bg-indigo-50/30'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">{plan.name}</h4>
                    <p className="text-xs text-slate-600">{plan.description}</p>
                  </div>
                  {isCurrentPlan && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                      Current
                    </span>
                  )}
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900">{formatPrice(price)}</span>
                    <span className="text-sm text-slate-500">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Calls included</span>
                    <span className="font-semibold text-slate-900">{plan.calls_included.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Extra call price</span>
                    <span className="font-semibold text-slate-900">${plan.price_per_extra_call}</span>
                  </div>
                  {plan.max_users > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">Users</span>
                      <span className="font-semibold text-slate-900">
                        {plan.max_users === -1 ? 'Unlimited' : plan.max_users}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleChangePlan(plan.id)}
                  disabled={isCurrentPlan || changing}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    isCurrentPlan
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : plan.slug === 'business'
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                      : 'bg-slate-700 text-white hover:bg-slate-800'
                  }`}
                >
                  {changing ? 'Processing...' : isCurrentPlan ? 'Current Plan' : plan.slug === 'enterprise' ? 'Contact Sales' : 'Select Plan'}
                </button>
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
