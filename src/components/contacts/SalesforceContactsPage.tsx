// components/contacts/SalesforceContactsPage.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FaSalesforce } from 'react-icons/fa';
import Link from 'next/link';
import Breadcrumbs from '@/components/ui/Breadcrumbs';

// ============================================================================
// TYPES
// ============================================================================

interface SalesforceContactsPageProps {
  companyId: string;
  planSlug: string;
  sfConnected: boolean;
  sfIntegration: {
    id: string;
    username: string;
    displayName: string | null;
    email: string | null;
    instanceUrl: string;
    lastSynced: string | null;
  } | null;
}

interface SFContact {
  Id: string;
  Name: string;
  FirstName: string | null;
  LastName: string;
  Email: string | null;
  Phone: string | null;
  Title: string | null;
  Account?: { Name: string } | null;
  LastModifiedDate: string;
}

interface SFLead {
  Id: string;
  Name: string;
  FirstName: string | null;
  LastName: string;
  Email: string | null;
  Phone: string | null;
  Title: string | null;
  Company: string | null;
  Status: string;
  LastModifiedDate: string;
}

interface ContactMapping {
  sf_contact_id: string | null;
  sf_lead_id: string | null;
  callengo_contact_id: string;
  last_synced_at: string | null;
}

type TabView = 'contacts' | 'leads';

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
// MAIN COMPONENT
// ============================================================================

export default function SalesforceContactsPage({
  companyId,
  planSlug,
  sfConnected,
  sfIntegration,
}: SalesforceContactsPageProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabView>('contacts');
  const [contacts, setContacts] = useState<SFContact[]>([]);
  const [leads, setLeads] = useState<SFLead[]>([]);
  const [mappings, setMappings] = useState<ContactMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Fetch Salesforce data
  const loadData = useCallback(async () => {
    if (!sfConnected) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations/salesforce/contacts?type=all&limit=200`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
        setLeads(data.leads || []);
        setMappings(data.mappings || []);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to load Salesforce data', 'error');
      }
    } catch {
      showToast('Failed to load Salesforce data', 'error');
    } finally {
      setLoading(false);
    }
  }, [sfConnected, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync contacts
  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/integrations/salesforce/sync', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const total = (data.contacts?.created || 0) + (data.leads?.created || 0);
        const updated = (data.contacts?.updated || 0) + (data.leads?.updated || 0);
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

  // Check if a contact/lead is synced to Callengo
  const isSynced = (id: string, type: 'contact' | 'lead') => {
    return mappings.some((m) =>
      type === 'contact' ? m.sf_contact_id === id : m.sf_lead_id === id
    );
  };

  // Filter by search
  const filteredContacts = contacts.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.Name?.toLowerCase().includes(q) ||
      c.Email?.toLowerCase().includes(q) ||
      c.Phone?.includes(q) ||
      c.Account?.Name?.toLowerCase().includes(q)
    );
  });

  const filteredLeads = leads.filter((l) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.Name?.toLowerCase().includes(q) ||
      l.Email?.toLowerCase().includes(q) ||
      l.Phone?.includes(q) ||
      l.Company?.toLowerCase().includes(q)
    );
  });

  // ============================================================================
  // NOT CONNECTED STATE
  // ============================================================================

  if (!sfConnected) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'Contacts', href: '/contacts' },
          { label: 'Salesforce' },
        ]} />

        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#00A1E0] flex items-center justify-center mx-auto mb-4">
            <FaSalesforce className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Connect Salesforce</h2>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Connect your Salesforce account to import contacts, leads, and sync your CRM data with Callengo.
          </p>
          <Link
            href="/api/integrations/salesforce/connect?return_to=/contacts/salesforce"
            className="btn-primary px-6 py-3 rounded-lg font-semibold text-sm inline-flex items-center gap-2"
          >
            <FaSalesforce className="w-4 h-4" />
            Connect Salesforce
          </Link>
          <p className="text-xs text-slate-400 mt-4">
            Requires Business plan or higher.{' '}
            <Link href="/billing" className="text-[var(--color-primary)] hover:underline">
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
        { label: 'Salesforce' },
      ]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#00A1E0] flex items-center justify-center">
            <FaSalesforce className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Salesforce Contacts</h1>
            <p className="text-sm text-slate-500">
              {sfIntegration?.displayName || sfIntegration?.username}
              {sfIntegration?.lastSynced && (
                <> · Last synced {formatLastSynced(sfIntegration.lastSynced)}</>
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
      <div className="bg-gradient-to-r from-blue-50 to-[var(--color-primary-50)] rounded-xl border border-blue-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Connected
          </span>
          <span className="text-sm text-slate-600">
            {contacts.length} contacts · {leads.length} leads from Salesforce
          </span>
        </div>
        <div className="text-xs text-slate-500">
          {mappings.length} synced to Callengo
        </div>
      </div>

      {/* Search + Tabs */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('contacts')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'contacts'
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Contacts ({filteredContacts.length})
          </button>
          <button
            onClick={() => setActiveTab('leads')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'leads'
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Leads ({filteredLeads.length})
          </button>
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

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border border-[var(--color-primary-200)] border-t-[var(--color-primary)] rounded-full animate-spin" />
        </div>
      )}

      {/* Contacts Tab */}
      {!loading && activeTab === 'contacts' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Phone</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Account</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Title</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Synced</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Modified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      {searchQuery ? 'No contacts match your search' : 'No contacts found in Salesforce'}
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((contact) => (
                    <tr key={contact.Id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{contact.Name}</td>
                      <td className="px-4 py-3 text-slate-600">{contact.Email || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{contact.Phone || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{contact.Account?.Name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{contact.Title || '—'}</td>
                      <td className="px-4 py-3">
                        {isSynced(contact.Id, 'contact') ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Synced
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                            Not synced
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(contact.LastModifiedDate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leads Tab */}
      {!loading && activeTab === 'leads' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
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
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      {searchQuery ? 'No leads match your search' : 'No leads found in Salesforce'}
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr key={lead.Id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{lead.Name}</td>
                      <td className="px-4 py-3 text-slate-600">{lead.Email || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{lead.Phone || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{lead.Company || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {lead.Status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isSynced(lead.Id, 'lead') ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Synced
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                            Not synced
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(lead.LastModifiedDate)}</td>
                    </tr>
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
