'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Tip {
  icon: string; // SVG path d attribute
  label: string;
  desc: string;
}

interface PageTipCardProps {
  title: string;
  tips: Tip[];
  settingKey: string;
  companyId: string;
}

export default function PageTipCard({ title, tips, settingKey, companyId }: PageTipCardProps) {
  const supabase = createClient();
  const [loaded, setLoaded] = useState(false);
  const [minimized, setMinimized] = useState(false); // true = only show help icon
  const [expanded, setExpanded] = useState(false);   // true = re-expanded after minimized

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('company_settings')
          .select('settings')
          .eq('company_id', companyId)
          .single();
        const s = (data?.settings as Record<string, unknown>) || {};
        if (s[settingKey]) setMinimized(true);
      } catch { /* ignore */ }
      setLoaded(true);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const dismiss = async () => {
    setMinimized(true);
    try {
      const { data } = await supabase.from('company_settings').select('settings').eq('company_id', companyId).single();
      const existing = (data?.settings as Record<string, unknown>) || {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from('company_settings').update({ settings: { ...existing, [settingKey]: true } as any }).eq('company_id', companyId);
    } catch { /* non-critical */ }
  };

  if (!loaded) return null;

  // If minimized AND not re-expanded by clicking help icon → show help icon only
  if (minimized && !expanded) {
    return (
      <div className="flex justify-end">
        <button
          onClick={() => setExpanded(true)}
          title="Show tips"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[var(--color-neutral-400)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all text-xs font-medium border border-[var(--border-default)] bg-white shadow-sm"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
          Tips
        </button>
      </div>
    );
  }

  const handleClose = () => {
    if (expanded) {
      setExpanded(false); // just collapse, already dismissed
    } else {
      dismiss();
    }
  };

  return (
    <div className="relative rounded-xl overflow-hidden border border-[var(--color-primary)]/20 shadow-sm">
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/8 via-purple-50/50 to-violet-50/30 pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[var(--color-primary)] via-purple-400 to-violet-400" />
      <div className="relative px-5 py-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-violet-600 flex items-center justify-center flex-shrink-0 shadow-md">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-sm font-bold text-[var(--color-ink)]">{title}</p>
              <span className="px-2 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-semibold tracking-wide uppercase">Tips</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {tips.map(({ icon, label, desc }, i) => (
                <div key={i} className="flex items-start gap-2.5 bg-white/60 rounded-lg px-3 py-2.5 border border-white/80">
                  <div className="w-6 h-6 rounded-md bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                    </svg>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-[var(--color-ink)]">{label}</span>
                    <p className="text-[11px] text-[var(--color-neutral-500)] leading-relaxed mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-100)] transition-colors flex-shrink-0"
            title="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--color-primary)]/10">
          <span className="text-[11px] text-[var(--color-neutral-400)]">Click the Tips button anytime to see these again</span>
          <button onClick={handleClose} className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline transition-colors">
            Got it, don&apos;t show again
          </button>
        </div>
      </div>
    </div>
  );
}
