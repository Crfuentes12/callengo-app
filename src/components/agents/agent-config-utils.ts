// Agent configuration utility functions
// Extracted from AgentConfigModal to reduce component size

import { BLAND_VOICES } from '@/lib/voices/bland-voices';
import { determineGender } from '@/lib/voices/voice-utils';
import { AgentTemplate } from '@/types/supabase';

/**
 * Map agent names to avatar images based on voice gender
 */
export const getAvatarImage = (name: string, voice?: string) => {
  if (voice) {
    const voiceData = BLAND_VOICES.find(v => v.id === voice);
    if (voiceData) {
      const gender = determineGender(voiceData);
      if (gender === 'female') return '/agent-avatars/female-agent.png';
      if (gender === 'male') return '/agent-avatars/male-agent.png';
    }
  }

  const nameMap: Record<string, string> = {
    'appointment': '/agent-avatars/appointment-confirmation.png',
    'data-validation': '/agent-avatars/data-validation.png',
    'lead-qualification': '/agent-avatars/lead-qualification.png',
  };

  const slug = name.toLowerCase().replace(/\s+/g, '-');
  if (nameMap[slug]) return nameMap[slug];

  for (const key in nameMap) {
    if (slug.includes(key) || key.includes(slug)) return nameMap[key];
  }

  return '/agent-avatars/lead-qualification.png';
};

/**
 * Generate agent description based on agent type
 */
export const getAgentDescription = (agent: AgentTemplate) => {
  const name = agent.name.toLowerCase();

  if (name.includes('data') || name.includes('validation')) {
    return {
      title: 'Data Validation Agent',
      description: 'This agent calls your contacts to verify and update their information. It asks specific questions to ensure your database remains accurate and up-to-date, improving the quality of your contact data.',
      demoData: { companyName: 'TechCorp Solutions', contactName: 'John Smith', email: 'john.smith@example.com', phone: '+1 (555) 123-4567' },
    };
  }

  if (name.includes('qualification') && name.includes('lead')) {
    return {
      title: 'Lead Qualification Agent',
      description: "Qualifies NEW leads by asking targeted questions to determine if they're a good fit for your product or service. Scores leads based on budget, authority, need, and timeline to prioritize your sales efforts.",
      demoData: { companyName: 'Sales Pro Inc', contactName: 'Alex Martinez', leadSource: 'Website Form', interest: 'Enterprise Plan' },
    };
  }

  if (name.includes('appointment') || name.includes('confirmation')) {
    return {
      title: 'Appointment Confirmation Agent',
      description: 'Confirms upcoming appointments with your contacts, reduces no-shows, and handles rescheduling requests. Ensures your calendar stays organized and efficient.',
      demoData: { companyName: 'Healthcare Clinic', contactName: 'Robert Taylor', appointmentDate: 'Tomorrow at 2:00 PM', appointmentType: 'Consultation' },
    };
  }

  return {
    title: agent.name,
    description: 'This AI agent helps automate your outbound calling campaigns with natural conversations and intelligent responses.',
    demoData: { companyName: 'Demo Company', contactName: 'Test Contact' },
  };
};

/**
 * Generate realistic agent stats based on agent type
 */
export const getAgentStats = (agent: AgentTemplate) => {
  const name = agent.name.toLowerCase();

  if (name.includes('data') || name.includes('validation')) {
    return { accuracy: 98, communication: 85, speed: 92, technical: 95 };
  }
  if (name.includes('qualification') && name.includes('lead')) {
    return { analysis: 96, questioning: 94, efficiency: 92, insight: 93 };
  }
  if (name.includes('appointment') || name.includes('confirmation')) {
    return { reliability: 98, communication: 89, precision: 96, scheduling: 94 };
  }
  return { communication: 88, efficiency: 90, adaptability: 86, intelligence: 92 };
};

/**
 * Get category-specific gradient color
 */
export const getCategoryColor = (category: string | null) => {
  const colors: Record<string, string> = {
    'sales': 'from-emerald-400 via-emerald-500 to-teal-600',
    'support': 'from-blue-400 via-blue-500 to-blue-600',
    'verification': 'from-[var(--color-primary)] via-[var(--color-primary-light)] to-[var(--color-accent)]',
    'appointment': 'from-blue-400 via-blue-500 to-blue-600',
    'survey': 'from-blue-400 via-blue-500 to-violet-600',
  };

  const cat = category?.toLowerCase() || 'default';
  return colors[cat] || 'from-slate-400 via-slate-500 to-slate-600';
};
