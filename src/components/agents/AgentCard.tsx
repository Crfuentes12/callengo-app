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
            className="object-cover group-hover:scale-110 transition-transform duration-700"
            priority
          />
          {/* Vignette effect */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black"></div>
        </div>

        {/* Top HUD */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-start justify-between z-10">
          {/* Level badge */}
          <div className="relative">
            <div className={`px-3 py-1.5 bg-gradient-to-r ${gradientColor} rounded-lg shadow-lg backdrop-blur-sm border border-white/20`}>
              <span className="text-white text-xs font-black uppercase tracking-wider">AI AGENT</span>
            </div>
            {/* Animated corner accents */}
            <div className={`absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
            <div className={`absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
          </div>

          {/* Category badge */}
          <div className="px-3 py-1.5 bg-black/70 backdrop-blur-md rounded-lg border border-white/10 shadow-lg">
            <span className="text-white text-xs font-bold uppercase tracking-wide">
              {agent.category || 'Special'}
            </span>
          </div>
        </div>

        {/* Bottom info panel with gradient */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          {/* Dark gradient background for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/95 to-transparent"></div>

          <div className="relative p-5 space-y-3">
            {/* Agent name with futuristic styling */}
            <div className="relative">
              <h3 className="text-2xl font-black text-white uppercase tracking-tight leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-cyan-300 group-hover:via-blue-400 group-hover:to-purple-400 transition-all duration-300">
                {agent.name}
              </h3>
              {/* Accent line */}
              <div className={`h-1 w-0 group-hover:w-full bg-gradient-to-r ${gradientColor} rounded-full transition-all duration-500 mt-1`}></div>
            </div>

            {/* Description */}
            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed drop-shadow-lg">
              {agent.description || 'Elite AI agent with specialized capabilities for your mission.'}
            </p>

            {/* Quick stats mini bars */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-black/40 backdrop-blur-sm rounded border border-cyan-500/30 p-1.5 text-center group-hover:border-cyan-400/60 transition-colors">
                <div className="text-[10px] text-cyan-300 font-bold uppercase">Power</div>
                <div className="text-sm font-black text-white">95</div>
              </div>
              <div className="bg-black/40 backdrop-blur-sm rounded border border-purple-500/30 p-1.5 text-center group-hover:border-purple-400/60 transition-colors">
                <div className="text-[10px] text-purple-300 font-bold uppercase">Speed</div>
                <div className="text-sm font-black text-white">88</div>
              </div>
              <div className="bg-black/40 backdrop-blur-sm rounded border border-pink-500/30 p-1.5 text-center group-hover:border-pink-400/60 transition-colors">
                <div className="text-[10px] text-pink-300 font-bold uppercase">Intel</div>
                <div className="text-sm font-black text-white">92</div>
              </div>
            </div>

            {/* Select button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              className={`w-full py-3 bg-gradient-to-r ${gradientColor} text-white font-black uppercase text-sm tracking-wider rounded-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden border border-white/20 group-hover:border-white/40`}
            >
              <span className="relative z-10 drop-shadow-lg">⚡ SELECT AGENT</span>
              {/* Animated shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
            </button>
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
