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
      {/* Hero Banner - Character Selection Style */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-3xl p-10 shadow-2xl border-2 border-slate-800">
        {/* Animated background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent"></div>

        {/* Scan lines effect */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)'
        }}></div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-600 flex items-center justify-center shadow-2xl overflow-hidden">
                <Image
                  src="/agent-avatars/agent-face.png"
                  alt="Agent"
                  width={64}
                  height={64}
                  className="object-cover"
                />
              </div>
              {/* Corner accents */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-400"></div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-400"></div>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-4xl font-black text-white uppercase tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-purple-200">
                  Agents Library
                </h2>
              </div>
              <p className="text-lg text-slate-400 font-medium">
                Specialized AI agents for your business operations
              </p>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 mt-6 p-4 bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span className="text-xs text-slate-400 uppercase font-bold">Available Agents:</span>
              <span className="text-sm text-white font-black">{agentTemplates.length}</span>
            </div>
            <div className="h-4 w-px bg-slate-700"></div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
              <span className="text-xs text-slate-400 uppercase font-bold">Status:</span>
              <span className="text-sm text-emerald-400 font-black">Online</span>
            </div>
            <div className="h-4 w-px bg-slate-700"></div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span className="text-xs text-slate-400 uppercase font-bold">Mode:</span>
              <span className="text-sm text-purple-400 font-black">Campaign</span>
            </div>
          </div>
        </div>

        {/* Decorative glowing orbs */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
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