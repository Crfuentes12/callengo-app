// components/integrations/IntegrationsPage.tsx
'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SiTwilio } from 'react-icons/si';
import { FaSalesforce, FaHubspot, FaLock } from 'react-icons/fa';
import Link from 'next/link';
import { BiLogoZoom } from 'react-icons/bi';
import { createClient } from '@/lib/supabase/client';
import { GoogleCalendarIcon, GoogleMeetIcon, GoogleSheetsIcon, OutlookIcon, TeamsIcon, SlackIcon } from '@/components/icons/BrandIcons';

// ============================================================================
// TYPES
// ============================================================================

type PlanTier = 'free' | 'starter' | 'business' | 'teams' | 'enterprise';
type CategoryFilter = 'all' | 'calendar' | 'video' | 'communication' | 'crm' | 'payment';
type PlanFilter = 'all_plans' | 'free' | 'starter' | 'business' | 'teams' | 'enterprise';

interface IntegrationsPageProps {
  integrations: {
    google_calendar: { connected: boolean; email?: string; lastSynced?: string; integrationId?: string };
    microsoft_outlook: { connected: boolean; email?: string; lastSynced?: string; integrationId?: string };
    zoom: { connected: boolean };
    slack: { connected: boolean; teamName?: string; channelName?: string };
    twilio: { connected: boolean };
    salesforce: { connected: boolean; email?: string; username?: string; displayName?: string; lastSynced?: string; integrationId?: string };
    hubspot?: { connected: boolean; email?: string; displayName?: string; hubDomain?: string; lastSynced?: string; integrationId?: string };
    pipedrive?: { connected: boolean; email?: string; displayName?: string; companyName?: string; companyDomain?: string; lastSynced?: string; integrationId?: string };
    clio?: { connected: boolean; email?: string; displayName?: string; firmName?: string; firmId?: string; lastSynced?: string; integrationId?: string };
    google_sheets?: { connected: boolean; email?: string; displayName?: string; lastUsed?: string; integrationId?: string };
  };
  planSlug: string;
  companyId: string;
}

interface IntegrationItem {
  id: string;
  provider: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  category: CategoryFilter;
  requiredPlan: PlanTier;
  status: 'connected' | 'available' | 'auto_enabled' | 'coming_soon';
  connectedInfo?: { label: string; value: string }[];
  autoEnabledWith?: string;
  connectUrl?: string;
  connectMethod?: 'redirect' | 'post' | 'twilio_inline';
  disconnectUrl?: string;
  syncUrl?: string;
  settingsUrl?: string;
  showSync?: boolean;
  manageUrl?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const PLAN_ORDER: Record<PlanTier, number> = { free: 0, starter: 1, business: 2, teams: 3, enterprise: 4 };

function planMeetsRequirement(currentPlan: string, requiredPlan: PlanTier): boolean {
  return (PLAN_ORDER[currentPlan as PlanTier] ?? 0) >= (PLAN_ORDER[requiredPlan] ?? 0);
}

function getPlanLabel(plan: PlanTier): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function getPlanBadgeColors(plan: PlanTier): string {
  switch (plan) {
    case 'free': return 'bg-slate-100 text-slate-500';
    case 'starter': return 'bg-blue-50 text-blue-600';
    case 'business': return 'bg-violet-50 text-violet-600';
    case 'teams': return 'bg-amber-50 text-amber-600';
    case 'enterprise': return 'bg-rose-50 text-rose-600';
  }
}

function formatLastSynced(dateStr?: string): string {
  if (!dateStr) return 'Never';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function Tooltip({ text }: { text: string }) {
  return (
    <div className="relative group/tip inline-flex">
      <svg className="w-3.5 h-3.5 text-slate-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-slate-800 text-white text-[11px] rounded-lg p-2.5 opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all z-50 shadow-xl leading-relaxed">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-transparent border-t-slate-800" />
      </div>
    </div>
  );
}

// Coming soon brand icons as simple SVG components
function BooksyIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 256 256" fill="currentColor">
      <g transform="translate(0,256) scale(0.1,-0.1)">
        <path d="M1268 2109c-17-9-18-44-18-504l0-493 41-35c22-20 65-48 94-63 74-39 82-31 87 99 5 117 27 174 100 253 62 67 135 98 233 98 106 1 166-25 239-105 76-82 100-146 100-274 1-175-54-269-200-342-130-64-279-57-451 22-93 43-173 95-371 243-90 68-186 134-213 147-144 73-339 73-496-1-107-51-245-209-260-298-8-48 15-57 134-54l97 3 40 60c56 81 117 118 205 123 114 6 201-40 516-272 156-115 296-188 420-217 75-18 110-20 215-16 151 6 239 32 343 103 158 108 247 285 247 491 0 180-59 331-175 449-112 114-233 164-395 164-100 0-170-18-256-66-34-18-64-31-68-27-3 3-6 114-6 245 0 287 3 278-112 278-40 0-81-5-90-11z" />
      </g>
    </svg>
  );
}

function PipedriveIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor">
      <path d="M16.3 7.8c-3.6 0-5.7 1.6-6.7 2.7-.1-1-.8-2.2-3.2-2.2H1v5.6h2.2c.4 0 .5.1.5.5v25.7h6.4V30v-.7c1 .9 2.9 2.2 5.9 2.2 6.3 0 10.7-5 10.7-12.1 0-7.3-4.2-12.1-10.4-12.1m-1.3 18.6c-3.5 0-5-3.3-5-6.4 0-4.8 2.6-6.6 5.1-6.6 3 0 5.1 2.6 5.1 6.5 0 4.5-2.6 6.5-5.2 6.5" transform="scale(0.85) translate(5, 0)" />
    </svg>
  );
}

function ZohoIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 290 100" fill="none">
      <defs>
        <linearGradient id="zoho-yellow" x2="1" gradientTransform="matrix(-7e-6 -164.3 -164.3 7e-6 636.24 170.92)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffe500" offset="0"/><stop stopColor="#fcb822" offset="1"/>
        </linearGradient>
        <linearGradient id="zoho-blue" x2="1" gradientTransform="matrix(161.08 -129.36 -129.36 -161.08 380.05 153.54)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#168ccc" offset="0"/><stop stopColor="#00649e" offset="1"/>
        </linearGradient>
        <linearGradient id="zoho-green" x2="1" gradientTransform="matrix(-6e-6 -143.94 -143.94 6e-6 287.19 149.02)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#25a149" offset="0"/><stop stopColor="#008a52" offset="1"/>
        </linearGradient>
        <linearGradient id="zoho-red" x2="1" gradientTransform="matrix(24.754 -149.44 -149.44 -24.754 78.386 163.11)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d92231" offset="0"/><stop stopColor="#ba2234" offset="1"/>
        </linearGradient>
      </defs>
      <g transform="matrix(1.3333 0 0 -1.3333 0 100.08)">
        <g transform="matrix(.29378 0 0 .29378 0 .042373)">
          <g transform="translate(740.38 200.84)"><path d="m0 0v-175.61l-24.248-23.659v171.73l24.248 27.54" fill="#e79224"/></g>
          <path d="m716.52 173.3h-160.57v-171.94h160.57z" fill="url(#zoho-yellow)"/>
          <g transform="translate(581.1 200.72)"><path d="m0 0-25.151-27.424h160.57l23.857 27.54-159.28-.116" fill="#fef26f"/></g>
          <g transform="translate(382.23 193.19)"><path d="M0,0 157.946,21.956 144.731-15.916-4.901-39.646-4.264-12.575 0,0" fill="#91c9ed"/></g>
          <path d="m526.96 177.28 21.881-154.04-155.74-21.883-21.03 148.92 9.094 7.106 145.8 19.893" fill="url(#zoho-blue)"/>
          <g transform="translate(540.18 215.15)"><path d="m0 0 .122-.93 20.484-157.73-11.94-33.25-21.881 154.04" fill="#0b9ad6"/></g>
          <path d="m248.83 206.33 139.83-63.093-63.094-143.23-139.83 63.089 63.094 143.24" fill="url(#zoho-green)"/>
          <g transform="translate(234.31 255.36)"><path d="M0,0 14.515-49.028 154.343-112.121 142.588-65.273 0,0" fill="#98d0a0"/></g>
          <g transform="translate(234.31 255.36)"><path d="m0,0-56.279-133.569 7.7-58.697L14.515-49.028 0,0" fill="#68bf6b"/></g>
          <path d="m156.3 177.5 23.047-151.58-154.53-24.23-24.82 151.87 156.3 23.932" fill="url(#zoho-red)"/>
          <g transform="translate(0 153.57)"><path d="M0,0 10.852,54.119 166.879,79.129 156.304,23.932 0,0" fill="#ef463d"/></g>
          <g transform="translate(166.88 232.7)"><path d="M0,0 22.877-153.042 12.472-206.773-10.575-55.197 0,0" fill="#761116"/></g>
          <g transform="translate(500.47 147.76)"><path d="m0 0c-.703 4.784-2.337 8.434-4.985 10.825-2.105 1.91-4.753 2.875-7.771 2.87-.77 0-1.563-.062-2.386-.182-4.043-.581-7.14-2.454-9.038-5.546-1.38-2.234-2.05-4.929-2.05-8.029 0-1.187.099-2.438.293-3.75l5.681-40.081-44.78-6.59-5.681 40.089c-.687 4.66-2.298 8.273-4.91 10.729-2.109 1.991-4.739 3.009-7.705 3.002-.7 0-1.419-.056-2.153-.164-4.215-.607-7.425-2.445-9.374-5.491-1.414-2.194-2.096-4.902-2.096-8.051 0-1.209.103-2.487.298-3.835l15.322-104.24c.703-4.793 2.38-8.435 5.135-10.789 2.149-1.839 4.843-2.764 7.929-2.758.843 0 1.72.066 2.625.2 3.855.558 6.833 2.423 8.629 5.511 1.287 2.195 1.913 4.832 1.913 7.85 0 1.208-.099 2.474-.295 3.8l-6.261 41.184 44.778 6.581 6.265-41.183c.689-4.73 2.349-8.351 5.066-10.736 2.158-1.898 4.826-2.853 7.85-2.848.777 0 1.573.059 2.395.18 4.028.586 7.113 2.431 8.955 5.498 1.327 2.188 1.967 4.841 1.967 7.899 0 1.21-.097 2.483-.293 3.82zm-182.12-57.657c-5.269-12.41-12.224-20.924-20.83-25.641-4.612-2.527-9.338-3.777-14.227-3.779-4.248 0-8.627.949-13.149 2.863-9.786 4.172-15.882 10.877-18.521 20.334-.882 3.173-1.326 6.508-1.326 10.013 0 6.941 1.742 14.556 5.256 22.841 5.388 12.704 12.421 21.371 21.034 26.117 4.599 2.535 9.329 3.794 14.234 3.794 4.295 0 8.733-.961 13.33-2.912 9.724-4.137 15.759-10.857 18.35-20.357.842-3.106 1.266-6.375 1.266-9.817 0-7.088-1.791-14.909-5.417-23.456zm15.318 62.394c-5.494 5.794-12.167 10.351-19.993 13.67-7.768 3.3-15.622 4.946-23.537 4.946l-.365-2e-3c-8.037-.052-15.98-1.841-23.809-5.353v3e-3c-8.195-3.567-15.337-8.558-21.396-14.968-6.06-6.406-10.995-14.112-14.805-23.088-3.758-8.872-5.844-17.747-6.231-26.624-.045-1.004-.066-2.009-.066-3.01 0-7.834 1.343-15.509 4.027-23.008 2.848-7.916 7.047-14.769 12.584-20.545 5.535-5.776 12.344-10.373 20.401-13.782v2e-3c7.706-3.274 15.531-4.912 23.457-4.908h.203c7.994.037 15.922 1.75 23.76 5.117l7e-3 3e-3 5e-3 3e-3c8.245 3.679 15.436 8.737 21.568 15.139 6.129 6.408 11.084 14.092 14.872 23.017 3.787 8.924 5.85 17.809 6.189 26.647.032.852.048 1.702.048 2.55 0 7.947-1.404 15.734-4.214 23.352-2.974 8.094-7.214 15.047-12.705 20.839" fill="#fff"/></g>
        </g>
      </g>
    </svg>
  );
}

function ZapierIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 500 229" fill="#FF4A00">
      <path d="M300.033 99.59H287.57c-.256-1.02-.447-2.203-.574-3.546a40.666 40.666 0 0 1 0-7.86c.127-1.34.318-2.522.574-3.548h31.06v98.353a46.42 46.42 0 0 1-4.697.572 65.11 65.11 0 0 1-4.7.19 62.93 62.93 0 0 1-4.502-.19 46.28 46.28 0 0 1-4.695-.575v-83.4.002zm108.127 24.734c0-3.58-.48-6.998-1.436-10.26-.96-3.257-2.37-6.1-4.218-8.53-1.857-2.426-4.22-4.377-7.096-5.846-2.875-1.47-6.295-2.206-10.257-2.206-7.796 0-13.772 2.368-17.925 7.095-4.154 4.728-6.677 11.31-7.573 19.747h48.506zm-48.696 14.186c.256 10.736 3.036 18.598 8.34 23.58 5.302 4.984 13.132 7.48 23.485 7.48 9.072 0 17.7-1.6 25.88-4.795 1.02 1.917 1.85 4.25 2.49 6.998a45.63 45.63 0 0 1 1.15 8.147c-4.215 1.794-8.852 3.13-13.897 4.027-5.052.892-10.643 1.342-16.774 1.342-8.95 0-16.62-1.25-23.007-3.74-6.392-2.495-11.664-6.01-15.818-10.545-4.153-4.536-7.19-9.905-9.107-16.105-1.916-6.197-2.877-13.004-2.877-20.417 0-7.285.926-14.092 2.78-20.42 1.85-6.323 4.7-11.82 8.53-16.485 3.836-4.667 8.66-8.372 14.476-11.12 5.813-2.748 12.682-4.124 20.61-4.124 6.773 0 12.716 1.152 17.83 3.452 5.11 2.3 9.393 5.464 12.845 9.49 3.45 4.027 6.07 8.82 7.86 14.377 1.788 5.562 2.686 11.6 2.686 18.12 0 1.79-.068 3.674-.195 5.654a192.677 192.677 0 0 1-.382 5.08H359.46l.002.003zm88.39-53.874a53.58 53.58 0 0 1 4.026-.574c1.275-.125 2.62-.19 4.026-.19 1.406 0 2.81.065 4.218.19 1.405.13 2.684.322 3.835.574.38 1.918.764 4.445 1.146 7.573.383 3.132.578 5.782.578 7.956 2.683-4.344 6.23-8.117 10.638-11.313 4.41-3.193 10.065-4.793 16.966-4.793 1.022 0 2.076.034 3.163.098.93.05 1.86.144 2.78.285.254 1.152.45 2.368.576 3.644.126 1.277.19 2.62.19 4.025 0 1.535-.095 3.134-.286 4.792a99.303 99.303 0 0 1-.67 4.792 13.208 13.208 0 0 0-3.165-.383h-2.59c-3.45 0-6.742.48-9.873 1.437-3.134.96-5.944 2.654-8.436 5.08-2.49 2.43-4.473 5.754-5.94 9.972-1.473 4.218-2.206 9.65-2.206 16.295v48.89c-1.555.27-3.123.463-4.698.574-1.723.128-3.29.19-4.695.19a64.51 64.51 0 0 1-4.698-.19 55.9 55.9 0 0 1-4.89-.573v-98.35zM313.3 32.12a19.054 19.054 0 0 1-1.223 6.718 19.08 19.08 0 0 1-6.72 1.224h-.028a19.06 19.06 0 0 1-6.72-1.223 19.035 19.035 0 0 1-1.225-6.72v-.03c0-2.365.434-4.63 1.22-6.72a19.018 19.018 0 0 1 6.722-1.223h.026c2.366 0 4.63.434 6.72 1.223a19.023 19.023 0 0 1 1.223 6.72v.03h.003zm23.426-5.32H318.15l13.134-13.135a31.954 31.954 0 0 0-7.502-7.5L310.646 19.3V.723A31.976 31.976 0 0 0 305.36.28h-.034c-1.802 0-3.567.154-5.287.443V19.3L286.9 6.164a31.78 31.78 0 0 0-4.06 3.436l-.006.006a32.025 32.025 0 0 0-3.433 4.06L292.54 26.8h-18.58s-.442 3.49-.442 5.294v.022c0 1.804.153 3.572.443 5.293h18.58L279.4 50.542a32.05 32.05 0 0 0 7.503 7.502L300.04 44.91v18.578c1.718.288 3.48.44 5.28.442h.045a32.11 32.11 0 0 0 5.28-.442V44.91l13.138 13.137a32.072 32.072 0 0 0 4.063-3.436h.003a32.135 32.135 0 0 0 3.432-4.063L318.147 37.41h18.58c.288-1.72.44-3.482.44-5.282v-.046c0-1.77-.148-3.535-.44-5.28V26.8z" />
    </svg>
  );
}

function StripeIcon({ className = 'w-7 h-7' }: { className?: string }) {
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

function DynamicsIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <img src="/dynamic-logo.png" alt="Microsoft Dynamics" className={className} />
  );
}

// ============================================================================
// TWILIO SETUP MODAL
// ============================================================================

function TwilioSetupModal({
  companyId,
  onClose,
  onSuccess,
}: {
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const handleTest = async () => {
    if (!accountSid || !authToken) {
      setError('Please enter both Account SID and Auth Token');
      return;
    }
    setTesting(true);
    setError('');
    setTestResult(null);
    try {
      const res = await fetch('/api/bland/twilio/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_sid: accountSid, auth_token: authToken, test_only: true }),
      });
      if (res.ok) {
        setTestResult('success');
      } else {
        const data = await res.json().catch(() => ({}));
        setTestResult('error');
        setError(data.error || 'Invalid credentials. Check your Account SID and Auth Token.');
      }
    } catch {
      setTestResult('error');
      setError('Connection failed. Please try again.');
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    if (!accountSid || !authToken) {
      setError('Please enter both Account SID and Auth Token');
      return;
    }
    setConnecting(true);
    setError('');
    try {
      const res = await fetch('/api/bland/twilio/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_sid: accountSid, auth_token: authToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect');

      // Save encrypted key to company settings
      const { data: currentSettings } = await supabase
        .from('company_settings')
        .select('settings')
        .eq('company_id', companyId)
        .single();
      const existingSettings = (currentSettings?.settings as any) || {};
      await supabase
        .from('company_settings')
        .update({
          settings: {
            ...existingSettings,
            twilio_encrypted_key: data.encrypted_key,
            twilio_connected_at: new Date().toISOString(),
          },
        })
        .eq('company_id', companyId);

      // Import phone numbers if provided
      if (phoneNumbers.trim()) {
        const numbers = phoneNumbers.split(/[,\n]/).map(n => n.trim()).filter(Boolean);
        if (numbers.length > 0) {
          await fetch('/api/bland/twilio/import-numbers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numbers, encrypted_key: data.encrypted_key }),
          });
        }
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to connect Twilio');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-50 text-[#F22F46] flex items-center justify-center">
                <SiTwilio className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Connect Twilio</h3>
                <p className="text-sm text-slate-500">Step {step} of 3</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          {/* Progress bar */}
          <div className="flex gap-1.5 mt-4">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-[#F22F46]' : 'bg-slate-200'}`} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-800 font-medium">{error}</p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div className="text-xs text-blue-900">
                    <p className="font-semibold mb-0.5">Where to find your credentials</p>
                    <p className="text-blue-700">Log in to <strong>twilio.com/console</strong>. Your Account SID and Auth Token are on the main dashboard page.</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <label className="block text-sm font-bold text-slate-700">Account SID</label>
                  <Tooltip text="Your Twilio Account SID starts with 'AC' and is 34 characters long. Find it on your Twilio Console dashboard." />
                </div>
                <input
                  type="text" value={accountSid} onChange={e => setAccountSid(e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F22F46]/20 focus:border-[#F22F46] outline-none transition-all font-mono text-sm"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <label className="block text-sm font-bold text-slate-700">Auth Token</label>
                  <Tooltip text="Your Auth Token is a 32-character string visible below your Account SID in Twilio Console. Click the eye icon to reveal it." />
                </div>
                <input
                  type="password" value={authToken} onChange={e => setAuthToken(e.target.value)}
                  placeholder="Your Twilio Auth Token"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F22F46]/20 focus:border-[#F22F46] outline-none transition-all text-sm"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div className="text-xs text-blue-900">
                    <p className="font-semibold mb-0.5">Test your credentials</p>
                    <p className="text-blue-700">We&apos;ll validate your Account SID and Auth Token before saving. This ensures a smooth setup.</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Account SID</span>
                  <span className="font-mono text-slate-900 text-xs">{accountSid.slice(0, 6)}...{accountSid.slice(-4)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Auth Token</span>
                  <span className="font-mono text-slate-900 text-xs">{'*'.repeat(8)}...{authToken.slice(-4)}</span>
                </div>
              </div>

              {testResult === 'success' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-xs text-emerald-800 font-semibold">Credentials verified successfully</p>
                </div>
              )}

              <button
                onClick={handleTest}
                disabled={testing}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold border border-[#F22F46] text-[#F22F46] hover:bg-[#F22F46]/5 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {testing ? <Spinner className="w-4 h-4" /> : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                )}
                {testing ? 'Testing...' : testResult === 'success' ? 'Re-test Connection' : 'Test Connection'}
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div className="text-xs text-blue-900">
                    <p className="font-semibold mb-0.5">Import your phone numbers</p>
                    <p className="text-blue-700">In Twilio Console go to <strong>Phone Numbers &rarr; Manage &rarr; Active Numbers</strong>. Copy them in E.164 format (e.g. +12223334444).</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <label className="block text-sm font-bold text-slate-700">Phone Numbers <span className="text-slate-400 font-normal">(optional)</span></label>
                  <Tooltip text="Add your Twilio phone numbers in E.164 format. You can also add them later from Settings. One per line or comma-separated." />
                </div>
                <textarea
                  value={phoneNumbers} onChange={e => setPhoneNumbers(e.target.value)}
                  placeholder={"+12223334444\n+13334445555"}
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#F22F46]/20 focus:border-[#F22F46] outline-none transition-all font-mono text-sm resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex gap-2">
          {step > 1 && (
            <button
              onClick={() => { setStep(step - 1); setError(''); }}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
            >
              Back
            </button>
          )}
          {step === 1 && (
            <button
              onClick={() => {
                if (!accountSid || !authToken) { setError('Fill in both fields to continue'); return; }
                setError(''); setStep(2);
              }}
              disabled={!accountSid || !authToken}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#F22F46] hover:bg-[#D92030] transition-all disabled:opacity-50"
            >
              Next
            </button>
          )}
          {step === 2 && (
            <button
              onClick={() => { setError(''); setStep(3); }}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#F22F46] hover:bg-[#D92030] transition-all"
            >
              {testResult === 'success' ? 'Continue' : 'Skip Test & Continue'}
            </button>
          )}
          {step === 3 && (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#F22F46] hover:bg-[#D92030] transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {connecting ? <Spinner className="w-4 h-4" /> : null}
              {connecting ? 'Connecting...' : 'Connect Twilio'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CONFIGURE MODAL
// ============================================================================

function ConfigureModal({
  item,
  onClose,
  onSync,
  onDisconnect,
  loadingAction,
}: {
  item: IntegrationItem;
  onClose: () => void;
  onSync: (provider: string, name: string) => void;
  onDisconnect: (provider: string, name: string) => void;
  loadingAction: string | null;
}) {
  const isConnected = item.status === 'connected';
  const isAutoEnabled = item.status === 'auto_enabled';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${item.iconBg} ${item.iconColor || ''} flex items-center justify-center`}>
              {item.icon}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{item.name}</h3>
              <p className="text-sm text-slate-500">{item.description}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
            <span className="text-sm text-slate-600">Status</span>
            {isConnected || isAutoEnabled ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {isAutoEnabled ? 'Auto-enabled' : 'Connected'}
              </span>
            ) : (
              <span className="text-xs font-medium text-slate-400">Not connected</span>
            )}
          </div>

          {/* Connected Info */}
          {(isConnected || isAutoEnabled) && item.connectedInfo && item.connectedInfo.length > 0 && (
            <div className="space-y-2">
              {item.connectedInfo.map((info, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <span className="text-sm text-slate-600">{info.label}</span>
                  <span className="text-sm font-medium text-slate-900 truncate ml-4 max-w-[200px]">{info.value}</span>
                </div>
              ))}
            </div>
          )}

          {isAutoEnabled && item.autoEnabledWith && (
            <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              Automatically enabled via {item.autoEnabledWith}
            </p>
          )}

          {/* Manage URL */}
          {isConnected && item.manageUrl && (
            <Link
              href={item.manageUrl}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15 hover:bg-[var(--color-primary)]/10 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Manage Integration
            </Link>
          )}
        </div>

        {/* Actions Footer */}
        <div className="p-6 pt-0 flex gap-2">
          {isConnected && item.showSync && item.syncUrl && (
            <button
              onClick={() => onSync(item.provider, item.name)}
              disabled={loadingAction === `sync-${item.provider}`}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15 hover:bg-[var(--color-primary)]/10 transition-all disabled:opacity-50"
            >
              {loadingAction === `sync-${item.provider}` ? <Spinner className="w-4 h-4" /> : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Sync Now
            </button>
          )}
          {isConnected && !item.settingsUrl && item.id !== 'zoom' && (
            <button
              onClick={() => onDisconnect(item.provider, item.name)}
              disabled={loadingAction === `disconnect-${item.provider}`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all disabled:opacity-50"
            >
              {loadingAction === `disconnect-${item.provider}` ? <Spinner className="w-4 h-4" /> : 'Disconnect'}
            </button>
          )}
          {isConnected && item.settingsUrl && (
            <Link
              href={item.settingsUrl}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15 hover:bg-[var(--color-primary)]/10 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function IntegrationsPage({ integrations, planSlug, companyId }: IntegrationsPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('all');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all_plans');
  const [configItem, setConfigItem] = useState<IntegrationItem | null>(null);
  const [showTwilioSetup, setShowTwilioSetup] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Handle OAuth callback params
  const integrationParam = searchParams.get('integration');
  const statusParam = searchParams.get('status');
  if (integrationParam && statusParam === 'connected') {
    if (typeof window !== 'undefined') {
      setTimeout(() => router.replace('/integrations', { scroll: false }), 0);
    }
  }

  // --------------------------------------------------------------------------
  // Actions - OAuth opens in NEW TAB
  // --------------------------------------------------------------------------

  const handleConnect = useCallback(async (provider: string, connectUrl: string, method?: 'redirect' | 'post' | 'twilio_inline') => {
    if (method === 'twilio_inline') {
      setShowTwilioSetup(true);
      return;
    }
    if (method === 'post') {
      setLoadingAction(`connect-${provider}`);
      try {
        const res = await fetch(connectUrl, { method: 'POST' });
        if (res.ok) {
          showToast('Connected successfully', 'success');
          router.refresh();
        } else {
          const data = await res.json().catch(() => ({}));
          showToast(data.error || 'Failed to connect', 'error');
        }
      } catch {
        showToast('Failed to connect', 'error');
      } finally {
        setLoadingAction(null);
      }
    } else {
      // Open OAuth in a new tab so the app doesn't close
      window.open(connectUrl, '_blank', 'noopener,noreferrer');
    }
  }, [router, showToast]);

  const handleDisconnect = useCallback(async (provider: string, name: string) => {
    setLoadingAction(`disconnect-${provider}`);
    try {
      const res = await fetch(`/api/integrations/${provider}/disconnect`, { method: 'POST' });
      if (res.ok) {
        showToast(`${name} disconnected`, 'success');
        setConfigItem(null);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || `Failed to disconnect ${name}`, 'error');
      }
    } catch {
      showToast(`Failed to disconnect ${name}`, 'error');
    } finally {
      setLoadingAction(null);
    }
  }, [showToast, router]);

  const handleSync = useCallback(async (provider: string, name: string) => {
    setLoadingAction(`sync-${provider}`);
    try {
      const res = await fetch(`/api/integrations/${provider}/sync`, { method: 'POST' });
      if (res.ok) {
        showToast(`${name} synced successfully`, 'success');
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || `Failed to sync ${name}`, 'error');
      }
    } catch {
      showToast(`Failed to sync ${name}`, 'error');
    } finally {
      setLoadingAction(null);
    }
  }, [showToast, router]);

  // --------------------------------------------------------------------------
  // All integrations as flat list with category tags
  // --------------------------------------------------------------------------

  const allItems: IntegrationItem[] = useMemo(() => [
    {
      id: 'google-calendar', provider: 'google-calendar', name: 'Google Calendar',
      description: 'Sync call schedules, appointments, and events',
      icon: <GoogleCalendarIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-blue-50',
      category: 'calendar', requiredPlan: 'free',
      status: integrations.google_calendar.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/google-calendar/connect?return_to=/integrations',
      syncUrl: '/api/integrations/google-calendar/sync', showSync: true,
      connectedInfo: integrations.google_calendar.connected ? [
        ...(integrations.google_calendar.email ? [{ label: 'Account', value: integrations.google_calendar.email }] : []),
        { label: 'Last sync', value: formatLastSynced(integrations.google_calendar.lastSynced) },
      ] : undefined,
    },
    {
      id: 'microsoft-outlook', provider: 'microsoft-outlook', name: 'Microsoft 365',
      description: 'Sync Outlook calendar events and schedules',
      icon: <OutlookIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-blue-50',
      category: 'calendar', requiredPlan: 'business',
      status: integrations.microsoft_outlook.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/microsoft-outlook/connect?return_to=/integrations',
      syncUrl: '/api/integrations/microsoft-outlook/sync', showSync: true,
      connectedInfo: integrations.microsoft_outlook.connected ? [
        ...(integrations.microsoft_outlook.email ? [{ label: 'Account', value: integrations.microsoft_outlook.email }] : []),
        { label: 'Last sync', value: formatLastSynced(integrations.microsoft_outlook.lastSynced) },
      ] : undefined,
    },
    {
      id: 'google-meet', provider: 'google-meet', name: 'Google Meet',
      description: 'Auto-generate Meet links for calendar events',
      icon: <GoogleMeetIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-teal-50',
      category: 'video', requiredPlan: 'free',
      status: integrations.google_calendar.connected ? 'auto_enabled' : 'available',
      autoEnabledWith: 'Google Calendar',
    },
    {
      id: 'microsoft-teams', provider: 'microsoft-teams', name: 'Microsoft Teams',
      description: 'Auto-generate Teams links for calendar events',
      icon: <TeamsIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-indigo-50',
      category: 'video', requiredPlan: 'business',
      status: integrations.microsoft_outlook.connected ? 'auto_enabled' : 'available',
      autoEnabledWith: 'Microsoft 365 Outlook',
    },
    {
      id: 'zoom', provider: 'zoom', name: 'Zoom',
      description: 'Server-to-server integration, always available',
      icon: <BiLogoZoom className="w-7 h-7" />, iconColor: 'text-[#2D8CFF]', iconBg: 'bg-blue-50',
      category: 'video', requiredPlan: 'free',
      status: 'connected',
      connectedInfo: [{ label: 'Status', value: 'Always available' }],
    },
    {
      id: 'salesforce', provider: 'salesforce', name: 'Salesforce',
      description: 'Sync contacts, leads, and call data with your CRM',
      icon: <FaSalesforce className="w-7 h-7" />, iconColor: 'text-[#00A1E0]', iconBg: 'bg-blue-50',
      category: 'crm', requiredPlan: 'business',
      status: integrations.salesforce.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/salesforce/connect?return_to=/integrations',
      syncUrl: '/api/integrations/salesforce/sync', showSync: true,
      manageUrl: '/contacts/salesforce',
      connectedInfo: integrations.salesforce.connected ? [
        ...(integrations.salesforce.username ? [{ label: 'User', value: integrations.salesforce.displayName || integrations.salesforce.username }] : []),
        { label: 'Last sync', value: formatLastSynced(integrations.salesforce.lastSynced) },
      ] : undefined,
    },
    {
      id: 'slack', provider: 'slack', name: 'Slack',
      description: 'Real-time notifications and slash commands',
      icon: <SlackIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-purple-50',
      category: 'communication', requiredPlan: 'business',
      status: integrations.slack.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/slack/connect?return_to=/integrations',
      connectedInfo: integrations.slack.connected ? [
        ...(integrations.slack.teamName ? [{ label: 'Workspace', value: integrations.slack.teamName }] : []),
        ...(integrations.slack.channelName ? [{ label: 'Channel', value: `#${integrations.slack.channelName}` }] : []),
      ] : undefined,
    },
    {
      id: 'twilio', provider: 'twilio', name: 'Twilio',
      description: 'Voice calling and SMS phone numbers',
      icon: <SiTwilio className="w-6 h-6" />, iconColor: 'text-[#F22F46]', iconBg: 'bg-red-50',
      category: 'communication', requiredPlan: 'business',
      status: integrations.twilio.connected ? 'connected' : 'available',
      connectUrl: '#twilio-setup',
      connectMethod: 'twilio_inline',
      settingsUrl: integrations.twilio.connected ? '/settings?section=call-settings&scroll=phone-numbers' : undefined,
      connectedInfo: integrations.twilio.connected ? [{ label: 'Config', value: 'Managed via Settings' }] : undefined,
    },
    {
      id: 'google-sheets', provider: 'google-sheets', name: 'Google Sheets',
      description: 'Import contacts from your Google Sheets spreadsheets',
      icon: <GoogleSheetsIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-green-50',
      category: 'crm', requiredPlan: 'free',
      status: integrations.google_sheets?.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/google-sheets/connect?return_to=/integrations',
      disconnectUrl: '/api/integrations/google-sheets/disconnect',
      manageUrl: '/contacts',
      connectedInfo: integrations.google_sheets?.connected ? [
        ...(integrations.google_sheets.email ? [{ label: 'Account', value: integrations.google_sheets.email }] : []),
        ...(integrations.google_sheets.lastUsed ? [{ label: 'Last Import', value: new Date(integrations.google_sheets.lastUsed).toLocaleDateString() }] : []),
      ] : undefined,
    },
    {
      id: 'hubspot', provider: 'hubspot', name: 'HubSpot',
      description: 'Import contacts and sync call outcomes',
      icon: <FaHubspot className="w-7 h-7" />, iconColor: 'text-[#FF7A59]', iconBg: 'bg-orange-50',
      category: 'crm', requiredPlan: 'business',
      status: integrations.hubspot?.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/hubspot/connect?return_to=/integrations',
      disconnectUrl: '/api/integrations/hubspot/disconnect',
      syncUrl: '/api/integrations/hubspot/sync',
      showSync: true,
      manageUrl: '/contacts/hubspot',
      connectedInfo: integrations.hubspot?.connected ? [
        ...(integrations.hubspot.displayName || integrations.hubspot.email ? [{ label: 'Account', value: integrations.hubspot.displayName || integrations.hubspot.email || '' }] : []),
        ...(integrations.hubspot.hubDomain ? [{ label: 'Portal', value: integrations.hubspot.hubDomain }] : []),
        ...(integrations.hubspot.lastSynced ? [{ label: 'Last Sync', value: formatLastSynced(integrations.hubspot.lastSynced) }] : []),
      ] : undefined,
    },
    {
      id: 'pipedrive', provider: 'pipedrive', name: 'Pipedrive',
      description: 'Bidirectional sync: import contacts and push call results back to your CRM',
      icon: <PipedriveIcon className="w-7 h-7" />, iconColor: 'text-black', iconBg: 'bg-slate-50',
      category: 'crm', requiredPlan: 'business',
      status: integrations.pipedrive?.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/pipedrive/connect?return_to=/integrations',
      disconnectUrl: '/api/integrations/pipedrive/disconnect',
      syncUrl: '/api/integrations/pipedrive/sync',
      showSync: true,
      manageUrl: '/contacts/pipedrive',
      connectedInfo: integrations.pipedrive?.connected ? [
        ...(integrations.pipedrive.displayName || integrations.pipedrive.email ? [{ label: 'Account', value: integrations.pipedrive.displayName || integrations.pipedrive.email || '' }] : []),
        ...(integrations.pipedrive.companyName ? [{ label: 'Company', value: integrations.pipedrive.companyName }] : []),
        ...(integrations.pipedrive.lastSynced ? [{ label: 'Last Sync', value: formatLastSynced(integrations.pipedrive.lastSynced) }] : []),
      ] : undefined,
    },
    {
      id: 'clio', provider: 'clio', name: 'Clio',
      description: 'Import contacts, matters, and calendar from your legal practice management software',
      icon: <img src="/clio-logo.png" alt="Clio" className="w-7 h-7" />, iconColor: '', iconBg: 'bg-[#1B2B5B]/5',
      category: 'crm', requiredPlan: 'business',
      status: integrations.clio?.connected ? 'connected' : 'available',
      connectUrl: '/api/integrations/clio/connect?return_to=/integrations',
      disconnectUrl: '/api/integrations/clio/disconnect',
      syncUrl: '/api/integrations/clio/sync',
      showSync: true,
      manageUrl: '/contacts/clio',
      connectedInfo: integrations.clio?.connected ? [
        ...(integrations.clio.displayName || integrations.clio.email ? [{ label: 'Account', value: integrations.clio.displayName || integrations.clio.email || '' }] : []),
        ...(integrations.clio.firmName ? [{ label: 'Firm', value: integrations.clio.firmName }] : []),
        ...(integrations.clio.lastSynced ? [{ label: 'Last Sync', value: formatLastSynced(integrations.clio.lastSynced) }] : []),
      ] : undefined,
    },
    {
      id: 'zoho', provider: 'zoho', name: 'Zoho CRM',
      description: 'Sync leads, contacts, and call logs bidirectionally',
      icon: <ZohoIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-red-50',
      category: 'crm', requiredPlan: 'business', status: 'coming_soon',
    },
    {
      id: 'booksy', provider: 'booksy', name: 'Booksy',
      description: 'Confirm and manage salon & beauty appointments',
      icon: <BooksyIcon className="w-6 h-6" />, iconColor: 'text-black', iconBg: 'bg-slate-50',
      category: 'calendar', requiredPlan: 'business', status: 'coming_soon',
    },
    {
      id: 'simplybook', provider: 'simplybook', name: 'SimplyBook.me',
      description: 'Appointment scheduling and booking management',
      icon: <img src="/simplybookme-logo.jpg" alt="SimplyBook.me" className="w-7 h-7 rounded" />, iconColor: '', iconBg: 'bg-sky-50',
      category: 'calendar', requiredPlan: 'starter', status: 'coming_soon',
    },
    {
      id: 'zapier', provider: 'zapier', name: 'Zapier',
      description: 'Connect Callengo to 5,000+ apps with automated workflows',
      icon: <ZapierIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-orange-50',
      category: 'communication', requiredPlan: 'business', status: 'coming_soon',
    },
    {
      id: 'dynamics', provider: 'dynamics', name: 'Microsoft Dynamics',
      description: 'Sync contacts, leads, and opportunities with Dynamics 365',
      icon: <DynamicsIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-blue-50',
      category: 'crm', requiredPlan: 'business', status: 'coming_soon',
    },
    {
      id: 'stripe', provider: 'stripe', name: 'Stripe',
      description: 'Payment processing, overage billing, and auto-recharge for call minutes',
      icon: <StripeIcon className="w-7 h-7" />, iconColor: '', iconBg: 'bg-indigo-50',
      category: 'payment', requiredPlan: 'free',
      status: 'connected',
      connectedInfo: [{ label: 'Status', value: 'Always available' }],
    },
  ], [integrations]);

  const filteredItems = useMemo(() => {
    let items = allItems;
    if (activeFilter !== 'all') items = items.filter(i => i.category === activeFilter);
    if (planFilter !== 'all_plans') items = items.filter(i => planMeetsRequirement(planFilter, i.requiredPlan));
    return items;
  }, [allItems, activeFilter, planFilter]);

  const activeCount = allItems.filter(i => i.status === 'connected' || i.status === 'auto_enabled').length;

  const categoryBadges: { id: CategoryFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'crm', label: 'CRM' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'video', label: 'Video' },
    { id: 'communication', label: 'Communication' },
    { id: 'payment', label: 'Payment' },
  ];

  const planBadges: { id: PlanFilter; label: string }[] = [
    { id: 'all_plans', label: 'All Plans' },
    { id: 'free', label: 'Free' },
    { id: 'starter', label: 'Starter' },
    { id: 'business', label: 'Business' },
    { id: 'teams', label: 'Teams' },
    { id: 'enterprise', label: 'Enterprise' },
  ];

  // --------------------------------------------------------------------------
  // Render card
  // --------------------------------------------------------------------------

  function renderCard(item: IntegrationItem) {
    const isComingSoon = item.status === 'coming_soon';
    const isConnected = item.status === 'connected';
    const isAutoEnabled = item.status === 'auto_enabled';
    const meetsRequirement = planMeetsRequirement(planSlug, item.requiredPlan);
    const isLocked = !meetsRequirement && !isComingSoon;

    return (
      <div
        key={item.id}
        className={`relative flex flex-col p-5 rounded-xl border transition-all ${
          isConnected || isAutoEnabled
            ? 'border-emerald-100 bg-white hover:shadow-md hover:border-emerald-200'
            : isLocked
            ? 'border-slate-100 bg-slate-50/40'
            : 'border-slate-200 bg-white hover:shadow-md hover:border-slate-300'
        }`}
      >
        {/* Plan badge - top right */}
        <div className="absolute top-3 right-3">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${getPlanBadgeColors(item.requiredPlan)} uppercase tracking-wider`}>
            {item.requiredPlan === 'free' ? 'Free' : `${getPlanLabel(item.requiredPlan)}+`}
          </span>
        </div>

        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl ${item.iconBg} ${item.iconColor || ''} flex items-center justify-center mb-3`}>
          {item.icon}
        </div>

        {/* Name */}
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-bold text-slate-900">{item.name}</h3>
          {(isConnected || isAutoEnabled) && (
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-slate-500 leading-relaxed mb-4 flex-1">{item.description}</p>

        {/* Action button */}
        <div>
          {isComingSoon && (
            <span className="inline-flex items-center px-3 py-2 rounded-lg text-xs font-medium text-slate-400 bg-slate-50 border border-slate-200 w-full justify-center">
              Coming Soon
            </span>
          )}

          {!isComingSoon && (isConnected || isAutoEnabled) && (
            <button
              onClick={() => setConfigItem(item)}
              className="inline-flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold text-[var(--color-primary)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/15 hover:bg-[var(--color-primary)]/10 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Configure
            </button>
          )}

          {!isComingSoon && !isConnected && !isAutoEnabled && item.connectUrl && (
            <button
              onClick={() => {
                if (isLocked) return;
                handleConnect(item.provider, item.connectUrl!, item.connectMethod);
              }}
              disabled={isLocked || loadingAction === `connect-${item.provider}`}
              className={`inline-flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                isLocked
                  ? 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed'
                  : 'btn-primary'
              }`}
            >
              {isLocked ? (
                <>
                  <FaLock className="w-2.5 h-2.5" />
                  Upgrade to {getPlanLabel(item.requiredPlan)}
                </>
              ) : loadingAction === `connect-${item.provider}` ? (
                <Spinner className="w-3.5 h-3.5" />
              ) : (
                'Connect'
              )}
            </button>
          )}

          {!isComingSoon && !isConnected && item.settingsUrl && !item.connectUrl && (
            <Link
              href={isLocked ? '#' : item.settingsUrl}
              className={`inline-flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                isLocked ? 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed pointer-events-none' : 'btn-primary'
              }`}
            >
              {isLocked ? (
                <>
                  <FaLock className="w-2.5 h-2.5" />
                  Upgrade
                </>
              ) : (
                'Configure'
              )}
            </Link>
          )}

          {!isComingSoon && !isConnected && !isAutoEnabled && !item.connectUrl && !item.settingsUrl && item.autoEnabledWith && (
            <span className="inline-flex items-center justify-center w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-400 bg-slate-50 border border-slate-100">
              Connect {item.autoEnabledWith} first
            </span>
          )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-slideDown ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
          <p className="text-slate-500 text-sm mt-1">Connect your tools to streamline your workflow</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold text-emerald-700">{activeCount} active</span>
        </div>
      </div>

      {/* Filter badges - category + plan */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {categoryBadges.map((badge) => (
            <button
              key={badge.id}
              onClick={() => setActiveFilter(badge.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeFilter === badge.id
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {badge.label}
            </button>
          ))}
          <span className="w-px h-5 bg-slate-200 mx-1" />
          {planBadges.map((badge) => (
            <button
              key={badge.id}
              onClick={() => setPlanFilter(badge.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                planFilter === badge.id
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {badge.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => renderCard(item))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400 text-sm">No integrations match your filters</p>
        </div>
      )}

      {/* Help Banner */}
      <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-200 p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Need help setting up integrations?</p>
            <p className="text-xs text-slate-500 mt-0.5">Step-by-step guides for connecting all your tools with Callengo</p>
          </div>
        </div>
        <a
          href="https://callengo.com/integrations"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-[var(--color-primary)] bg-white border border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/5 transition-all shrink-0"
        >
          View Guides
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
      </div>

      {/* Twilio Setup Modal */}
      {showTwilioSetup && (
        <TwilioSetupModal
          companyId={companyId}
          onClose={() => setShowTwilioSetup(false)}
          onSuccess={() => {
            setShowTwilioSetup(false);
            showToast('Twilio connected successfully', 'success');
            router.refresh();
          }}
        />
      )}

      {/* Configure Modal */}
      {configItem && (
        <ConfigureModal
          item={configItem}
          onClose={() => setConfigItem(null)}
          onSync={handleSync}
          onDisconnect={handleDisconnect}
          loadingAction={loadingAction}
        />
      )}
    </div>
  );
}
