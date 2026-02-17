// components/agents/AgentCard.tsx
'use client';

import Image from 'next/image';
import { AgentTemplate } from '@/types/supabase';

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

export default function AgentCard({ agent, onSelect }: AgentCardProps) {
  const avatarImage = getAvatarImage(agent.name);

  return (
    <div
      className="group relative cursor-pointer"
      onClick={onSelect}
    >
      {/* Main card container */}
      <div className="relative aspect-square rounded-2xl overflow-hidden shadow-md border border-slate-200 group-hover:shadow-lg group-hover:border-[var(--color-primary-300)] transition-all duration-300">
        {/* Character Image Background */}
        <div className="absolute inset-0">
          <Image
            src={avatarImage}
            alt={agent.name}
            fill
            className="object-cover object-top transition-transform duration-500"
            priority
          />
        </div>

        {/* Bottom text overlay with gradient */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent h-32"></div>

          <div className="relative px-4 pb-4 pt-8">
            <div className="relative">
              <h3 className="text-lg font-semibold text-white leading-tight drop-shadow-md">
                {agent.name}
              </h3>
              <div className="h-0.5 w-0 group-hover:w-full gradient-bg rounded-full transition-all duration-500 mt-1"></div>
            </div>

            <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed drop-shadow-md mt-1.5">
              {agent.description || 'Specialized AI agent for your business operations'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
