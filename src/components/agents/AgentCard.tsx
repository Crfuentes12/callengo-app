// components/agents/AgentCard.tsx
'use client';

import { AgentTemplate } from '@/types/supabase';

interface AgentCardProps {
  agent: AgentTemplate;
  onSelect: () => void;
}

export default function AgentCard({ agent, onSelect }: AgentCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-lg bg-gradient from-blue-500 to-indigo-600 flex items-center justify-center text-2xl">
          {agent.icon}
        </div>
        <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded capitalize">
          {agent.category}
        </span>
      </div>

      <h3 className="text-lg font-bold text-slate-900 mb-2">{agent.name}</h3>
      <p className="text-sm text-slate-600 mb-4 line-clamp-2">{agent.description}</p>

      <button
        onClick={onSelect}
        className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors group-hover:shadow-md"
      >
        Select Agent
      </button>
    </div>
  );
}