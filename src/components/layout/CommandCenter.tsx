// components/layout/CommandCenter.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTranslation } from '@/i18n';

interface SearchResult {
  id: string;
  type: 'page' | 'contact' | 'campaign' | 'agent' | 'call' | 'voicemail' | 'follow-up' | 'user' | 'action' | 'integration' | 'setting' | 'help' | 'resource';
  title: string;
  subtitle?: string;
  href: string;
  icon: React.ReactNode;
  external?: boolean;
}

interface CommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
  companyId?: string;
}

// ─── SVG Icon Components ────────────────────────────────────────────────────

function IconDashboard({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function IconContacts({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function IconCampaigns({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function IconAgents({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  );
}

function IconCalls({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}

function IconCalendar({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function IconVoicemail({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V18" />
    </svg>
  );
}

function IconFollowUps({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
    </svg>
  );
}

function IconAnalytics({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function IconIntegrations({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

function IconSettings({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconBilling({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  );
}

function IconTeam({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  );
}

function IconBell({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function IconPhone({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  );
}

function IconImport({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function IconRocket({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  );
}

function IconExport({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function IconPlus({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function IconUser({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function IconDocument({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function IconQuestion({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827m0 0v.75m0-3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconExternal({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

function IconBook({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function IconMail({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function IconTag({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
    </svg>
  );
}

function IconGlobe({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  );
}

function IconShield({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function IconReports({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  );
}

function IconWrench({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.648 5.648a2.625 2.625 0 01-3.712-3.712l5.648-5.648m0 0a6.718 6.718 0 0110.06-1.06c.032.032.063.065.093.098m-10.153.96l1.06 1.06m0 0l3.182-3.182" />
    </svg>
  );
}

// ─── Static Data ────────────────────────────────────────────────────────────

const PAGES: SearchResult[] = [
  { id: 'p-dashboard',     type: 'page', title: 'Dashboard',             subtitle: 'Overview & metrics',                href: '/dashboard',                    icon: <IconDashboard /> },
  { id: 'p-contacts',      type: 'page', title: 'Contacts',              subtitle: 'Manage your contact lists',         href: '/contacts',                     icon: <IconContacts /> },
  { id: 'p-campaigns',     type: 'page', title: 'Campaigns',             subtitle: 'Campaign management & wizard',      href: '/campaigns',                    icon: <IconCampaigns /> },
  { id: 'p-agents',        type: 'page', title: 'Agents',                subtitle: 'AI agent library & configuration',  href: '/agents',                       icon: <IconAgents /> },
  { id: 'p-calls',         type: 'page', title: 'Call History',           subtitle: 'View all calls & transcripts',      href: '/calls',                        icon: <IconCalls /> },
  { id: 'p-calendar',      type: 'page', title: 'Calendar',              subtitle: 'Scheduling & appointments',         href: '/calendar',                     icon: <IconCalendar /> },
  { id: 'p-voicemails',    type: 'page', title: 'Voicemails',            subtitle: 'Voicemail inbox & playback',        href: '/voicemails',                   icon: <IconVoicemail /> },
  { id: 'p-followups',     type: 'page', title: 'Follow-ups',            subtitle: 'Pending callbacks & retries',       href: '/follow-ups',                   icon: <IconFollowUps /> },
  { id: 'p-analytics',     type: 'page', title: 'Analytics',             subtitle: 'Reports, charts & insights',        href: '/analytics',                    icon: <IconAnalytics /> },
  { id: 'p-reports',       type: 'page', title: 'Reports',               subtitle: 'Detailed performance reports',      href: '/reports',                      icon: <IconReports /> },
  { id: 'p-integrations',  type: 'page', title: 'Integrations',          subtitle: 'CRM, calendar & third-party apps',  href: '/integrations',                 icon: <IconIntegrations /> },
  { id: 'p-settings',      type: 'page', title: 'Settings',              subtitle: 'Company & account configuration',   href: '/settings',                     icon: <IconSettings /> },
  { id: 'p-billing',       type: 'page', title: 'Billing & Plans',       subtitle: 'Subscription & payment management', href: '/settings?tab=billing',         icon: <IconBilling /> },
  { id: 'p-team',          type: 'page', title: 'Team Members',          subtitle: 'Manage users, roles & invitations', href: '/settings?tab=team',            icon: <IconTeam /> },
  { id: 'p-notifications', type: 'page', title: 'Notification Settings', subtitle: 'Configure email & push alerts',     href: '/settings?tab=notifications',   icon: <IconBell /> },
  { id: 'p-calling',       type: 'page', title: 'Call Settings',         subtitle: 'Voice, timezone & working hours',   href: '/settings?tab=calling',         icon: <IconPhone /> },
  { id: 'p-onboarding',    type: 'page', title: 'Onboarding',            subtitle: 'Setup wizard & getting started',    href: '/onboarding',                   icon: <IconRocket /> },
];

const ACTIONS: SearchResult[] = [
  { id: 'a-import',     type: 'action', title: 'Import Contacts',      subtitle: 'CSV, Excel, Google Sheets',         href: '/contacts',       icon: <IconImport /> },
  { id: 'a-campaign',   type: 'action', title: 'Create Campaign',      subtitle: 'Launch a new AI calling campaign',  href: '/campaigns',      icon: <IconRocket /> },
  { id: 'a-agent',      type: 'action', title: 'Create Agent',         subtitle: 'Configure a new AI voice agent',   href: '/agents',         icon: <IconPlus /> },
  { id: 'a-contact',    type: 'action', title: 'Add Contact',          subtitle: 'Manually add a new contact',        href: '/contacts',       icon: <IconPlus /> },
  { id: 'a-schedule',   type: 'action', title: 'Schedule Event',       subtitle: 'Add to calendar',                   href: '/calendar',       icon: <IconCalendar /> },
  { id: 'a-export',     type: 'action', title: 'Export Reports',       subtitle: 'Download analytics & call data',    href: '/analytics',      icon: <IconExport /> },
  { id: 'a-invite',     type: 'action', title: 'Invite Team Member',   subtitle: 'Add someone to your team',          href: '/settings?tab=team', icon: <IconTeam /> },
];

const INTEGRATIONS: SearchResult[] = [
  { id: 'i-hubspot',     type: 'integration', title: 'HubSpot',                subtitle: 'CRM sync & contact import',         href: 'https://callengo.com/integrations/hubspot',                icon: <IconIntegrations />, external: true },
  { id: 'i-salesforce',  type: 'integration', title: 'Salesforce',             subtitle: 'CRM sync & lead management',        href: 'https://callengo.com/integrations/salesforce',             icon: <IconIntegrations />, external: true },
  { id: 'i-pipedrive',   type: 'integration', title: 'Pipedrive',              subtitle: 'CRM sync & deal tracking',          href: 'https://callengo.com/integrations/pipedrive',              icon: <IconIntegrations />, external: true },
  { id: 'i-zoho',        type: 'integration', title: 'Zoho CRM',               subtitle: 'CRM sync & contact management',     href: 'https://callengo.com/integrations/zoho-crm',               icon: <IconIntegrations />, external: true },
  { id: 'i-dynamics',    type: 'integration', title: 'Microsoft Dynamics 365', subtitle: 'Enterprise CRM integration',        href: 'https://callengo.com/integrations/microsoft-dynamics-365', icon: <IconIntegrations />, external: true },
  { id: 'i-clio',        type: 'integration', title: 'Clio',                   subtitle: 'Legal CRM for law firms',           href: 'https://callengo.com/integrations/clio',                   icon: <IconIntegrations />, external: true },
  { id: 'i-gcal',        type: 'integration', title: 'Google Calendar',        subtitle: 'Calendar sync & scheduling',        href: 'https://callengo.com/integrations/google-calendar',        icon: <IconCalendar />,     external: true },
  { id: 'i-outlook',     type: 'integration', title: 'Microsoft Outlook',      subtitle: 'Calendar & email integration',      href: 'https://callengo.com/integrations/outlook-calendar',       icon: <IconCalendar />,     external: true },
  { id: 'i-gmeet',       type: 'integration', title: 'Google Meet',            subtitle: 'Video meeting links',               href: 'https://callengo.com/integrations/google-meet',            icon: <IconIntegrations />, external: true },
  { id: 'i-zoom',        type: 'integration', title: 'Zoom',                   subtitle: 'Video meeting integration',         href: 'https://callengo.com/integrations/zoom',                   icon: <IconIntegrations />, external: true },
  { id: 'i-teams',       type: 'integration', title: 'Microsoft Teams',        subtitle: 'Team meetings & notifications',     href: 'https://callengo.com/integrations/microsoft-teams',        icon: <IconIntegrations />, external: true },
  { id: 'i-slack',       type: 'integration', title: 'Slack',                  subtitle: 'Real-time notifications',           href: 'https://callengo.com/integrations/slack',                  icon: <IconIntegrations />, external: true },
  { id: 'i-gsheets',     type: 'integration', title: 'Google Sheets',          subtitle: 'Import contacts from spreadsheets', href: 'https://callengo.com/integrations/google-sheets',          icon: <IconIntegrations />, external: true },
  { id: 'i-stripe',      type: 'integration', title: 'Stripe',                 subtitle: 'Payment processing',                href: 'https://callengo.com/integrations/stripe',                 icon: <IconBilling />,      external: true },
  { id: 'i-simplybook',  type: 'integration', title: 'SimplyBook.me',          subtitle: 'Booking & appointment scheduling',  href: 'https://callengo.com/integrations/simplybook-me',          icon: <IconCalendar />,     external: true },
  { id: 'i-webhooks',    type: 'integration', title: 'Webhooks',               subtitle: 'Zapier, Make, n8n automation',      href: 'https://callengo.com/integrations/webhooks',               icon: <IconIntegrations />, external: true },
];

const SETTINGS: SearchResult[] = [
  { id: 's-company',      type: 'setting', title: 'Company Information',    subtitle: 'Name, industry, website, logo',       href: '/settings',                   icon: <IconSettings /> },
  { id: 's-voice',        type: 'setting', title: 'Default Voice',          subtitle: 'Choose AI agent voice',               href: '/settings?tab=calling',       icon: <IconPhone /> },
  { id: 's-timezone',     type: 'setting', title: 'Timezone & Hours',       subtitle: 'Working hours & timezone config',     href: '/settings?tab=calling',       icon: <IconCalendar /> },
  { id: 's-language',     type: 'setting', title: 'Language Settings',      subtitle: 'Platform & agent language',           href: '/settings',                   icon: <IconGlobe /> },
  { id: 's-billing',      type: 'setting', title: 'Manage Subscription',    subtitle: 'Change plan, payment method',         href: '/settings?tab=billing',       icon: <IconBilling /> },
  { id: 's-invoices',     type: 'setting', title: 'Invoices & Receipts',    subtitle: 'Download billing history',            href: '/settings?tab=billing',       icon: <IconDocument /> },
  { id: 's-addons',       type: 'setting', title: 'Add-ons',                subtitle: 'Dedicated number, recording vault',   href: '/settings?tab=billing',       icon: <IconTag /> },
  { id: 's-roles',        type: 'setting', title: 'Roles & Permissions',    subtitle: 'Owner, Admin, Member roles',          href: '/settings?tab=team',          icon: <IconShield /> },
  { id: 's-notif-email',  type: 'setting', title: 'Email Notifications',    subtitle: 'Configure email alert preferences',   href: '/settings?tab=notifications', icon: <IconMail /> },
  { id: 's-callinterval', type: 'setting', title: 'Call Interval',          subtitle: 'Time between automatic calls',        href: '/settings?tab=calling',       icon: <IconCalls /> },
  { id: 's-maxduration',  type: 'setting', title: 'Max Call Duration',      subtitle: 'Maximum length per call',             href: '/settings?tab=calling',       icon: <IconCalls /> },
  { id: 's-concurrent',   type: 'setting', title: 'Concurrent Calls',       subtitle: 'Simultaneous call limit',             href: '/settings?tab=calling',       icon: <IconCalls /> },
];

const HELP_RESOURCES: SearchResult[] = [
  // Help & Docs (callengo.com)
  { id: 'h-help',          type: 'help', title: 'Help Center',              subtitle: 'Guides, FAQs & troubleshooting',            href: 'https://callengo.com/help',                                   icon: <IconQuestion />, external: true },
  { id: 'h-quickstart',    type: 'help', title: 'Quick Start Guide',        subtitle: 'Get started with Callengo',                  href: 'https://callengo.com/help/quick-start',                       icon: <IconRocket />,   external: true },
  { id: 'h-docs',          type: 'help', title: 'Documentation',            subtitle: 'Full platform documentation',                href: 'https://callengo.com/docs',                                   icon: <IconBook />,     external: true },
  { id: 'h-pricing',       type: 'help', title: 'Pricing & Plans',          subtitle: 'Compare plans & features',                   href: 'https://callengo.com/pricing',                                icon: <IconTag />,      external: true },
  { id: 'h-blog',          type: 'help', title: 'Blog',                     subtitle: 'Latest articles & insights',                 href: 'https://callengo.com/blog',                                   icon: <IconDocument />, external: true },
  { id: 'h-freetools',     type: 'help', title: 'Free Tools',               subtitle: 'Free resources & utilities',                 href: 'https://callengo.com/free-tools',                             icon: <IconWrench />,   external: true },
  { id: 'h-about',         type: 'help', title: 'About Callengo',           subtitle: 'Our mission & company info',                 href: 'https://callengo.com/about',                                  icon: <IconGlobe />,    external: true },
  { id: 'h-contact',       type: 'help', title: 'Contact Us',               subtitle: 'Get in touch with our team',                 href: 'https://callengo.com/contact',                                icon: <IconMail />,     external: true },
  // Agent pages
  { id: 'h-agent-lq',      type: 'help', title: 'Lead Qualification Agent', subtitle: 'How BANT-based lead scoring works',          href: 'https://callengo.com/agents/lead-qualification',              icon: <IconAgents />,   external: true },
  { id: 'h-agent-dv',      type: 'help', title: 'Data Validation Agent',    subtitle: 'Automated contact data verification',        href: 'https://callengo.com/agents/data-validation',                 icon: <IconAgents />,   external: true },
  { id: 'h-agent-ac',      type: 'help', title: 'Appointment Confirmation', subtitle: 'Reduce no-shows with AI confirmations',      href: 'https://callengo.com/agents/appointment-confirmation',        icon: <IconAgents />,   external: true },
  // Integration articles
  { id: 'h-i-hubspot',     type: 'resource', title: 'HubSpot Setup Guide',          subtitle: 'Step-by-step integration guide',    href: 'https://callengo.com/integrations/hubspot',                   icon: <IconBook />,     external: true },
  { id: 'h-i-salesforce',  type: 'resource', title: 'Salesforce Setup Guide',       subtitle: 'Connect Salesforce to Callengo',    href: 'https://callengo.com/integrations/salesforce',                icon: <IconBook />,     external: true },
  { id: 'h-i-pipedrive',   type: 'resource', title: 'Pipedrive Setup Guide',        subtitle: 'Connect Pipedrive to Callengo',     href: 'https://callengo.com/integrations/pipedrive',                 icon: <IconBook />,     external: true },
  { id: 'h-i-zoho',        type: 'resource', title: 'Zoho CRM Setup Guide',         subtitle: 'Connect Zoho CRM to Callengo',      href: 'https://callengo.com/integrations/zoho-crm',                  icon: <IconBook />,     external: true },
  { id: 'h-i-dynamics',    type: 'resource', title: 'Dynamics 365 Setup Guide',     subtitle: 'Connect MS Dynamics to Callengo',   href: 'https://callengo.com/integrations/microsoft-dynamics-365',     icon: <IconBook />,     external: true },
  { id: 'h-i-clio',        type: 'resource', title: 'Clio Setup Guide',             subtitle: 'Connect Clio to Callengo',          href: 'https://callengo.com/integrations/clio',                      icon: <IconBook />,     external: true },
  { id: 'h-i-gcal',        type: 'resource', title: 'Google Calendar Setup',        subtitle: 'Sync your Google Calendar',         href: 'https://callengo.com/integrations/google-calendar',           icon: <IconBook />,     external: true },
  { id: 'h-i-outlook',     type: 'resource', title: 'Outlook Calendar Setup',       subtitle: 'Sync your Outlook Calendar',        href: 'https://callengo.com/integrations/outlook-calendar',          icon: <IconBook />,     external: true },
  { id: 'h-i-gmeet',       type: 'resource', title: 'Google Meet Setup',            subtitle: 'Auto-generate Meet links',          href: 'https://callengo.com/integrations/google-meet',               icon: <IconBook />,     external: true },
  { id: 'h-i-zoom',        type: 'resource', title: 'Zoom Setup Guide',             subtitle: 'Connect Zoom to Callengo',          href: 'https://callengo.com/integrations/zoom',                      icon: <IconBook />,     external: true },
  { id: 'h-i-teams',       type: 'resource', title: 'Microsoft Teams Setup',        subtitle: 'Connect Teams to Callengo',         href: 'https://callengo.com/integrations/microsoft-teams',           icon: <IconBook />,     external: true },
  { id: 'h-i-slack',       type: 'resource', title: 'Slack Setup Guide',            subtitle: 'Set up Slack notifications',        href: 'https://callengo.com/integrations/slack',                     icon: <IconBook />,     external: true },
  { id: 'h-i-gsheets',     type: 'resource', title: 'Google Sheets Setup',          subtitle: 'Import contacts from Sheets',       href: 'https://callengo.com/integrations/google-sheets',             icon: <IconBook />,     external: true },
  { id: 'h-i-stripe',      type: 'resource', title: 'Stripe Integration',           subtitle: 'Payment & billing setup',           href: 'https://callengo.com/integrations/stripe',                    icon: <IconBook />,     external: true },
  { id: 'h-i-simplybook',  type: 'resource', title: 'SimplyBook.me Setup',          subtitle: 'Booking integration guide',         href: 'https://callengo.com/integrations/simplybook-me',             icon: <IconBook />,     external: true },
  { id: 'h-i-webhooks',    type: 'resource', title: 'Webhooks Setup',               subtitle: 'Zapier, Make & n8n automation',     href: 'https://callengo.com/integrations/webhooks',                  icon: <IconBook />,     external: true },
  // Blog articles
  { id: 'h-b-noshows',     type: 'resource', title: 'Reduce No-Shows with AI',      subtitle: 'Blog: automated confirmations',     href: 'https://callengo.com/blog/reduce-no-shows-automated-confirmations', icon: <IconDocument />, external: true },
  { id: 'h-b-baddata',     type: 'resource', title: 'True Cost of Bad CRM Data',    subtitle: 'Blog: data quality insights',       href: 'https://callengo.com/blog/true-cost-bad-data-crm',                  icon: <IconDocument />, external: true },
  { id: 'h-b-response',    type: 'resource', title: 'Lead Response Time & Sales',   subtitle: 'Blog: speed-to-lead matters',       href: 'https://callengo.com/blog/lead-response-time-killing-sales',        icon: <IconDocument />, external: true },
  // Legal
  { id: 'h-legal',         type: 'resource', title: 'Legal',                  subtitle: 'Terms, privacy & compliance',               href: 'https://callengo.com/legal',      icon: <IconShield />,   external: true },
  { id: 'h-privacy',       type: 'resource', title: 'Privacy Policy',         subtitle: 'How we handle your data',                   href: 'https://callengo.com/privacy',    icon: <IconShield />,   external: true },
  { id: 'h-terms',         type: 'resource', title: 'Terms of Service',       subtitle: 'Platform terms & conditions',               href: 'https://callengo.com/terms',      icon: <IconDocument />, external: true },
  { id: 'h-compliance',    type: 'resource', title: 'Compliance',             subtitle: 'Regulatory & compliance info',              href: 'https://callengo.com/compliance', icon: <IconShield />,   external: true },
];

const ALL_STATIC = [...PAGES, ...ACTIONS, ...INTEGRATIONS, ...SETTINGS, ...HELP_RESOURCES];

const TYPE_PILL: Record<string, string> = {
  page:        'bg-[var(--color-info-50)] text-[var(--color-info-600)]',
  action:      'bg-[var(--color-primary-50)] text-[var(--color-primary-600)]',
  contact:     'bg-[var(--color-success-50)] text-[var(--color-success-600)]',
  campaign:    'bg-[var(--color-warning-50)] text-[var(--color-warning-600)]',
  agent:       'bg-purple-50 text-purple-600',
  user:        'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]',
  integration: 'bg-teal-50 text-teal-600',
  setting:     'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]',
  help:        'bg-amber-50 text-amber-600',
  resource:    'bg-sky-50 text-sky-600',
  default:     'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]',
};

const TYPE_LABELS: Record<string, string> = {
  page: 'page',
  action: 'action',
  contact: 'contact',
  campaign: 'campaign',
  agent: 'agent',
  user: 'user',
  integration: 'integration',
  setting: 'setting',
  help: 'help',
  resource: 'article',
};

export default function CommandCenter({ isOpen, onClose, companyId }: CommandCenterProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dbResults, setDbResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const inputRef   = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  // Reset & focus on open
  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => {
        setQuery('');
        setSelectedIndex(0);
        setDbResults([]);
      });
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick, true);
    return () => document.removeEventListener('mousedown', handleClick, true);
  }, [isOpen, onClose]);

  // DB search with debounce
  useEffect(() => {
    if (!query || query.length < 2 || !companyId) {
      queueMicrotask(() => setDbResults([]));
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const supabase = createClient();
      const results: SearchResult[] = [];
      try {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, contact_name, phone_number, email')
          .eq('company_id', companyId)
          .or(`contact_name.ilike.%${query}%,phone_number.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(5);
        contacts?.forEach(c => results.push({
          id: `c-${c.id}`, type: 'contact',
          title: c.contact_name || 'Unknown',
          subtitle: c.phone_number || c.email || '',
          href: '/contacts', icon: <IconUser />,
        }));

        const { data: campaigns } = await supabase
          .from('agent_runs')
          .select('id, name, status')
          .eq('company_id', companyId)
          .ilike('name', `%${query}%`)
          .limit(5);
        campaigns?.forEach(c => results.push({
          id: `camp-${c.id}`, type: 'campaign',
          title: c.name, subtitle: `Campaign · ${c.status}`,
          href: '/campaigns', icon: <IconCampaigns />,
        }));

        const { data: agents } = await supabase
          .from('agent_templates')
          .select('id, name, category')
          .ilike('name', `%${query}%`)
          .limit(5);
        agents?.forEach(a => results.push({
          id: `ag-${a.id}`, type: 'agent',
          title: a.name, subtitle: `Agent · ${a.category || 'General'}`,
          href: '/agents', icon: <IconAgents />,
        }));

        const { data: users } = await supabase
          .from('users')
          .select('id, full_name, email, role')
          .eq('company_id', companyId)
          .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(3);
        users?.forEach(u => results.push({
          id: `u-${u.id}`, type: 'user',
          title: u.full_name || u.email, subtitle: `User · ${u.role}`,
          href: '/settings?tab=team', icon: <IconTeam />,
        }));
      } catch (err) {
        console.error('Search error:', err);
      }
      setDbResults(results);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, companyId]);

  // Filter static results
  const filterStatic = useCallback((items: SearchResult[]) => {
    if (!query) return [];
    const q = query.toLowerCase();
    return items.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.subtitle?.toLowerCase().includes(q)
    );
  }, [query]);

  // Compute results
  const filteredPages = query ? filterStatic(PAGES) : PAGES.slice(0, 6);
  const filteredActions = query ? filterStatic(ACTIONS) : ACTIONS.slice(0, 4);
  const filteredIntegrations = filterStatic(INTEGRATIONS);
  const filteredSettings = filterStatic(SETTINGS);
  const filteredHelp = filterStatic(HELP_RESOURCES);

  const allResults = [
    ...filteredPages,
    ...filteredActions,
    ...filteredIntegrations,
    ...filteredSettings,
    ...dbResults,
    ...filteredHelp,
  ];

  // Navigate to result
  const navigateToResult = useCallback((result: SearchResult) => {
    if (result.external) {
      window.open(result.href, '_blank', 'noopener,noreferrer');
    } else {
      router.push(result.href);
    }
    onClose();
  }, [router, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, allResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (allResults[selectedIndex]) {
          navigateToResult(allResults[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [isOpen, allResults, selectedIndex, navigateToResult, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (!resultsRef.current) return;
    const el = resultsRef.current.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  // Build grouped structure
  const pages   = allResults.filter(r => r.type === 'page');
  const actions = allResults.filter(r => r.type === 'action');
  const integrations = allResults.filter(r => r.type === 'integration');
  const settings = allResults.filter(r => r.type === 'setting');
  const data    = allResults.filter(r => ['contact', 'campaign', 'agent', 'user'].includes(r.type));
  const help    = allResults.filter(r => r.type === 'help');
  const resources = allResults.filter(r => r.type === 'resource');

  const groups: { label: string; items: SearchResult[] }[] = [];
  if (pages.length)        groups.push({ label: 'Pages',        items: pages });
  if (actions.length)      groups.push({ label: 'Quick Actions', items: actions });
  if (integrations.length) groups.push({ label: 'Integrations', items: integrations });
  if (settings.length)     groups.push({ label: 'Settings',     items: settings });
  if (data.length)         groups.push({ label: 'Results',      items: data });
  if (help.length)         groups.push({ label: 'Help & Docs',  items: help });
  if (resources.length)    groups.push({ label: 'Articles & Guides', items: resources });

  const flatOrdered = groups.flatMap(g => g.items);
  const hasNoResults = groups.length === 0 && query && !searching;

  return (
    <div
      ref={panelRef}
      className="
        absolute top-[calc(100%+8px)] left-0 right-0
        min-w-[420px] -left-8
        bg-white rounded-2xl shadow-2xl border border-[var(--border-default)]
        overflow-hidden z-50
        animate-slideDown
      "
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Search input */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)] bg-white">
        <svg className="w-4 h-4 text-[var(--color-neutral-400)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
          placeholder={t.commandCenter.placeholder}
          className="flex-1 text-sm text-[var(--color-ink)] placeholder-[var(--color-neutral-400)] outline-none bg-transparent"
        />
        {searching ? (
          <div className="w-4 h-4 border-2 border-[var(--border-default)] border-t-[var(--color-primary)] rounded-full animate-spin shrink-0" />
        ) : (
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-neutral-400)] bg-[var(--color-neutral-100)] border border-[var(--border-default)] rounded">
            ESC
          </kbd>
        )}
      </div>

      {/* Results */}
      <div
        ref={resultsRef}
        className="overflow-y-auto overscroll-contain"
        style={{ maxHeight: '400px' }}
      >
        {/* No results with help links */}
        {hasNoResults && (
          <div className="px-5 py-8 text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-[var(--color-neutral-100)] flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--color-neutral-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[var(--color-neutral-600)]">{t.commandCenter.noResults}</p>
            <p className="text-xs text-[var(--color-neutral-400)] mt-1">No matches for &ldquo;{query}&rdquo;</p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <a
                href="https://callengo.com/help"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary-50)] hover:bg-[var(--color-primary-100)] rounded-lg transition-colors"
              >
                <IconQuestion className="w-3.5 h-3.5" />
                Visit Help Center
              </a>
              <a
                href="https://callengo.com/contact"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-neutral-600)] bg-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-200)] rounded-lg transition-colors"
              >
                <IconMail className="w-3.5 h-3.5" />
                Contact Us
              </a>
            </div>
          </div>
        )}

        {groups.length === 0 && !query && (
          <div className="px-4 py-3" />
        )}

        {groups.map(group => (
          <div key={group.label}>
            <div className="sticky top-0 px-4 pt-3 pb-1 bg-white z-10">
              <span className="text-[10px] font-bold text-[var(--color-neutral-400)] uppercase tracking-wider">
                {group.label}
              </span>
            </div>

            {group.items.map(item => {
              const idx = flatOrdered.indexOf(item);
              const isSelected = selectedIndex === idx;
              return (
                <button
                  key={item.id}
                  data-index={idx}
                  onClick={() => navigateToResult(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                    ${isSelected ? 'bg-[var(--color-primary-50)]' : 'hover:bg-[var(--color-neutral-50)]'}
                  `}
                >
                  <span className={`w-6 flex items-center justify-center shrink-0 ${isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-neutral-400)]'}`}>
                    {item.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-neutral-800)]'}`}>
                      {item.title}
                    </div>
                    {item.subtitle && (
                      <div className="text-xs text-[var(--color-neutral-500)] truncate">{item.subtitle}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_PILL[item.type] ?? TYPE_PILL.default}`}>
                      {TYPE_LABELS[item.type] || item.type}
                    </span>
                    {item.external && (
                      <IconExternal className="w-3 h-3 text-[var(--color-neutral-300)]" />
                    )}
                    {isSelected && !item.external && (
                      <kbd className="text-[10px] text-[var(--color-neutral-400)] px-1.5 py-0.5 bg-[var(--color-neutral-100)] rounded border border-[var(--border-default)]">
                        ↵
                      </kbd>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[var(--border-subtle)] bg-[var(--color-neutral-50)] flex items-center justify-between text-[11px] text-[var(--color-neutral-400)]">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white rounded border border-[var(--border-default)] text-[10px] shadow-sm">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-white rounded border border-[var(--border-default)] text-[10px] shadow-sm">↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white rounded border border-[var(--border-default)] text-[10px] shadow-sm">↵</kbd>
            Open
          </span>
        </div>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-white rounded border border-[var(--border-default)] text-[10px] shadow-sm">ESC</kbd>
          Close
        </span>
      </div>
    </div>
  );
}
