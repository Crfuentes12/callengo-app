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
                  AI Agents
                </h2>
              </div>
              <p className="text-lg text-slate-400 font-medium">
                Deploy specialized AI agents to automate your business operations
              </p>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 mt-6 p-4 bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span className="text-xs text-slate-400 uppercase font-bold">Active Solutions:</span>
              <span className="text-sm text-white font-black">{agentTemplates.length}</span>
            </div>
            <div className="h-4 w-px bg-slate-700"></div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
              <span className="text-xs text-slate-400 uppercase font-bold">System:</span>
              <span className="text-sm text-emerald-400 font-black">Ready</span>
            </div>
            <div className="h-4 w-px bg-slate-700"></div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span className="text-xs text-slate-400 uppercase font-bold">Your Impact:</span>
              <span className="text-sm text-purple-400 font-black">Growing</span>
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

      {/* Additional Agents in Development */}
      <div className="mt-8 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border-2 border-slate-800">
        {/* Scan lines effect */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)'
        }}></div>

        {/* Glowing orbs */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-purple-500/10 to-transparent rounded-full blur-3xl"></div>

        <div className="relative z-10 p-8">
          <div className="flex items-start gap-6">
            {/* Icon */}
            <div className="shrink-0">
              <div className="relative">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-600 flex items-center justify-center shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                {/* Corner accents */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-400 rounded-tl"></div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-400 rounded-br"></div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                  Agent Development Pipeline
                </h3>
                <span className="px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/30 rounded text-xs font-bold text-cyan-400 uppercase">
                  Active
                </span>
              </div>
              <p className="text-slate-300 mb-4 leading-relaxed">
                Our team is continuously building new specialized agents to expand your automation capabilities. Each agent is designed to solve specific business challenges and integrate seamlessly with your existing workflows.
              </p>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="text-2xl font-black text-cyan-400 mb-1">5+</div>
                  <div className="text-xs text-slate-400 uppercase font-bold">In Development</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="text-2xl font-black text-purple-400 mb-1">Q1</div>
                  <div className="text-xs text-slate-400 uppercase font-bold">Next Release</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="text-2xl font-black text-emerald-400 mb-1">12+</div>
                  <div className="text-xs text-slate-400 uppercase font-bold">Planned 2026</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Empty state if no solutions */}
      {agentTemplates.length === 0 && (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mx-auto mb-4 text-4xl">
            ⚡
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