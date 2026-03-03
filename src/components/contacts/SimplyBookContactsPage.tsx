// components/contacts/SimplyBookContactsPage.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Breadcrumbs from '@/components/ui/Breadcrumbs';

// ============================================================================
// SKELETON
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
          <div className="h-5 w-14 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// TYPES
// ============================================================================

interface SimplyBookContactsPageProps {
  companyId: string;
  planSlug: string;
  sbConnected: boolean;
  sbIntegration: {
    id: string;
    displayName: string | null;
    email: string | null;
    companyName: string | null;
    companyLogin: string | null;
    lastSynced: string | null;
  } | null;
}

interface SBClientItem {
  id: number;
  name: string;
  email: string;
  phone: string;
  already_synced: boolean;
  callengo_contact_id: string | null;
}

interface SBBookingItem {
  id: number;
  code: string;
  is_confirmed: boolean;
  start_datetime: string;
  end_datetime: string;
  duration: number;
  status: string;
  service: { id: number; name: string; price: number; currency: string } | null;
  provider: { id: number; name: string } | null;
  client: { id: number; name: string; email: string } | null;
  comment: string;
}

type ActiveTab = 'clients' | 'bookings';

// ============================================================================
// COMPONENT
// ============================================================================

export default function SimplyBookContactsPage({ companyId, planSlug, sbConnected, sbIntegration }: SimplyBookContactsPageProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('clients');

  // Connect form state
  const [companyLogin, setCompanyLogin] = useState('');
  const [userLogin, setUserLogin] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Clients tab
  const [clients, setClients] = useState<SBClientItem[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [clientPage, setClientPage] = useState(1);
  const [clientTotalPages, setClientTotalPages] = useState(1);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<number>>(new Set());

  // Bookings tab
  const [bookings, setBookings] = useState<SBBookingItem[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingPage, setBookingPage] = useState(1);
  const [bookingTotalPages, setBookingTotalPages] = useState(1);
  const [showUpcomingOnly, setShowUpcomingOnly] = useState(true);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ============================================================================
  // CONNECT
  // ============================================================================

  const handleConnect = async () => {
    if (!companyLogin || !userLogin || !userPassword) {
      setConnectError('All fields are required');
      return;
    }

    setConnecting(true);
    setConnectError(null);

    try {
      const res = await fetch('/api/integrations/simplybook/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_login: companyLogin,
          user_login: userLogin,
          user_password: userPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setConnectError(data.error || 'Failed to connect');
        return;
      }

      setToast({ type: 'success', message: 'Connected to SimplyBook.me successfully!' });
      router.refresh();
    } catch {
      setConnectError('Network error. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  // ============================================================================
  // FETCH CLIENTS
  // ============================================================================

  const fetchClients = useCallback(async () => {
    if (!sbConnected) return;
    setClientsLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(clientPage),
        limit: '50',
      });
      if (clientSearch) params.set('search', clientSearch);

      const res = await fetch(`/api/integrations/simplybook/clients?${params}`);
      const data = await res.json();

      if (res.ok) {
        setClients(data.clients || []);
        setClientTotalPages(data.metadata?.pages_count || 1);
      }
    } catch {
      // Silently handle
    } finally {
      setClientsLoading(false);
    }
  }, [sbConnected, clientPage, clientSearch]);

  // ============================================================================
  // FETCH BOOKINGS
  // ============================================================================

  const fetchBookings = useCallback(async () => {
    if (!sbConnected) return;
    setBookingsLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(bookingPage),
        limit: '50',
      });
      if (showUpcomingOnly) params.set('upcoming', '1');

      const res = await fetch(`/api/integrations/simplybook/bookings?${params}`);
      const data = await res.json();

      if (res.ok) {
        setBookings(data.bookings || []);
        setBookingTotalPages(data.metadata?.pages_count || 1);
      }
    } catch {
      // Silently handle
    } finally {
      setBookingsLoading(false);
    }
  }, [sbConnected, bookingPage, showUpcomingOnly]);

  useEffect(() => {
    if (activeTab === 'clients') fetchClients();
    if (activeTab === 'bookings') fetchBookings();
  }, [activeTab, fetchClients, fetchBookings]);

  // ============================================================================
  // SYNC
  // ============================================================================

  const handleFullSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/integrations/simplybook/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync_type: 'full' }),
      });

      const data = await res.json();

      if (res.ok) {
        setToast({
          type: 'success',
          message: `Synced: ${data.result.clients_created} created, ${data.result.clients_updated} updated`,
        });
        fetchClients();
      } else {
        setToast({ type: 'error', message: data.error || 'Sync failed' });
      }
    } catch {
      setToast({ type: 'error', message: 'Network error during sync' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectiveSync = async () => {
    if (selectedClientIds.size === 0) return;
    setSyncing(true);

    try {
      const res = await fetch('/api/integrations/simplybook/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sync_type: 'selective',
          client_ids: Array.from(selectedClientIds),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setToast({
          type: 'success',
          message: `Synced ${selectedClientIds.size} clients: ${data.result.clients_created} created, ${data.result.clients_updated} updated`,
        });
        setSelectedClientIds(new Set());
        fetchClients();
      } else {
        setToast({ type: 'error', message: data.error || 'Selective sync failed' });
      }
    } catch {
      setToast({ type: 'error', message: 'Network error during sync' });
    } finally {
      setSyncing(false);
    }
  };

  const toggleClientSelection = (id: number) => {
    setSelectedClientIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const unsyncedClients = clients.filter(c => !c.already_synced);
    if (selectedClientIds.size === unsyncedClients.length && unsyncedClients.length > 0) {
      setSelectedClientIds(new Set());
    } else {
      setSelectedClientIds(new Set(unsyncedClients.map(c => c.id)));
    }
  };

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // ============================================================================
  // RENDER — NOT CONNECTED
  // ============================================================================

  if (!sbConnected) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'Contacts', href: '/contacts' },
          { label: 'SimplyBook.me' },
        ]} />

        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-lg mx-auto">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-sky-50 flex items-center justify-center mx-auto mb-4">
              <img src="/simplybookme-logo.jpg" alt="SimplyBook.me" className="w-10 h-10 rounded" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Connect SimplyBook.me</h2>
            <p className="text-sm text-slate-500 mt-1">
              Enter your SimplyBook.me credentials to sync clients and bookings
            </p>
          </div>

          {connectError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {connectError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company Login</label>
              <input
                type="text"
                value={companyLogin}
                onChange={(e) => setCompanyLogin(e.target.value)}
                placeholder="your-company"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
              <p className="text-xs text-slate-400 mt-1">Your SimplyBook.me subdomain (e.g., &quot;mycompany&quot; from mycompany.simplybook.me)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">User Login</label>
              <input
                type="text"
                value={userLogin}
                onChange={(e) => setUserLogin(e.target.value)}
                placeholder="admin@example.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={userPassword}
                onChange={(e) => setUserPassword(e.target.value)}
                placeholder="********"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
            </div>

            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full py-2.5 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 transition-colors disabled:opacity-50"
            >
              {connecting ? 'Connecting...' : 'Connect SimplyBook.me'}
            </button>
          </div>

          <p className="text-xs text-slate-400 mt-4 text-center">
            Your credentials are encrypted and stored securely. We never share them with third parties.
          </p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER — CONNECTED
  // ============================================================================

  const unsyncedCount = clients.filter(c => !c.already_synced).length;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Contacts', href: '/contacts' },
        { label: 'SimplyBook.me' },
      ]} />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Deletion protection banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
        <p className="text-sm text-emerald-800">
          <strong>Deletion Protection:</strong> Disconnecting or removing contacts from Callengo will never delete data from your SimplyBook.me account.
        </p>
      </div>

      {/* Connection info header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center">
              <img src="/simplybookme-logo.jpg" alt="SimplyBook.me" className="w-8 h-8 rounded" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">SimplyBook.me</h2>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                {sbIntegration?.companyName && <span>{sbIntegration.companyName}</span>}
                {sbIntegration?.email && <span>· {sbIntegration.email}</span>}
                {sbIntegration?.lastSynced && (
                  <span>· Last sync: {new Date(sbIntegration.lastSynced).toLocaleString()}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleFullSync}
              disabled={syncing}
              className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {syncing ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Syncing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                  Sync All
                </>
              )}
            </button>
            <Link
              href="/integrations"
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              Settings
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('clients')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'clients'
                ? 'text-sky-600 border-b-2 border-sky-600 bg-sky-50/50'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Clients
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'bookings'
                ? 'text-sky-600 border-b-2 border-sky-600 bg-sky-50/50'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Bookings
          </button>
        </div>

        {/* CLIENTS TAB */}
        {activeTab === 'clients' && (
          <div>
            {/* Search & actions bar */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-xs">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={clientSearch}
                  onChange={(e) => { setClientSearch(e.target.value); setClientPage(1); }}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                />
              </div>
              {selectedClientIds.size > 0 && (
                <button
                  onClick={handleSelectiveSync}
                  disabled={syncing}
                  className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  Sync Selected ({selectedClientIds.size})
                </button>
              )}
            </div>

            {clientsLoading ? (
              <TableSkeleton />
            ) : clients.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                {clientSearch ? 'No clients match your search' : 'No clients found in SimplyBook.me'}
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <div className="w-5">
                    <input
                      type="checkbox"
                      checked={selectedClientIds.size > 0 && selectedClientIds.size === clients.filter(c => !c.already_synced).length}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-sky-600"
                    />
                  </div>
                  <div className="flex-1">Name</div>
                  <div className="w-48">Email</div>
                  <div className="w-36">Phone</div>
                  <div className="w-24 text-center">Status</div>
                </div>

                {/* Table rows */}
                <div className="divide-y divide-slate-100">
                  {clients.map((client) => (
                    <div key={client.id} className="px-4 py-3 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                      <div className="w-5">
                        {!client.already_synced && (
                          <input
                            type="checkbox"
                            checked={selectedClientIds.has(client.id)}
                            onChange={() => toggleClientSelection(client.id)}
                            className="rounded border-slate-300 text-sky-600"
                          />
                        )}
                      </div>
                      <div className="flex-1 font-medium text-sm text-slate-900">{client.name || '—'}</div>
                      <div className="w-48 text-sm text-slate-500 truncate">{client.email || '—'}</div>
                      <div className="w-36 text-sm text-slate-500">{client.phone || '—'}</div>
                      <div className="w-24 text-center">
                        {client.already_synced ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            Synced
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">
                            Not synced
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {clientTotalPages > 1 && (
                  <div className="p-4 border-t border-slate-100 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setClientPage(p => Math.max(1, p - 1))}
                      disabled={clientPage <= 1}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-slate-500">
                      Page {clientPage} of {clientTotalPages}
                    </span>
                    <button
                      onClick={() => setClientPage(p => Math.min(clientTotalPages, p + 1))}
                      disabled={clientPage >= clientTotalPages}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* BOOKINGS TAB */}
        {activeTab === 'bookings' && (
          <div>
            {/* Filter bar */}
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showUpcomingOnly}
                  onChange={() => { setShowUpcomingOnly(!showUpcomingOnly); setBookingPage(1); }}
                  className="rounded border-slate-300 text-sky-600"
                />
                Show upcoming only
              </label>
            </div>

            {bookingsLoading ? (
              <TableSkeleton />
            ) : bookings.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No bookings found
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <div className="w-20">Code</div>
                  <div className="flex-1">Service</div>
                  <div className="w-32">Provider</div>
                  <div className="w-32">Client</div>
                  <div className="w-36">Date & Time</div>
                  <div className="w-16 text-center">Duration</div>
                  <div className="w-24 text-center">Status</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {bookings.map((booking) => (
                    <div key={booking.id} className="px-4 py-3 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                      <div className="w-20 text-sm font-mono text-slate-500">{booking.code}</div>
                      <div className="flex-1 text-sm font-medium text-slate-900">
                        {booking.service?.name || `Service #${booking.id}`}
                        {booking.service?.price ? (
                          <span className="ml-1 text-slate-400 font-normal">
                            ({booking.service.currency} {booking.service.price})
                          </span>
                        ) : null}
                      </div>
                      <div className="w-32 text-sm text-slate-500 truncate">{booking.provider?.name || '—'}</div>
                      <div className="w-32 text-sm text-slate-500 truncate">{booking.client?.name || '—'}</div>
                      <div className="w-36 text-sm text-slate-500">
                        {new Date(booking.start_datetime).toLocaleDateString()}{' '}
                        {new Date(booking.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="w-16 text-center text-sm text-slate-500">{booking.duration}m</div>
                      <div className="w-24 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          booking.status === 'confirmed' || booking.is_confirmed
                            ? 'bg-emerald-50 text-emerald-700'
                            : booking.status === 'canceled'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          {booking.status || (booking.is_confirmed ? 'Confirmed' : 'Pending')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {bookingTotalPages > 1 && (
                  <div className="p-4 border-t border-slate-100 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setBookingPage(p => Math.max(1, p - 1))}
                      disabled={bookingPage <= 1}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-slate-500">
                      Page {bookingPage} of {bookingTotalPages}
                    </span>
                    <button
                      onClick={() => setBookingPage(p => Math.min(bookingTotalPages, p + 1))}
                      disabled={bookingPage >= bookingTotalPages}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
