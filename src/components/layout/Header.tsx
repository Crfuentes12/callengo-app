// components/layout/Header.tsx
'use client';

import { Database } from '@/types/supabase';

type User = {
  id: string;
  email: string;
  full_name: string | null;
};

interface HeaderProps {
  user: User;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

function BellIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

export default function Header({ user, title, subtitle, actions }: HeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-4">
          {actions}

          {/* Notifications */}
          <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <BellIcon />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* User menu */}
          <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">
                {user.full_name || 'User'}
              </p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
              {(user.full_name || user.email).charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}