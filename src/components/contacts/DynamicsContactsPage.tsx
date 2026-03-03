// components/contacts/DynamicsContactsPage.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Breadcrumbs from '@/components/ui/Breadcrumbs';

// ============================================================================
// SKELETON ROW
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
          <div className="h-5 w-14 rounded-full bg-slate-100" />
          <div className="h-3 w-20 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// TYPES
// ============================================================================

interface DynamicsContactsPageProps {
  companyId: string;
  planSlug: string;
  dynamicsConnected: boolean;
  dynamicsIntegration: {
    id: string;
    displayName: string | null;
    email: string | null;
    orgName: string | null;
    lastSynced: string | null;
  } | null;
}

interface DynamicsContactItem {
  contactid: string;
  firstname: string | null;
  lastname: string | null;
  fullname: string | null;
  emailaddress1: string | null;
  telephone1: string | null;
  mobilephone: string | null;
  jobtitle: string | null;
  department: string | null;
  parentcustomerid_account?: { name: string; accountid: string } | null;
  address1_city: string | null;
  address1_stateorprovince: string | null;
  address1_country: string | null;
  modifiedon: string;
  createdon: string;
}

interface DynamicsLeadItem {
  leadid: string;
  firstname: string | null;
  lastname: string | null;
  fullname: string | null;
  emailaddress1: string | null;
  telephone1: string | null;
  mobilephone: string | null;
  jobtitle: string | null;
  companyname: string | null;
  statuscode: number | null;
  leadsourcecode: number | null;
  modifiedon: string;
  createdon: string;
}

interface ContactMapping {
  dynamics_contact_id: string;
  dynamics_entity_type: string;
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

function getLeadStatusLabel(statusCode: number | null): string {
  if (statusCode === null) return '';
  const statusMap: Record<number, string> = {
    0: 'Open', 1: 'New', 2: 'Contacted',
    3: 'Qualified', 4: 'Lost', 5: 'Cannot Contact',
    6: 'No Longer Interested', 7: 'Canceled',
  };
  return statusMap[statusCode] || `Status ${statusCode}`;
}

// ============================================================================
// DYNAMICS LOGO SVG
// ============================================================================

function DynamicsLogo({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#002050" />
      <path d="M6 6h5v5H6V6z" fill="#0078D4" />
      <path d="M13 6h5v5h-5V6z" fill="#28A8EA" />
      <path d="M6 13h5v5H6v-5z" fill="#50E6FF" />
      <path d="M13 13h5v5h-5v-5z" fill="#0078D4" opacity="0.7" />
    </svg>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DynamicsContactsPage({
  companyId,
  planSlug,
  dynamicsConnected,
  dynamicsIntegration,
}: DynamicsContactsPageProps) {
  const router = useRouter();
  const [contacts, setContacts] = useState<DynamicsContactItem[]>([]);
  const [leads, setLeads] = useState<DynamicsLeadItem[]>([]);
  const [mappings, setMappings] = useState<ContactMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'contacts' | 'leads'>('contacts');

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Fetch Dynamics data
  const loadData = useCallback(async () => {
    if (!dynamicsConnected) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations/dynamics/contacts?limit=200`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
        setLeads(data.leads || []);
        setMappings(data.mappings || []);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to load Dynamics data', 'error');
      }
    } catch {
      showToast('Failed to load Dynamics data', 'error');
    } finally {
      setLoading(false);
    }
  }, [dynamicsConnected, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync all
  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/integrations/dynamics/sync', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const contactsCreated = data.contacts?.created || 0;
        const contactsUpdated = data.contacts?.updated || 0;
        const leadsCreated = data.leads?.created || 0;
        const leadsUpdated = data.leads?.updated || 0;
        showToast(`Sync complete: ${contactsCreated + leadsCreated} created, ${contactsUpdated + leadsUpdated} updated`, 'success');
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

  // Check if a record is synced
  const isSynced = (id: string) => {
    return mappings.some((m) => m.dynamics_contact_id === id);
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

  // Sync selected
  const handleSyncSelected = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/integrations/dynamics/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, type: activeTab }),
      });
      if (res.ok) {
        const data = await res.json();
        const created = (data.contacts?.created || 0) + (data.leads?.created || 0);
        const updated = (data.contacts?.updated || 0) + (data.leads?.updated || 0);
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
  }, [selectedIds, activeTab, showToast, loadData, router]);

  // Filter by search
  const filteredContacts = contacts.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = c.fullname || `${c.firstname || ''} ${c.lastname || ''}`.trim();
    return (
      name.toLowerCase().includes(q) ||
      c.emailaddress1?.toLowerCase().includes(q) ||
      c.telephone1?.includes(q) ||
      c.parentcustomerid_account?.name?.toLowerCase().includes(q)
    );
  });

  const filteredLeads = leads.filter((l) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = l.fullname || `${l.firstname || ''} ${l.lastname || ''}`.trim();
    return (
      name.toLowerCase().includes(q) ||
      l.emailaddress1?.toLowerCase().includes(q) ||
      l.telephone1?.includes(q) ||
      l.companyname?.toLowerCase().includes(q)
    );
  });

  const currentItems = activeTab === 'contacts'
    ? filteredContacts.map((c) => ({ ...c, id: c.contactid }))
    : filteredLeads.map((l) => ({ ...l, id: l.leadid }));
  const syncedCount = currentItems.filter((item) => isSynced(item.id)).length;
  const notSyncedCount = currentItems.length - syncedCount;
  const currentIds = currentItems.map((item) => item.id);
  const allCurrentSelected = currentIds.length > 0 && currentIds.every((id) => selectedIds.includes(id));

  // ============================================================================
  // NOT CONNECTED STATE
  // ============================================================================

  if (!dynamicsConnected) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'Contacts', href: '/contacts' },
          { label: 'Microsoft Dynamics' },
        ]} />

        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <DynamicsLogo className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Connect Microsoft Dynamics</h2>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Connect your Microsoft Dynamics account to import contacts, leads, and sync your sales data bidirectionally with Callengo.
          </p>
          <Link
            href="/api/integrations/dynamics/connect?return_to=/contacts/microsoft-dynamics"
            className="btn-primary px-6 py-3 rounded-lg font-semibold text-sm inline-flex items-center gap-2"
          >
            <DynamicsLogo className="w-4 h-4" />
            Connect Microsoft Dynamics
          </Link>
          <p className="text-xs text-slate-400 mt-4">
            Requires Teams plan or higher.{' '}
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
        { label: 'Microsoft Dynamics' },
      ]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <DynamicsLogo className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Microsoft Dynamics</h1>
            <p className="text-sm text-slate-500">
              {dynamicsIntegration?.displayName || dynamicsIntegration?.email}
              {dynamicsIntegration?.orgName && <> · {dynamicsIntegration.orgName}</>}
              {dynamicsIntegration?.lastSynced && (
                <> · Last synced {formatLastSynced(dynamicsIntegration.lastSynced)}</>
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

      {/* Deletion Protection Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-amber-800">Deletion Protection Active</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Deleting a contact from Callengo will <strong>never</strong> delete it from Microsoft Dynamics. Your Dynamics data is always safe. Contacts removed from Callengo will retain all enriched data in Dynamics.
          </p>
        </div>
      </div>

      {/* Connection Info Bar */}
      <div className="bg-gradient-to-r from-blue-50 to-[var(--color-primary-50)] rounded-xl border border-blue-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Connected
          </span>
          <span className="text-sm text-slate-600">
            {contacts.length} contacts · {leads.length} leads from Microsoft Dynamics
          </span>
        </div>
        <div className="text-xs text-slate-500">
          {mappings.length} synced to Callengo
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => { setActiveTab('contacts'); setSelectedIds([]); }}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === 'contacts'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Contacts ({contacts.length})
        </button>
        <button
          onClick={() => { setActiveTab('leads'); setSelectedIds([]); }}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === 'leads'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Leads ({leads.length})
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">
            {activeTab === 'contacts' ? 'All Contacts' : 'All Leads'} ({currentItems.length})
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
              {currentItems.length} total
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

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-4">
            <div className="w-5 h-5 rounded bg-slate-100" />
            <div className="w-5 h-5 bg-slate-100 rounded" />
            <div className="h-4 w-24 bg-slate-100 rounded" />
            <div className="h-4 w-32 bg-slate-100 rounded" />
            <div className="h-4 w-24 bg-slate-100 rounded" />
            <div className="h-4 w-28 bg-slate-100 rounded" />
            <div className="h-4 w-16 bg-slate-100 rounded" />
            <div className="h-4 w-20 bg-slate-100 rounded" />
          </div>
          <TableSkeleton />
        </div>
      )}

      {/* Contacts Table */}
      {!loading && activeTab === 'contacts' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allCurrentSelected}
                      onChange={() => toggleSelectAll(currentIds)}
                      className="rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]/20"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 w-8" />
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Phone</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Account</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Synced</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Modified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      {searchQuery ? 'No contacts match your search' : 'No contacts found in Microsoft Dynamics'}
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((contact) => {
                    const name = contact.fullname || `${contact.firstname || ''} ${contact.lastname || ''}`.trim();
                    return (
                      <React.Fragment key={contact.contactid}>
                        <tr
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => setExpandedId(expandedId === contact.contactid ? null : contact.contactid)}
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(contact.contactid)}
                              onChange={() => toggleSelect(contact.contactid)}
                              className="rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]/20"
                            />
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            <svg
                              className={`w-4 h-4 transition-transform duration-200 ${expandedId === contact.contactid ? 'rotate-90' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">{name || '\u2014'}</td>
                          <td className="px-4 py-3 text-slate-600">{contact.emailaddress1 || '\u2014'}</td>
                          <td className="px-4 py-3 text-slate-600">{contact.telephone1 || contact.mobilephone || '\u2014'}</td>
                          <td className="px-4 py-3 text-slate-600">{contact.parentcustomerid_account?.name || '\u2014'}</td>
                          <td className="px-4 py-3">
                            {isSynced(contact.contactid) ? (
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
                          <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(contact.modifiedon)}</td>
                        </tr>
                        {expandedId === contact.contactid && (
                          <tr>
                            <td colSpan={8} className="bg-blue-50/30 px-4 py-0">
                              <div className="pl-14 py-4">
                                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                                  <div>
                                    <span className="text-slate-400 text-xs font-medium">Job Title</span>
                                    <p className="text-slate-700">{contact.jobtitle || '\u2014'}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 text-xs font-medium">Department</span>
                                    <p className="text-slate-700">{contact.department || '\u2014'}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 text-xs font-medium">Account</span>
                                    <p className="text-slate-700">{contact.parentcustomerid_account?.name || '\u2014'}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 text-xs font-medium">Location</span>
                                    <p className="text-slate-700">
                                      {[contact.address1_city, contact.address1_stateorprovince, contact.address1_country]
                                        .filter(Boolean)
                                        .join(', ') || '\u2014'}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 text-xs font-medium">Created</span>
                                    <p className="text-slate-700">{formatDate(contact.createdon)}</p>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leads Table */}
      {!loading && activeTab === 'leads' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allCurrentSelected}
                      onChange={() => toggleSelectAll(currentIds)}
                      className="rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]/20"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 w-8" />
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Phone</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Company</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Synced</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Modified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      {searchQuery ? 'No leads match your search' : 'No leads found in Microsoft Dynamics'}
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => {
                    const name = lead.fullname || `${lead.firstname || ''} ${lead.lastname || ''}`.trim();
                    const statusLabel = getLeadStatusLabel(lead.statuscode);
                    return (
                      <React.Fragment key={lead.leadid}>
                        <tr
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => setExpandedId(expandedId === lead.leadid ? null : lead.leadid)}
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(lead.leadid)}
                              onChange={() => toggleSelect(lead.leadid)}
                              className="rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]/20"
                            />
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            <svg
                              className={`w-4 h-4 transition-transform duration-200 ${expandedId === lead.leadid ? 'rotate-90' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">{name || '\u2014'}</td>
                          <td className="px-4 py-3 text-slate-600">{lead.emailaddress1 || '\u2014'}</td>
                          <td className="px-4 py-3 text-slate-600">{lead.telephone1 || lead.mobilephone || '\u2014'}</td>
                          <td className="px-4 py-3 text-slate-600">{lead.companyname || '\u2014'}</td>
                          <td className="px-4 py-3">
                            {statusLabel && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap bg-blue-50 text-blue-700 border border-blue-200">
                                {statusLabel}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isSynced(lead.leadid) ? (
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
                          <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(lead.modifiedon)}</td>
                        </tr>
                        {expandedId === lead.leadid && (
                          <tr>
                            <td colSpan={9} className="bg-blue-50/30 px-4 py-0">
                              <div className="pl-14 py-4">
                                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                                  <div>
                                    <span className="text-slate-400 text-xs font-medium">Job Title</span>
                                    <p className="text-slate-700">{lead.jobtitle || '\u2014'}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 text-xs font-medium">Company</span>
                                    <p className="text-slate-700">{lead.companyname || '\u2014'}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 text-xs font-medium">Created</span>
                                    <p className="text-slate-700">{formatDate(lead.createdon)}</p>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
