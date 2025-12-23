// components/layout/Main.tsx
'use client';

interface MainProps {
  children: React.ReactNode;
}

export default function Main({ children }: MainProps) {
  return (
    <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {children}
      </div>
    </main>
  );
}