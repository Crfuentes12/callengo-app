// components/layout/Header.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import NotificationsDropdown from '@/components/notifications/NotificationsDropdown';

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
}

function BellIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function MenuIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

export default function Header({ user, title, subtitle, actions, onMenuClick, onLogout, companyId }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const initials = (user.full_name || user.email)
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 h-14 sm:h-16 flex items-center">
      <div className="flex items-center justify-between w-full gap-3">
        {/* Left: Menu Button (Mobile) + Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Hamburger Menu - Only visible on mobile */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <MenuIcon className="w-6 h-6" />
          </button>

          {/* Title */}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="hidden sm:block text-sm text-slate-500 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right: Actions & User */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Custom Actions */}
          {actions && <div className="flex items-center gap-2 mr-2">{actions}</div>}

          {/* Notifications */}
          {companyId && (
            <NotificationsDropdown companyId={companyId} userId={user.id} />
          )}

          {/* Divider */}
          <div className="hidden sm:block w-px h-8 bg-slate-200 mx-1 sm:mx-2"></div>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 sm:gap-3 p-1 sm:p-1.5 sm:pr-3 rounded-lg hover:bg-slate-50 transition-colors group"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-medium text-xs sm:text-sm shadow-sm">
                {initials}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-sm font-medium text-slate-900 group-hover:text-indigo-600 transition-colors truncate max-w-[100px] lg:max-w-[140px]">
                  {user.full_name || 'User'}
                </p>
                <p className="text-xs text-slate-500 truncate max-w-[100px] lg:max-w-[140px]">
                  {user.email}
                </p>
              </div>
              <svg className={`w-4 h-4 text-slate-400 hidden md:block transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-slideDown">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {user.full_name || 'User'}
                  </p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {user.email}
                  </p>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      // Navigate to account settings
                      window.location.href = '/settings';
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Account Settings
                  </button>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      // Navigate to settings (billing tab)
                      window.location.href = '/settings';
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Billing & Plans
                  </button>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      // Navigate to help
                      window.location.href = '/help';
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Help & Support
                  </button>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-100 my-1"></div>

                {/* Sign Out */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      if (onLogout) {
                        onLogout();
                      }
                    }}
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
  );
}
