'use client';

import { Calendar, Phone, TrendingUp, AlertCircle, CreditCard, Users } from 'lucide-react';
import { SubscriptionPlan } from './PlanCard';

export interface Subscription {
  id: string;
  plan: SubscriptionPlan;
  billing_cycle: 'monthly' | 'annual';
  status: 'active' | 'cancelled' | 'past_due' | 'trial';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  trial_end: string | null;
  extra_users: number;
}

export interface UsageData {
  calls_made: number;
  calls_included: number;
  overage_calls: number;
  period_start: string;
  period_end: string;
}

interface CurrentPlanProps {
  subscription: Subscription;
  usage: UsageData;
  onManagePlan: () => void;
  onUpgrade: () => void;
}

const getStatusColor = (status: string) => {
  const colors = {
    'active': 'bg-green-500/10 text-green-400 border-green-500/30',
    'trial': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    'cancelled': 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    'past_due': 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return colors[status as keyof typeof colors] || colors.active;
};

const getStatusText = (status: string) => {
  const text = {
    'active': 'Activo',
    'trial': 'Período de prueba',
    'cancelled': 'Cancelado',
    'past_due': 'Pago vencido',
  };
  return text[status as keyof typeof text] || status;
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
};

export default function CurrentPlan({
  subscription,
  usage,
  onManagePlan,
  onUpgrade
}: CurrentPlanProps) {
  const { plan, billing_cycle, status, current_period_end, trial_end, extra_users, cancel_at_period_end } = subscription;
  const { calls_made, calls_included, overage_calls } = usage;

  const usagePercentage = Math.min((calls_made / calls_included) * 100, 100);
  const isNearLimit = usagePercentage >= 80;
  const isOverLimit = calls_made > calls_included;

  const currentPrice = billing_cycle === 'monthly' ? plan.price_monthly : plan.price_annual;
  const extraUsersCost = extra_users * (plan.price_per_extra_user || 0);
  const overageCost = overage_calls * plan.price_per_extra_call;
  const totalCost = currentPrice + extraUsersCost + overageCost;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-2xl">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(255 255 255) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }}></div>

        {/* Gradient overlay */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent blur-3xl"></div>

        <div className="relative p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-3xl font-black text-white">{plan.name}</h2>
                <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${getStatusColor(status)}`}>
                  {getStatusText(status)}
                </span>
              </div>
              <p className="text-slate-400 text-sm">{plan.description}</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black text-white mb-1">
                {formatPrice(currentPrice)}
              </div>
              <div className="text-sm text-slate-400">
                /{billing_cycle === 'monthly' ? 'mes' : 'año'}
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <Phone className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Llamadas</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {calls_made.toLocaleString()} <span className="text-sm text-slate-400">/ {calls_included.toLocaleString()}</span>
              </div>
            </div>

            {plan.max_users > 0 && (
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30">
                    <Users className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Usuarios</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {plan.max_users + extra_users}
                  {extra_users > 0 && (
                    <span className="text-sm text-slate-400 ml-2">
                      (+{extra_users} extra)
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/30">
                  <Calendar className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Renueva</span>
              </div>
              <div className="text-sm font-semibold text-white">
                {formatDate(current_period_end)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Progress Card */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Uso del Período Actual</h3>
          {isNearLimit && !isOverLimit && (
            <div className="flex items-center gap-2 bg-orange-500/10 text-orange-400 text-xs font-semibold px-3 py-1.5 rounded-full border border-orange-500/30">
              <AlertCircle className="w-3 h-3" />
              Cerca del límite
            </div>
          )}
          {isOverLimit && (
            <div className="flex items-center gap-2 bg-red-500/10 text-red-400 text-xs font-semibold px-3 py-1.5 rounded-full border border-red-500/30">
              <AlertCircle className="w-3 h-3" />
              Sobre el límite
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-400">
              {calls_made.toLocaleString()} de {calls_included.toLocaleString()} llamadas
            </span>
            <span className={`font-bold ${isOverLimit ? 'text-red-400' : isNearLimit ? 'text-orange-400' : 'text-green-400'}`}>
              {usagePercentage.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                isOverLimit
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : isNearLimit
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600'
                  : 'bg-gradient-to-r from-green-500 to-green-600'
              }`}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Overage Info */}
        {isOverLimit && (
          <div className="mt-4 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-grow">
                <div className="font-semibold text-red-400 mb-1">
                  Llamadas adicionales: {overage_calls.toLocaleString()}
                </div>
                <div className="text-sm text-slate-400">
                  Costo adicional estimado: <span className="font-bold text-red-400">{formatPrice(overageCost)}</span>
                  <span className="text-xs ml-1">
                    ({formatPrice(plan.price_per_extra_call)} por llamada)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Total Cost Breakdown */}
        {(extra_users > 0 || overageCost > 0) && (
          <div className="mt-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-300">Desglose del Período</span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Plan {plan.name}</span>
                <span className="text-white font-semibold">{formatPrice(currentPrice)}</span>
              </div>

              {extra_users > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">{extra_users} usuario(s) adicional(es)</span>
                  <span className="text-white font-semibold">{formatPrice(extraUsersCost)}</span>
                </div>
              )}

              {overageCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">{overage_calls} llamada(s) extra</span>
                  <span className="text-white font-semibold">{formatPrice(overageCost)}</span>
                </div>
              )}

              <div className="h-px bg-slate-700/50 my-2"></div>

              <div className="flex justify-between">
                <span className="text-white font-bold">Total Estimado</span>
                <span className="text-white font-bold text-lg">{formatPrice(totalCost)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Warnings */}
      {trial_end && new Date(trial_end) > new Date() && (
        <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-blue-400 mb-1">
                Período de Prueba
              </div>
              <div className="text-sm text-slate-400">
                Tu período de prueba termina el {formatDate(trial_end)}. Después de esta fecha, se te cobrará {formatPrice(currentPrice)}/{billing_cycle === 'monthly' ? 'mes' : 'año'}.
              </div>
            </div>
          </div>
        </div>
      )}

      {cancel_at_period_end && (
        <div className="rounded-xl bg-orange-500/5 border border-orange-500/20 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-orange-400 mb-1">
                Plan Programado para Cancelación
              </div>
              <div className="text-sm text-slate-400">
                Tu suscripción se cancelará el {formatDate(current_period_end)}. Puedes reactivarla en cualquier momento antes de esa fecha.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={onManagePlan}
          className="flex-1 py-3 px-6 rounded-xl font-semibold text-white bg-slate-700 hover:bg-slate-600 transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          Administrar Plan
        </button>
        {!isOverLimit && (
          <button
            onClick={onUpgrade}
            className="flex-1 py-3 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-[1.02]"
          >
            Actualizar Plan
          </button>
        )}
      </div>
    </div>
  );
}
