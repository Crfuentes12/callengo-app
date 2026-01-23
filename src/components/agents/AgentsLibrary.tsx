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
                  Solve Your Problems
                </h2>
              </div>
              <p className="text-lg text-slate-400 font-medium">
                Choose what you want to fix and start saving time and money today
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

      {/* Working on More Message */}
      <div className="mt-8 relative overflow-hidden bg-gradient-to-br from-indigo-900/40 via-purple-900/40 to-slate-900/40 rounded-2xl p-8 border border-indigo-800/50 backdrop-blur-sm">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-600/10 via-transparent to-transparent"></div>
        <div className="relative z-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">More Solutions Coming Soon</h3>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            We're working hard to bring you more AI-powered experiences to solve your business problems, save you time, and help you make more money.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <div className="flex -space-x-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 border-2 border-slate-900"></div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 border-2 border-slate-900"></div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 border-2 border-slate-900"></div>
            </div>
            <span className="text-sm text-slate-400 font-medium">+5 more agents in development</span>
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