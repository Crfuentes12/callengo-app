// components/agents/AgentsLibrary.tsx
'use client';

import { useState } from 'react';
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
}

export default function AgentsLibrary({ agentTemplates, companyAgents, companyId, company }: AgentsLibraryProps) {
  const [selectedAgent, setSelectedAgent] = useState<AgentTemplate | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const handleSelectAgent = (agent: AgentTemplate) => {
    setSelectedAgent(agent);
    setShowConfigModal(true);
  };

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 rounded-3xl p-8 shadow-2xl">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg">
              🎮
            </div>
            <h2 className="text-3xl font-bold text-white">AI Agent Gallery</h2>
          </div>
          <p className="text-lg text-indigo-200">
            Deploy specialized AI agents for your business. Each character has unique abilities and skills.
          </p>
        </div>
        {/* Decorative elements */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
        <div className="absolute left-0 bottom-0 w-64 h-64 bg-gradient-to-tr from-purple-500/10 to-pink-500/10 rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl"></div>
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

      {/* Empty state if no agents */}
      {agentTemplates.length === 0 && (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-2xl bg-slate-200 flex items-center justify-center mx-auto mb-4 text-4xl">
            🤖
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No agents available</h3>
          <p className="text-slate-600">Check back later for new AI agents.</p>
        </div>
      )}

      {showConfigModal && selectedAgent && (
        <AgentConfigModal
          agent={selectedAgent}
          companyId={companyId}
          company={company}
          onClose={() => {
            setShowConfigModal(false);
            setSelectedAgent(null);
          }}
        />
      )}
    </div>
  );
}