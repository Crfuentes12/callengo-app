'use client';

import { Check, Sparkles, Zap, Users, Crown } from 'lucide-react';

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_monthly: number;
  price_annual: number;
  calls_included: number;
  price_per_extra_call: number;
  max_users: number;
  price_per_extra_user: number;
  max_agents: number;
  features: string[];
  display_order: number;
  is_active: boolean;
}

interface PlanCardProps {
  plan: SubscriptionPlan;
  isCurrentPlan?: boolean;
  billingCycle: 'monthly' | 'annual';
  onSelect: () => void;
  isLoading?: boolean;
}

const getPlanIcon = (slug: string) => {
  const icons = {
    'starter': Sparkles,
    'business': Zap,
    'teams': Users,
    'enterprise': Crown,
  };
  return icons[slug as keyof typeof icons] || Sparkles;
};

const getPlanColor = (slug: string) => {
  const colors = {
    'starter': {
      gradient: 'from-blue-400 via-blue-500 to-cyan-600',
      badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      glow: 'group-hover:shadow-[0_0_40px_rgba(59,130,246,0.5)]',
      button: 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600',
    },
    'business': {
      gradient: 'from-indigo-400 via-indigo-500 to-purple-600',
      badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
      glow: 'group-hover:shadow-[0_0_40px_rgba(99,102,241,0.5)]',
      button: 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600',
    },
    'teams': {
      gradient: 'from-purple-400 via-purple-500 to-pink-600',
      badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      glow: 'group-hover:shadow-[0_0_40px_rgba(168,85,247,0.5)]',
      button: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600',
    },
    'enterprise': {
      gradient: 'from-amber-400 via-amber-500 to-orange-600',
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      glow: 'group-hover:shadow-[0_0_40px_rgba(245,158,11,0.5)]',
      button: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600',
    },
  };
  return colors[slug as keyof typeof colors] || colors.starter;
};

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
};

const formatDecimalPrice = (price: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
};

export default function PlanCard({
  plan,
  isCurrentPlan = false,
  billingCycle,
  onSelect,
  isLoading = false
}: PlanCardProps) {
  const Icon = getPlanIcon(plan.slug);
  const colors = getPlanColor(plan.slug);
  const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_annual;
  const savings = billingCycle === 'annual' ? ((plan.price_monthly * 12 - plan.price_annual * 12) / (plan.price_monthly * 12) * 100) : 0;
  const isPopular = plan.slug === 'business';
  const isEnterprise = plan.slug === 'enterprise';

  return (
    <div className="group relative h-full">
      {/* Popular badge */}
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
            MÁS POPULAR
          </div>
        </div>
      )}

      {/* Outer glow effect */}
      <div className={`absolute -inset-1 bg-gradient-to-r ${colors.gradient} rounded-2xl blur-lg opacity-0 ${isPopular ? 'opacity-40 group-hover:opacity-75' : 'group-hover:opacity-60'} transition-all duration-500`}></div>

      {/* Main card container */}
      <div className={`relative h-full rounded-2xl overflow-hidden shadow-2xl border-2 ${isPopular ? 'border-indigo-500/50' : 'border-slate-700/50'} group-hover:border-slate-500 transition-all duration-500 ${colors.glow} ${isPopular ? 'scale-105' : 'group-hover:scale-[1.02]'}`}>
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"></div>

        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(255 255 255) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }}></div>

        {/* Content */}
        <div className="relative p-8 flex flex-col h-full">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${colors.badge} border backdrop-blur-sm`}>
                <Icon className="w-6 h-6" />
              </div>
              {isCurrentPlan && (
                <div className="bg-green-500/10 text-green-400 text-xs font-semibold px-3 py-1.5 rounded-full border border-green-500/30">
                  Plan Actual
                </div>
              )}
            </div>

            <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{plan.description}</p>
          </div>

          {/* Pricing */}
          <div className="mb-6">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-5xl font-black text-white">
                {formatPrice(price)}
              </span>
              <span className="text-slate-400 text-sm font-medium">
                /{billingCycle === 'monthly' ? 'mes' : 'año'}
              </span>
            </div>
            {billingCycle === 'annual' && savings > 0 && (
              <div className="inline-flex items-center gap-1.5 bg-green-500/10 text-green-400 text-xs font-semibold px-3 py-1 rounded-full border border-green-500/30">
                <Sparkles className="w-3 h-3" />
                Ahorra {savings.toFixed(0)}% anualmente
              </div>
            )}
          </div>

          {/* Key metrics */}
          <div className="mb-6 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Llamadas incluidas</span>
              <span className="text-lg font-bold text-white">
                {plan.calls_included.toLocaleString()}
              </span>
            </div>
            <div className="h-px bg-slate-700/50"></div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Llamada extra</span>
              <span className="text-sm font-semibold text-slate-300">
                {formatDecimalPrice(plan.price_per_extra_call)}
              </span>
            </div>
            {plan.max_users > 0 && (
              <>
                <div className="h-px bg-slate-700/50"></div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Usuarios</span>
                  <span className="text-sm font-semibold text-slate-300">
                    {plan.max_users === -1 ? 'Ilimitados' : plan.max_users}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Features */}
          <div className="mb-8 flex-grow">
            <div className="space-y-3">
              {plan.features.map((feature, index) => (
                <div key={index} className="flex items-start gap-3 group/feature">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className={`p-0.5 rounded-full bg-gradient-to-r ${colors.gradient}`}>
                      <div className="bg-slate-900 rounded-full p-0.5">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  </div>
                  <span className="text-sm text-slate-300 leading-relaxed group-hover/feature:text-white transition-colors">
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={onSelect}
            disabled={isCurrentPlan || isLoading}
            className={`
              w-full py-4 px-6 rounded-xl font-bold text-white text-sm
              transition-all duration-300 shadow-lg
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isCurrentPlan
                ? 'bg-slate-700 cursor-not-allowed'
                : `${colors.button} hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]`
              }
            `}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Procesando...
              </div>
            ) : isCurrentPlan ? (
              'Plan Actual'
            ) : isEnterprise ? (
              'Contactar Ventas'
            ) : (
              'Seleccionar Plan'
            )}
          </button>
        </div>

        {/* Corner accents */}
        <div className={`absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-cyan-400/0 group-hover:border-cyan-400/80 transition-all duration-300`}></div>
        <div className={`absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-cyan-400/0 group-hover:border-cyan-400/80 transition-all duration-300`}></div>
        <div className={`absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-cyan-400/0 group-hover:border-cyan-400/80 transition-all duration-300`}></div>
        <div className={`absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-cyan-400/0 group-hover:border-cyan-400/80 transition-all duration-300`}></div>
      </div>
    </div>
  );
}
