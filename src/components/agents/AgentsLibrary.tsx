// components/agents/AgentsLibrary.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
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
  custom_settings: any;
  created_at: string;
  updated_at: string;
  agent_templates: AgentTemplate | null;
}

interface AgentsLibraryProps {
  agentTemplates: AgentTemplate[];
  companyAgents: any[];
  companyId: string;
  company: Company;
  companySettings?: any;
}

export default function AgentsLibrary({ agentTemplates, companyAgents, companyId, company, companySettings }: AgentsLibraryProps) {
  const { t } = useTranslation();
  const [selectedAgent, setSelectedAgent] = useState<AgentTemplate | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [pendingAgent, setPendingAgent] = useState<AgentTemplate | null>(null);

  const planSlug = companySettings?.plan_slug || 'free';
  const isLimitedPlan = ['free', 'starter'].includes(planSlug);
  const isFreePlan = planSlug === 'free';

  // Find the currently active agent for limited plans
  const activeCompanyAgent = companyAgents.find((ca: any) => ca.is_active);
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
      {/* Page Header */}
      <div className="gradient-bg-subtle rounded-2xl p-8 border border-slate-200">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl gradient-bg flex items-center justify-center shadow-md overflow-hidden">
            <Image
              src="/agent-avatars/agent-face.png"
              alt="Agent"
              width={56}
              height={56}
              className="object-cover"
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {t.agents.title}
            </h2>
            <p className="text-slate-600 mt-0.5">
              {t.agents.subtitle}
            </p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 mt-6 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
            <span className="text-xs text-slate-500 font-medium">Available:</span>
            <span className="text-sm text-slate-900 font-semibold">{agentTemplates.length}</span>
          </div>
          <div className="h-4 w-px bg-slate-200"></div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full"></div>
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <span className="text-sm text-emerald-600 font-semibold">Ready</span>
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
                <div className="absolute inset-0 z-10 bg-slate-900/10 backdrop-blur-[1px] rounded-2xl flex items-center justify-center">
                  <div className="bg-white/95 rounded-xl px-4 py-3 shadow-lg text-center max-w-[200px]">
                    <svg className="w-5 h-5 text-slate-400 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <p className="text-xs font-semibold text-slate-700">Upgrade</p>
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
                <h3 className="text-lg font-bold text-slate-900">{t.common.confirm}</h3>
                <p className="text-sm text-slate-500">Starter plan: 1 active agent at a time</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              This will deactivate your current agent and activate <strong>{pendingAgent.name}</strong>. You can only have 1 active agent on the Starter plan.
            </p>
            <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-violet-700">
                <strong>Want all agents simultaneously?</strong>{' '}
                <a href="/settings?tab=billing" className="underline font-semibold">Upgrade to Business</a> for unlimited agents.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowSwitchModal(false); setPendingAgent(null); }} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors">
                {t.common.cancel}
              </button>
              <button onClick={handleConfirmSwitch} className="flex-1 px-4 py-2.5 gradient-bg text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
                {t.common.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Additional Agents Banner */}
      <div className="gradient-bg-subtle rounded-2xl border border-slate-200">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center shadow-sm">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-0.5">
                  New Agents Coming Soon
                </h3>
                <p className="text-slate-600 text-sm">
                  Expanding your automation capabilities with specialized agents
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-bold gradient-text">
                  2
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  In Development
                </div>
              </div>
              <div className="w-px h-12 bg-slate-200"></div>
              <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm">
                <div className="text-xs text-slate-500 font-medium mb-0.5">
                  Next Release
                </div>
                <div className="text-sm font-semibold text-emerald-600">
                  Q1 2026
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Empty state if no solutions */}
      {agentTemplates.length === 0 && (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
          <div className="w-16 h-16 rounded-2xl gradient-bg-subtle flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">{t.agents.noAgents}</h3>
          <p className="text-slate-600">{t.agents.noAgents}</p>
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
