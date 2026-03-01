// components/contacts/ContactsManager.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Contact as ContactType } from '@/types/call-agent';
import { ContactList } from '@/types/supabase';
import ContactsTable, { type SortField, type SortOrder } from './ContactsTable';
import ContactDetailDrawer from './ContactDetailDrawer';
import ImportModal from './ImportModal';
import GoogleSheetsPickerModal from './GoogleSheetsPickerModal';
import GoogleSheetsSyncProgress, { type SyncJobInfo } from './GoogleSheetsSyncProgress';
import { GoogleSheetsIcon } from '@/components/icons/BrandIcons';
import { FaSalesforce, FaHubspot } from 'react-icons/fa';
import Link from 'next/link';

interface ContactsManagerProps {
  initialContacts: any[];
  initialTotalCount: number;
  initialContactLists?: ContactList[];
  companyId: string;
  hasSalesforceAccess: boolean;
  sfConnected: boolean;
  hasHubSpotAccess?: boolean;
  hsConnected?: boolean;
  hasPipedriveAccess?: boolean;
  pdConnected?: boolean;
  gsConnected?: boolean;
}

interface ContactStats {
  total: number;
  statusCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  withEmail: number;
  called: number;
  recentlyAdded: number;
  noList: number;
}

interface AIResult {
  action: string;
  result: Record<string, unknown>;
  contactCount: number;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ConfirmDialog {
  show: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
}

// Confirmation Dialog Component
function ConfirmationModal({ dialog, onClose }: { dialog: ConfirmDialog; onClose: () => void }) {
  if (!dialog.show) return null;

  const typeColors = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-amber-600 hover:bg-amber-700',
    info: 'gradient-bg',
  };

  const typeIcons = {
    danger: (
      <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    warning: (
      <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  const type = dialog.type || 'info';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-md border border-slate-100 animate-slideUp">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              {typeIcons[type]}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{dialog.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{dialog.message}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 rounded-b-2xl flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-white hover:border-slate-300 transition-all font-medium"
          >
            {dialog.cancelText || 'Cancel'}
          </button>
          <button
            onClick={() => {
              dialog.onConfirm();
              onClose();
            }}
            className={`flex-1 px-4 py-2.5 text-white rounded-xl transition-all font-medium ${typeColors[type]}`}
          >
            {dialog.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContactsManager({ initialContacts, initialTotalCount, initialContactLists = [], companyId, hasSalesforceAccess, sfConnected, hasHubSpotAccess = false, hsConnected = false, hasPipedriveAccess = false, pdConnected = false, gsConnected = false }: ContactsManagerProps) {
  const [contacts, setContacts] = useState<ContactType[]>(initialContacts as ContactType[]);
  const [total, setTotal] = useState(initialTotalCount);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(Math.ceil(initialTotalCount / 50));
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [contactLists, setContactLists] = useState<ContactList[]>(initialContactLists);
  const [selectedListFilter, setSelectedListFilter] = useState<string>('all');
  const [showListManager, setShowListManager] = useState(false);
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [showAddContactsDropdown, setShowAddContactsDropdown] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [showManualAddModal, setShowManualAddModal] = useState(false);
  const [importType, setImportType] = useState<'csv' | 'xlsx' | 'google' | 'txt' | 'xml' | 'json' | null>(null);
  const [showGSheetsPicker, setShowGSheetsPicker] = useState(false);
  const [gSheetsPreloadedData, setGSheetsPreloadedData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [syncJob, setSyncJob] = useState<SyncJobInfo | null>(null);
  const [selectedContact, setSelectedContact] = useState<ContactType | null>(null);
  const [showAIMenu, setShowAIMenu] = useState(false);
  const [aiLoading, setAILoading] = useState(false);
  const [aiResult, setAIResult] = useState<AIResult | null>(null);
  const [creatingSegments, setCreatingSegments] = useState<Set<number>>(new Set());
  const [createdSegments, setCreatedSegments] = useState<Set<number>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const aiMenuRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 4000);
  };

  // Load contact lists on mount (only if not provided initially)
  useEffect(() => {
    if (initialContactLists.length === 0) {
      loadContactLists();
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch contacts from API when filters/sort/page change
  const fetchContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
        sortOrder,
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (selectedListFilter && selectedListFilter !== 'all') params.set('listId', selectedListFilter);

      const res = await fetch(`/api/contacts?${params}`);
      const data = await res.json();
      if (res.ok) {
        setContacts(data.contacts as ContactType[]);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch {
      // Keep existing data on error
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sortBy, sortOrder, debouncedSearch, statusFilter, selectedListFilter]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Fetch stats on mount and after data changes
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/contacts/stats');
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch {
      // ignore
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.add-contacts-dropdown') && showAddContactsDropdown) {
        setShowAddContactsDropdown(false);
      }
      if (aiMenuRef.current && !aiMenuRef.current.contains(target)) {
        setShowAIMenu(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddContactsDropdown]);

  const loadContactLists = async () => {
    const { data } = await supabase
      .from('contact_lists')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (data) {
      setContactLists(data);
    }
  };

  const refreshContacts = async () => {
    await fetchContacts();
    await fetchStats();
  };

  const handleSort = (field: SortField) => {
    if (field === sortBy) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleAIAnalysis = async (action: 'suggest-lists' | 'analyze-quality') => {
    setShowAIMenu(false);
    setAILoading(true);
    try {
      const res = await fetch('/api/contacts/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI analysis failed');
      setAIResult(data);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'AI analysis failed', 'error');
    } finally {
      setAILoading(false);
    }
  };

  const handleCreateSegmentList = async (segment: { name: string; color: string; description: string; criteria: string; filters?: Record<string, unknown> }, index: number) => {
    setCreatingSegments(prev => new Set(prev).add(index));
    try {
      const res = await fetch('/api/contacts/ai-segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: segment.name,
          description: segment.description,
          color: segment.color,
          criteria: segment.criteria,
          filters: segment.filters || {},
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create segment');
      setCreatedSegments(prev => new Set(prev).add(index));
      await loadContactLists();
      await refreshContacts();
      showToast(`List "${segment.name}" created with ${data.assignedCount} contacts`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create list', 'error');
    } finally {
      setCreatingSegments(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  const handleImportComplete = () => {
    refreshContacts();
    setShowImportModal(false);
    setImportType(null);
    setGSheetsPreloadedData(null);
  };

  const handleImportTypeSelect = (type: 'csv' | 'xlsx' | 'google' | 'txt' | 'xml' | 'json') => {
    setImportType(type);
    setShowImportModal(true);
    setShowAddContactsDropdown(false);
  };

  const handleGoogleSheetsClick = () => {
    setShowAddContactsDropdown(false);
    if (gsConnected) {
      // Connected: open picker to browse sheets
      setShowGSheetsPicker(true);
    } else {
      // Not connected: redirect to OAuth
      window.location.href = '/api/integrations/google-sheets/connect?return_to=/contacts';
    }
  };

  const handleGSheetsDataReady = (headers: string[], rows: string[][]) => {
    setShowGSheetsPicker(false);
    setGSheetsPreloadedData({ headers, rows });
    setImportType('google');
    setShowImportModal(true);
  };

  const handleManualAdd = () => {
    setShowManualAddModal(true);
    setShowAddContactsDropdown(false);
  };

  const handleExport = async (format: 'csv' | 'json' | 'xlsx' | 'gsheets' = 'csv') => {
    setShowExportMenu(false);
    if (format === 'gsheets') {
      // Download CSV and open a new Google Sheet for the user to import
      try {
        const params = new URLSearchParams({ format: 'csv' });
        if (selectedListFilter !== 'all') params.set('listId', selectedListFilter);
        if (statusFilter !== 'all') params.set('status', statusFilter);
        const response = await fetch(`/api/contacts/export?${params}`);
        if (!response.ok) throw new Error('Export failed');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contacts_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast('CSV downloaded! Opening Google Sheets — use File > Import to upload.', 'info');
        window.open('https://sheets.new', '_blank');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Export failed', 'error');
      }
      return;
    }
    try {
      const params = new URLSearchParams({ format });
      if (selectedListFilter !== 'all') params.set('listId', selectedListFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const response = await fetch(`/api/contacts/export?${params}`);
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const ext = format === 'xlsx' ? 'xls' : format;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts_export_${new Date().toISOString().split('T')[0]}.${ext}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast(`Contacts exported as ${format.toUpperCase()} successfully`, 'success');
    } catch (error) {
      console.error('Export failed:', error);
      showToast('Failed to export contacts', 'error');
    }
  };

  const handleBatchMoveToList = async (listId: string | null) => {
    if (selectedContactIds.length === 0) return;

    try {
      const { error } = await supabase
        .from('contacts')
        .update({ list_id: listId })
        .in('id', selectedContactIds);

      if (error) throw error;

      const count = selectedContactIds.length;
      await refreshContacts();
      setSelectedContactIds([]);
      setShowBatchActions(false);

      if (listId === null) {
        showToast(`Removed ${count} contact${count > 1 ? 's' : ''} from list`, 'success');
      } else {
        showToast(`Added ${count} contact${count > 1 ? 's' : ''} to list successfully`, 'success');
      }
    } catch (error) {
      showToast('Failed to move contacts', 'error');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedContactIds.length === 0) return;

    setConfirmDialog({
      show: true,
      title: 'Delete Contacts',
      message: `Are you sure you want to permanently delete ${selectedContactIds.length} contact${selectedContactIds.length > 1 ? 's' : ''}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        try {
          const count = selectedContactIds.length;
          // Batch deletes to avoid URL length limits (Supabase REST API uses query params)
          const BATCH_SIZE = 50;
          for (let i = 0; i < selectedContactIds.length; i += BATCH_SIZE) {
            const batch = selectedContactIds.slice(i, i + BATCH_SIZE);
            const { error } = await supabase
              .from('contacts')
              .delete()
              .in('id', batch);
            if (error) throw error;
          }

          await refreshContacts();
          setSelectedContactIds([]);
          setShowBatchActions(false);
          showToast(`Deleted ${count} contact${count > 1 ? 's' : ''} successfully`, 'success');
        } catch (error) {
          showToast('Failed to delete contacts', 'error');
        }
      },
    });
  };

  const handleQuickFilterClick = (listId: string) => {
    if (selectedListFilter === listId) {
      setSelectedListFilter('all');
    } else {
      setSelectedListFilter(listId);
    }
    setPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleListFilterChange = (value: string) => {
    setSelectedListFilter(value);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Total</p>
              {statsLoading ? (
                <div className="h-7 w-16 bg-slate-200 rounded animate-pulse mt-0.5" />
              ) : (
                <p className="text-2xl font-bold text-slate-900">{(stats?.total || total).toLocaleString()}</p>
              )}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Called</p>
              {statsLoading ? (
                <div className="h-7 w-12 bg-slate-200 rounded animate-pulse mt-0.5" />
              ) : (
                <p className="text-2xl font-bold text-slate-900">{(stats?.called || 0).toLocaleString()}</p>
              )}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">With Email</p>
              {statsLoading ? (
                <div className="h-7 w-12 bg-slate-200 rounded animate-pulse mt-0.5" />
              ) : (
                <p className="text-2xl font-bold text-slate-900">{(stats?.withEmail || 0).toLocaleString()}</p>
              )}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Last 7 Days</p>
              {statsLoading ? (
                <div className="h-7 w-12 bg-slate-200 rounded animate-pulse mt-0.5" />
              ) : (
                <p className="text-2xl font-bold text-slate-900">{(stats?.recentlyAdded || 0).toLocaleString()}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Filters - List Badges */}
      {contactLists.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-slate-600">Quick Filters:</span>
            <button
              onClick={() => setSelectedListFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                selectedListFilter === 'all'
                  ? 'bg-[var(--color-primary-50)] border-[var(--color-primary)] text-[var(--color-primary)] shadow-md'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
              }`}
            >
              All Contacts ({(stats?.total || total).toLocaleString()})
            </button>
            <button
              onClick={() => setSelectedListFilter('none')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                selectedListFilter === 'none'
                  ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-md'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
              }`}
            >
              No List ({(stats?.noList || 0).toLocaleString()})
            </button>
            {contactLists.map((list) => {
              const listColor = list.color || '#3b82f6';
              return (
                <button
                  key={list.id}
                  onClick={() => handleQuickFilterClick(list.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    selectedListFilter === list.id
                      ? 'shadow-md'
                      : 'hover:shadow-md'
                  }`}
                  style={{
                    backgroundColor: selectedListFilter === list.id ? `${listColor}25` : `${listColor}10`,
                    borderColor: listColor,
                    color: selectedListFilter === list.id ? listColor : `${listColor}cc`
                  }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: listColor }}></div>
                  {list.name}
                  {selectedListFilter === list.id && (
                    <span className="ml-1 px-1.5 py-0.5 bg-white/50 rounded text-xs font-semibold">
                      {total.toLocaleString()}
                    </span>
                  )}
                </button>
              );
            })}
            {/* Add New List Button */}
            <button
              onClick={() => setShowListManager(true)}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:bg-slate-50 transition-all"
              title="Create new list"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Batch Actions Bar */}
      {selectedContactIds.length > 0 && (
        <div className="bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] rounded-xl p-4 flex items-center justify-between animate-slideDown relative z-50">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-900">
              {selectedContactIds.length} contact{selectedContactIds.length > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setSelectedContactIds([])}
              className="text-xs text-[var(--color-primary)] hover:opacity-80 font-medium"
            >
              Clear selection
            </button>
          </div>
          <div className="flex gap-2">
            <div className="relative z-[100]">
              <button
                onClick={() => setShowBatchActions(!showBatchActions)}
                className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Actions
              </button>
              {showBatchActions && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-[9999]">
                  <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Add to List</div>
                  <button
                    onClick={() => setShowListManager(true)}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create new list
                  </button>
                  {contactLists.map((list) => (
                    <button
                      key={list.id}
                      onClick={() => handleBatchMoveToList(list.id)}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-between"
                    >
                      <span>{list.name}</span>
                      {list.color && (
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: list.color }}></div>
                      )}
                    </button>
                  ))}
                  <div className="border-t border-slate-200 my-2"></div>
                  <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Other Actions</div>
                  <button
                    onClick={() => handleBatchMoveToList(null)}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Remove from current list
                  </button>
                  <div className="border-t border-slate-200 my-2"></div>
                  <button
                    onClick={handleBatchDelete}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors font-semibold flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete permanently
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4">
        {/* Row 1: Search + Actions */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          {/* Search */}
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, company, phone, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none transition-all text-sm text-slate-900 placeholder-slate-400"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 items-center">
            <select
              value={selectedListFilter}
              onChange={(e) => handleListFilterChange(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none text-slate-700 cursor-pointer"
            >
              <option value="all">All Lists</option>
              <option value="none">No List</option>
              {contactLists.map((list) => (
                <option key={list.id} value={list.id}>{list.name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none text-slate-700 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Calling">Calling</option>
              <option value="Fully Verified">Verified</option>
              <option value="For Callback">For Callback</option>
              <option value="No Answer">No Answer</option>
              <option value="Voicemail Left">Voicemail</option>
              <option value="Wrong Number">Wrong Number</option>
            </select>
          </div>

          {/* Divider */}
          <div className="hidden lg:block w-px h-8 bg-slate-200" />

          {/* Actions */}
          <div className="flex gap-2 items-center">
            {/* AI Insights - Prominent */}
            <div className="relative" ref={aiMenuRef}>
              <button
                onClick={() => setShowAIMenu(!showAIMenu)}
                disabled={aiLoading}
                className="px-3.5 py-2 text-sm rounded-lg font-semibold transition-all flex items-center gap-2 disabled:opacity-50 bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-sm hover:shadow-md hover:from-violet-700 hover:to-purple-700"
              >
                {aiLoading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                )}
                AI Insights
              </button>
              {showAIMenu && (
                <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 overflow-hidden">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1.5">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                      Powered by AI
                    </p>
                  </div>
                  <button onClick={() => handleAIAnalysis('suggest-lists')} className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-purple-50 transition-colors flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Suggest Lists</div>
                      <div className="text-xs text-slate-400">Create smart lists automatically</div>
                    </div>
                  </button>
                  <button onClick={() => handleAIAnalysis('analyze-quality')} className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-purple-50 transition-colors flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Data Quality</div>
                      <div className="text-xs text-slate-400">Analyze completeness &amp; issues</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowListManager(true)}
              className="px-3 py-2 text-sm border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-1.5 font-medium"
              title="Manage Lists"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span className="hidden xl:inline">Lists</span>
            </button>

            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={total === 0}
                className="px-3 py-2 text-sm border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 font-medium"
                title="Export Contacts"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="hidden xl:inline">Export</span>
                <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 overflow-hidden">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Download as</div>
                  <button onClick={() => handleExport('csv')} className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span>
                    <span className="font-medium">CSV</span>
                    <span className="ml-auto text-xs text-slate-400">.csv</span>
                  </button>
                  <button onClick={() => handleExport('xlsx')} className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
                    <span className="font-medium">Excel</span>
                    <span className="ml-auto text-xs text-slate-400">.xls</span>
                  </button>
                  <button onClick={() => handleExport('json')} className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0"></span>
                    <span className="font-medium">JSON</span>
                    <span className="ml-auto text-xs text-slate-400">.json</span>
                  </button>
                  <div className="border-t border-slate-100 my-1"></div>
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cloud</div>
                  <button onClick={() => handleExport('gsheets')} className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5">
                    <GoogleSheetsIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="font-medium">Google Sheets</span>
                    {!gsConnected && <span className="ml-auto text-[10px] text-amber-600 font-bold">Connect</span>}
                  </button>
                </div>
              )}
            </div>

            <div className="relative add-contacts-dropdown">
              <button
                onClick={() => setShowAddContactsDropdown(!showAddContactsDropdown)}
                className="btn-primary px-3.5 py-2 rounded-lg flex items-center gap-2 font-semibold text-sm shadow-sm hover:shadow-md"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add
                <svg className="w-3 h-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showAddContactsDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 animate-fadeIn overflow-hidden">
                  <div className="px-4 py-2.5 text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider border-b border-slate-100 bg-slate-50/50">
                    Add Contacts
                  </div>

                  <button
                    onClick={handleManualAdd}
                    className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3 group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Add Manually</div>
                      <div className="text-xs text-slate-500">Create a contact with custom fields</div>
                    </div>
                  </button>

                  <div className="border-t border-slate-100">
                    <div className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">Import From File</div>
                    <div className="px-4 pb-3 pt-1 grid grid-cols-3 gap-2">
                      {([
                        { type: 'csv' as const, label: 'CSV', color: 'bg-green-500' },
                        { type: 'xlsx' as const, label: 'XLSX', color: 'bg-emerald-500' },
                        { type: 'txt' as const, label: 'TXT', color: 'bg-slate-400' },
                        { type: 'xml' as const, label: 'XML', color: 'bg-orange-500' },
                        { type: 'json' as const, label: 'JSON', color: 'bg-purple-500' },
                      ]).map(({ type, label, color }) => (
                        <button
                          key={type}
                          onClick={() => handleImportTypeSelect(type)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-sm font-medium text-slate-700"
                        >
                          <span className={`w-2 h-2 rounded-full ${color} flex-shrink-0`}></span>
                          {label}
                        </button>
                      ))}
                      <button
                        onClick={handleGoogleSheetsClick}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-sm font-medium text-slate-700"
                      >
                        <GoogleSheetsIcon className="w-4 h-4 flex-shrink-0" />
                        Sheets
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-slate-100">
                    <div className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">Integrations</div>
                    <div className="px-2 pb-2">
                      {([
                        { name: 'Salesforce', icon: <FaSalesforce className="w-5 h-5 text-white" />, bg: 'bg-[#00A1E0]', connected: sfConnected, hasAccess: hasSalesforceAccess, href: sfConnected ? '/contacts/salesforce' : hasSalesforceAccess ? '/api/integrations/salesforce/connect?return_to=/contacts/salesforce' : '/settings?tab=billing', desc: 'Import contacts & leads' },
                        { name: 'HubSpot', icon: <FaHubspot className="w-5 h-5 text-white" />, bg: 'bg-[#FF7A59]', connected: hsConnected, hasAccess: hasHubSpotAccess, href: hsConnected ? '/contacts/hubspot' : hasHubSpotAccess ? '/api/integrations/hubspot/connect?return_to=/contacts/hubspot' : '/settings?tab=billing', desc: 'Import contacts from HubSpot' },
                        { name: 'Pipedrive', icon: <svg className="w-5 h-5 text-black" viewBox="0 0 32 32" fill="currentColor"><path d="M16.3 7.8c-3.6 0-5.7 1.6-6.7 2.7-.1-1-.8-2.2-3.2-2.2H1v5.6h2.2c.4 0 .5.1.5.5v25.7h6.4V30v-.7c1 .9 2.9 2.2 5.9 2.2 6.3 0 10.7-5 10.7-12.1 0-7.3-4.2-12.1-10.4-12.1m-1.3 18.6c-3.5 0-5-3.3-5-6.4 0-4.8 2.6-6.6 5.1-6.6 3 0 5.1 2.6 5.1 6.5 0 4.5-2.6 6.5-5.2 6.5" transform="scale(0.85) translate(5, 0)" /></svg>, bg: 'bg-slate-100', connected: pdConnected, hasAccess: hasPipedriveAccess, href: pdConnected ? '/contacts/pipedrive' : hasPipedriveAccess ? '/api/integrations/pipedrive/connect?return_to=/contacts/pipedrive' : '/settings?tab=billing', desc: 'Sync contacts with Pipedrive' },
                      ] as const).map((crm) => (
                        <Link
                          key={crm.name}
                          href={crm.href}
                          className="w-full px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3 rounded-lg group"
                        >
                          <div className={`w-9 h-9 rounded-lg ${crm.bg} flex items-center justify-center flex-shrink-0`}>{crm.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-900 flex items-center gap-2">
                              {crm.name}
                              {!crm.hasAccess && <span className="text-[10px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white px-1.5 py-0.5 rounded-full">Business+</span>}
                            </div>
                            <div className="text-xs text-slate-500">{crm.desc}</div>
                          </div>
                          <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ContactsTable
        contacts={contacts}
        selectedContactIds={selectedContactIds}
        onSelectionChange={setSelectedContactIds}
        contactLists={contactLists}
        onListClick={handleQuickFilterClick}
        onContactClick={(contact) => setSelectedContact(contact)}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        isLoading={isLoading}
        page={page}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />

      {showImportModal && (
        <ImportModal
          companyId={companyId}
          onClose={() => {
            setShowImportModal(false);
            setImportType(null);
            setGSheetsPreloadedData(null);
          }}
          onComplete={handleImportComplete}
          importType={importType}
          onShowToast={showToast}
          preloadedData={gSheetsPreloadedData || undefined}
        />
      )}

      {showGSheetsPicker && (
        <GoogleSheetsPickerModal
          onClose={() => setShowGSheetsPicker(false)}
          onDataReady={handleGSheetsDataReady}
          onShowToast={showToast}
          onSyncStart={(job) => {
            setSyncJob(job);
            setShowGSheetsPicker(false);
          }}
        />
      )}

      {/* Google Sheets Sync Progress Widget (minimizable) */}
      <GoogleSheetsSyncProgress
        syncJob={syncJob}
        onComplete={() => {
          refreshContacts();
          setSyncJob(null);
        }}
        onDismiss={() => setSyncJob(null)}
      />

      {showManualAddModal && (
        <ManualAddModal
          companyId={companyId}
          onClose={() => setShowManualAddModal(false)}
          onComplete={handleImportComplete}
          onShowToast={showToast}
        />
      )}

      {showListManager && (
        <ListManagerModal
          companyId={companyId}
          lists={contactLists}
          onClose={() => setShowListManager(false)}
          onUpdate={loadContactLists}
          onShowToast={showToast}
        />
      )}

      {/* Contact Detail Drawer */}
      {selectedContact && (
        <ContactDetailDrawer
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onRefresh={() => {
            refreshContacts();
            setSelectedContact(null);
          }}
          onShowToast={showToast}
          sfConnected={sfConnected}
          hsConnected={hsConnected}
          pdConnected={pdConnected}
        />
      )}

      {/* AI Results Modal */}
      {aiResult && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] shadow-md border border-slate-200 flex flex-col">
            {/* Header with AI branding */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-violet-50 to-purple-50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {aiResult.action === 'suggest-lists' ? 'Suggested Lists' :
                     'Data Quality Report'}
                  </h3>
                  <p className="text-xs text-purple-600 font-medium mt-0.5">Analyzed {aiResult.contactCount} contacts with AI</p>
                </div>
              </div>
              <button
                onClick={() => { setAIResult(null); setCreatingSegments(new Set()); setCreatedSegments(new Set()); }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {aiResult.action === 'suggest-lists' && (
                <>
                  {(aiResult.result as { lists?: { name: string; description: string; criteria: string; estimatedCount: number; color: string; filters?: Record<string, unknown> }[] }).lists?.map((seg, i) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                        <h4 className="font-semibold text-slate-900">{seg.name}</h4>
                        <span className="ml-auto text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">~{seg.estimatedCount} contacts</span>
                      </div>
                      <p className="text-sm text-slate-600 mb-1">{seg.description}</p>
                      <p className="text-xs text-slate-400 mb-3">Criteria: {seg.criteria}</p>
                      <div className="flex items-center justify-end">
                        {createdSegments.has(i) ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            List Created
                          </span>
                        ) : (
                          <button
                            onClick={() => handleCreateSegmentList(seg, i)}
                            disabled={creatingSegments.has(i)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg hover:from-violet-700 hover:to-purple-700 transition-all shadow-sm disabled:opacity-50"
                          >
                            {creatingSegments.has(i) ? (
                              <>
                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                Creating...
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Create List
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {(aiResult.result as { insights?: string[] }).insights && (
                    <div className="bg-purple-50/80 rounded-xl p-4 border border-purple-100">
                      <h4 className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-2">Key Insights</h4>
                      <ul className="space-y-1">
                        {(aiResult.result as { insights: string[] }).insights.map((insight, i) => (
                          <li key={i} className="text-sm text-purple-800 flex items-start gap-2">
                            <span className="text-purple-500 mt-0.5">&#x2022;</span>
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {aiResult.action === 'analyze-quality' && (
                <>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative w-20 h-20">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-slate-200" strokeWidth="3" />
                        <circle cx="18" cy="18" r="15.5" fill="none" className={`${
                          ((aiResult.result as { overallScore?: number }).overallScore || 0) >= 70 ? 'stroke-emerald-500' :
                          ((aiResult.result as { overallScore?: number }).overallScore || 0) >= 40 ? 'stroke-amber-500' : 'stroke-red-500'
                        }`} strokeWidth="3" strokeDasharray={`${((aiResult.result as { overallScore?: number }).overallScore || 0)} 100`} strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-lg font-bold text-slate-900">{(aiResult.result as { overallScore?: number }).overallScore || 0}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Overall Quality Score</p>
                      <p className="text-xs text-slate-500">Based on data completeness and accuracy</p>
                    </div>
                  </div>
                  {(aiResult.result as { issues?: { type: string; count: number; severity: string; suggestion: string }[] }).issues?.map((issue, i) => (
                    <div key={i} className={`border rounded-xl p-3 flex items-start gap-3 ${
                      issue.severity === 'high' ? 'border-red-200 bg-red-50/50' :
                      issue.severity === 'medium' ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-slate-50/50'
                    }`}>
                      <span className={`mt-0.5 px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${
                        issue.severity === 'high' ? 'bg-red-100 text-red-700' :
                        issue.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'
                      }`}>{issue.severity}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">{issue.type.replace(/_/g, ' ')} ({issue.count})</p>
                        <p className="text-xs text-slate-500 mt-0.5">{issue.suggestion}</p>
                      </div>
                    </div>
                  ))}
                  {(aiResult.result as { recommendations?: string[] }).recommendations && (
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                      <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">Recommendations</h4>
                      <ul className="space-y-1">
                        {(aiResult.result as { recommendations: string[] }).recommendations.map((rec, i) => (
                          <li key={i} className="text-sm text-emerald-800 flex items-start gap-2">
                            <span className="text-emerald-500 mt-0.5">&#x2022;</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => { setAIResult(null); setCreatingSegments(new Set()); setCreatedSegments(new Set()); }}
                className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-sm animate-slideUp ${
              toast.type === 'success'
                ? 'bg-green-50/95 border-green-400 text-green-800'
                : toast.type === 'error'
                ? 'bg-red-50/95 border-red-400 text-red-800'
                : 'bg-blue-50/95 border-blue-400 text-blue-800'
            }`}
          >
            <div className="flex-shrink-0">
              {toast.type === 'success' && (
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {toast.type === 'error' && (
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {toast.type === 'info' && (
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        ))}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationModal
        dialog={confirmDialog}
        onClose={() => setConfirmDialog({ ...confirmDialog, show: false })}
      />
    </div>
  );
}

// List Manager Modal Component
interface ListManagerModalProps {
  companyId: string;
  lists: ContactList[];
  onClose: () => void;
  onUpdate: () => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

function ListManagerModal({ companyId, lists, onClose, onUpdate, onShowToast }: ListManagerModalProps) {
  const supabase = createClient();
  const [editingList, setEditingList] = useState<ContactList | null>(null);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [newListColor, setNewListColor] = useState('#3b82f6');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreateList = async () => {
    if (!newListName.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('contact_lists')
        .insert({
          company_id: companyId,
          name: newListName.trim(),
          description: newListDescription.trim() || null,
          color: newListColor,
        });

      if (error) {
        console.error('Error creating list:', error);
        onShowToast(`Failed to create list: ${error.message}`, 'error');
        return;
      }

      setNewListName('');
      setNewListDescription('');
      setNewListColor('#3b82f6');
      setShowCreateForm(false);
      onUpdate();
      onShowToast('List created successfully', 'success');
    } catch (error) {
      console.error('Error creating list:', error);
      onShowToast(`Failed to create list: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateList = async (list: ContactList) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('contact_lists')
        .update({
          name: list.name,
          description: list.description,
          color: list.color,
        })
        .eq('id', list.id);

      if (error) throw error;

      setEditingList(null);
      onUpdate();
      onShowToast('List updated successfully', 'success');
    } catch (error) {
      onShowToast('Failed to update list', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteList = async (listId: string) => {
    setConfirmDialog({
      show: true,
      title: 'Delete List',
      message: 'Are you sure you want to delete this list? Contacts in this list will not be deleted, but will be removed from the list.',
      confirmText: 'Delete List',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        setLoading(true);
        try {
          const { error } = await supabase
            .from('contact_lists')
            .delete()
            .eq('id', listId);

          if (error) throw error;

          onUpdate();
          onShowToast('List deleted successfully', 'success');
        } catch (error) {
          onShowToast('Failed to delete list', 'error');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const colorOptions = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] shadow-md border border-slate-200/50 flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Manage Contact Lists</h2>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Create New List Form */}
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full p-4 border border-dashed border-slate-300 rounded-xl text-slate-600 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:bg-slate-50 transition-all flex items-center justify-center gap-2 font-medium mb-6"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New List
            </button>
          ) : (
            <div className="border border-[var(--color-primary-200)] rounded-xl p-5 gradient-bg-subtle mb-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Create New List</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">List Name</label>
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="e.g., Summer Campaign 2025"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description (Optional)</label>
                  <input
                    type="text"
                    value={newListDescription}
                    onChange={(e) => setNewListDescription(e.target.value)}
                    placeholder="Brief description..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Color</label>
                  <div className="flex gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewListColor(color)}
                        className={`w-8 h-8 rounded-lg transition-all ${newListColor === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewListName('');
                      setNewListDescription('');
                      setNewListColor('#3b82f6');
                    }}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateList}
                    disabled={!newListName.trim() || loading}
                    className="flex-1 px-4 py-2 gradient-bg text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium"
                  >
                    {loading ? 'Creating...' : 'Create List'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Existing Lists */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Existing Lists ({lists.length})</h3>
            {lists.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <p className="text-sm">No lists created yet</p>
              </div>
            ) : (
              lists.map((list) => (
                <div key={list.id} className="border border-slate-200 rounded-xl p-4 bg-white hover:shadow-md transition-all">
                  {editingList?.id === list.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editingList.name}
                        onChange={(e) => setEditingList({ ...editingList, name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none font-semibold"
                      />
                      <input
                        type="text"
                        value={editingList.description || ''}
                        onChange={(e) => setEditingList({ ...editingList, description: e.target.value })}
                        placeholder="Description..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none text-sm"
                      />
                      <div className="flex gap-2">
                        {colorOptions.map((color) => (
                          <button
                            key={color}
                            onClick={() => setEditingList({ ...editingList, color })}
                            className={`w-7 h-7 rounded-lg transition-all ${editingList.color === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingList(null)}
                          className="flex-1 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleUpdateList(editingList)}
                          disabled={loading}
                          className="flex-1 px-3 py-2 gradient-bg text-white rounded-lg disabled:opacity-50 transition-all text-sm font-medium"
                        >
                          {loading ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: list.color || '#3b82f6' }}></div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{list.name}</p>
                          {list.description && (
                            <p className="text-xs text-slate-500 mt-0.5">{list.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingList(list)}
                          className="px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary-50)] rounded-lg hover:opacity-80 transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteList(list.id)}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-medium"
          >
            Close
          </button>
        </div>
      </div>
      <ConfirmationModal
        dialog={confirmDialog}
        onClose={() => setConfirmDialog({ ...confirmDialog, show: false })}
      />
    </div>
  );
}

// Manual Add Modal Component
interface ManualAddModalProps {
  companyId: string;
  onClose: () => void;
  onComplete: () => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'date';
}

interface ContactRow {
  id: string;
  data: Record<string, string>;
}

function ManualAddModal({ companyId, onClose, onComplete, onShowToast }: ManualAddModalProps) {
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<CustomField[]>([
    { id: '1', name: 'First Name', type: 'text' },
    { id: '2', name: 'Last Name', type: 'text' },
    { id: '3', name: 'Company Name', type: 'text' },
    { id: '4', name: 'Phone', type: 'phone' },
    { id: '5', name: 'Email', type: 'email' },
  ]);
  const [rows, setRows] = useState<ContactRow[]>([
    { id: '1', data: {} }
  ]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'email' | 'phone' | 'number' | 'date'>('text');
  const [showAddField, setShowAddField] = useState(false);
  const supabase = createClient();

  const addField = () => {
    if (!newFieldName.trim()) return;
    const newField: CustomField = {
      id: Date.now().toString(),
      name: newFieldName.trim(),
      type: newFieldType,
    };
    setFields([...fields, newField]);
    setNewFieldName('');
    setNewFieldType('text');
    setShowAddField(false);
  };

  const removeField = (fieldId: string) => {
    // Don't allow removing if only 1 field left
    if (fields.length <= 1) return;
    setFields(fields.filter(f => f.id !== fieldId));
    // Remove field data from all rows
    setRows(rows.map(row => {
      const newData = { ...row.data };
      const fieldToRemove = fields.find(f => f.id === fieldId);
      if (fieldToRemove) {
        delete newData[fieldToRemove.name];
      }
      return { ...row, data: newData };
    }));
  };

  const addRow = () => {
    setRows([...rows, { id: Date.now().toString(), data: {} }]);
  };

  const removeRow = (rowId: string) => {
    // Don't allow removing if only 1 row left
    if (rows.length <= 1) return;
    setRows(rows.filter(r => r.id !== rowId));
  };

  const updateRowData = (rowId: string, fieldName: string, value: string) => {
    setRows(rows.map(row => {
      if (row.id === rowId) {
        return { ...row, data: { ...row.data, [fieldName]: value } };
      }
      return row;
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Validate that at least one row has data
      const validRows = rows.filter(row => Object.values(row.data).some(val => val.trim()));

      if (validRows.length === 0) {
        onShowToast('Please add at least one contact with data', 'error');
        setLoading(false);
        return;
      }

      // Prepare contacts for insertion
      const contactsToInsert = validRows.map(row => {
        // Extract standard fields
        const firstName = row.data['First Name'] || row.data['first_name'] || '';
        const lastName = row.data['Last Name'] || row.data['last_name'] || '';
        const companyName = row.data['Company Name'] || row.data['company_name'] || '';
        const phone = row.data['Phone'] || row.data['phone'] || row.data['Phone Number'] || row.data['phone_number'] || '';
        const email = row.data['Email'] || row.data['email'] || '';

        // Combine first and last name for contact_name
        const contactName = [firstName, lastName].filter(Boolean).join(' ').trim() || null;

        // Build custom_fields object from non-standard fields
        const customFields: Record<string, any> = {};
        const standardFieldNames = ['First Name', 'Last Name', 'Company Name', 'Phone', 'Email',
                                   'first_name', 'last_name', 'company_name', 'phone', 'email',
                                   'Phone Number', 'phone_number'];

        fields.forEach(field => {
          if (!standardFieldNames.includes(field.name)) {
            const value = row.data[field.name] || '';
            if (value) {
              customFields[field.name.toLowerCase().replace(/\s+/g, '_')] = value;
            }
          }
        });

        return {
          company_id: companyId,
          company_name: companyName || 'Unknown',
          contact_name: contactName,
          phone_number: phone,
          email: email || null,
          status: 'Pending',
          custom_fields: Object.keys(customFields).length > 0 ? customFields : null,
        };
      });

      const { error } = await supabase
        .from('contacts')
        .insert(contactsToInsert);

      if (error) throw error;

      onComplete();
      onClose();
    } catch (error) {
      console.error('Error saving contacts:', error);
      onShowToast('Failed to save contacts. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-md border border-slate-200 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 gradient-bg-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Add Contacts Manually</h2>
                <p className="text-sm text-slate-600 mt-0.5">Create custom fields and add multiple contacts</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Field Management */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Custom Fields</h3>
              <button
                onClick={() => setShowAddField(!showAddField)}
                className="btn-primary px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Field
              </button>
            </div>

            {showAddField && (
              <div className="gradient-bg-subtle border border-[var(--color-primary-200)] rounded-xl p-4 mb-4 animate-fadeIn">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    placeholder="Field name (e.g., Company, Address)"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none"
                    onKeyPress={(e) => e.key === 'Enter' && addField()}
                  />
                  <select
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value as any)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none"
                  >
                    <option value="text">Text</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                  </select>
                  <button
                    onClick={addField}
                    disabled={!newFieldName.trim()}
                    className="px-4 py-2 gradient-bg text-white rounded-lg disabled:opacity-50 transition-all font-medium"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddField(false);
                      setNewFieldName('');
                      setNewFieldType('text');
                    }}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-all font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {fields.map((field) => (
                <div
                  key={field.id}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm"
                >
                  <span className="font-semibold text-slate-900">{field.name}</span>
                  <span className="text-xs text-slate-500 px-2 py-0.5 bg-white rounded">
                    {field.type}
                  </span>
                  {fields.length > 1 && (
                    <button
                      onClick={() => removeField(field.id)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Contacts Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-12">
                      #
                    </th>
                    {fields.map((field) => (
                      <th key={field.id} className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                        {field.name}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-700 uppercase tracking-wider w-24">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {rows.map((row, index) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-semibold text-slate-500">
                        {index + 1}
                      </td>
                      {fields.map((field) => (
                        <td key={field.id} className="px-4 py-3">
                          <input
                            type={field.type}
                            value={row.data[field.name] || ''}
                            onChange={(e) => updateRowData(row.id, field.name, e.target.value)}
                            placeholder={`Enter ${field.name.toLowerCase()}`}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none text-sm"
                          />
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        {rows.length > 1 && (
                          <button
                            onClick={() => removeRow(row.id)}
                            className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition-all"
                            title="Remove row"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={addRow}
            className="mt-4 w-full px-4 py-3 border border-dashed border-[var(--color-primary)] text-[var(--color-primary)] rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2 font-semibold"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Another Contact
          </button>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn-secondary px-6 py-2.5 rounded-xl font-semibold disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2.5 gradient-bg text-white rounded-xl hover:shadow-md transition-all font-semibold disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save {rows.filter(r => Object.values(r.data).some(v => v.trim())).length} Contact{rows.filter(r => Object.values(r.data).some(v => v.trim())).length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
