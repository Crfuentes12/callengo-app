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
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 rounded-2xl p-6 text-white shadow-lg shadow-indigo-500/20">
        <h2 className="text-2xl font-bold mb-2">Pre-Built AI Agents</h2>
        <p className="text-indigo-100">
          Choose an agent designed for your specific business need. Each agent is pre-trained and ready to use.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {agentTemplates.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onSelect={() => handleSelectAgent(agent)}
          />
        ))}
      </div>

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