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
  { id: 'p-dashboard', type: 'page', title: 'Dashboard', subtitle: 'Overview & metrics', href: '/dashboard', icon: '🏠' },
  { id: 'p-contacts', type: 'page', title: 'Contacts', subtitle: 'Manage contacts', href: '/contacts', icon: '👥' },
  { id: 'p-campaigns', type: 'page', title: 'Campaigns', subtitle: 'Campaign management', href: '/campaigns', icon: '⚡' },
  { id: 'p-agents', type: 'page', title: 'Agents', subtitle: 'AI agent library', href: '/agents', icon: '✨' },
  { id: 'p-calls', type: 'page', title: 'Call History', subtitle: 'View all calls', href: '/calls', icon: '📞' },
  { id: 'p-calendar', type: 'page', title: 'Calendar', subtitle: 'Scheduling & appointments', href: '/calendar', icon: '📅' },
  { id: 'p-voicemails', type: 'page', title: 'Voicemails', subtitle: 'Voicemail inbox', href: '/voicemails', icon: '📧' },
  { id: 'p-followups', type: 'page', title: 'Follow-ups', subtitle: 'Pending follow-ups', href: '/follow-ups', icon: '🔄' },
  { id: 'p-analytics', type: 'page', title: 'Analytics', subtitle: 'Reports & insights', href: '/analytics', icon: '📊' },
  { id: 'p-integrations', type: 'page', title: 'Integrations', subtitle: 'Third-party connections', href: '/integrations', icon: '🔗' },
  { id: 'p-settings', type: 'page', title: 'Settings', subtitle: 'Company & account settings', href: '/settings', icon: '⚙️' },
  { id: 'p-billing', type: 'page', title: 'Billing & Plans', subtitle: 'Subscription management', href: '/settings?tab=billing', icon: '💳' },
  { id: 'p-team', type: 'page', title: 'Team Members', subtitle: 'Manage users', href: '/settings?tab=team', icon: '👨‍💼' },
  { id: 'p-notifications', type: 'page', title: 'Notification Settings', subtitle: 'Configure alerts', href: '/settings?tab=notifications', icon: '🔔' },
  { id: 'p-calling', type: 'page', title: 'Call Settings', subtitle: 'Voice & phone config', href: '/settings?tab=calling', icon: '📱' },
];

const ACTIONS: SearchResult[] = [
  { id: 'a-import', type: 'action', title: 'Import Contacts', subtitle: 'CSV, Excel, Google Sheets', href: '/contacts', icon: '📥' },
  { id: 'a-campaign', type: 'action', title: 'Create Campaign', subtitle: 'Start a new campaign', href: '/campaigns', icon: '🚀' },
  { id: 'a-schedule', type: 'action', title: 'Schedule Event', subtitle: 'Add to calendar', href: '/calendar', icon: '📆' },
  { id: 'a-export', type: 'action', title: 'Export Reports', subtitle: 'Download analytics data', href: '/analytics', icon: '📤' },
];

export default function CommandCenter({ isOpen, onClose, companyId }: CommandCenterProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dbResults, setDbResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setDbResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Search database
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
        // Search contacts
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, contact_name, phone_number, email')
          .eq('company_id', companyId)
          .or(`contact_name.ilike.%${query}%,phone_number.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(5);

        contacts?.forEach(c => {
          results.push({
            id: `c-${c.id}`,
            type: 'contact',
            title: c.contact_name || 'Unknown',
            subtitle: c.phone_number || c.email || '',
            href: '/contacts',
            icon: '👤',
          });
        });

        // Search campaigns
        const { data: campaigns } = await supabase
          .from('agent_runs')
          .select('id, name, status')
          .eq('company_id', companyId)
          .ilike('name', `%${query}%`)
          .limit(5);

        campaigns?.forEach(c => {
          results.push({
            id: `camp-${c.id}`,
            type: 'campaign',
            title: c.name,
            subtitle: `Campaign - ${c.status}`,
            href: '/campaigns',
            icon: '⚡',
          });
        });

        // Search agents
        const { data: agents } = await supabase
          .from('agent_templates')
          .select('id, name, category')
          .ilike('name', `%${query}%`)
          .limit(5);

        agents?.forEach(a => {
          results.push({
            id: `ag-${a.id}`,
            type: 'agent',
            title: a.name,
            subtitle: `Agent - ${a.category || 'General'}`,
            href: '/agents',
            icon: '✨',
          });
        });

        // Search users
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name, email, role')
          .eq('company_id', companyId)
          .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(3);

        users?.forEach(u => {
          results.push({
            id: `u-${u.id}`,
            type: 'user',
            title: u.full_name || u.email,
            subtitle: `User - ${u.role}`,
            href: '/settings?tab=team',
            icon: '👨‍💼',
          });
        });
      } catch (err) {
        console.error('Search error:', err);
      }

      setDbResults(results);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, companyId]);

  // Filter static results
  const filteredPages = query
    ? PAGES.filter(p => p.title.toLowerCase().includes(query.toLowerCase()) || p.subtitle?.toLowerCase().includes(query.toLowerCase()))
    : PAGES.slice(0, 6);

  const filteredActions = query
    ? ACTIONS.filter(a => a.title.toLowerCase().includes(query.toLowerCase()) || a.subtitle?.toLowerCase().includes(query.toLowerCase()))
    : ACTIONS;

  const allResults = [...filteredPages, ...filteredActions, ...dbResults];

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, allResults, selectedIndex, router, onClose]);

  // Scroll selected into view
  useEffect(() => {
    if (resultsRef.current) {
      const selected = resultsRef.current.children[selectedIndex] as HTMLElement;
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const groupedResults: { label: string; items: SearchResult[] }[] = [];

  const pages = allResults.filter(r => r.type === 'page');
  const actions = allResults.filter(r => r.type === 'action');
  const data = allResults.filter(r => !['page', 'action'].includes(r.type));

  if (pages.length > 0) groupedResults.push({ label: 'Pages', items: pages });
  if (actions.length > 0) groupedResults.push({ label: 'Actions', items: actions });
  if (data.length > 0) groupedResults.push({ label: 'Results', items: data });

  let globalIndex = -1;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="Search pages, contacts, campaigns, agents..."
            className="flex-1 text-sm text-slate-900 placeholder-slate-400 outline-none bg-transparent"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded-md">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-[400px] overflow-y-auto py-2">
          {searching && (
            <div className="px-5 py-3 text-sm text-slate-400 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-slate-200 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
              Searching...
            </div>
          )}

          {groupedResults.map(group => (
            <div key={group.label}>
              <div className="px-5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {group.label}
              </div>
              {group.items.map(item => {
                globalIndex++;
                const idx = globalIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => { router.push(item.href); onClose(); }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                      selectedIndex === idx ? 'bg-[var(--color-primary-50)]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-base w-6 text-center shrink-0">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${selectedIndex === idx ? 'text-[var(--color-primary)]' : 'text-slate-900'}`}>
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div className="text-xs text-slate-500 truncate">{item.subtitle}</div>
                      )}
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      item.type === 'page' ? 'bg-blue-50 text-blue-600' :
                      item.type === 'action' ? 'bg-purple-50 text-purple-600' :
                      item.type === 'contact' ? 'bg-emerald-50 text-emerald-600' :
                      item.type === 'campaign' ? 'bg-amber-50 text-amber-600' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {item.type}
                    </span>
                    {selectedIndex === idx && (
                      <kbd className="text-[10px] text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
                        ↵
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {allResults.length === 0 && query && !searching && (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-slate-500">No results found for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-slate-400 mt-1">Try a different search term</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 text-[10px]">↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 text-[10px]">↵</kbd>
              Open
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 text-[10px]">ESC</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}
