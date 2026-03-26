'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n';
import { createClient } from '@/lib/supabase/client';
import OnboardingWizardModal from '@/components/onboarding/OnboardingWizardModal';
import 'driver.js/dist/driver.css';

interface HomePageProps {
  userName: string;
  companyId: string;
  companyName: string;
  completedTasks: Record<string, boolean>;
  onboardingWizardCompleted: boolean;
  homeTourSeen?: boolean;
  stats: {
    contacts: number;
    campaigns: number;
    calls: number;
  };
  plan: {
    name: string;
    slug: string;
    minutesUsed: number;
    minutesIncluded: number;
  };
}

const GET_STARTED_TASKS = [
  { id: 'added_contacts', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z', href: '/contacts' },
  { id: 'configured_agent', icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z', href: '/agents' },
  { id: 'launched_campaign', icon: 'M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z', href: '/campaigns' },
  { id: 'tested_agent', icon: 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z', href: '/agents' },
  { id: 'connected_google', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5', href: '/integrations' },
  { id: 'synced_calendar_contacts', icon: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5', href: '/contacts' },
  { id: 'viewed_analytics', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z', href: '/analytics' },
  { id: 'listened_call', icon: 'M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z', href: '/calls' },
  { id: 'viewed_transcript', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z', href: '/calls' },
  { id: 'updated_contact', icon: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10', href: '/contacts' },
  { id: 'explored_integrations', icon: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244', href: '/integrations' },
];

// Translation keys for each get-started task
const TASK_LABELS: Record<string, string> = {
  added_contacts: 'getStarted.addContacts',
  configured_agent: 'getStarted.configureAgent',
  launched_campaign: 'getStarted.launchCampaign',
  tested_agent: 'getStarted.testAgent',
  connected_google: 'getStarted.connectCalendar',
  synced_calendar_contacts: 'getStarted.syncCalendarContacts',
  viewed_analytics: 'getStarted.viewAnalytics',
  listened_call: 'getStarted.listenRecording',
  viewed_transcript: 'getStarted.viewTranscript',
  updated_contact: 'getStarted.updateContact',
  explored_integrations: 'getStarted.exploreIntegrations',
};

const VIDEOS = [
  { id: 'what-is', title: 'What is Callengo?', videoId: 'qAdcMVbrIeM' },
  { id: 'get-started', title: 'How to get started using Callengo', videoId: 'ZnhFtWcfY4w' },
  { id: 'first-campaign', title: 'Your First Campaign in Callengo', videoId: 'HkZPPre33BI' },
  { id: 'integrations', title: 'Integrate your favorite tools in Callengo', videoId: 'k_YlnxFwgM0' },
];

// Quick actions with proper page-matching icons
const QUICK_ACTIONS = [
  {
    labelKey: 'nav.campaigns' as const,
    descKey: 'campaigns.newCampaign' as const,
    href: '/campaigns',
    icon: 'M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z',
    color: 'from-[var(--color-primary)] to-[var(--color-electric)]',
  },
  {
    labelKey: 'nav.contacts' as const,
    descKey: 'contacts.addContact' as const,
    href: '/contacts',
    icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    labelKey: 'nav.calendar' as const,
    descKey: 'calendar.syncCalendar' as const,
    href: '/calendar',
    icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
    color: 'from-orange-500 to-amber-600',
  },
  {
    labelKey: 'nav.agents' as const,
    descKey: 'agents.subtitle' as const,
    href: '/agents',
    icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z',
    color: 'from-violet-500 to-purple-600',
  },
];

// ─── Home Guided Tour ─────────────────────────────────────────────────────────

interface HomeTourProps {
  firstName: string;
  pendingCount: number;
  companyId: string;
  onDismiss: () => void;
}

function HomeTour({ firstName, pendingCount, companyId, onDismiss }: HomeTourProps) {
  const supabase = createClient();

  const persistAndClose = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('company_settings')
        .select('settings')
        .eq('company_id', companyId)
        .single();
      const existing = (data?.settings as Record<string, unknown>) || {};
      await supabase
        .from('company_settings')
        .update({ settings: { ...existing, tour_home_seen: true } })
        .eq('company_id', companyId);
    } catch { /* non-critical */ }
  }, [companyId, supabase]);

  useEffect(() => {
    let tourInstance: { destroy: () => void; drive: () => void } | null = null;
    let finished = false;

    const finish = () => {
      if (!finished) {
        finished = true;
        persistAndClose();
        onDismiss();
      }
    };

    const start = async () => {
      const { driver: driverFn } = await import('driver.js');

      tourInstance = driverFn({
        showProgress: true,
        progressText: '{{current}} of {{total}}',
        allowClose: true,
        smoothScroll: true,
        stagePadding: 8,
        stageRadius: 10,
        overlayOpacity: 0.62,
        popoverClass: 'callengo-tour',
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Done',
        overlayClickBehavior: () => {},
        onDestroyed: finish,
        steps: [
          {
            popover: {
              title: `Welcome to Callengo, ${firstName}!`,
              description: `Your AI calling platform is ready. You have ${pendingCount} ${pendingCount === 1 ? 'task' : 'tasks'} to complete before your first campaign. Let's take a quick tour.`,
            },
          },
          {
            element: '#tour-action-cards',
            popover: {
              title: 'Quick Actions',
              description: 'Jump directly to Campaigns, Contacts, Calendar, and your Agents with a single click.',
              side: 'bottom',
              align: 'start',
            },
          },
          {
            element: '#tour-quick-actions',
            popover: {
              title: 'Your Get Started checklist',
              description: `Complete ${pendingCount} tasks to unlock the full power of Callengo. Each step builds on the last.`,
              side: 'top',
              align: 'start',
            },
          },
          {
            element: '#tour-nav-group-0',
            popover: {
              title: 'Home & Dashboard',
              description: 'Home is your daily overview. Dashboard shows live call metrics and KPIs.',
              side: 'right',
              align: 'center',
            },
          },
          {
            element: '#tour-nav-group-1',
            popover: {
              title: 'Contacts, Campaigns & Agents',
              description: 'Manage your contact list, run outbound calling campaigns, and configure your AI agents here.',
              side: 'right',
              align: 'center',
            },
          },
          {
            element: '#tour-nav-group-2',
            popover: {
              title: 'Calls, Calendar & Follow-ups',
              description: 'Review call recordings and transcripts, manage your calendar, listen to voicemails, and track follow-up actions.',
              side: 'right',
              align: 'center',
            },
          },
          {
            element: '#tour-nav-group-3',
            popover: {
              title: 'Analytics, Integrations & Team',
              description: 'Measure performance across campaigns, connect your CRM and calendar tools, and manage your team.',
              side: 'right',
              align: 'center',
            },
          },
          {
            element: '#tour-settings-btn',
            popover: {
              title: 'Settings',
              description: 'Configure your account, billing plan, and notification preferences.',
              side: 'bottom',
              align: 'end',
            },
          },
          {
            element: '#tour-cali-btn',
            popover: {
              title: 'Meet Cali, your AI assistant',
              description: 'Ask about call performance, get help writing scripts, or request contact insights. Always here when you need it.',
              side: 'bottom',
              align: 'end',
            },
          },
        ],
      });

      // Expose global close so other components can dismiss the tour
      // NOTE: call finish() first (it sets finished=true + persists), then destroy
      (window as Window & { __callengoTourClose?: () => void }).__callengoTourClose = () => {
        finish();             // persists tour_home_seen + calls onDismiss
        tourInstance?.destroy(); // triggers onDestroyed → finish() is no-op (finished=true)
      };

      setTimeout(() => tourInstance?.drive(), 400);
    };

    start();

    return () => {
      finished = true;
      tourInstance?.destroy();
      delete (window as Window & { __callengoTourClose?: () => void }).__callengoTourClose;
    };
  }, [firstName, pendingCount, companyId, onDismiss, persistAndClose]);

  // Dark Callengo theme overrides for driver.js popover
  return (
    <style suppressHydrationWarning dangerouslySetInnerHTML={{__html: `
      .callengo-tour.driver-popover {
        background-color: #12101e !important;
        border: 1px solid rgba(124,58,237,0.3) !important;
        border-radius: 14px !important;
        box-shadow: 0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(124,58,237,0.08) !important;
        padding: 22px 24px 18px !important;
        max-width: 310px !important;
        min-width: 265px !important;
      }
      .callengo-tour .driver-popover-title {
        font-size: 15px !important;
        font-weight: 600 !important;
        color: #fff !important;
        line-height: 1.35 !important;
        letter-spacing: -0.01em !important;
        margin-bottom: 6px !important;
      }
      .callengo-tour .driver-popover-description {
        font-size: 13px !important;
        color: rgba(255,255,255,0.62) !important;
        line-height: 1.65 !important;
        margin-top: 0 !important;
      }
      .callengo-tour .driver-popover-footer {
        margin-top: 18px !important;
        padding-top: 14px !important;
        border-top: 1px solid rgba(255,255,255,0.07) !important;
      }
      .callengo-tour .driver-popover-footer button {
        background-color: transparent !important;
        border: 1px solid rgba(255,255,255,0.14) !important;
        color: rgba(255,255,255,0.52) !important;
        border-radius: 8px !important;
        padding: 7px 13px !important;
        font-size: 12.5px !important;
        font-weight: 500 !important;
        text-shadow: none !important;
        box-shadow: none !important;
        transition: background 0.15s ease, color 0.15s ease !important;
        line-height: 1.4 !important;
      }
      .callengo-tour .driver-popover-footer button:hover,
      .callengo-tour .driver-popover-footer button:focus {
        background-color: rgba(255,255,255,0.07) !important;
        color: rgba(255,255,255,0.85) !important;
      }
      .callengo-tour .driver-popover-next-btn {
        background: linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%) !important;
        border-color: transparent !important;
        color: #fff !important;
        font-weight: 600 !important;
        box-shadow: 0 2px 8px rgba(124,58,237,0.35) !important;
        padding: 7px 16px !important;
      }
      .callengo-tour .driver-popover-next-btn:hover,
      .callengo-tour .driver-popover-next-btn:focus {
        opacity: 0.88 !important;
        background: linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%) !important;
      }
      .callengo-tour .driver-popover-close-btn {
        color: rgba(255,255,255,0.28) !important;
        background: none !important;
        border: none !important;
        outline: none !important;
      }
      .callengo-tour .driver-popover-close-btn:hover,
      .callengo-tour .driver-popover-close-btn:focus {
        color: rgba(255,255,255,0.75) !important;
        background: none !important;
        outline: none !important;
        box-shadow: none !important;
      }
      .callengo-tour .driver-popover-footer button:focus-visible { outline: none !important; }
      .callengo-tour .driver-popover-progress-text {
        font-size: 11px !important;
        color: rgba(255,255,255,0.28) !important;
        font-weight: 500 !important;
      }
      .callengo-tour .driver-popover-arrow { border-color: #12101e !important; }
      .callengo-tour .driver-popover-arrow-side-left {
        border-right-color: transparent !important;
        border-bottom-color: transparent !important;
        border-top-color: transparent !important;
      }
      .callengo-tour .driver-popover-arrow-side-right {
        border-left-color: transparent !important;
        border-bottom-color: transparent !important;
        border-top-color: transparent !important;
      }
      .callengo-tour .driver-popover-arrow-side-top {
        border-right-color: transparent !important;
        border-bottom-color: transparent !important;
        border-left-color: transparent !important;
      }
      .callengo-tour .driver-popover-arrow-side-bottom {
        border-right-color: transparent !important;
        border-left-color: transparent !important;
        border-top-color: transparent !important;
      }
    `}} />
  );
}

// ─── Helper to get nested i18n key ────────────────────────────────────────────

// Helper to get nested i18n key
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return path;
    }
  }
  return typeof current === 'string' ? current : path;
}

const COLLAPSED_COUNT = 5;

export default function HomePage({ userName, companyId, companyName, completedTasks, onboardingWizardCompleted, homeTourSeen = false, stats, plan }: HomePageProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [videoModal, setVideoModal] = useState<{ title: string; videoId: string } | null>(null);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(!onboardingWizardCompleted);
  const [wizardCompleted, setWizardCompleted] = useState(onboardingWizardCompleted);
  const [showHomeTour, setShowHomeTour] = useState(false);

  // Show home tour after onboarding completes (or on first visit if already completed)
  useEffect(() => {
    if (homeTourSeen) return;
    if (!wizardCompleted || showOnboardingWizard) return;
    const timer = setTimeout(() => setShowHomeTour(true), 650);
    return () => clearTimeout(timer);
  }, [wizardCompleted, showOnboardingWizard, homeTourSeen]);

  const handleTourDismiss = useCallback(() => setShowHomeTour(false), []);

  const handleOnboardingComplete = () => {
    setShowOnboardingWizard(false);
    setWizardCompleted(true);
    router.refresh();
  };

  const handleOnboardingDismiss = () => {
    setShowOnboardingWizard(false);
    setWizardCompleted(true);
  };

  const completedCount = Object.values(completedTasks).filter(Boolean).length;
  const totalTasks = GET_STARTED_TASKS.length;
  const progressPercent = Math.round((completedCount / totalTasks) * 100);

  const isFree = plan.slug === 'free';
  const firstName = userName.split(' ')[0] || 'there';

  // Sort tasks: incomplete first, then completed
  const sortedTasks = [...GET_STARTED_TASKS].sort((a, b) => {
    const aCompleted = completedTasks[a.id] || false;
    const bCompleted = completedTasks[b.id] || false;
    if (aCompleted === bCompleted) return 0;
    return aCompleted ? 1 : -1;
  });

  const visibleTasks = showAllTasks ? sortedTasks : sortedTasks.slice(0, COLLAPSED_COUNT);
  const hiddenCount = sortedTasks.length - COLLAPSED_COUNT;

  const getTaskLabel = (taskId: string): string => {
    const key = TASK_LABELS[taskId];
    if (!key) return taskId;
    return getNestedValue(t as unknown as Record<string, unknown>, key);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-ink)]">
            {t.dashboard.welcome}, {firstName}
          </h1>
          <p className="text-sm text-[var(--color-neutral-500)] mt-1">
            {t.dashboard.overview}
          </p>
        </div>
        {isFree && (
          <button
            onClick={() => router.push('/settings?tab=billing')}
            className="px-4 py-2 gradient-bg text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-all shadow-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            {t.billing.upgradePlan}
          </button>
        )}
      </div>

      {/* Free plan banner */}
      {isFree && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">{t.billing.free}</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {plan.minutesUsed.toFixed(1)} / {plan.minutesIncluded} {t.common.minutes}
            </p>
          </div>
          <button
            onClick={() => router.push('/settings?tab=billing')}
            className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors flex-shrink-0"
          >
            {t.billing.changePlan}
          </button>
        </div>
      )}

      {/* Pending Onboarding Banner — only if wizard not completed and modal not open */}
      {!wizardCompleted && !showOnboardingWizard && (
        <div className="bg-gradient-to-r from-[var(--color-primary-50)] to-indigo-50 border border-[var(--color-primary-200)] rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center flex-shrink-0 shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--color-ink)]">{t.onboarding.wizard.completeOnboarding}</p>
            <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">{t.onboarding.wizard.pendingSetup}</p>
          </div>
          <button
            onClick={() => setShowOnboardingWizard(true)}
            className="px-4 py-2 gradient-bg text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-sm flex-shrink-0"
          >
            {t.onboarding.wizard.resumeSetup}
          </button>
        </div>
      )}

      {/* Stats Summary - compact row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-[var(--border-default)] rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-[var(--color-ink)]">{stats.contacts}</p>
              <p className="text-xs text-[var(--color-neutral-500)] font-medium">{t.nav.contacts}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-[var(--border-default)] rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-[var(--color-ink)]">{stats.campaigns}</p>
              <p className="text-xs text-[var(--color-neutral-500)] font-medium">{t.nav.campaigns}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-[var(--border-default)] rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-bold text-[var(--color-ink)]">{stats.calls}</p>
              <p className="text-xs text-[var(--color-neutral-500)] font-medium">{t.nav.callHistory}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions - 4 cards horizontal with proper icons */}
      <div id="tour-action-cards" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.href}
            onClick={() => {
              (window as Window & { __callengoTourClose?: () => void }).__callengoTourClose?.();
              router.push(action.href);
            }}
            className="group bg-white border border-[var(--border-default)] rounded-xl p-4 hover:shadow-md hover:border-[var(--color-primary-200)] transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform flex-shrink-0`}>
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={action.icon} />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-ink)] truncate">
                  {getNestedValue(t as unknown as Record<string, unknown>, action.labelKey)}
                </p>
                <p className="text-xs text-[var(--color-neutral-400)] truncate">
                  {getNestedValue(t as unknown as Record<string, unknown>, action.descKey)}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Get Started Section - Collapsed by default, shows 5 tasks */}
      <div id="tour-quick-actions" className="bg-white border border-[var(--border-default)] rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg gradient-bg flex items-center justify-center shadow-sm">
                <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--color-ink)]">{t.dashboard.quickActions}</h2>
                <p className="text-xs text-[var(--color-neutral-400)]">{completedCount} / {totalTasks}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 h-2 bg-[var(--color-neutral-100)] rounded-full overflow-hidden">
                <div
                  className="h-full gradient-bg rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-sm font-bold text-[var(--color-primary)]">{progressPercent}%</span>
            </div>
          </div>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {visibleTasks.map((task) => {
            const isCompleted = completedTasks[task.id] || false;
            return (
              <button
                key={task.id}
                onClick={() => router.push(task.href)}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-[var(--color-neutral-50)] group ${isCompleted ? 'opacity-50' : ''}`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                  isCompleted
                    ? 'bg-[var(--color-success-500)]'
                    : 'border-2 border-[var(--color-neutral-300)] group-hover:border-[var(--color-primary)]'
                }`}>
                  {isCompleted && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <svg className={`w-4 h-4 flex-shrink-0 ${isCompleted ? 'text-[var(--color-neutral-400)]' : 'text-[var(--color-primary)]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={task.icon} />
                </svg>
                <span className={`text-sm font-medium flex-1 ${isCompleted ? 'line-through text-[var(--color-neutral-400)]' : 'text-[var(--color-ink)]'}`}>
                  {getTaskLabel(task.id)}
                </span>
                {!isCompleted && (
                  <svg className="w-3.5 h-3.5 text-[var(--color-neutral-300)] group-hover:text-[var(--color-primary)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Show All / Collapse toggle — hidden during guided tour to avoid re-render loop */}
        {hiddenCount > 0 && !showHomeTour && (
          <button
            onClick={() => setShowAllTasks(!showAllTasks)}
            className="w-full px-5 py-2.5 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-neutral-50)] transition-colors flex items-center justify-center gap-1.5 border-t border-[var(--border-subtle)]"
          >
            {showAllTasks ? (
              <>
                {t.common.close}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
              </>
            ) : (
              <>
                {t.common.viewAll} ({hiddenCount} {t.common.more || 'more'})
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </>
            )}
          </button>
        )}
      </div>

      {/* Learn Section - Videos (HIDDEN: using test videos, uncomment when real video URLs are ready) */}
      {/* <div>
        <h2 className="text-base font-bold text-[var(--color-ink)] mb-3">{t.common.info}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {VIDEOS.map((video) => (
            <button
              key={video.id}
              onClick={() => setVideoModal(video)}
              className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden hover:shadow-md hover:border-[var(--color-primary-200)] transition-all group text-left"
            >
              <div className="relative aspect-video bg-[var(--color-neutral-100)]">
                <img
                  src={`https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/30 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4 text-[var(--color-ink)] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs font-semibold text-[var(--color-ink)] line-clamp-2">{video.title}</p>
              </div>
            </button>
          ))}
        </div>
      </div> */}

      {/* Video Modal (HIDDEN: uncomment with Learn Section above) */}
      {/* {videoModal && (
        <div className="fixed inset-0 bg-[var(--color-neutral-900)]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setVideoModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)]">
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">{videoModal.title}</h3>
              <button onClick={() => setVideoModal(null)} className="p-1 rounded-lg hover:bg-[var(--color-neutral-100)] transition-colors">
                <svg className="w-5 h-5 text-[var(--color-neutral-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="aspect-video">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoModal.videoId}?autoplay=1`}
                title={videoModal.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      )} */}

      {/* Onboarding Wizard Modal — overlay on top of home page */}
      {showOnboardingWizard && (
        <OnboardingWizardModal
          companyId={companyId}
          companyName={companyName}
          onComplete={handleOnboardingComplete}
          onDismiss={handleOnboardingDismiss}
        />
      )}

      {/* Home guided tour — only after onboarding, only if not seen before */}
      {showHomeTour && !showOnboardingWizard && (
        <HomeTour
          firstName={firstName}
          pendingCount={Object.values(completedTasks).filter(v => !v).length}
          companyId={companyId}
          onDismiss={handleTourDismiss}
        />
      )}
    </div>
  );
}
