// components/contacts/ClioContactsPage.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Breadcrumbs from '@/components/ui/Breadcrumbs';

// ============================================================================
// SKELETON ROW (inline loading placeholder)
// ============================================================================

function TableSkeleton() {
  return (
    <div className="divide-y divide-[var(--border-subtle)]">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="px-4 py-3.5 flex items-center gap-4 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="w-5 h-5 rounded bg-[var(--color-neutral-100)] shrink-0" />
          <div className="w-4 h-4 rounded bg-[var(--color-neutral-100)] shrink-0" />
          <div className="h-4 w-28 rounded bg-[var(--color-neutral-100)]" />
          <div className="h-4 w-40 rounded bg-[var(--color-neutral-100)]" />
          <div className="h-4 w-24 rounded bg-[var(--color-neutral-100)]" />
          <div className="h-4 w-28 rounded bg-[var(--color-neutral-100)]" />
          <div className="h-5 w-14 rounded-full bg-[var(--color-neutral-100)]" />
          <div className="h-3 w-20 rounded bg-[var(--color-neutral-100)]" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// TYPES
// ============================================================================

interface ClioContactsPageProps {
  companyId: string;
  planSlug: string;
  clioConnected: boolean;
  clioIntegration: {
    id: string;
    displayName: string | null;
    email: string | null;
    firmName: string | null;
    lastSynced: string | null;
  } | null;
}

interface ClioContactItem {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  type: 'Person' | 'Company';
  title: string | null;
  primary_email_address: string | null;
  primary_phone_number: string | null;
  company?: { id: number; name: string } | null;
  addresses: { city: string | null; province: string | null; country: string | null }[];
  created_at: string;
  updated_at: string;
}

interface ContactMapping {
  clio_contact_id: string;
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

// ============================================================================
// CLIO LOGO COMPONENT
// ============================================================================

function ClioLogo({ className = 'w-5 h-5' }: { className?: string }) {
  return <Image src="/clio-logo.png" alt="Clio" width={20} height={20} className={className} />;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ClioContactsPage({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  companyId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  planSlug,
  clioConnected,
  clioIntegration,
}: ClioContactsPageProps) {
  const router = useRouter();
  const [contacts, setContacts] = useState<ClioContactItem[]>([]);
  const [mappings, setMappings] = useState<ContactMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Fetch Clio data
  const loadData = useCallback(async () => {
    if (!clioConnected) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations/clio/contacts?limit=200`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
        setMappings(data.mappings || []);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to load Clio data', 'error');
      }
    } catch {
      showToast('Failed to load Clio data', 'error');
    } finally {
      setLoading(false);
    }
  }, [clioConnected, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync contacts
  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/integrations/clio/sync', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const total = data.contacts?.created || 0;
        const updated = data.contacts?.updated || 0;
        showToast(`Sync complete: ${total} created, ${updated} updated`, 'success');
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

  // Check if a contact is synced to Callengo
  const isSynced = (id: number) => {
    return mappings.some((m) => m.clio_contact_id === String(id));
  };

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (ids: string[]) => {
    const allSelected = ids.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...ids])]);
    }
  };

  // Sync selected contacts
  const handleSyncSelected = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/integrations/clio/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res.ok) {
        const data = await res.json();
        const total = data.contacts?.created || 0;
        const updated = data.contacts?.updated || 0;
        showToast(`Sync complete: ${total} created, ${updated} updated`, 'success');
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
  const filteredContacts = contacts.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.primary_email_address?.toLowerCase().includes(q) ||
      c.primary_phone_number?.includes(q) ||
      c.company?.name?.toLowerCase().includes(q)
    );
  });

  // Stats
  const syncedCount = filteredContacts.filter((item) => isSynced(item.id)).length;
  const notSyncedCount = filteredContacts.length - syncedCount;
  const currentIds = filteredContacts.map((item) => String(item.id));
  const allCurrentSelected = currentIds.length > 0 && currentIds.every((id) => selectedIds.includes(id));

  // ============================================================================
  // NOT CONNECTED STATE
  // ============================================================================

  if (!clioConnected) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'Contacts', href: '/contacts' },
          { label: 'Clio' },
        ]} />

        <div className="bg-white rounded-xl border border-[var(--border-default)] p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1B2B5B]/5 flex items-center justify-center mx-auto mb-4">
            <ClioLogo className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-ink)] mb-2">Connect Clio</h2>
          <p className="text-[var(--color-neutral-600)] mb-6 max-w-md mx-auto">
            Connect your Clio account to import contacts, matters, and sync your legal practice data with Callengo.
          </p>
          <Link
            href="/api/integrations/clio/connect?return_to=/contacts/clio"
            className="btn-primary px-6 py-3 rounded-lg font-semibold text-sm inline-flex items-center gap-2"
          >
            <ClioLogo className="w-4 h-4" />
            Connect Clio
          </Link>
          <p className="text-xs text-[var(--color-neutral-400)] mt-4">
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
        { label: 'Clio' },
      ]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1B2B5B]/5 flex items-center justify-center">
            <ClioLogo className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--color-ink)]">Clio Contacts</h1>
            <p className="text-sm text-[var(--color-neutral-50)]0">
              {clioIntegration?.displayName || clioIntegration?.email}
              {clioIntegration?.firmName && <> · {clioIntegration.firmName}</>}
              {clioIntegration?.lastSynced && (
                <> · Last synced {formatLastSynced(clioIntegration.lastSynced)}</>
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
      <div className="bg-gradient-to-r from-[#1B2B5B]/5 to-[var(--color-primary-50)] rounded-xl border border-[#1B2B5B]/10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Connected
          </span>
          <span className="text-sm text-[var(--color-neutral-600)]">
            {contacts.length} contacts from Clio
          </span>
        </div>
        <div className="text-xs text-[var(--color-neutral-50)]0">
          {mappings.length} synced to Callengo
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--color-neutral-700)]">All Contacts ({filteredContacts.length})</span>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-neutral-400)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none w-64"
          />
        </div>
      </div>

      {/* Summary Stats Bar */}
      {!loading && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-[var(--color-neutral-50)]0">
              {filteredContacts.length} total
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {syncedCount} synced
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-neutral-100)] text-[var(--color-neutral-50)]0 border border-[var(--border-default)] whitespace-nowrap">
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
        <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
          <div className="bg-[var(--color-neutral-50)] border-b border-[var(--border-default)] px-4 py-3 flex items-center gap-4">
            <div className="w-5 h-5 rounded bg-[var(--color-neutral-100)]" />
            <div className="w-5 h-5 bg-[var(--color-neutral-100)] rounded" />
            <div className="h-4 w-24 bg-[var(--color-neutral-100)] rounded" />
            <div className="h-4 w-32 bg-[var(--color-neutral-100)] rounded" />
            <div className="h-4 w-24 bg-[var(--color-neutral-100)] rounded" />
            <div className="h-4 w-28 bg-[var(--color-neutral-100)] rounded" />
            <div className="h-4 w-16 bg-[var(--color-neutral-100)] rounded" />
            <div className="h-4 w-20 bg-[var(--color-neutral-100)] rounded" />
          </div>
          <TableSkeleton />
        </div>
      )}

      {/* Contacts Table */}
      {!loading && (
        <div className="bg-white rounded-xl border border-[var(--border-default)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--border-default)]">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allCurrentSelected}
                      onChange={() => toggleSelectAll(currentIds)}
                      className="rounded border-[var(--border-strong)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/20"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--color-neutral-600)] w-8" />
                  <th className="text-left px-4 py-3 font-semibold text-[var(--color-neutral-600)]">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--color-neutral-600)]">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--color-neutral-600)]">Phone</th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--color-neutral-600)]">Company</th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--color-neutral-600)]">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--color-neutral-600)]">Synced</th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--color-neutral-600)]">Modified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-[var(--color-neutral-400)]">
                      {searchQuery ? 'No contacts match your search' : 'No contacts found in Clio'}
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((contact) => (
                    <React.Fragment key={contact.id}>
                      <tr
                        className="hover:bg-[var(--color-neutral-50)] transition-colors cursor-pointer"
                        onClick={() => setExpandedId(expandedId === contact.id ? null : contact.id)}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(String(contact.id))}
                            onChange={() => toggleSelect(String(contact.id))}
                            className="rounded border-[var(--border-strong)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/20"
                          />
                        </td>
                        <td className="px-4 py-3 text-[var(--color-neutral-400)]">
                          <svg
                            className={`w-4 h-4 transition-transform duration-200 ${expandedId === contact.id ? 'rotate-90' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--color-ink)]">{contact.name}</td>
                        <td className="px-4 py-3 text-[var(--color-neutral-600)]">{contact.primary_email_address || '\u2014'}</td>
                        <td className="px-4 py-3 text-[var(--color-neutral-600)]">{contact.primary_phone_number || '\u2014'}</td>
                        <td className="px-4 py-3 text-[var(--color-neutral-600)]">{contact.company?.name || '\u2014'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                            contact.type === 'Person'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}>
                            {contact.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isSynced(contact.id) ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Synced
                            </span>
                          ) : (
                            <span className="whitespace-nowrap inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-neutral-100)] text-[var(--color-neutral-50)]0 border border-[var(--border-default)]">
                              Not synced
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-neutral-50)]0 text-xs">{formatDate(contact.updated_at)}</td>
                      </tr>
                      {expandedId === contact.id && (
                        <tr>
                          <td colSpan={9} className="bg-[#1B2B5B]/5 px-4 py-0">
                            <div className="pl-14 py-4">
                              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                                <div>
                                  <span className="text-[var(--color-neutral-400)] text-xs font-medium">Title</span>
                                  <p className="text-[var(--color-neutral-700)]">{contact.title || '\u2014'}</p>
                                </div>
                                <div>
                                  <span className="text-[var(--color-neutral-400)] text-xs font-medium">Type</span>
                                  <p className="text-[var(--color-neutral-700)]">{contact.type}</p>
                                </div>
                                <div>
                                  <span className="text-[var(--color-neutral-400)] text-xs font-medium">Company</span>
                                  <p className="text-[var(--color-neutral-700)]">{contact.company?.name || '\u2014'}</p>
                                </div>
                                <div>
                                  <span className="text-[var(--color-neutral-400)] text-xs font-medium">Location</span>
                                  <p className="text-[var(--color-neutral-700)]">
                                    {contact.addresses?.[0]
                                      ? [contact.addresses[0].city, contact.addresses[0].province, contact.addresses[0].country]
                                          .filter(Boolean)
                                          .join(', ') || '\u2014'
                                      : '\u2014'}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-[var(--color-neutral-400)] text-xs font-medium">Created Date</span>
                                  <p className="text-[var(--color-neutral-700)]">{formatDate(contact.created_at)}</p>
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
