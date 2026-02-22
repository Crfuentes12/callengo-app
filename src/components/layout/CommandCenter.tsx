// components/layout/CommandCenter.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface SearchResult {
  id: string;
  type: 'page' | 'contact' | 'campaign' | 'agent' | 'call' | 'voicemail' | 'follow-up' | 'user' | 'action';
  title: string;
  subtitle?: string;
  href: string;
  icon: string;
}

interface CommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
  companyId?: string;
}

const PAGES: SearchResult[] = [
  { id: 'p-dashboard',     type: 'page', title: 'Dashboard',             subtitle: 'Overview & metrics',        href: '/dashboard',            icon: '🏠' },
  { id: 'p-contacts',      type: 'page', title: 'Contacts',              subtitle: 'Manage contacts',           href: '/contacts',             icon: '👥' },
  { id: 'p-campaigns',     type: 'page', title: 'Campaigns',             subtitle: 'Campaign management',       href: '/campaigns',            icon: '⚡' },
  { id: 'p-agents',        type: 'page', title: 'Agents',                subtitle: 'AI agent library',          href: '/agents',               icon: '✨' },
  { id: 'p-calls',         type: 'page', title: 'Call History',          subtitle: 'View all calls',            href: '/calls',                icon: '📞' },
  { id: 'p-calendar',      type: 'page', title: 'Calendar',              subtitle: 'Scheduling & appointments', href: '/calendar',             icon: '📅' },
  { id: 'p-voicemails',    type: 'page', title: 'Voicemails',            subtitle: 'Voicemail inbox',           href: '/voicemails',           icon: '📧' },
  { id: 'p-followups',     type: 'page', title: 'Follow-ups',            subtitle: 'Pending follow-ups',        href: '/follow-ups',           icon: '🔄' },
  { id: 'p-analytics',     type: 'page', title: 'Analytics',             subtitle: 'Reports & insights',        href: '/analytics',            icon: '📊' },
  { id: 'p-integrations',  type: 'page', title: 'Integrations',          subtitle: 'Third-party connections',   href: '/integrations',         icon: '🔗' },
  { id: 'p-settings',      type: 'page', title: 'Settings',              subtitle: 'Company & account settings',href: '/settings',             icon: '⚙️' },
  { id: 'p-billing',       type: 'page', title: 'Billing & Plans',       subtitle: 'Subscription management',   href: '/settings?tab=billing', icon: '💳' },
  { id: 'p-team',          type: 'page', title: 'Team Members',          subtitle: 'Manage users',              href: '/settings?tab=team',    icon: '👨‍💼' },
  { id: 'p-notifications', type: 'page', title: 'Notification Settings', subtitle: 'Configure alerts',          href: '/settings?tab=notifications', icon: '🔔' },
  { id: 'p-calling',       type: 'page', title: 'Call Settings',         subtitle: 'Voice & phone config',      href: '/settings?tab=calling', icon: '📱' },
];

const ACTIONS: SearchResult[] = [
  { id: 'a-import',   type: 'action', title: 'Import Contacts', subtitle: 'CSV, Excel, Google Sheets', href: '/contacts',  icon: '📥' },
  { id: 'a-campaign', type: 'action', title: 'Create Campaign', subtitle: 'Start a new campaign',      href: '/campaigns', icon: '🚀' },
  { id: 'a-schedule', type: 'action', title: 'Schedule Event',  subtitle: 'Add to calendar',           href: '/calendar',  icon: '📆' },
  { id: 'a-export',   type: 'action', title: 'Export Reports',  subtitle: 'Download analytics data',   href: '/analytics', icon: '📤' },
];

const TYPE_PILL: Record<string, string> = {
  page:     'bg-blue-50 text-blue-600',
  action:   'bg-purple-50 text-purple-600',
  contact:  'bg-emerald-50 text-emerald-600',
  campaign: 'bg-amber-50 text-amber-600',
  default:  'bg-slate-100 text-slate-600',
};

export default function CommandCenter({ isOpen, onClose, companyId }: CommandCenterProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dbResults, setDbResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const inputRef   = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  // Reset & focus on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setDbResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use capture so clicks that hit the backdrop (outside panel) are caught first
    document.addEventListener('mousedown', handleClick, true);
    return () => document.removeEventListener('mousedown', handleClick, true);
  }, [isOpen, onClose]);

  // DB search with debounce
  useEffect(() => {
    if (!query || query.length < 2 || !companyId) {
      setDbResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const supabase = createClient();
      const results: SearchResult[] = [];
      try {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, contact_name, phone_number, email')
          .eq('company_id', companyId)
          .or(`contact_name.ilike.%${query}%,phone_number.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(5);
        contacts?.forEach(c => results.push({
          id: `c-${c.id}`, type: 'contact',
          title: c.contact_name || 'Unknown',
          subtitle: c.phone_number || c.email || '',
          href: '/contacts', icon: '👤',
        }));

        const { data: campaigns } = await supabase
          .from('agent_runs')
          .select('id, name, status')
          .eq('company_id', companyId)
          .ilike('name', `%${query}%`)
          .limit(5);
        campaigns?.forEach(c => results.push({
          id: `camp-${c.id}`, type: 'campaign',
          title: c.name, subtitle: `Campaign · ${c.status}`,
          href: '/campaigns', icon: '⚡',
        }));

        const { data: agents } = await supabase
          .from('agent_templates')
          .select('id, name, category')
          .ilike('name', `%${query}%`)
          .limit(5);
        agents?.forEach(a => results.push({
          id: `ag-${a.id}`, type: 'agent',
          title: a.name, subtitle: `Agent · ${a.category || 'General'}`,
          href: '/agents', icon: '✨',
        }));

        const { data: users } = await supabase
          .from('users')
          .select('id, full_name, email, role')
          .eq('company_id', companyId)
          .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(3);
        users?.forEach(u => results.push({
          id: `u-${u.id}`, type: 'user',
          title: u.full_name || u.email, subtitle: `User · ${u.role}`,
          href: '/settings?tab=team', icon: '👨‍💼',
        }));
      } catch (err) {
        console.error('Search error:', err);
      }
      setDbResults(results);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, companyId]);

  // Compute flat results list for keyboard nav
  const filteredPages = query
    ? PAGES.filter(p =>
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.subtitle?.toLowerCase().includes(query.toLowerCase()))
    : PAGES.slice(0, 6);

  const filteredActions = query
    ? ACTIONS.filter(a =>
        a.title.toLowerCase().includes(query.toLowerCase()) ||
        a.subtitle?.toLowerCase().includes(query.toLowerCase()))
    : ACTIONS;

  const allResults = [...filteredPages, ...filteredActions, ...dbResults];

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, allResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (allResults[selectedIndex]) {
          router.push(allResults[selectedIndex].href);
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [isOpen, allResults, selectedIndex, router, onClose]);

  // Scroll selected item into view inside the results container only
  useEffect(() => {
    if (!resultsRef.current) return;
    // querySelectorAll to grab rendered buttons by data-index
    const el = resultsRef.current.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  // Build grouped structure
  const pages   = allResults.filter(r => r.type === 'page');
  const actions = allResults.filter(r => r.type === 'action');
  const data    = allResults.filter(r => !['page', 'action'].includes(r.type));

  const groups: { label: string; items: SearchResult[] }[] = [];
  if (pages.length)   groups.push({ label: 'Pages',   items: pages });
  if (actions.length) groups.push({ label: 'Actions', items: actions });
  if (data.length)    groups.push({ label: 'Results', items: data });

  // Build a flat ordered array for stable data-index mapping
  const flatOrdered = groups.flatMap(g => g.items);

  return (
    /*
      The dropdown panel. Positioned absolute so it anchors below the search bar.
      The Header's search wrapper div (relative) is the positioning context.
      w-full matches the search bar width; min-w and max-w keep it comfortable.
      z-50 lifts it above page content but below the header z-30 stacking context
      (header itself is z-30, and we're a child of it, so we naturally stack above).
    */
    <div
      ref={panelRef}
      className="
        absolute top-[calc(100%+8px)] left-0 right-0
        min-w-[420px] -left-8
        bg-white rounded-2xl shadow-2xl border border-slate-200
        overflow-hidden z-50
        animate-slideDown
      "
      // Prevent clicks inside panel from bubbling up and triggering document listener
      onMouseDown={e => e.stopPropagation()}
    >
      {/* ── Search input ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-white">
        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
          placeholder="Search pages, contacts, campaigns..."
          className="flex-1 text-sm text-slate-900 placeholder-slate-400 outline-none bg-transparent"
        />
        {searching ? (
          <div className="w-4 h-4 border-2 border-slate-200 border-t-[var(--color-primary)] rounded-full animate-spin shrink-0" />
        ) : (
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded">
            ESC
          </kbd>
        )}
      </div>

      {/* ── Results — fixed height, scrolls internally ────────────────── */}
      <div
        ref={resultsRef}
        className="overflow-y-auto overscroll-contain"
        style={{ maxHeight: '340px' }}
      >
        {groups.length === 0 && query && !searching && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-slate-500">No results for &ldquo;{query}&rdquo;</p>
            <p className="text-xs text-slate-400 mt-1">Try a different search term</p>
          </div>
        )}

        {groups.length === 0 && !query && (
          // Empty state hint when no query typed yet and results not loaded
          <div className="px-4 py-3">
            {/* groups will render below once allResults populates */}
          </div>
        )}

        {groups.map(group => (
          <div key={group.label}>
            {/* Group label */}
            <div className="sticky top-0 px-4 pt-3 pb-1 bg-white z-10">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {group.label}
              </span>
            </div>

            {/* Items */}
            {group.items.map(item => {
              const idx = flatOrdered.indexOf(item);
              const isSelected = selectedIndex === idx;
              return (
                <button
                  key={item.id}
                  data-index={idx}
                  onClick={() => { router.push(item.href); onClose(); }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                    ${isSelected ? 'bg-[var(--color-primary-50)]' : 'hover:bg-slate-50'}
                  `}
                >
                  <span className="text-base w-6 text-center shrink-0 leading-none">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${isSelected ? 'text-[var(--color-primary)]' : 'text-slate-800'}`}>
                      {item.title}
                    </div>
                    {item.subtitle && (
                      <div className="text-xs text-slate-500 truncate">{item.subtitle}</div>
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${TYPE_PILL[item.type] ?? TYPE_PILL.default}`}>
                    {item.type}
                  </span>
                  {isSelected && (
                    <kbd className="text-[10px] text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 shrink-0">
                      ↵
                    </kbd>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Footer shortcuts ──────────────────────────────────────────── */}
      <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 text-[10px] shadow-sm">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 text-[10px] shadow-sm">↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 text-[10px] shadow-sm">↵</kbd>
            Open
          </span>
        </div>
        <span className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 text-[10px] shadow-sm">ESC</kbd>
          Close
        </span>
      </div>
    </div>
  );
}