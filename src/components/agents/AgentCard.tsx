// components/agents/AgentCard.tsx
'use client';

import Image from 'next/image';
import { AgentTemplate } from '@/types/supabase';
import { useTranslation } from '@/i18n';

interface AgentCardProps {
  agent: AgentTemplate;
  onSelect: () => void;
}

// Map agent names/slugs to avatar images
const getAvatarImage = (name: string) => {
  const nameMap: Record<string, string> = {
    'abandoned-cart': '/agent-avatars/abandoned-cart.png',
    'appointment': '/agent-avatars/appointment-confirmation.png',
    'data-validation': '/agent-avatars/data-validation.png',
    'feedback': '/agent-avatars/feedback.png',
    'lead-qualification': '/agent-avatars/lead-qualification.png',
    'lead-reactivation': '/agent-avatars/lead-reactivation.png',
    'winback': '/agent-avatars/winback.png',
  };

  // Try to find by exact slug match
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  if (nameMap[slug]) return nameMap[slug];

  // Try partial matches
  for (const key in nameMap) {
    if (slug.includes(key) || key.includes(slug)) {
      return nameMap[key];
    }
  }

  // Default fallback
  return '/agent-avatars/lead-qualification.png';
};

// Agent-specific SVG icons
const getAgentIcon = (name: string) => {
  const slug = name.toLowerCase();
  if (slug.includes('data') || slug.includes('validation')) {
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    );
  }
  if (slug.includes('appointment') || slug.includes('confirmation')) {
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
      </svg>
    );
  }
  // Lead qualification / default
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
};

// Agent-specific gradient
const getAgentGradient = (name: string) => {
  const slug = name.toLowerCase();
  if (slug.includes('data') || slug.includes('validation')) return 'from-emerald-500 to-teal-600';
  if (slug.includes('appointment') || slug.includes('confirmation')) return 'from-blue-500 to-blue-700';
  return 'from-[var(--color-primary)] to-[var(--color-accent)]';
};

export default function AgentCard({ agent, onSelect }: AgentCardProps) {
  const { t } = useTranslation();
  const avatarImage = getAvatarImage(agent.name);
  const gradient = getAgentGradient(agent.name);

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
            {/* Avatar */}
            <div className="relative w-14 h-14 rounded-xl overflow-hidden shadow-md flex-shrink-0 border border-[var(--border-default)] group-hover:shadow-lg transition-shadow duration-300">
              <Image
                src={avatarImage}
                alt={agent.name}
                fill
                className="object-cover object-top transition-transform duration-500 group-hover:scale-110"
                priority
              />
              {/* Subtle gradient overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-15 transition-opacity duration-500`} />
            </div>

            {/* Type badge */}
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-[var(--color-ink)] leading-tight mb-1 group-hover:text-[var(--color-primary)] transition-colors duration-300">
                {agent.name}
              </h3>
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r ${gradient} bg-opacity-10`} style={{ background: `linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(59, 130, 246, 0.08))` }}>
                <span className={`text-transparent bg-clip-text bg-gradient-to-r ${gradient}`}>
                  {getAgentIcon(agent.name)}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]">AI Agent</span>
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
