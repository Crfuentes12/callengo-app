// components/layout/Main.tsx
'use client';

interface MainProps {
  children: React.ReactNode;
}

export default function Main({ children }: MainProps) {
  return (
    <main className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-7xl mx-auto p-6">
        {children}
      </div>
    </main>
  );
}