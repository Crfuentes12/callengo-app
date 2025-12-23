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

  const supabase = createClient();

  // Load contact lists on mount
  useEffect(() => {
    loadContactLists();
  }, []);

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
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export contacts');
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

      await refreshContacts();
      setSelectedContactIds([]);
      setShowBatchActions(false);
      alert(`Moved ${selectedContactIds.length} contact(s) to list`);
    } catch (error) {
      alert('Failed to move contacts');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedContactIds.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedContactIds.length} contact(s)?`)) return;

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', selectedContactIds);

      if (error) throw error;

      await refreshContacts();
      setSelectedContactIds([]);
      alert(`Deleted ${selectedContactIds.length} contact(s)`);
    } catch (error) {
      alert('Failed to delete contacts');
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

  return (
    <div className="space-y-6">
      {/* Batch Actions Bar */}
      {selectedContactIds.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
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
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
                  <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Move to List</div>
                  <button
                    onClick={() => handleBatchMoveToList(null)}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Remove from all lists
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
                  <button
                    onClick={handleBatchDelete}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                  >
                    Delete selected contacts
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

          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 font-medium shadow-sm hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import CSV
          </button>
        </div>
      </div>

      <ContactsTable
        contacts={filteredContacts}
        onRefresh={refreshContacts}
        selectedContactIds={selectedContactIds}
        onSelectionChange={setSelectedContactIds}
      />

      {showImportModal && (
        <ImportModal
          companyId={companyId}
          onClose={() => setShowImportModal(false)}
          onComplete={handleImportComplete}
        />
      )}

      {showListManager && (
        <ListManagerModal
          companyId={companyId}
          lists={contactLists}
          onClose={() => setShowListManager(false)}
          onUpdate={loadContactLists}
        />
      )}
    </div>
  );
}

// List Manager Modal Component
interface ListManagerModalProps {
  companyId: string;
  lists: ContactList[];
  onClose: () => void;
  onUpdate: () => void;
}

function ListManagerModal({ companyId, lists, onClose, onUpdate }: ListManagerModalProps) {
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

      if (error) throw error;

      setNewListName('');
      setNewListDescription('');
      setNewListColor('#3b82f6');
      setShowCreateForm(false);
      onUpdate();
    } catch (error) {
      alert('Failed to create list');
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
    } catch (error) {
      alert('Failed to update list');
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
    } catch (error) {
      alert('Failed to delete list');
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