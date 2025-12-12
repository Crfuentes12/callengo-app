// components/layout/Header.tsx
'use client';

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
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

export default function Header({ user, title, subtitle, actions }: HeaderProps) {
  const initials = (user.full_name || user.email)
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="bg-white border-b border-slate-200/80 px-6 py-4 sticky top-0 z-40">
      <div className="flex items-center justify-between">
        {/* Left: Title */}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>

        {/* Right: Actions & User */}
        <div className="flex items-center gap-2 ml-4">
          {/* Custom Actions */}
          {actions && <div className="flex items-center gap-2 mr-2">{actions}</div>}

          {/* Notifications */}
          <button className="relative p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <BellIcon className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full ring-2 ring-white"></span>
          </button>

          {/* Divider */}
          <div className="w-px h-8 bg-slate-200 mx-2"></div>

          {/* User Menu */}
          <button className="flex items-center gap-3 p-1.5 pr-3 rounded-lg hover:bg-slate-50 transition-colors group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-medium text-sm shadow-sm">
              {initials}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-slate-900 group-hover:text-indigo-600 transition-colors truncate max-w-[140px]">
                {user.full_name || 'User'}
              </p>
              <p className="text-xs text-slate-500 truncate max-w-[140px]">
                {user.email}
              </p>
            </div>
            <svg className="w-4 h-4 text-slate-400 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
