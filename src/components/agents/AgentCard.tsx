// components/agents/AgentCard.tsx
'use client';

import { AgentTemplate } from '@/types/supabase';

interface AgentCardProps {
  agent: AgentTemplate;
  onSelect: () => void;
}

export default function AgentCard({ agent, onSelect }: AgentCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-6 hover:shadow-lg hover:shadow-slate-200/50 hover:border-slate-300/80 transition-all duration-200 group">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-2xl shadow-sm">
          {agent.icon}
        </div>
        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg capitalize">
          {agent.category}
        </span>
      </div>

      <h3 className="text-lg font-bold text-slate-900 mb-2">{agent.name}</h3>
      <p className="text-sm text-slate-600 mb-5 line-clamp-2 leading-relaxed">{agent.description}</p>

      <button
        onClick={onSelect}
        className="w-full py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md group-hover:shadow-indigo-200"
      >
        Select Agent
      </button>
    </div>
  );
}