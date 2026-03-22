// components/agents/AgentsLibrary.tsx
'use client';

import { useState } from 'react';
import { AgentTemplate, Company } from '@/types/supabase';
import AgentCard from './AgentCard';
import AgentConfigModal from './AgentConfigModal';
import { useTranslation } from '@/i18n';

interface CompanyAgentWithTemplate {
  id: string;
  company_id: string;
  agent_template_id: string;
  name: string;
  is_active: boolean;
  custom_task: string | null;
  custom_settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  agent_templates: AgentTemplate | null;
}

interface AgentsLibraryProps {
  agentTemplates: AgentTemplate[];
  companyAgents: CompanyAgentWithTemplate[];
  companyId: string;
  company: Company;
  companySettings?: Record<string, unknown>;
}

export default function AgentsLibrary({ agentTemplates, companyAgents, companyId, company, companySettings }: AgentsLibraryProps) {
  const { t } = useTranslation();
  const [selectedAgent, setSelectedAgent] = useState<AgentTemplate | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [pendingAgent, setPendingAgent] = useState<AgentTemplate | null>(null);

  const planSlug = (companySettings?.plan_slug as string) || 'free';
  const isLimitedPlan = ['free', 'starter'].includes(planSlug);
  const isFreePlan = planSlug === 'free';

  // Find the currently active agent for limited plans
  const activeCompanyAgent = companyAgents.find((ca) => ca.is_active);
  const activeTemplateId = activeCompanyAgent?.agent_template_id;

  const handleSelectAgent = (agent: AgentTemplate) => {
    // For Free plan: only allow selecting the locked agent
    if (isFreePlan && activeTemplateId && agent.id !== activeTemplateId) {
      // Show upgrade prompt
      return;
    }

    // For Starter plan: if switching to a different agent, show confirmation
    if (planSlug === 'starter' && activeTemplateId && agent.id !== activeTemplateId) {
      setPendingAgent(agent);
      setShowSwitchModal(true);
      return;
    }

    setSelectedAgent(agent);
    setShowConfigModal(true);
  };

  const handleConfirmSwitch = () => {
    if (pendingAgent) {
      setSelectedAgent(pendingAgent);
      setShowConfigModal(true);
    }
    setShowSwitchModal(false);
    setPendingAgent(null);
  };

  return (
    <div className="space-y-8">
      {/* Hero Header — AI-driven design */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-default)]">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary-50)] via-white to-blue-50" />
        {/* Subtle animated mesh pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 25% 25%, var(--color-primary) 1px, transparent 1px), radial-gradient(circle at 75% 75%, var(--color-accent) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        <div className="relative px-8 py-8">
          <div className="flex items-center gap-5 mb-5">
            {/* Animated AI icon */}
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl gradient-bg flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              {/* Pulse ring */}
              <div className="absolute -inset-1 rounded-2xl gradient-bg opacity-20 animate-pulse" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-[var(--color-ink)] tracking-tight">
                {t.agents.title}
              </h2>
              <p className="text-[var(--color-neutral-500)] mt-0.5 text-sm">
                {t.agents.subtitle}
              </p>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-6 p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-[var(--border-default)] shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div>
                <span className="text-xs text-[var(--color-neutral-500)] font-medium">Available</span>
                <p className="text-sm text-[var(--color-ink)] font-bold">{agentTemplates.length} agents</p>
              </div>
            </div>
            <div className="h-8 w-px bg-[var(--color-neutral-200)]" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              </div>
              <div>
                <span className="text-xs text-[var(--color-neutral-500)] font-medium">Status</span>
                <p className="text-sm text-emerald-600 font-bold">Operational</p>
              </div>
            </div>
            <div className="h-8 w-px bg-[var(--color-neutral-200)]" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <div>
                <span className="text-xs text-[var(--color-neutral-500)] font-medium">Powered by</span>
                <p className="text-sm text-[var(--color-ink)] font-bold">GPT-4o + Bland AI</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Agent limit banner for Free/Starter */}
      {isLimitedPlan && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                {isFreePlan
                  ? '1 agent available on Free plan (locked after selection)'
                  : '1 active agent at a time on Starter plan'}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Upgrade to Business for unlimited simultaneous agents
              </p>
            </div>
            <a href="/settings?tab=billing" className="flex-shrink-0 px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-colors">
              Upgrade
            </a>
          </div>
        </div>
      )}

      {/* Agent Cards Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agentTemplates.map((agent) => {
          const isActive = agent.id === activeTemplateId;
          const isLocked = isFreePlan && activeTemplateId && !isActive;

          return (
            <div key={agent.id} className="relative">
              {isLocked && (
                <div className="absolute inset-0 z-10 bg-[var(--color-neutral-900)]/10 backdrop-blur-[1px] rounded-2xl flex items-center justify-center">
                  <div className="bg-white/95 rounded-xl px-4 py-3 shadow-lg text-center max-w-[200px]">
                    <svg className="w-5 h-5 text-[var(--color-neutral-400)] mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <p className="text-xs font-semibold text-[var(--color-neutral-700)]">Upgrade</p>
                  </div>
                </div>
              )}
              <AgentCard
                agent={agent}
                onSelect={() => handleSelectAgent(agent)}
              />
            </div>
          );
        })}
      </div>

      {/* Switch Agent Confirmation Modal (Starter only) */}
      {showSwitchModal && pendingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--color-ink)]">{t.common.confirm}</h3>
                <p className="text-sm text-[var(--color-neutral-500)]">Starter plan: 1 active agent at a time</p>
              </div>
            </div>
            <p className="text-sm text-[var(--color-neutral-600)] mb-4">
              This will deactivate your current agent and activate <strong>{pendingAgent.name}</strong>. You can only have 1 active agent on the Starter plan.
            </p>
            <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-violet-700">
                <strong>Want all agents simultaneously?</strong>{' '}
                <a href="/settings?tab=billing" className="underline font-semibold">Upgrade to Business</a> for unlimited agents.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowSwitchModal(false); setPendingAgent(null); }} className="flex-1 px-4 py-2.5 bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] rounded-lg text-sm font-semibold hover:bg-[var(--color-neutral-200)] transition-colors">
                {t.common.cancel}
              </button>
              <button onClick={handleConfirmSwitch} className="flex-1 px-4 py-2.5 gradient-bg text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
                {t.common.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coming Soon Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-default)]">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-neutral-50)] via-white to-violet-50/30" />
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'radial-gradient(circle at 50% 50%, var(--color-primary) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
        }} />

        <div className="relative px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center shadow-sm">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[var(--color-ink)] mb-0.5">
                  New Agents Coming Soon
                </h3>
                <p className="text-[var(--color-neutral-500)] text-sm">
                  Expanding your automation capabilities with specialized agents
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-bold gradient-text">
                  1
                </div>
                <div className="text-xs text-[var(--color-neutral-500)] font-medium">
                  In Development
                </div>
              </div>
              <div className="w-px h-12 bg-[var(--color-neutral-200)]"></div>
              <div className="px-4 py-2 bg-white border border-[var(--border-default)] rounded-lg shadow-sm">
                <div className="text-xs text-[var(--color-neutral-500)] font-medium mb-0.5">
                  Next Release
                </div>
                <div className="text-sm font-semibold text-emerald-600">
                  Q3 2026
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Empty state if no solutions */}
      {agentTemplates.length === 0 && (
        <div className="text-center py-16 bg-[var(--color-neutral-50)] rounded-2xl border border-dashed border-[var(--border-strong)]">
          <div className="w-16 h-16 rounded-2xl gradient-bg-subtle flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-[var(--color-ink)] mb-2">{t.agents.noAgents}</h3>
          <p className="text-[var(--color-neutral-600)]">{t.agents.noAgents}</p>
        </div>
      )}

      {showConfigModal && selectedAgent && (
        <AgentConfigModal
          agent={selectedAgent}
          companyId={companyId}
          company={company}
          companySettings={companySettings}
          onClose={() => {
            setShowConfigModal(false);
            setSelectedAgent(null);
          }}
        />
      )}
    </div>
  );
}
