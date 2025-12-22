// components/agents/AgentCard.tsx
'use client';

import { AgentTemplate } from '@/types/supabase';

interface AgentCardProps {
  agent: AgentTemplate;
  onSelect: () => void;
}

// Generate avatar based on agent name
const getAvatarForAgent = (name: string) => {
  const avatars = {
    'Sales': '👨‍💼',
    'Support': '👩‍💻',
    'Lead': '🧑‍🚀',
    'Survey': '👩‍🔬',
    'Verification': '👨‍⚖️',
    'Appointment': '👩‍⚕️',
    'Follow-up': '🧑‍💼',
    'Feedback': '👨‍🎓',
  };

  for (const key in avatars) {
    if (name.toLowerCase().includes(key.toLowerCase())) {
      return avatars[key as keyof typeof avatars];
    }
  }
  return '🤖';
};

const getCategoryColor = (category: string | null) => {
  const colors = {
    'sales': 'from-emerald-500 to-teal-600',
    'support': 'from-blue-500 to-cyan-600',
    'verification': 'from-purple-500 to-pink-600',
    'appointment': 'from-orange-500 to-red-600',
    'survey': 'from-indigo-500 to-violet-600',
  };

  const cat = category?.toLowerCase() || 'default';
  return colors[cat as keyof typeof colors] || 'from-slate-500 to-slate-600';
};

export default function AgentCard({ agent, onSelect }: AgentCardProps) {
  const avatar = agent.icon || getAvatarForAgent(agent.name);
  const gradientColor = getCategoryColor(agent.category);

  return (
    <div className="group relative">
      {/* Glow effect on hover */}
      <div className={`absolute -inset-0.5 bg-gradient-to-r ${gradientColor} rounded-2xl blur opacity-0 group-hover:opacity-30 transition duration-500`}></div>

      {/* Main card */}
      <div className="relative bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50 hover:border-slate-600 transition-all duration-300">
        {/* Top gradient bar */}
        <div className={`h-2 bg-gradient-to-r ${gradientColor}`}></div>

        {/* Card content */}
        <div className="p-6">
          {/* Avatar & Category badge */}
          <div className="flex items-start justify-between mb-4">
            <div className="relative">
              {/* Avatar circle */}
              <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${gradientColor} flex items-center justify-center text-4xl shadow-lg ring-4 ring-slate-800 group-hover:scale-110 transition-transform duration-300`}>
                {avatar}
              </div>
              {/* Level badge */}
              <div className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br ${gradientColor} flex items-center justify-center text-xs font-bold text-white shadow-lg ring-2 ring-slate-900`}>
                AI
              </div>
            </div>

            {/* Category badge */}
            <span className={`px-3 py-1.5 bg-gradient-to-r ${gradientColor} text-white text-xs font-bold rounded-lg capitalize shadow-md`}>
              {agent.category || 'Agent'}
            </span>
          </div>

          {/* Agent name */}
          <h3 className="text-xl font-bold text-white mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-slate-300 transition-all">
            {agent.name}
          </h3>

          {/* Description */}
          <p className="text-sm text-slate-400 mb-4 line-clamp-2 leading-relaxed">
            {agent.description || 'A powerful AI agent ready to assist with your business needs.'}
          </p>

          {/* Stats / Skills */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-slate-800/50 rounded-lg p-2 text-center backdrop-blur-sm border border-slate-700/30">
              <div className="text-xs text-slate-400">Calls</div>
              <div className="text-sm font-bold text-white">24/7</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2 text-center backdrop-blur-sm border border-slate-700/30">
              <div className="text-xs text-slate-400">Lang</div>
              <div className="text-sm font-bold text-white">Multi</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2 text-center backdrop-blur-sm border border-slate-700/30">
              <div className="text-xs text-slate-400">Speed</div>
              <div className="text-sm font-bold text-white">Fast</div>
            </div>
          </div>

          {/* Select button */}
          <button
            onClick={onSelect}
            className={`w-full py-3 bg-gradient-to-r ${gradientColor} text-white font-bold rounded-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-0.5 relative overflow-hidden group/btn`}
          >
            <span className="relative z-10">Deploy Agent</span>
            {/* Shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover/btn:translate-x-[200%] transition-transform duration-700"></div>
          </button>
        </div>

        {/* Bottom decorative pattern */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-slate-950/50 to-transparent pointer-events-none"></div>
      </div>
    </div>
  );
}
