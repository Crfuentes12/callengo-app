// components/layout/LayoutShell.tsx
'use client';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar Placeholder */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="w-64 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
          {/* Sidebar skeleton would go here, but we keep it simple */}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Placeholder */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="h-8 bg-slate-200 rounded w-48 animate-pulse"></div>
        </div>

        {/* Main Content with Skeleton */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
