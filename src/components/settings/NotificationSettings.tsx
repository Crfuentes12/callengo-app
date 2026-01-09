// components/settings/NotificationSettings.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface NotificationSettingsProps {
  userId: string;
  initialEnabled: boolean;
}

export default function NotificationSettings({ userId, initialEnabled }: NotificationSettingsProps) {
  const supabase = createClient();
  const [notificationsEnabled, setNotificationsEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleToggle = async () => {
    setLoading(true);
    setSuccess('');

    try {
      const newValue = !notificationsEnabled;

      const { error } = await supabase
        .from('users')
        .update({ notifications_enabled: newValue })
        .eq('id', userId);

      if (error) throw error;

      setNotificationsEnabled(newValue);
      setSuccess(`Notifications ${newValue ? 'enabled' : 'disabled'} successfully`);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error updating notification settings:', error);
      alert('Failed to update notification settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {success && (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 animate-slideDown">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-emerald-700 font-medium">{success}</p>
        </div>
      )}

      {/* Notification Settings Card */}
      <div className="bg-white rounded-xl border-2 border-slate-200/80 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Enable Notifications</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Receive real-time updates about your campaigns, calls, and account activity
                </p>
              </div>
              <button
                onClick={handleToggle}
                disabled={loading}
                className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  notificationsEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    notificationsEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Types Info */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-6">
        <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          What you'll be notified about:
        </h4>
        <ul className="space-y-3">
          {[
            {
              icon: '✓',
              color: 'text-emerald-600',
              bg: 'bg-emerald-50',
              title: 'Campaign Completed',
              description: 'When your calling campaigns finish successfully',
            },
            {
              icon: '⚠',
              color: 'text-red-600',
              bg: 'bg-red-50',
              title: 'Campaign Issues',
              description: 'Alerts for failed campaigns or high failure rates',
            },
            {
              icon: '🕒',
              color: 'text-amber-600',
              bg: 'bg-amber-50',
              title: 'Usage Alerts',
              description: 'When you approach or exceed your monthly minutes limit',
            },
            {
              icon: 'ℹ',
              color: 'text-blue-600',
              bg: 'bg-blue-50',
              title: 'System Updates',
              description: 'Important updates and new features',
            },
          ].map((item, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0 ${item.color}`}>
                <span className="text-lg">{item.icon}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Info Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm text-blue-900 font-medium">About Notifications</p>
          <p className="text-xs text-blue-700 mt-1">
            Notifications are displayed in the header and automatically updated in real-time. You can mark them as read or delete them individually.
          </p>
        </div>
      </div>
    </div>
  );
}
