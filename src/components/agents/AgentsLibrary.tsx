// components/agents/AgentsLibrary.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AgentTemplate, Company } from '@/types/supabase';
import AgentCard from './AgentCard';
import AgentConfigModal from './AgentConfigModal';

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
  const [selectedAgent, setSelectedAgent] = useState<AgentTemplate | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const handleSelectAgent = (agent: AgentTemplate) => {
    setSelectedAgent(agent);
    setShowConfigModal(true);
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
              AI Agents
            </h2>
            <p className="text-slate-600 mt-0.5">
              Deploy specialized AI agents to automate your business operations
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

      {/* Agent Cards Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agentTemplates.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onSelect={() => handleSelectAgent(agent)}
          />
        ))}
      </div>

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
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No solutions available yet</h3>
          <p className="text-slate-600">We're working on bringing AI-powered solutions to solve your business problems.</p>
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
