// Integration helper functions and icon components
// Extracted from IntegrationsPage to reduce component size

type PlanTier = 'free' | 'starter' | 'business' | 'teams' | 'enterprise';

export const PLAN_ORDER: Record<PlanTier, number> = { free: 0, starter: 1, business: 2, teams: 3, enterprise: 4 };

export function planMeetsRequirement(currentPlan: string, requiredPlan: PlanTier): boolean {
  return (PLAN_ORDER[currentPlan as PlanTier] ?? 0) >= (PLAN_ORDER[requiredPlan] ?? 0);
}

export function getPlanLabel(plan: PlanTier): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

export function getPlanBadgeColors(plan: PlanTier): string {
  switch (plan) {
    case 'free': return 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)]';
    case 'starter': return 'bg-blue-50 text-blue-600';
    case 'business': return 'bg-violet-50 text-violet-600';
    case 'teams': return 'bg-amber-50 text-amber-600';
    case 'enterprise': return 'bg-rose-50 text-rose-600';
  }
}

export function formatLastSynced(dateStr?: string): string {
  if (!dateStr) return 'Never';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function Tooltip({ text }: { text: string }) {
  return (
    <div className="relative group/tip inline-flex">
      <svg className="w-3.5 h-3.5 text-[var(--color-neutral-400)] cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-[var(--color-neutral-800)] text-white text-[11px] rounded-lg p-2.5 opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all z-50 shadow-xl leading-relaxed">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-transparent border-t-[var(--color-neutral-800)]" />
      </div>
    </div>
  );
}

export function WebhookIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M6.032 4.132c0-1.039.843-1.882 1.886-1.882.709 0 1.328.39 1.65.97a.75.75 0 101.311-.728A3.385 3.385 0 007.918.75a3.383 3.383 0 00-3.386 3.382c0 .94.385 1.79 1.003 2.402l-2.054 3.594a1.25 1.25 0 00.151 2.49h.007a1.25 1.25 0 001.146-1.75l2.369-4.144a.75.75 0 00-.249-1.005 1.879 1.879 0 01-.873-1.587z"/>
      <path d="M7.793 5.375a1.25 1.25 0 01.125-2.494h.006a1.25 1.25 0 011.157 1.725l2.159 3.572a3.383 3.383 0 014.51 3.19 3.383 3.383 0 01-4.23 3.275.75.75 0 11.373-1.452 1.883 1.883 0 002.357-1.822 1.883 1.883 0 00-2.897-1.588.75.75 0 01-1.045-.245l-2.515-4.16z"/>
      <path d="M2.002 10.429a.75.75 0 00-1.298-.752 3.383 3.383 0 002.932 5.073c1.61 0 2.96-1.124 3.301-2.632h4.42c.229.304.592.5 1.001.5h.007a1.25 1.25 0 000-2.5h-.007c-.409 0-.772.197-1 .5H6.271a.75.75 0 00-.75.75 1.883 1.883 0 01-1.886 1.882 1.883 1.883 0 01-1.633-2.821z"/>
    </svg>
  );
}

export function PipedriveIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor">
      <path d="M16.3 7.8c-3.6 0-5.7 1.6-6.7 2.7-.1-1-.8-2.2-3.2-2.2H1v5.6h2.2c.4 0 .5.1.5.5v25.7h6.4V30v-.7c1 .9 2.9 2.2 5.9 2.2 6.3 0 10.7-5 10.7-12.1 0-7.3-4.2-12.1-10.4-12.1m-1.3 18.6c-3.5 0-5-3.3-5-6.4 0-4.8 2.6-6.6 5.1-6.6 3 0 5.1 2.6 5.1 6.5 0 4.5-2.6 6.5-5.2 6.5" transform="scale(0.85) translate(5, 0)" />
    </svg>
  );
}

export function ZohoIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1024 450" fill="none">
      <path d="M458.1,353c-7.7,0-15.5-1.6-23-4.9l0,0l-160-71.3c-28.6-12.7-41.5-46.4-28.8-75l71.3-160c12.7-28.6,46.4-41.5,75-28.8l160,71.3c28.6,12.7,41.5,46.4,28.8,75l-71.3,160C500.6,340.5,479.8,353,458.1,353z M448.4,318.1c12.1,5.4,26.3-0.1,31.7-12.1l71.3-160c5.4-12.1-0.1-26.3-12.1-31.7L379.2,43c-12.1-5.4-26.3,0.1-31.7,12.1l-71.3,160c-5.4,12.1,0.1,26.3,12.1,31.7L448.4,318.1z" fill="#089949"/>
      <path d="M960,353.1H784.8c-31.3,0-56.8-25.5-56.8-56.8V121.1c0-31.3,25.5-56.8,56.8-56.8H960c31.3,0,56.8,25.5,56.8,56.8v175.2C1016.8,327.6,991.3,353.1,960,353.1z M784.8,97.1c-13.2,0-24,10.8-24,24v175.2c0,13.2,10.8,24,24,24H960c13.2,0,24-10.8,24-24V121.1c0-13.2-10.8-24-24-24H784.8z" fill="#F9B21D"/>
      <path d="M303.9,153.2L280.3,206c-0.3,0.6-0.6,1.1-0.9,1.6l9.2,56.8c2.1,13.1-6.8,25.4-19.8,27.5l-173,28c-6.3,1-12.7-0.5-17.9-4.2c-5.2-3.7-8.6-9.3-9.6-15.6l-28-173c-1-6.3,0.5-12.7,4.2-17.9c3.7-5.2,9.3-8.6,15.6-9.6l173-28c1.3-0.2,2.6-0.3,3.8-0.3c11.5,0,21.8,8.4,23.7,20.2l9.3,57.2L294.3,94l-1.3-7.7c-5-30.9-34.2-52-65.1-47l-173,28C40,69.6,26.8,77.7,18,90c-8.9,12.3-12.4,27.3-10,42.3l28,173c2.4,15,10.5,28.1,22.8,37C68.5,349.4,80,353,91.9,353c3,0,6.1-0.2,9.2-0.7l173-28c30.9-5,52-34.2,47-65.1L303.9,153.2z" fill="#E42527"/>
      <path d="M511.4,235.8l25.4-56.9l-7.2-52.9c-0.9-6.3,0.8-12.6,4.7-17.7c3.9-5.1,9.5-8.4,15.9-9.2l173.6-23.6c1.1-0.1,2.2-0.2,3.3-0.2c5.2,0,10.2,1.7,14.5,4.9c0.8,0.6,1.5,1.3,2.2,1.9c7.7-8.1,17.8-13.9,29.1-16.4c-3.2-4.4-7-8.3-11.5-11.7c-12.1-9.2-27-13.1-42-11.1L545.6,66.5c-15,2-28.4,9.8-37.5,21.9c-9.2,12.1-13.1,27-11.1,42L511.4,235.8z" fill="#226DB4"/>
      <path d="M806.8,265.1l-22.8-168c-12.8,0.4-23.1,11-23.1,23.9v49.3l13.5,99.2c0.9,6.3-0.8,12.6-4.7,17.7s-9.5,8.4-15.9,9.2l-173.6,23.6c-6.3,0.9-12.6-0.8-17.7-4.7c-5.1-3.9-8.4-9.5-9.2-15.9l-8-58.9l-25.4,56.9l0.9,6.4c2,15,9.8,28.4,21.9,37.5c10,7.6,21.9,11.6,34.3,11.6c2.6,0,5.2-0.2,7.8-0.5L758.2,329c15-2,28.4-9.8,37.5-21.9C804.9,295,808.8,280.1,806.8,265.1z" fill="#226DB4"/>
    </svg>
  );
}

export function StripeIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="54 36 360 150" fill="#635BFF">
      <path d="M414,113.4c0-25.6-12.4-45.8-36.1-45.8c-23.8,0-38.2,20.2-38.2,45.6c0,30.1,17,45.3,41.4,45.3c11.9,0,20.9-2.7,27.7-6.5v-20c-6.8,3.4-14.6,5.5-24.5,5.5c-9.7,0-18.3-3.4-19.4-15.2h48.9C413.8,121,414,115.8,414,113.4z M364.6,103.9c0-11.3,6.9-16,13.2-16c6.1,0,12.6,4.7,12.6,16H364.6z"/>
      <path d="M301.1,67.6c-9.8,0-16.1,4.6-19.6,7.8l-1.3-6.2h-22v116.6l25-5.3l0.1-28.3c3.6,2.6,8.9,6.3,17.7,6.3c17.9,0,34.2-14.4,34.2-46.1C335.1,83.4,318.6,67.6,301.1,67.6z M295.1,136.5c-5.9,0-9.4-2.1-11.8-4.7l-0.1-37.1c2.6-2.9,6.2-4.9,11.9-4.9c9.1,0,15.4,10.2,15.4,23.3C310.5,126.5,304.3,136.5,295.1,136.5z"/>
      <polygon points="223.8,61.7 248.9,56.3 248.9,36 223.8,41.3"/>
      <rect x="223.8" y="69.3" width="25.1" height="87.5"/>
      <path d="M196.9,76.7l-1.6-7.4h-21.6v87.5h25V97.5c5.9-7.7,15.9-6.3,19-5.2v-23C214.5,68.1,202.8,65.9,196.9,76.7z"/>
      <path d="M146.9,47.6l-24.4,5.2l-0.1,80.1c0,14.8,11.1,25.7,25.9,25.7c8.2,0,14.2-1.5,17.5-3.3V135c-3.2,1.3-19,5.9-19-8.9V90.6h19V69.3h-19L146.9,47.6z"/>
      <path d="M79.3,94.7c0-3.9,3.2-5.4,8.5-5.4c7.6,0,17.2,2.3,24.8,6.4V72.2c-8.3-3.3-16.5-4.6-24.8-4.6C67.5,67.6,54,78.2,54,95.9c0,27.6,38,23.2,38,35.1c0,4.6-4,6.1-9.6,6.1c-8.3,0-18.9-3.4-27.3-8v23.8c9.3,4,18.7,5.7,27.3,5.7c20.8,0,35.1-10.3,35.1-28.2C117.4,100.6,79.3,105.9,79.3,94.7z"/>
    </svg>
  );
}

export function DynamicsIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- Small brand logo */
    <img src="/dynamic-logo.png" alt="Microsoft Dynamics" className={className} />
  );
}
