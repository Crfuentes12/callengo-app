'use client';

import { useState, useEffect } from 'react';

interface BillingNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
}

export default function BillingAlertBanner() {
  const [notifications, setNotifications] = useState<BillingNotification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // Only fetch alerts from the last 7 days
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const res = await fetch(`/api/billing/notifications?since=${since}`);
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
        }
      } catch {
        // Silent fail — banner is non-critical
      }
    };

    fetchNotifications();
    // Re-check every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Load dismissed from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('callengo_dismissed_alerts');
      if (stored) setDismissed(new Set(JSON.parse(stored)));
    } catch {
      // Ignore
    }
  }, []);

  const dismiss = (id: string) => {
    const next = new Set([...dismissed, id]);
    setDismissed(next);
    try {
      localStorage.setItem('callengo_dismissed_alerts', JSON.stringify([...next]));
    } catch {
      // Ignore
    }
  };

  const visible = notifications.filter(n => !dismissed.has(n.id));
  if (visible.length === 0) return null;

  // Show only the most severe notification
  const sorted = [...visible].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
  const top = sorted[0];

  const styles = {
    critical: 'bg-red-50 border-red-300 text-red-800',
    warning: 'bg-amber-50 border-amber-300 text-amber-800',
    info: 'bg-blue-50 border-blue-300 text-blue-800',
  };

  const icons = {
    critical: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    ),
  };

  return (
    <div className={`border rounded-lg p-3 flex items-start gap-3 ${styles[top.severity]}`}>
      {icons[top.severity]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{top.title}</p>
        <p className="text-xs mt-0.5 opacity-80">{top.message}</p>
      </div>
      <button
        onClick={() => dismiss(top.id)}
        className="shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {sorted.length > 1 && (
        <span className="text-xs opacity-60 shrink-0">+{sorted.length - 1} more</span>
      )}
    </div>
  );
}
