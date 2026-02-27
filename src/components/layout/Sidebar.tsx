// components/layout/Sidebar.tsx
'use client';
import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Database } from '@/types/supabase';
type Company = Database['public']['Tables']['companies']['Row'];
interface SidebarProps {
  company: Company;
  userRole: string;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}
function HomeIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}
function UsersIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}
function CampaignsIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
      <path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14" />
      <path d="M8 6v8" />
    </svg>
  );
}
function AgentsIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}
function ChartIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}
function LogoutIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  );
}
function ShieldIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}
function PhoneIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}
function IntegrationsIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}
function VoicemailIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function FollowUpIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
function CalendarIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}
function TeamIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  );
}

interface TooltipState {
  text: string;
  top: number;
}

export default function Sidebar({
  company,
  userRole,
  onLogout,
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  const showTooltip = useCallback((e: React.MouseEvent, text: string) => {
    if (!isCollapsed) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ text, top: rect.top + rect.height / 2 });
  }, [isCollapsed]);

  const hideTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

  const isAdmin = userRole === 'admin';
  const isOwnerOrAdmin = userRole === 'admin' || userRole === 'owner';

  const navGroups = [
    [
      { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    ],
    [
      { name: 'Contacts', href: '/contacts', icon: UsersIcon },
      { name: 'Campaigns', href: '/campaigns', icon: CampaignsIcon },
      { name: 'Agents', href: '/agents', icon: AgentsIcon },
    ],
    [
      { name: 'Call History', href: '/calls', icon: PhoneIcon },
      { name: 'Calendar', href: '/calendar', icon: CalendarIcon },
      { name: 'Voicemails', href: '/voicemails', icon: VoicemailIcon },
      { name: 'Follow-ups', href: '/follow-ups', icon: FollowUpIcon },
    ],
    [
      { name: 'Analytics', href: '/analytics', icon: ChartIcon },
      { name: 'Integrations', href: '/integrations', icon: IntegrationsIcon },
      { name: 'Team', href: '/team', icon: TeamIcon },
    ],
  ];

  const adminNavigation = [
    { name: 'Admin Finances', href: '/admin/finances', icon: ShieldIcon },
  ];

  const sidebarWidth = isCollapsed ? 67 : 200;

  return (
    <aside
      ref={sidebarRef}
      className={`
        fixed lg:static inset-y-0 left-0 z-50
        flex flex-col h-screen
        transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isCollapsed ? 'lg:w-[67px]' : 'lg:w-[200px]'}
        w-[200px]
        gradient-bg-shell lg:bg-transparent
        shadow-xl lg:shadow-none
      `}
    >
      {/* Tooltip rendered at sidebar level — escapes overflow containers */}
      {isCollapsed && tooltip && (
        <div
          className="hidden lg:flex fixed items-center px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium shadow-lg whitespace-nowrap z-[100] pointer-events-none"
          style={{
            left: `${sidebarWidth + 12}px`,
            top: `${tooltip.top}px`,
            transform: 'translateY(-50%)',
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/*
        Logo area — height matches the header (h-12 = 48px) so logo and
        header content sit on the same optical baseline.
        The collapse toggle has been removed from here and moved into the Header.
      */}
      <div className="h-12 flex items-center px-3 overflow-hidden shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur-sm flex items-center justify-center shrink-0">
            <img src="/callengo-logo.svg" alt="Callengo" className="w-5 h-5" />
          </div>
          <span
            className={`
              font-semibold text-[18px] text-white whitespace-nowrap
              transition-all duration-300 overflow-hidden
              ${isCollapsed ? 'lg:w-0 lg:opacity-0' : 'opacity-100'}
            `}
          >
            Callengo
          </span>
        </div>

        {/* Close button — mobile only, keeps the mobile menu functional */}
        <button
          onClick={onClose}
          className="lg:hidden ml-auto p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close navigation"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto overflow-x-hidden">
        {/* Admin Section */}
        {isAdmin && (
          <>
            <div className="space-y-1">
              {adminNavigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => onClose()}
                    onMouseEnter={(e) => showTooltip(e, item.name)}
                    onMouseLeave={hideTooltip}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium
                      transition-all duration-200
                      ${isActive
                        ? 'bg-white/20 text-white shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                      }
                    `}
                  >
                    <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-white/50'}`} />
                    <span
                      className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${isCollapsed ? 'lg:opacity-0 lg:w-0' : 'opacity-100'}`}
                    >
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </div>
            <div className="my-2 mx-2">
              <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
          </>
        )}

        {navGroups.map((group, groupIndex) => (
          <div key={groupIndex}>
            {groupIndex > 0 && (
              <div className="my-2 mx-2">
                <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              </div>
            )}
            <div className="space-y-1">
              {group.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' &&
                    !item.href.includes('?') &&
                    pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => onClose()}
                    onMouseEnter={(e) => showTooltip(e, item.name)}
                    onMouseLeave={hideTooltip}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium
                      transition-all duration-200
                      ${isActive
                        ? 'bg-white/20 text-white shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                      }
                    `}
                  >
                    <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-white/50'}`} />
                    <span
                      className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${isCollapsed ? 'lg:opacity-0 lg:w-0' : 'opacity-100'}`}
                    >
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-white/10 shrink-0">
        <button
          onClick={onLogout}
          onMouseEnter={(e) => showTooltip(e, 'Sign out')}
          onMouseLeave={hideTooltip}
          className="
            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium
            text-white/70 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200
          "
        >
          <LogoutIcon className="w-5 h-5 shrink-0" />
          <span
            className={`whitespace-nowrap transition-all duration-300 overflow-hidden ${isCollapsed ? 'lg:opacity-0 lg:w-0' : 'opacity-100'}`}
          >
            Sign out
          </span>
        </button>
      </div>
    </aside>
  );
}