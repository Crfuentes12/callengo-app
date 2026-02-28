// components/contacts/PipedriveContactsPage.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Breadcrumbs from '@/components/ui/Breadcrumbs';

// ============================================================================
// SKELETON ROW (inline loading placeholder)
// ============================================================================

function TableSkeleton() {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="px-4 py-3.5 flex items-center gap-4 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="w-5 h-5 rounded bg-slate-100 shrink-0" />
          <div className="w-4 h-4 rounded bg-slate-100 shrink-0" />
          <div className="h-4 w-28 rounded bg-slate-100" />
          <div className="h-4 w-40 rounded bg-slate-100" />
          <div className="h-4 w-24 rounded bg-slate-100" />
          <div className="h-4 w-28 rounded bg-slate-100" />
          <div className="h-4 w-20 rounded bg-slate-100" />
          <div className="h-5 w-14 rounded-full bg-slate-100" />
          <div className="h-3 w-20 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// PIPEDRIVE ICON (inline SVG)
// ============================================================================

function PipedriveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="currentColor">
      <path d="M16.3 7.8c-3.6 0-5.7 1.6-6.7 2.7-.1-1-.8-2.2-3.2-2.2H1v5.6h2.2c.4 0 .5.1.5.5v25.7h6.4V30v-.7c1 .9 2.9 2.2 5.9 2.2 6.3 0 10.7-5 10.7-12.1 0-7.3-4.2-12.1-10.4-12.1m-1.3 18.6c-3.5 0-5-3.3-5-6.4 0-4.8 2.6-6.6 5.1-6.6 3 0 5.1 2.6 5.1 6.5 0 4.5-2.6 6.5-5.2 6.5" transform="scale(0.85) translate(5, 0)" />
    </svg>
  );
}

// ============================================================================
// TYPES
// ============================================================================

interface PipedriveContactsPageProps {
  companyId: string;
  planSlug: string;
  pdConnected: boolean;
  pdIntegration: {
    id: string;
    userName: string | null;
    userEmail: string | null;
    companyName: string | null;
    companyDomain: string | null;
    lastSynced: string | null;
  } | null;
}

interface PDPerson {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  email: { value: string; primary: boolean; label: string }[];
  phone: { value: string; primary: boolean; label: string }[];
  org_id: { value: number; name: string } | null;
  owner_id: { id: number; name: string; email: string } | null;
  open_deals_count: number;
  closed_deals_count: number;
  active_flag: boolean;
  add_time: string;
  update_time: string;
}

interface ContactMapping {
  pd_person_id: string | null;
  callengo_contact_id: string;
  last_synced_at: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatLastSynced(dateStr?: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function getPrimaryEmail(person: PDPerson): string {
  if (!person.email || person.email.length === 0) return '';
  const primary = person.email.find((e) => e.primary);
  return (primary?.value || person.email[0]?.value) || '';
}

function getPrimaryPhone(person: PDPerson): string {
  if (!person.phone || person.phone.length === 0) return '';
  const primary = person.phone.find((p) => p.primary);
  return (primary?.value || person.phone[0]?.value) || '';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PipedriveContactsPage({
  companyId,
  planSlug,
  pdConnected,
  pdIntegration,
}: PipedriveContactsPageProps) {
  const router = useRouter();
  const [persons, setPersons] = useState<PDPerson[]>([]);
  const [mappings, setMappings] = useState<ContactMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Fetch Pipedrive data
  const loadData = useCallback(async () => {
    if (!pdConnected) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations/pipedrive/contacts?limit=200`);
      if (res.ok) {
        const data = await res.json();
        setPersons(data.persons || []);
        setMappings(data.mappings || []);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to load Pipedrive data', 'error');
      }
    } catch {
      showToast('Failed to load Pipedrive data', 'error');
    } finally {
      setLoading(false);
    }
  }, [pdConnected, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync persons
  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/integrations/pipedrive/sync', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const created = data.persons?.created || 0;
        const updated = data.persons?.updated || 0;
        showToast(`Sync complete: ${created} created, ${updated} updated`, 'success');
        loadData();
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Sync failed', 'error');
      }
    } catch {
      showToast('Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  }, [showToast, loadData, router]);

  // Check if a person is synced to Callengo
  const isSynced = (id: number) => {
    return mappings.some((m) => m.pd_person_id === String(id));
  };

  // Selection helpers
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (ids: number[]) => {
    const allSelected = ids.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...ids])]);
    }
  };

  // Sync selected persons
  const handleSyncSelected = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/integrations/pipedrive/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res.ok) {
        const data = await res.json();
        const created = data.persons?.created || 0;
        const updated = data.persons?.updated || 0;
        showToast(`Sync complete: ${created} created, ${updated} updated`, 'success');
        setSelectedIds([]);
        loadData();
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Sync failed', 'error');
      }
    } catch {
      showToast('Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  }, [selectedIds, showToast, loadData, router]);

  // Filter by search
  const filteredPersons = persons.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      getPrimaryEmail(p).toLowerCase().includes(q) ||
      getPrimaryPhone(p).includes(q) ||
      p.org_id?.name?.toLowerCase().includes(q)
    );
  });

  // Stats
  const syncedCount = filteredPersons.filter((p) => isSynced(p.id)).length;
  const notSyncedCount = filteredPersons.length - syncedCount;
  const currentIds = filteredPersons.map((p) => p.id);
  const allCurrentSelected = currentIds.length > 0 && currentIds.every((id) => selectedIds.includes(id));

  // ============================================================================
  // NOT CONNECTED STATE
  // ============================================================================

  if (!pdConnected) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'Contacts', href: '/contacts' },
          { label: 'Pipedrive' },
        ]} />

        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-black flex items-center justify-center mx-auto mb-4">
            <PipedriveIcon className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Connect Pipedrive</h2>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Connect your Pipedrive account to import contacts, organizations, and sync your CRM data with Callengo.
          </p>
          <Link
            href="/api/integrations/pipedrive/connect?return_to=/contacts/pipedrive"
            className="btn-primary px-6 py-3 rounded-lg font-semibold text-sm inline-flex items-center gap-2"
          >
            <PipedriveIcon className="w-4 h-4" />
            Connect Pipedrive
          </Link>
          <p className="text-xs text-slate-400 mt-4">
            Requires Business plan or higher.{' '}
            <Link href="/settings?tab=billing" className="text-[var(--color-primary)] hover:underline">
              Upgrade plan
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // CONNECTED STATE
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-slideDown ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Breadcrumbs */}
      <Breadcrumbs items={[
        { label: 'Contacts', href: '/contacts' },
        { label: 'Pipedrive' },
      ]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-black flex items-center justify-center">
            <PipedriveIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Pipedrive Contacts</h1>
            <p className="text-sm text-slate-500">
              {pdIntegration?.companyName || pdIntegration?.userName}
              {pdIntegration?.lastSynced && (
                <> · Last synced {formatLastSynced(pdIntegration.lastSynced)}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-[var(--color-primary)] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/10 transition-all disabled:opacity-50"
          >
            {syncing ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {syncing ? 'Syncing...' : 'Sync to Callengo'}
          </button>
        </div>
      </div>

      {/* Connection Info Bar */}
      <div className="bg-gradient-to-r from-emerald-50 to-[var(--color-primary-50)] rounded-xl border border-emerald-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Connected
          </span>
          <span className="text-sm text-slate-600">
            {persons.length} persons from Pipedrive
          </span>
        </div>
        <div className="text-xs text-slate-500">
          {mappings.length} synced to Callengo
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white shadow-sm">
            Persons ({filteredPersons.length})
          </span>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none w-64"
          />
        </div>
      </div>

      {/* Summary Stats Bar */}
      {!loading && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500">
              {filteredPersons.length} total
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {syncedCount} synced
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
              {notSyncedCount} not synced
            </span>
          </div>
          {selectedIds.length > 0 && (
            <button
              onClick={handleSyncSelected}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-xs text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 transition-all disabled:opacity-50 shadow-sm"
            >
              {syncing ? (
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Sync Selected ({selectedIds.length})
            </button>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-4">
            <div className="w-5 h-5 rounded bg-slate-100" />
            <div className="w-5 h-5 bg-slate-100 rounded" />
            <div className="h-4 w-24 bg-slate-100 rounded" />
            <div className="h-4 w-32 bg-slate-100 rounded" />
            <div className="h-4 w-24 bg-slate-100 rounded" />
            <div className="h-4 w-28 bg-slate-100 rounded" />
            <div className="h-4 w-20 bg-slate-100 rounded" />
            <div className="h-4 w-16 bg-slate-100 rounded" />
            <div className="h-4 w-20 bg-slate-100 rounded" />
          </div>
          <TableSkeleton />
        </div>
      )}

      {/* Persons Table */}
      {!loading && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allCurrentSelected}
                      onChange={() => toggleSelectAll(filteredPersons.map((p) => p.id))}
                      className="rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]/20"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 w-8" />
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Phone</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Organization</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Deals</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Synced</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPersons.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      {searchQuery ? 'No persons match your search' : 'No persons found in Pipedrive'}
                    </td>
                  </tr>
                ) : (
                  filteredPersons.map((person) => (
                    <React.Fragment key={person.id}>
                      <tr
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => setExpandedId(expandedId === person.id ? null : person.id)}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(person.id)}
                            onChange={() => toggleSelect(person.id)}
                            className="rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]/20"
                          />
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          <svg
                            className={`w-4 h-4 transition-transform duration-200 ${expandedId === person.id ? 'rotate-90' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{person.name}</td>
                        <td className="px-4 py-3 text-slate-600">{getPrimaryEmail(person) || '\u2014'}</td>
                        <td className="px-4 py-3 text-slate-600">{getPrimaryPhone(person) || '\u2014'}</td>
                        <td className="px-4 py-3 text-slate-600">{person.org_id?.name || '\u2014'}</td>
                        <td className="px-4 py-3 text-slate-600">
                          <span className="text-xs">
                            {person.open_deals_count > 0 && (
                              <span className="text-blue-600 font-medium">{person.open_deals_count} open</span>
                            )}
                            {person.open_deals_count > 0 && person.closed_deals_count > 0 && ' · '}
                            {person.closed_deals_count > 0 && (
                              <span className="text-slate-500">{person.closed_deals_count} closed</span>
                            )}
                            {person.open_deals_count === 0 && person.closed_deals_count === 0 && '\u2014'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isSynced(person.id) ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Synced
                            </span>
                          ) : (
                            <span className="whitespace-nowrap inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                              Not synced
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(person.update_time)}</td>
                      </tr>
                      {expandedId === person.id && (
                        <tr>
                          <td colSpan={9} className="bg-emerald-50 px-4 py-0">
                            <div className="pl-14 py-4">
                              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                                <div>
                                  <span className="text-slate-400 text-xs font-medium">First Name</span>
                                  <p className="text-slate-700">{person.first_name || '\u2014'}</p>
                                </div>
                                <div>
                                  <span className="text-slate-400 text-xs font-medium">Last Name</span>
                                  <p className="text-slate-700">{person.last_name || '\u2014'}</p>
                                </div>
                                <div>
                                  <span className="text-slate-400 text-xs font-medium">Organization</span>
                                  <p className="text-slate-700">{person.org_id?.name || '\u2014'}</p>
                                </div>
                                <div>
                                  <span className="text-slate-400 text-xs font-medium">Owner</span>
                                  <p className="text-slate-700">{person.owner_id?.name || '\u2014'}</p>
                                </div>
                                <div>
                                  <span className="text-slate-400 text-xs font-medium">Open Deals</span>
                                  <p className="text-slate-700">{person.open_deals_count}</p>
                                </div>
                                <div>
                                  <span className="text-slate-400 text-xs font-medium">Closed Deals</span>
                                  <p className="text-slate-700">{person.closed_deals_count}</p>
                                </div>
                                <div>
                                  <span className="text-slate-400 text-xs font-medium">Status</span>
                                  <p className="text-slate-700">{person.active_flag ? 'Active' : 'Inactive'}</p>
                                </div>
                                <div>
                                  <span className="text-slate-400 text-xs font-medium">Created</span>
                                  <p className="text-slate-700">{formatDate(person.add_time)}</p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
