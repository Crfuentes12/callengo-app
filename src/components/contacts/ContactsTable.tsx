// components/contacts/ContactsTable.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Contact } from '@/types/call-agent';
import { formatPhoneForDisplay, getStatusColor } from '@/lib/call-agent-utils';

export type SortField = 'created_at' | 'updated_at' | 'company_name' | 'contact_name' | 'email' | 'phone_number' | 'status' | 'city' | 'call_attempts' | 'last_call_date' | 'source';
export type SortOrder = 'asc' | 'desc';

interface ContactsTableProps {
  contacts: Contact[];
  selectedContactIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  contactLists: { id: string; name: string; color: string | null }[];
  onListClick: (listId: string) => void;
  onContactClick: (contact: Contact) => void;
  sortBy: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  isLoading?: boolean;
  // Pagination
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

function SortIcon({ field, currentSort, currentOrder }: { field: SortField; currentSort: SortField; currentOrder: SortOrder }) {
  const isActive = field === currentSort;
  return (
    <span className={`inline-flex ml-1 ${isActive ? 'text-[var(--color-primary)]' : 'text-slate-300 group-hover:text-slate-400'}`}>
      {isActive && currentOrder === 'asc' ? (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
      ) : isActive && currentOrder === 'desc' ? (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
      ) : (
        <svg className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
      )}
    </span>
  );
}

export default function ContactsTable({
  contacts,
  selectedContactIds,
  onSelectionChange,
  contactLists,
  onListClick,
  onContactClick,
  sortBy,
  sortOrder,
  onSort,
  isLoading,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: ContactsTableProps) {
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLTableCellElement>(null);
  const [visibleColumns, setVisibleColumns] = useState({
    address: false,
    zipCode: false,
    lastCallDate: true,
    callAttempts: false,
    source: false,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setShowColumnMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getListForContact = (listId: string | null) => {
    if (!listId) return null;
    return contactLists.find(list => list.id === listId);
  };

  const handleSelectAll = (checked: boolean) => {
    onSelectionChange(checked ? contacts.map(c => c.id) : []);
  };

  const handleSelectOne = (contactId: string, checked: boolean) => {
    const newSelection = checked
      ? [...selectedContactIds, contactId]
      : selectedContactIds.filter(id => id !== contactId);
    onSelectionChange(newSelection);
  };

  const allSelected = contacts.length > 0 && contacts.every(c => selectedContactIds.includes(c.id));
  const someSelected = contacts.some(c => selectedContactIds.includes(c.id)) && !allSelected;

  const SortableHeader = ({ field, children, className = '' }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none group hover:bg-slate-100/80 transition-colors ${className}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center">
        {children}
        <SortIcon field={field} currentSort={sortBy} currentOrder={sortOrder} />
      </span>
    </th>
  );

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50/80 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 w-12">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={input => { if (input) input.indeterminate = someSelected; }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 text-[var(--color-primary)] bg-white border-slate-300 rounded focus:ring-[var(--color-primary)] focus:ring-2 cursor-pointer"
                />
              </th>
              <SortableHeader field="company_name">Company</SortableHeader>
              <SortableHeader field="phone_number">Phone</SortableHeader>
              <SortableHeader field="city">Location</SortableHeader>
              {visibleColumns.address && <SortableHeader field="city">Address</SortableHeader>}
              {visibleColumns.zipCode && <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Zip</th>}
              <SortableHeader field="status">Status</SortableHeader>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">List</th>
              <SortableHeader field="contact_name">Contact</SortableHeader>
              <SortableHeader field="email">Email</SortableHeader>
              {visibleColumns.lastCallDate && <SortableHeader field="last_call_date">Last Call</SortableHeader>}
              {visibleColumns.callAttempts && <SortableHeader field="call_attempts">Attempts</SortableHeader>}
              {visibleColumns.source && <SortableHeader field="source">Source</SortableHeader>}
              <th className="px-4 py-3 w-12 relative" ref={columnMenuRef}>
                <button
                  onClick={() => setShowColumnMenu(!showColumnMenu)}
                  className="w-7 h-7 rounded-lg hover:bg-slate-200 transition-all flex items-center justify-center text-slate-400 hover:text-slate-600"
                  title="Show/hide columns"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
                {showColumnMenu && (
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-50">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Toggle Columns</div>
                    {Object.entries({
                      address: 'Address',
                      zipCode: 'Zip Code',
                      lastCallDate: 'Last Call Date',
                      callAttempts: 'Call Attempts',
                      source: 'Source',
                    }).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
                        className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2.5"
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                          visibleColumns[key as keyof typeof visibleColumns]
                            ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                            : 'border-slate-300'
                        }`}>
                          {visibleColumns[key as keyof typeof visibleColumns] && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-xs">{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
              Array.from({ length: pageSize > 10 ? 10 : pageSize }, (_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3.5"><div className="w-4 h-4 bg-slate-200 rounded" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 w-32 bg-slate-200 rounded" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 w-28 bg-slate-200 rounded" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 w-24 bg-slate-200 rounded" /></td>
                  <td className="px-4 py-3.5"><div className="h-5 w-20 bg-slate-200 rounded-lg" /></td>
                  <td className="px-4 py-3.5"><div className="h-5 w-16 bg-slate-200 rounded-lg" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 w-20 bg-slate-200 rounded" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 w-28 bg-slate-200 rounded" /></td>
                  {visibleColumns.lastCallDate && <td className="px-4 py-3.5"><div className="h-4 w-20 bg-slate-200 rounded" /></td>}
                  {visibleColumns.callAttempts && <td className="px-4 py-3.5"><div className="h-4 w-8 bg-slate-200 rounded" /></td>}
                  {visibleColumns.source && <td className="px-4 py-3.5"><div className="h-4 w-16 bg-slate-200 rounded" /></td>}
                  <td className="px-4 py-3.5" />
                </tr>
              ))
            ) : (
              contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${selectedContactIds.includes(contact.id) ? 'bg-[var(--color-primary-50)]/40' : ''}`}
                  onClick={(e) => {
                    // Don't trigger on checkbox click
                    if ((e.target as HTMLElement).closest('input[type="checkbox"]') || (e.target as HTMLElement).closest('button')) return;
                    onContactClick(contact);
                  }}
                >
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedContactIds.includes(contact.id)}
                      onChange={(e) => handleSelectOne(contact.id, e.target.checked)}
                      className="w-4 h-4 text-[var(--color-primary)] bg-white border-slate-300 rounded focus:ring-[var(--color-primary)] focus:ring-2 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                        {(contact.company_name || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-slate-900 truncate block max-w-[180px]">{contact.company_name}</span>
                        {contact.is_test_call && (
                          <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-medium rounded border border-amber-200">Test</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 font-mono text-xs">
                    {formatPhoneForDisplay(contact.phone_number)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                    {contact.city ? `${contact.city}${contact.state ? `, ${contact.state}` : ''}` : <span className="text-slate-300">—</span>}
                  </td>
                  {visibleColumns.address && (
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 max-w-[200px] truncate">
                      {contact.address || <span className="text-slate-300">—</span>}
                    </td>
                  )}
                  {visibleColumns.zipCode && (
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                      {contact.zip_code || <span className="text-slate-300">—</span>}
                    </td>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-0.5 text-[11px] font-semibold rounded-md border ${getStatusColor(contact.status)}`}>
                      {contact.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {(() => {
                      const list = getListForContact(contact.list_id);
                      return list ? (
                        <button
                          onClick={() => onListClick(list.id)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md border transition-all hover:shadow-sm"
                          style={{
                            backgroundColor: `${list.color}12`,
                            borderColor: `${list.color}40`,
                            color: list.color || undefined,
                          }}
                        >
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: list.color || undefined }}></div>
                          {list.name}
                        </button>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                    {contact.contact_name || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 max-w-[180px] truncate">
                    {contact.email || <span className="text-slate-300">—</span>}
                  </td>
                  {visibleColumns.lastCallDate && (
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                      {contact.last_call_date ? new Date(contact.last_call_date).toLocaleDateString() : <span className="text-slate-300">—</span>}
                    </td>
                  )}
                  {visibleColumns.callAttempts && (
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-center">
                      {contact.call_attempts || 0}
                    </td>
                  )}
                  {visibleColumns.source && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      {contact.source ? (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded font-medium capitalize">{contact.source}</span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap" />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {!isLoading && contacts.length === 0 && (
        <div className="text-center py-16">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-slate-700 font-semibold">No contacts found</p>
          <p className="text-sm text-slate-500 mt-1">Try adjusting your filters or import contacts</p>
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-700">{from.toLocaleString()}</span>–<span className="font-semibold text-slate-700">{to.toLocaleString()}</span> of <span className="font-semibold text-slate-700">{total.toLocaleString()}</span>
            </span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-600 cursor-pointer focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] outline-none"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={200}>200 / page</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(1)}
              disabled={page <= 1}
              className="px-2 py-1 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
            </button>
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-2 py-1 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            {/* Page numbers */}
            {(() => {
              const pages: (number | string)[] = [];
              const maxVisible = 5;
              if (totalPages <= maxVisible + 2) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                const start = Math.max(2, page - 1);
                const end = Math.min(totalPages - 1, page + 1);
                if (start > 2) pages.push('...');
                for (let i = start; i <= end; i++) pages.push(i);
                if (end < totalPages - 1) pages.push('...');
                pages.push(totalPages);
              }
              return pages.map((p, i) =>
                typeof p === 'string' ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-slate-400 text-xs">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => onPageChange(p)}
                    className={`min-w-[28px] px-1.5 py-1 text-xs rounded-md border transition-all ${
                      p === page
                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:bg-white'
                    }`}
                  >
                    {p}
                  </button>
                )
              );
            })()}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-2 py-1 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={page >= totalPages}
              className="px-2 py-1 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
