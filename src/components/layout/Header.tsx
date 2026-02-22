// components/layout/Header.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NotificationsDropdown from '@/components/notifications/NotificationsDropdown';
import AIChatPanel from '@/components/ai/AIChatPanel';
import CommandCenter from './CommandCenter';

type User = {
  id: string;
  email: string;
  full_name: string | null;
  company_id?: string;
};

interface HeaderProps {
  user: User;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  onMenuClick: () => void;
  onLogout?: () => void;
  companyId?: string;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

function MenuIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function ChevronLeftIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

interface PlanInfo {
  name: string;
  slug: string;
  minutesUsed: number;
  minutesIncluded: number;
}

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

export default function Header({
  user,
  title,
  subtitle,
  actions,
  onMenuClick,
  onLogout,
  companyId,
  isSidebarCollapsed,
  onToggleSidebar,
}: HeaderProps) {
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCommandCenter, setShowCommandCenter] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const userMenuRef = useRef<HTMLDivElement>(null);
  // Ref for the search bar wrapper — CommandCenter uses this to anchor the dropdown
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  const initials = (user.full_name || user.email)
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  useEffect(() => {
    if (!companyId) return;
    const supabase = createClient();
    const fetchData = async () => {
      const { data: subscription } = await supabase
        .from('company_subscriptions')
        .select('*, subscription_plans(*)')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .single();

      const { data: usage } = await supabase
        .from('usage_tracking')
        .select('minutes_used, minutes_included')
        .eq('company_id', companyId)
        .order('period_start', { ascending: false })
        .limit(1)
        .single();

      if (subscription?.subscription_plans) {
        const plan = subscription.subscription_plans as any;
        setPlanInfo({
          name: plan.name || 'Free',
          slug: plan.slug || 'free',
          minutesUsed: usage?.minutes_used || 0,
          minutesIncluded: plan.minutes_included || usage?.minutes_included || 0,
        });
      } else {
        setPlanInfo({
          name: 'Free',
          slug: 'free',
          minutesUsed: usage?.minutes_used || 0,
          minutesIncluded: usage?.minutes_included || 15,
        });
      }

      const { data: members } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('company_id', companyId)
        .limit(10);

      if (members) setTeamMembers(members);
    };
    fetchData();
  }, [companyId]);

  // Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandCenter(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  const usagePercent = planInfo
    ? Math.min(100, Math.round((planInfo.minutesUsed / Math.max(planInfo.minutesIncluded, 1)) * 100))
    : 0;

  const usageColor =
    usagePercent >= 90
      ? 'from-red-500 to-red-600'
      : usagePercent >= 70
      ? 'from-amber-500 to-orange-500'
      : 'from-emerald-500 to-teal-500';

  const planBadgeColor: Record<string, string> = {
    free: 'bg-slate-100 text-slate-700 border-slate-200',
    starter: 'bg-blue-50 text-blue-700 border-blue-200',
    business: 'bg-purple-50 text-purple-700 border-purple-200',
    teams: 'bg-amber-50 text-amber-700 border-amber-200',
    enterprise: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  return (
    <>
      <header className="bg-transparent px-4 sm:px-5 h-12 flex items-center relative z-30 shrink-0">
        <div className="flex items-center justify-between w-full gap-3">

          {/* LEFT */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile hamburger */}
            <button
              onClick={onMenuClick}
              className="lg:hidden p-1.5 -ml-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Open navigation"
            >
              <MenuIcon className="w-5 h-5" />
            </button>

            {/* Desktop sidebar toggle */}
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="hidden lg:flex p-1.5 -ml-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isSidebarCollapsed ? (
                  <MenuIcon className="w-5 h-5" />
                ) : (
                  <ChevronLeftIcon className="w-5 h-5" />
                )}
              </button>
            )}

            {title && (
              <div className="hidden sm:flex items-center gap-2 text-white/60 text-sm">
                <span className="text-white/40">/</span>
                <span className="font-medium text-white/80 truncate max-w-[200px]">{title}</span>
              </div>
            )}
          </div>

          {/* CENTER — search wrapper is `relative` so the dropdown anchors to it */}
          <div ref={searchWrapperRef} className="flex-1 max-w-md mx-4 relative">
            <button
              onClick={() => setShowCommandCenter(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 hover:border-white/20 transition-all text-white/60 hover:text-white/80"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <span className="text-xs font-medium truncate">Search...</span>
              <kbd className="hidden md:inline-flex items-center gap-0.5 ml-auto px-1.5 py-0.5 text-[10px] font-medium text-white/40 bg-white/10 border border-white/10 rounded shrink-0">
                <span className="text-[10px]">⌘</span>K
              </kbd>
            </button>

            {/* Dropdown anchored right below the search bar */}
            <CommandCenter
              isOpen={showCommandCenter}
              onClose={() => setShowCommandCenter(false)}
              companyId={companyId}
            />
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {actions && <div className="flex items-center gap-1.5 mr-1">{actions}</div>}

            {companyId && (
              <div className="[&_button]:text-white/60 [&_button]:hover:text-white [&_button]:hover:bg-white/10 [&_button]:rounded-lg [&_button]:transition-colors">
                <NotificationsDropdown companyId={companyId} userId={user.id} />
              </div>
            )}

            {/* Settings quick-access */}
            <button
              onClick={() => router.push('/settings')}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {/* AI Assistant Spark */}
            <button
              onClick={() => setShowAIChat(!showAIChat)}
              className={`relative p-1.5 rounded-lg transition-all ${
                showAIChat
                  ? 'text-white bg-white/20'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
              title="Ask Cali"
            >
              <div className="relative">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <defs>
                    <linearGradient id="sparkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="currentColor" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                  <path fill="url(#sparkGradient)" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
                {/* Subtle animated glow dot */}
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-gradient-to-r from-purple-400 to-pink-400" />
              </div>
            </button>

            {/* User Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1 sm:p-1 sm:pr-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white font-medium text-[11px] shadow-sm">
                  {initials}
                </div>
                <svg
                  className={`w-3.5 h-3.5 text-white/40 hidden sm:block transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 animate-slideDown overflow-hidden">
                  <div className="p-4 gradient-bg-subtle border-b border-slate-100">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 rounded-xl gradient-bg flex items-center justify-center text-white font-bold text-sm shadow-sm">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{user.full_name || 'User'}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      </div>
                    </div>

                    {planInfo && (
                      <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${planBadgeColor[planInfo.slug] || planBadgeColor.free}`}>
                              {planInfo.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">Plan</span>
                          </div>
                          <button
                            onClick={() => { setShowUserMenu(false); router.push('/billing'); }}
                            className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline flex items-center gap-1"
                          >
                            Upgrade
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
                            </svg>
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-medium">Minutes used</span>
                            <span className="font-bold text-slate-900">
                              {planInfo.minutesUsed.toFixed(1)} / {planInfo.minutesIncluded} min
                            </span>
                          </div>
                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${usageColor} rounded-full transition-all duration-500`}
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className={`font-medium ${usagePercent >= 90 ? 'text-red-600' : usagePercent >= 70 ? 'text-amber-600' : 'text-slate-400'}`}>
                              {usagePercent}% used
                            </span>
                            <span className="text-slate-400">
                              {Math.max(0, planInfo.minutesIncluded - planInfo.minutesUsed).toFixed(1)} min remaining
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {teamMembers.length > 1 && (
                    <div className="px-4 py-3 border-b border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Team</span>
                        <button
                          onClick={() => { setShowUserMenu(false); router.push('/team'); }}
                          className="text-[10px] text-[var(--color-primary)] font-semibold hover:underline"
                        >
                          Manage
                        </button>
                      </div>
                      <div className="flex items-center -space-x-2">
                        {teamMembers.slice(0, 5).map(member => {
                          const mi = (member.full_name || member.email).split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                          return (
                            <div key={member.id} title={member.full_name || member.email}
                              className="w-7 h-7 rounded-full gradient-bg flex items-center justify-center text-white text-[10px] font-bold border-2 border-white">
                              {mi}
                            </div>
                          );
                        })}
                        {teamMembers.length > 5 && (
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-[10px] font-bold border-2 border-white">
                            +{teamMembers.length - 5}
                          </div>
                        )}
                        <span className="text-xs text-slate-500 ml-3 font-medium">
                          {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="py-1">
                    <button onClick={() => { setShowUserMenu(false); router.push('/settings'); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                      </svg>
                      Settings
                    </button>
                    <button onClick={() => { setShowUserMenu(false); router.push('/billing'); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      Billing & Plans
                    </button>
                    <button onClick={() => { setShowUserMenu(false); router.push('/help'); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Help & Support
                    </button>
                  </div>

                  <div className="border-t border-slate-100 my-0.5" />

                  <div className="py-1">
                    <button
                      onClick={() => { setShowUserMenu(false); if (onLogout) onLogout(); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3 font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </header>
      {/* AI Chat Panel */}
      {companyId && (
        <AIChatPanel
          isOpen={showAIChat}
          onClose={() => setShowAIChat(false)}
          userId={user.id}
          companyId={companyId}
          userName={user.full_name || user.email}
        />
      )}
    </>
  );
}