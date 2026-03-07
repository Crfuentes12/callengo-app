// components/layout/Main.tsx
'use client';
interface MainProps {
  children: React.ReactNode;
}
export default function Main({ children }: MainProps) {
  return (
    <main className="flex-1 overflow-y-auto bg-gradient-to-br from-[var(--color-neutral-50)] via-[var(--color-neutral-50)] to-[var(--color-neutral-100)] lg:rounded-tl-2xl">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {children}
      </div>
    </main>
  );
}