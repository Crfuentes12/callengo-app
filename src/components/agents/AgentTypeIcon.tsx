// Shared agent type icons — used in PainSelection, AgentCard, AgentTestExperience, and campaign wizards
// These are the canonical visual identity for each agent type.

interface IconProps {
  className?: string;
}

export function DataValidationIcon({ className = 'w-14 h-14' }: IconProps) {
  return (
    <svg viewBox="0 0 56 56" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="28" cy="14" rx="16" ry="5" stroke="currentColor" strokeWidth="2.2" />
      <path d="M12 14v28c0 2.76 7.16 5 16 5s16-2.24 16-5V14" stroke="currentColor" strokeWidth="2.2" />
      <ellipse cx="28" cy="28" rx="16" ry="5" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="42" cy="42" r="10" fill="#10b981" />
      <path d="M38 42l3 3 6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AppointmentConfirmationIcon({ className = 'w-14 h-14' }: IconProps) {
  return (
    <svg viewBox="0 0 56 56" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
      {/* Calendar body */}
      <rect x="8" y="14" width="34" height="30" rx="4" stroke="currentColor" strokeWidth="2.2" />
      <path d="M8 22h34" stroke="currentColor" strokeWidth="2.2" />
      <path d="M18 10v8M30 10v8" stroke="currentColor" strokeWidth="2.2" />
      {/* No-show X cross-out */}
      <path d="M16 30l8 8M24 30l-8 8" stroke="#ef4444" strokeWidth="2" opacity="0.6" />
      {/* Phone badge — centered at (42,42) using g transform */}
      <circle cx="42" cy="42" r="10" fill="#3b82f6" />
      <g transform="translate(35 35) scale(0.6)" fill="white">
        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
      </g>
    </svg>
  );
}

export function LeadQualificationIcon({ className = 'w-14 h-14' }: IconProps) {
  return (
    <svg viewBox="0 0 56 56" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
      {/* Funnel */}
      <path d="M10 12h36l-14 18v12l-8-4V30L10 12z" stroke="currentColor" strokeWidth="2.2" />
      {/* Many unqualified leads entering */}
      <circle cx="16" cy="8" r="2.5" fill="currentColor" opacity="0.35" />
      <circle cx="22" cy="7" r="2.5" fill="currentColor" opacity="0.35" />
      <circle cx="28" cy="8" r="2.5" fill="currentColor" opacity="0.35" />
      <circle cx="34" cy="7" r="2.5" fill="currentColor" opacity="0.35" />
      <circle cx="40" cy="8" r="2.5" fill="currentColor" opacity="0.35" />
      {/* Star badge — qualified lead */}
      <circle cx="42" cy="42" r="10" fill="#4f46e5" />
      <path d="M42 36l1.5 3.5 3.5.5-2.5 2.5.5 3.5-3-1.5-3 1.5.5-3.5-2.5-2.5 3.5-.5z" fill="white" />
    </svg>
  );
}

/** Returns the right icon component for any agent slug or name */
export function AgentTypeIcon({ slug, className }: { slug: string; className?: string }) {
  const s = slug.toLowerCase();
  if (s.includes('data') || s.includes('validation')) return <DataValidationIcon className={className} />;
  if (s.includes('appointment') || s.includes('confirmation')) return <AppointmentConfirmationIcon className={className} />;
  return <LeadQualificationIcon className={className} />;
}

/** Returns gradient class for agent slug */
export function getAgentGradient(slug: string): string {
  const s = slug.toLowerCase();
  if (s.includes('data') || s.includes('validation')) return 'from-emerald-500 to-teal-600';
  if (s.includes('appointment') || s.includes('confirmation')) return 'from-blue-500 to-blue-700';
  return 'from-indigo-500 to-violet-600';
}

/** Returns accent color info for agent slug */
export function getAgentAccent(slug: string) {
  const s = slug.toLowerCase();
  if (s.includes('data') || s.includes('validation')) {
    return { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200', fill: '#10b981' };
  }
  if (s.includes('appointment') || s.includes('confirmation')) {
    return { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200', fill: '#3b82f6' };
  }
  return { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200', fill: '#4f46e5' };
}
