// components/agents/AgentCard.tsx
'use client';

import { AgentTemplate } from '@/types/supabase';
import { useTranslation } from '@/i18n';
import { AgentTypeIcon, getAgentGradient, getAgentAccent } from './AgentTypeIcon';

interface AgentCardProps {
  agent: AgentTemplate;
  onSelect: () => void;
}

export default function AgentCard({ agent, onSelect }: AgentCardProps) {
  const { t } = useTranslation();
  const gradient = getAgentGradient(agent.name);
  const accent = getAgentAccent(agent.name);

  return (
    <div
      className="group relative cursor-pointer"
      onClick={onSelect}
    >
      <div className="relative rounded-2xl overflow-hidden bg-white border border-[var(--border-default)] shadow-sm hover:shadow-xl hover:border-[var(--color-primary-200)] transition-all duration-500">
        {/* Top gradient accent bar */}
        <div className={`h-1 w-full bg-gradient-to-r ${gradient}`} />

        {/* Content */}
        <div className="p-5">
          <div className="flex items-start gap-4 mb-4">
            {/* Agent icon */}
            <div className={`
              relative w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center
              ${accent.bg} ${accent.text}
              border ${accent.border}
              group-hover:shadow-md transition-all duration-300
            `}>
              <AgentTypeIcon slug={agent.name} className="w-10 h-10" />
            </div>

            {/* Name + type badge */}
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-[var(--color-ink)] leading-tight mb-1 group-hover:text-[var(--color-primary)] transition-colors duration-300">
                {agent.name}
              </h3>
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${accent.bg} border ${accent.border}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${accent.text}`}>AI Agent</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-[var(--color-neutral-600)] leading-relaxed line-clamp-2 mb-4">
            {agent.description || t.agents.subtitle}
          </p>

          {/* Bottom action area */}
          <div className="flex items-center justify-between pt-3 border-t border-[var(--border-default)]">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-emerald-500 rounded-full" />
              <span className="text-[11px] font-medium text-emerald-600">Ready</span>
            </div>
            <span className="text-xs font-semibold text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-1">
              Configure
              <svg className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
