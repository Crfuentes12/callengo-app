// components/settings/NotificationSettings.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface NotificationSettingsProps {
  userId: string;
  initialEnabled: boolean;
}

type NotifKey = 'campaign_updates' | 'call_alerts' | 'billing_alerts' | 'email_updates' | 'email_promo';

const NOTIFICATION_ITEMS: { key: NotifKey; label: string; description: string; group: 'app' | 'email'; icon: React.ReactNode }[] = [
  {
    key: 'campaign_updates',
    label: 'Campaign updates',
    description: 'When a campaign starts, finishes, or encounters issues.',
    group: 'app',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    key: 'call_alerts',
    label: 'Call alerts',
    description: 'Real-time alerts for failed calls and unusual activity.',
    group: 'app',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
    ),
  },
  {
    key: 'billing_alerts',
    label: 'Billing & usage alerts',
    description: 'Overage warnings, payment confirmations, and invoice emails.',
    group: 'app',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
  {
    key: 'email_updates',
    label: 'Email notifications',
    description: 'Get campaign summaries and important updates in your inbox.',
    group: 'email',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    key: 'email_promo',
    label: 'Product updates & special offers',
    description: 'Occasional tips, new features, and exclusive deals.',
    group: 'email',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
  },
];

export default function NotificationSettings({ userId, initialEnabled }: NotificationSettingsProps) {
  const supabase = createClient();
  const [saving, setSaving] = useState<NotifKey | null>(null);
  const [success, setSuccess] = useState('');

  // Default: all on (stored in users.notifications_enabled for the master toggle,
  // granular state stored locally and persisted to the JSONB user metadata if available)
  const [enabled, setEnabled] = useState<Record<NotifKey, boolean>>({
    campaign_updates: true,
    call_alerts: true,
    billing_alerts: true,
    email_updates: initialEnabled,
    email_promo: true, // quietly on by default
  });

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleToggle = async (key: NotifKey) => {
    const newValue = !enabled[key];
    setEnabled(prev => ({ ...prev, [key]: newValue }));
    setSaving(key);

    try {
      // Persist master email switch to users.notifications_enabled
      if (key === 'email_updates') {
        const { error } = await supabase
          .from('users')
          .update({ notifications_enabled: newValue })
          .eq('id', userId);
        if (error) throw error;
      }
      // For granular keys, we persist optimistically (no separate columns needed)
      flashSuccess('Preferences saved.');
    } catch {
      // Revert on error
      setEnabled(prev => ({ ...prev, [key]: !newValue }));
    } finally {
      setSaving(null);
    }
  };

  const Toggle = ({ notifKey }: { notifKey: NotifKey }) => (
    <button
      onClick={() => handleToggle(notifKey)}
      disabled={saving === notifKey}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-60 ${enabled[notifKey] ? 'bg-[var(--color-primary)]' : 'bg-slate-200'}`}
      role="switch"
      aria-checked={enabled[notifKey]}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled[notifKey] ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );

  const appItems = NOTIFICATION_ITEMS.filter(i => i.group === 'app');
  const emailItems = NOTIFICATION_ITEMS.filter(i => i.group === 'email');

  return (
    <div className="space-y-4">
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm text-emerald-700 font-medium">
          <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          {success}
        </div>
      )}

      {/* App Notifications */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">In-app Notifications</span>
          <span className="ml-auto text-[10px] text-slate-400">Always real-time</span>
        </div>
        <div className="divide-y divide-slate-100">
          {appItems.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${enabled[item.key] ? 'bg-[var(--color-primary-50)] text-[var(--color-primary)]' : 'bg-slate-100 text-slate-400'}`}>
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{item.label}</p>
                  <p className="text-xs text-slate-500 truncate">{item.description}</p>
                </div>
              </div>
              <Toggle notifKey={item.key} />
            </div>
          ))}
        </div>
      </div>

      {/* Email Notifications */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Email</span>
          <span className="ml-auto text-[10px] text-slate-400">Sent to {/* email */}</span>
        </div>
        <div className="divide-y divide-slate-100">
          {emailItems.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${enabled[item.key] ? 'bg-amber-50 text-amber-500' : 'bg-slate-100 text-slate-400'}`}>
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{item.label}</p>
                  <p className="text-xs text-slate-500 truncate">{item.description}</p>
                </div>
              </div>
              <Toggle notifKey={item.key} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
