'use client';

import { useState, useEffect } from 'react';
import { CreditCard, Receipt, Sparkles, FileText, Download, ExternalLink } from 'lucide-react';
import PlanCard, { SubscriptionPlan } from './PlanCard';
import CurrentPlan, { Subscription, UsageData } from './CurrentPlan';

interface BillingHistoryItem {
  id: string;
  amount: number;
  currency: string;
  description: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  invoice_url: string | null;
  billing_date: string;
}

interface BillingManagerProps {
  companyId: string;
}

export default function BillingManager({ companyId }: BillingManagerProps) {
  const [activeTab, setActiveTab] = useState<'current' | 'plans' | 'history'>('current');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [isLoading, setIsLoading] = useState(true);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingHistoryItem[]>([]);

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const fetchData = async () => {
    try {
      setIsLoading(true);

      // Fetch plans
      const plansResponse = await fetch('/api/billing/plans');
      const plansData = await plansResponse.json();
      setPlans(plansData);

      // Fetch current subscription
      const subResponse = await fetch(`/api/billing/subscription?companyId=${companyId}`);
      const subData = await subResponse.json();
      setSubscription(subData.subscription);
      setUsage(subData.usage);

      // Fetch billing history
      const historyResponse = await fetch(`/api/billing/history?companyId=${companyId}`);
      const historyData = await historyResponse.json();
      setBillingHistory(historyData);

    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    // For Enterprise plan, open contact form
    const selectedPlan = plans.find(p => p.id === planId);
    if (selectedPlan?.slug === 'enterprise') {
      window.open('mailto:sales@callengo.ai?subject=Enterprise Plan Inquiry', '_blank');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/billing/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          planId,
          billingCycle
        })
      });

      if (response.ok) {
        await fetchData();
        setActiveTab('current');
      }
    } catch (error) {
      console.error('Error changing plan:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManagePlan = () => {
    setActiveTab('plans');
  };

  const handleUpgrade = () => {
    setActiveTab('plans');
  };

  const getStatusColor = (status: string) => {
    const colors = {
      'paid': 'bg-green-500/10 text-green-400 border-green-500/30',
      'pending': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
      'failed': 'bg-red-500/10 text-red-400 border-red-500/30',
      'refunded': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    };
    return colors[status as keyof typeof colors] || colors.paid;
  };

  const getStatusText = (status: string) => {
    const text = {
      'paid': 'Pagado',
      'pending': 'Pendiente',
      'failed': 'Fallido',
      'refunded': 'Reembolsado',
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

  const formatPrice = (price: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  if (isLoading && !subscription) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Cargando información de facturación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('current')}
            className={`
              px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300
              ${activeTab === 'current'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Plan Actual
            </div>
          </button>

          <button
            onClick={() => setActiveTab('plans')}
            className={`
              px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300
              ${activeTab === 'plans'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Todos los Planes
            </div>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`
              px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300
              ${activeTab === 'history'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Historial
            </div>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="animate-fadeIn">
        {/* Current Plan Tab */}
        {activeTab === 'current' && subscription && usage && (
          <CurrentPlan
            subscription={subscription}
            usage={usage}
            onManagePlan={handleManagePlan}
            onUpgrade={handleUpgrade}
          />
        )}

        {/* All Plans Tab */}
        {activeTab === 'plans' && (
          <div className="space-y-8">
            {/* Billing Cycle Toggle */}
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-3 p-1.5 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`
                    px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300
                    ${billingCycle === 'monthly'
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white'
                    }
                  `}
                >
                  Mensual
                </button>
                <button
                  onClick={() => setBillingCycle('annual')}
                  className={`
                    px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center gap-2
                    ${billingCycle === 'annual'
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white'
                    }
                  `}
                >
                  Anual
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-bold rounded-full">
                    -12% a -20%
                  </span>
                </button>
              </div>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {plans
                .filter(p => p.is_active)
                .sort((a, b) => a.display_order - b.display_order)
                .map(plan => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    isCurrentPlan={subscription?.plan.id === plan.id}
                    billingCycle={billingCycle}
                    onSelect={() => handleSelectPlan(plan.id)}
                    isLoading={isLoading}
                  />
                ))}
            </div>

            {/* FAQ or Additional Info */}
            <div className="mt-12 p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
              <h3 className="text-lg font-bold text-white mb-4">¿Preguntas frecuentes?</h3>
              <div className="space-y-4 text-sm text-slate-300">
                <div>
                  <p className="font-semibold text-white mb-1">¿Puedo cambiar de plan en cualquier momento?</p>
                  <p className="text-slate-400">Sí, puedes actualizar o degradar tu plan cuando quieras. Los cambios se aplicarán inmediatamente y se prorratearán en tu próxima factura.</p>
                </div>
                <div>
                  <p className="font-semibold text-white mb-1">¿Qué pasa si excedo mis llamadas incluidas?</p>
                  <p className="text-slate-400">Se te cobrará por cada llamada adicional según la tarifa de tu plan. Recibirás notificaciones cuando te acerques al límite.</p>
                </div>
                <div>
                  <p className="font-semibold text-white mb-1">¿Puedo cancelar en cualquier momento?</p>
                  <p className="text-slate-400">Sí, sin compromiso. Puedes cancelar tu suscripción en cualquier momento y seguirás teniendo acceso hasta el final de tu período de facturación.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Billing History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {billingHistory.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-400 mb-2">
                  No hay historial de facturación
                </h3>
                <p className="text-sm text-slate-500">
                  Tus facturas aparecerán aquí una vez que se procesen los pagos.
                </p>
              </div>
            ) : (
              billingHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-6 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-grow">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-white">
                          {item.description || 'Pago de suscripción'}
                        </h4>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${getStatusColor(item.status)}`}>
                          {getStatusText(item.status)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400">
                        {formatDate(item.billing_date)}
                      </p>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">
                          {formatPrice(item.amount, item.currency)}
                        </div>
                      </div>

                      {item.invoice_url && (
                        <a
                          href={item.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all duration-300 group"
                        >
                          <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Support Contact */}
            {billingHistory.length > 0 && (
              <div className="mt-8 p-6 rounded-xl bg-blue-500/5 border border-blue-500/20">
                <div className="flex items-start gap-3">
                  <ExternalLink className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-400 mb-1">
                      ¿Necesitas ayuda con una factura?
                    </h4>
                    <p className="text-sm text-slate-400">
                      Contáctanos en{' '}
                      <a href="mailto:billing@callengo.ai" className="text-blue-400 hover:underline">
                        billing@callengo.ai
                      </a>{' '}
                      y te ayudaremos con cualquier pregunta sobre facturación.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
