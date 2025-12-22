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

const getCategoryColor = (category: string | null) => {
  const colors = {
    'sales': 'from-emerald-400 via-emerald-500 to-teal-600',
    'support': 'from-blue-400 via-blue-500 to-cyan-600',
    'verification': 'from-purple-400 via-purple-500 to-pink-600',
    'appointment': 'from-orange-400 via-orange-500 to-red-600',
    'survey': 'from-indigo-400 via-indigo-500 to-violet-600',
  };

  const cat = category?.toLowerCase() || 'default';
  return colors[cat as keyof typeof colors] || 'from-slate-400 via-slate-500 to-slate-600';
};

export default function AgentCard({ agent, onSelect }: AgentCardProps) {
  const avatarImage = getAvatarImage(agent.name);
  const gradientColor = getCategoryColor(agent.category);

  return (
    <div className="group relative cursor-pointer" onClick={onSelect}>
      {/* Outer glow effect */}
      <div className={`absolute -inset-1 bg-gradient-to-r ${gradientColor} rounded-2xl blur-lg opacity-0 group-hover:opacity-60 transition-all duration-500 animate-pulse`}></div>

      {/* Main card container */}
      <div className="relative h-[420px] rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-700/50 group-hover:border-slate-500 transition-all duration-500 group-hover:scale-[1.02] group-hover:shadow-[0_0_50px_rgba(99,102,241,0.5)]">
        {/* Character Image Background */}
        <div className="absolute inset-0">
          <Image
            src={avatarImage}
            alt={agent.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
            priority
          />
          {/* Subtle vignette - lighter to show chest icon */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30"></div>
        </div>

        {/* Bottom info panel - more compact */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          {/* Smaller gradient background for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/90 to-transparent"></div>

          <div className="relative p-4 space-y-2">
            {/* Agent name with futuristic styling */}
            <div className="relative">
              <h3 className="text-xl font-black text-white uppercase tracking-tight leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-cyan-300 group-hover:via-blue-400 group-hover:to-purple-400 transition-all duration-300">
                {agent.name}
              </h3>
              {/* Accent line */}
              <div className={`h-0.5 w-0 group-hover:w-full bg-gradient-to-r ${gradientColor} rounded-full transition-all duration-500 mt-1`}></div>
            </div>

            {/* Description */}
            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed drop-shadow-lg">
              {agent.description || 'Specialized AI agent for your business operations'}
            </p>
          </div>
        </div>

        {/* Scan line effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-2000 pointer-events-none"></div>

        {/* Corner accents */}
        <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-cyan-400/0 group-hover:border-cyan-400/80 transition-all duration-300"></div>
        <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-cyan-400/0 group-hover:border-cyan-400/80 transition-all duration-300"></div>
        <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-cyan-400/0 group-hover:border-cyan-400/80 transition-all duration-300"></div>
        <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-cyan-400/0 group-hover:border-cyan-400/80 transition-all duration-300"></div>
      </div>
    </div>
  );
}
