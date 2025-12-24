// components/contacts/ContactsManager.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Contact as ContactType } from '@/types/call-agent';
import { ContactList } from '@/types/supabase';
import ContactsTable from './ContactsTable';
import ImportModal from './ImportModal';

interface ContactsManagerProps {
  initialContacts: any[];
  companyId: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function ContactsManager({ initialContacts, companyId }: ContactsManagerProps) {
  const [contacts, setContacts] = useState<ContactType[]>(initialContacts as ContactType[]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [selectedListFilter, setSelectedListFilter] = useState<string>('all');
  const [showListManager, setShowListManager] = useState(false);
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [showAddContactsDropdown, setShowAddContactsDropdown] = useState(false);
  const [showManualAddModal, setShowManualAddModal] = useState(false);
  const [importType, setImportType] = useState<'csv' | 'xlsx' | 'google' | 'txt' | 'xml' | 'json' | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const supabase = createClient();

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 4000);
  };

  // Load contact lists on mount
  useEffect(() => {
    loadContactLists();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.add-contacts-dropdown') && showAddContactsDropdown) {
        setShowAddContactsDropdown(false);
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
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    
    if (data) setContacts(data as ContactType[]);
  };

  const handleImportComplete = () => {
    refreshContacts();
    setShowImportModal(false);
    setImportType(null);
  };

  const handleImportTypeSelect = (type: 'csv' | 'xlsx' | 'google' | 'txt' | 'xml' | 'json') => {
    setImportType(type);
    setShowImportModal(true);
    setShowAddContactsDropdown(false);
  };

  const handleManualAdd = () => {
    setShowManualAddModal(true);
    setShowAddContactsDropdown(false);
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/contacts/export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('Contacts exported successfully', 'success');
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

    if (!confirm(`Are you sure you want to delete ${selectedContactIds.length} contact(s)?`)) return;

    try {
      const count = selectedContactIds.length;
      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', selectedContactIds);

      if (error) throw error;

      await refreshContacts();
      setSelectedContactIds([]);
      showToast(`Deleted ${count} contact${count > 1 ? 's' : ''} successfully`, 'success');
    } catch (error) {
      showToast('Failed to delete contacts', 'error');
    }
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch =
      contact.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone_number.includes(searchTerm) ||
      (contact.city && contact.city.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || contact.status === statusFilter;

    const matchesList = selectedListFilter === 'all'
      ? true
      : selectedListFilter === 'none'
      ? !contact.list_id
      : contact.list_id === selectedListFilter;

    return matchesSearch && matchesStatus && matchesList;
  });

  const handleQuickFilterClick = (listId: string) => {
    if (selectedListFilter === listId) {
      setSelectedListFilter('all');
    } else {
      setSelectedListFilter(listId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Filters - List Badges */}
      {contactLists.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-slate-600">Quick Filters:</span>
            <button
              onClick={() => setSelectedListFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-all ${
                selectedListFilter === 'all'
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-md scale-105'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
              }`}
            >
              All Contacts ({contacts.length})
            </button>
            <button
              onClick={() => setSelectedListFilter('none')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-all ${
                selectedListFilter === 'none'
                  ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-md scale-105'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
              }`}
            >
              No List ({contacts.filter(c => !c.list_id).length})
            </button>
            {contactLists.map((list) => {
              const listContactCount = contacts.filter(c => c.list_id === list.id).length;
              const listColor = list.color || '#3b82f6';
              return (
                <button
                  key={list.id}
                  onClick={() => handleQuickFilterClick(list.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-all ${
                    selectedListFilter === list.id
                      ? 'shadow-md scale-105'
                      : 'hover:scale-105 hover:shadow-md'
                  }`}
                  style={{
                    backgroundColor: selectedListFilter === list.id ? `${listColor}25` : `${listColor}10`,
                    borderColor: listColor,
                    color: selectedListFilter === list.id ? listColor : `${listColor}cc`
                  }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: listColor }}></div>
                  {list.name}
                  <span className="ml-1 px-1.5 py-0.5 bg-white/50 rounded text-xs font-bold">
                    {listContactCount}
                  </span>
                </button>
              );
            })}
            {/* Add New List Button */}
            <button
              onClick={() => setShowListManager(true)}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all"
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
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between animate-slideDown">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-indigo-900">
              {selectedContactIds.length} contact{selectedContactIds.length > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setSelectedContactIds([])}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Clear selection
            </button>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <button
                onClick={() => setShowBatchActions(!showBatchActions)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-2 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Actions
              </button>
              {showBatchActions && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
                  <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Add to List</div>
                  <button
                    onClick={() => setShowListManager(true)}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 transition-colors flex items-center gap-2"
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

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:w-auto">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-900 placeholder-slate-400"
            />
          </div>
        </div>

        <div className="flex gap-3 w-full sm:w-auto flex-wrap">
          <select
            value={selectedListFilter}
            onChange={(e) => setSelectedListFilter(e.target.value)}
            className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-700 cursor-pointer"
          >
            <option value="all">All Lists</option>
            <option value="none">No List</option>
            {contactLists.map((list) => (
              <option key={list.id} value={list.id}>{list.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-700 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Calling">Calling</option>
            <option value="Fully Verified">Verified</option>
            <option value="For Callback">For Callback</option>
          </select>

          <button
            onClick={() => setShowListManager(true)}
            className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2 font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Manage Lists
          </button>

          <button
            onClick={handleExport}
            disabled={contacts.length === 0}
            className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>

          <div className="relative add-contacts-dropdown">
            <button
              onClick={() => setShowAddContactsDropdown(!showAddContactsDropdown)}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 font-medium shadow-sm hover:shadow-md"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Contacts
              <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showAddContactsDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border-2 border-indigo-100 py-2 z-50 animate-fadeIn">
                <div className="px-3 py-2 text-xs font-black text-indigo-600 uppercase tracking-wider border-b border-slate-100">
                  Add Method
                </div>
                <button
                  onClick={handleManualAdd}
                  className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-indigo-50 transition-colors flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">Add Manually</div>
                    <div className="text-xs text-slate-500">Create custom fields</div>
                  </div>
                </button>
                <div className="border-t border-slate-100 my-2"></div>
                <div className="px-3 py-2 text-xs font-black text-slate-500 uppercase tracking-wider">
                  Import From File
                </div>
                <button
                  onClick={() => handleImportTypeSelect('csv')}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
                >
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium">Import CSV</span>
                </button>
                <button
                  onClick={() => handleImportTypeSelect('xlsx')}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
                >
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="font-medium">Import XLSX</span>
                </button>
                <button
                  onClick={() => handleImportTypeSelect('txt')}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
                >
                  <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium">Import TXT</span>
                </button>
                <button
                  onClick={() => handleImportTypeSelect('xml')}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
                >
                  <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  <span className="font-medium">Import XML</span>
                </button>
                <button
                  onClick={() => handleImportTypeSelect('json')}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
                >
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span className="font-medium">Import JSON</span>
                </button>
                <div className="border-t border-slate-100 my-2"></div>
                <button
                  onClick={() => handleImportTypeSelect('google')}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
                >
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="font-medium">Import from Google Sheets</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ContactsTable
        contacts={filteredContacts}
        onRefresh={refreshContacts}
        selectedContactIds={selectedContactIds}
        onSelectionChange={setSelectedContactIds}
        contactLists={contactLists}
        onListClick={handleQuickFilterClick}
      />

      {showImportModal && (
        <ImportModal
          companyId={companyId}
          onClose={() => {
            setShowImportModal(false);
            setImportType(null);
          }}
          onComplete={handleImportComplete}
          importType={importType}
        />
      )}

      {showManualAddModal && (
        <ManualAddModal
          companyId={companyId}
          onClose={() => setShowManualAddModal(false)}
          onComplete={handleImportComplete}
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

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border-2 backdrop-blur-sm animate-slideUp ${
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
    if (!confirm('Are you sure you want to delete this list? Contacts in this list will not be deleted, but will be removed from the list.')) return;

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
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] shadow-2xl border border-slate-200/50 flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Manage Contact Lists</h2>
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
              className="w-full p-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2 font-medium mb-6"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New List
            </button>
          ) : (
            <div className="border-2 border-indigo-200 rounded-xl p-5 bg-indigo-50/50 mb-6">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Create New List</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">List Name</label>
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="e.g., Summer Campaign 2025"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description (Optional)</label>
                  <input
                    type="text"
                    value={newListDescription}
                    onChange={(e) => setNewListDescription(e.target.value)}
                    placeholder="Brief description..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
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
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium"
                  >
                    {loading ? 'Creating...' : 'Create List'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Existing Lists */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Existing Lists ({lists.length})</h3>
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
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-semibold"
                      />
                      <input
                        type="text"
                        value={editingList.description || ''}
                        onChange={(e) => setEditingList({ ...editingList, description: e.target.value })}
                        placeholder="Description..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
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
                          className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all text-sm font-medium"
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
                          className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-all"
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
    </div>
  );
}

// Manual Add Modal Component
interface ManualAddModalProps {
  companyId: string;
  onClose: () => void;
  onComplete: () => void;
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

function ManualAddModal({ companyId, onClose, onComplete }: ManualAddModalProps) {
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
        alert('Please add at least one contact with data');
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
      alert('Failed to save contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl border-2 border-indigo-100 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">Add Contacts Manually</h2>
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
              <h3 className="text-lg font-bold text-slate-900">Custom Fields</h3>
              <button
                onClick={() => setShowAddField(!showAddField)}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-2 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Field
              </button>
            </div>

            {showAddField && (
              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4 mb-4 animate-fadeIn">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    placeholder="Field name (e.g., Company, Address)"
                    className="flex-1 px-3 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    onKeyPress={(e) => e.key === 'Enter' && addField()}
                  />
                  <select
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value as any)}
                    className="px-3 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
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
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all font-medium"
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
          <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-black text-slate-700 uppercase tracking-wider w-12">
                      #
                    </th>
                    {fields.map((field) => (
                      <th key={field.id} className="px-4 py-3 text-left text-xs font-black text-slate-700 uppercase tracking-wider">
                        {field.name}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-black text-slate-700 uppercase tracking-wider w-24">
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
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
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
            className="mt-4 w-full px-4 py-3 border-2 border-dashed border-indigo-300 text-indigo-600 rounded-xl hover:bg-indigo-50 hover:border-indigo-400 transition-all flex items-center justify-center gap-2 font-semibold"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Another Contact
          </button>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2.5 bg-white border-2 border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all font-semibold disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-xl transition-all font-semibold disabled:opacity-50 flex items-center gap-2"
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