// components/contacts/ContactsTable.tsx
'use client';

import { useState } from 'react';
import { Contact } from '@/types/call-agent';
import { formatPhoneForDisplay, getStatusColor } from '@/lib/call-agent-utils';
import ContactDetailModal from './ContactDetailModal';

interface ContactsTableProps {
  contacts: Contact[];
  onRefresh: () => void;
  selectedContactIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  contactLists?: any[];
  onListClick?: (listId: string) => void;
}

export default function ContactsTable({
  contacts,
  onRefresh,
  selectedContactIds = [],
  onSelectionChange,
  contactLists = [],
  onListClick
}: ContactsTableProps) {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    address: false,
    zipCode: false,
    tags: false,
    lastCallDate: false,
    callAttempts: false,
  });

  const getListForContact = (listId: string | null) => {
    if (!listId) return null;
    return contactLists.find(list => list.id === listId);
  };

  const handleSelectAll = (checked: boolean) => {
    if (onSelectionChange) {
      onSelectionChange(checked ? contacts.map(c => c.id) : []);
    }
  };

  const handleSelectOne = (contactId: string, checked: boolean) => {
    if (onSelectionChange) {
      const newSelection = checked
        ? [...selectedContactIds, contactId]
        : selectedContactIds.filter(id => id !== contactId);
      onSelectionChange(newSelection);
    }
  };

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  const allSelected = contacts.length > 0 && selectedContactIds.length === contacts.length;
  const someSelected = selectedContactIds.length > 0 && selectedContactIds.length < contacts.length;

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/80">
              <tr>
                {onSelectionChange && (
                  <th className="px-6 py-3.5 w-12">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={input => {
                        if (input) input.indeterminate = someSelected;
                      }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-[var(--color-primary)] bg-white border-slate-300 rounded focus:ring-[var(--color-primary)] focus:ring-2 cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
                {visibleColumns.address && (
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Address</th>
                )}
                {visibleColumns.zipCode && (
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Zip</th>
                )}
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">List</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                {visibleColumns.tags && (
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tags</th>
                )}
                {visibleColumns.lastCallDate && (
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Call</th>
                )}
                {visibleColumns.callAttempts && (
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Attempts</th>
                )}
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                <th className="px-6 py-3.5 w-12 relative">
                  <button
                    onClick={() => setShowColumnMenu(!showColumnMenu)}
                    className="w-8 h-8 rounded-lg hover:bg-slate-200 transition-all flex items-center justify-center text-slate-500 hover:text-slate-700"
                    title="Show/hide columns"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  {showColumnMenu && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
                      <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">Toggle Columns</div>
                      {Object.entries({
                        address: 'Address',
                        zipCode: 'Zip Code',
                        tags: 'Tags',
                        lastCallDate: 'Last Call Date',
                        callAttempts: 'Call Attempts',
                      }).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => toggleColumn(key as keyof typeof visibleColumns)}
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3"
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                            visibleColumns[key as keyof typeof visibleColumns]
                              ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                              : 'border-slate-300'
                          }`}>
                            {visibleColumns[key as keyof typeof visibleColumns] && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contacts.map((contact) => (
                <tr key={contact.id} className={`hover:bg-slate-50/50 transition-colors ${selectedContactIds.includes(contact.id) ? 'bg-[var(--color-primary)]/5' : ''}`}>
                  {onSelectionChange && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedContactIds.includes(contact.id)}
                        onChange={(e) => handleSelectOne(contact.id, e.target.checked)}
                        className="w-4 h-4 text-[var(--color-primary)] bg-white border-slate-300 rounded focus:ring-[var(--color-primary)] focus:ring-2 cursor-pointer"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{contact.company_name}</span>
                      {contact.is_test_call && (
                        <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 text-xs font-medium rounded-md border border-amber-200">Test</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">
                    {formatPhoneForDisplay(contact.phone_number)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {contact.city}{contact.state ? `, ${contact.state}` : ''}
                  </td>
                  {visibleColumns.address && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {contact.address || <span className="text-slate-300">—</span>}
                    </td>
                  )}
                  {visibleColumns.zipCode && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {contact.zip_code || <span className="text-slate-300">—</span>}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-lg border ${getStatusColor(contact.status)}`}>
                      {contact.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      const list = getListForContact(contact.list_id);
                      return list ? (
                        <button
                          onClick={() => onListClick && onListClick(list.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all hover:shadow-md"
                          style={{
                            backgroundColor: `${list.color}15`,
                            borderColor: list.color,
                            color: list.color
                          }}
                        >
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: list.color }}></div>
                          {list.name}
                        </button>
                      ) : (
                        <span className="text-slate-300 text-xs">No list</span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {contact.contact_name || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {contact.email || <span className="text-slate-300">—</span>}
                  </td>
                  {visibleColumns.tags && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {contact.tags && contact.tags.length > 0 ? (
                        <div className="flex gap-1">
                          {contact.tags.slice(0, 2).map((tag, i) => (
                            <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-md">{tag}</span>
                          ))}
                          {contact.tags.length > 2 && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-md">+{contact.tags.length - 2}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  )}
                  {visibleColumns.lastCallDate && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {contact.last_call_date ? new Date(contact.last_call_date).toLocaleDateString() : <span className="text-slate-300">—</span>}
                    </td>
                  )}
                  {visibleColumns.callAttempts && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {contact.call_attempts}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => setSelectedContact(contact)}
                      className="px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/5 rounded-lg hover:bg-[var(--color-primary)]/10 transition-all border border-[var(--color-primary)]/10 hover:border-[var(--color-primary)]/20"
                    >
                      View Details
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {contacts.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-slate-700 font-semibold">No contacts found</p>
            <p className="text-sm text-slate-500 mt-1">Import a CSV file to get started</p>
          </div>
        )}
      </div>

      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}