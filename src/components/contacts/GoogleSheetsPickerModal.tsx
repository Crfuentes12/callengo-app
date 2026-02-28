// components/contacts/GoogleSheetsPickerModal.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { GoogleSheetsIcon } from '@/components/icons/BrandIcons';

interface SpreadsheetInfo {
  id: string;
  name: string;
  modifiedTime: string;
  webViewLink?: string;
  owners?: string[];
}

interface SheetTab {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

interface SheetData {
  headers: string[];
  rows: string[][];
  sheetTitle: string;
  totalRows: number;
}

interface GoogleSheetsPickerModalProps {
  onClose: () => void;
  onDataReady: (headers: string[], rows: string[][]) => void;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

type PickerStep = 'spreadsheets' | 'tabs' | 'loading-data';

export default function GoogleSheetsPickerModal({
  onClose,
  onDataReady,
  onShowToast,
}: GoogleSheetsPickerModalProps) {
  const [step, setStep] = useState<PickerStep>('spreadsheets');
  const [loading, setLoading] = useState(true);
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetInfo[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [selectedSpreadsheet, setSelectedSpreadsheet] = useState<SpreadsheetInfo | null>(null);
  const [tabs, setTabs] = useState<SheetTab[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  // Load spreadsheets on mount
  useEffect(() => {
    fetchSpreadsheets();
  }, []);

  const fetchSpreadsheets = async (pageToken?: string) => {
    try {
      if (pageToken) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const url = pageToken
        ? `/api/integrations/google-sheets/spreadsheets?pageToken=${pageToken}`
        : '/api/integrations/google-sheets/spreadsheets';

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load spreadsheets');
      }

      if (pageToken) {
        setSpreadsheets((prev) => [...prev, ...data.files]);
      } else {
        setSpreadsheets(data.files);
      }
      setNextPageToken(data.nextPageToken);
    } catch (error) {
      onShowToast?.(`Error: ${(error as Error).message}`, 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSelectSpreadsheet = async (spreadsheet: SpreadsheetInfo) => {
    setSelectedSpreadsheet(spreadsheet);
    setStep('tabs');
    setLoading(true);

    try {
      const response = await fetch(
        `/api/integrations/google-sheets/spreadsheets?spreadsheetId=${spreadsheet.id}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load sheet tabs');
      }

      setTabs(data.sheets);

      // If only one tab, auto-select it
      if (data.sheets.length === 1) {
        handleSelectTab(spreadsheet.id, data.sheets[0]);
        return;
      }
    } catch (error) {
      onShowToast?.(`Error: ${(error as Error).message}`, 'error');
      setStep('spreadsheets');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTab = async (spreadsheetId: string, tab: SheetTab) => {
    setStep('loading-data');
    setLoading(true);

    try {
      const response = await fetch(
        `/api/integrations/google-sheets/sheet-data?spreadsheetId=${spreadsheetId}&sheetTitle=${encodeURIComponent(tab.title)}`
      );
      const data: SheetData = await response.json();

      if (!response.ok) {
        throw new Error((data as unknown as { error: string }).error || 'Failed to load sheet data');
      }

      if (data.headers.length === 0 || data.rows.length === 0) {
        onShowToast?.('The selected sheet is empty or has no data rows.', 'error');
        setStep('tabs');
        setLoading(false);
        return;
      }

      // Pass data back to parent (ImportModal flow)
      onDataReady(data.headers, data.rows);
    } catch (error) {
      onShowToast?.(`Error: ${(error as Error).message}`, 'error');
      setStep('tabs');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = useCallback((dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }, []);

  const filteredSpreadsheets = searchTerm
    ? spreadsheets.filter((s) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : spreadsheets;

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200/50 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                <GoogleSheetsIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {step === 'spreadsheets' && 'Select a Spreadsheet'}
                  {step === 'tabs' && (selectedSpreadsheet?.name || 'Select a Sheet')}
                  {step === 'loading-data' && 'Loading Data...'}
                </h2>
                <p className="text-xs text-slate-500">
                  {step === 'spreadsheets' && 'Choose from your Google Sheets'}
                  {step === 'tabs' && 'Select which tab to import from'}
                  {step === 'loading-data' && 'Reading spreadsheet data...'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-white hover:bg-red-600 hover:border-red-500 transition-all duration-300 flex items-center justify-center group"
            >
              <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Spreadsheets List */}
          {step === 'spreadsheets' && (
            <div>
              {/* Search */}
              <div className="p-4 pb-2 sticky top-0 bg-white z-10">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search spreadsheets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                    autoFocus
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-500">Loading your spreadsheets...</p>
                  </div>
                </div>
              ) : filteredSpreadsheets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                    <GoogleSheetsIcon className="w-7 h-7 opacity-50" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">
                    {searchTerm ? 'No matching spreadsheets' : 'No spreadsheets found'}
                  </p>
                  <p className="text-xs text-slate-500 text-center">
                    {searchTerm
                      ? 'Try a different search term'
                      : 'Create a spreadsheet in Google Sheets first'}
                  </p>
                </div>
              ) : (
                <div className="px-4 pb-4">
                  <div className="space-y-1">
                    {filteredSpreadsheets.map((sheet) => (
                      <button
                        key={sheet.id}
                        onClick={() => handleSelectSpreadsheet(sheet)}
                        className="w-full px-3 py-3 text-left rounded-xl hover:bg-slate-50 transition-all flex items-center gap-3 group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 group-hover:border-green-300 group-hover:bg-green-50 transition-colors">
                          <GoogleSheetsIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {sheet.name}
                          </p>
                          <p className="text-xs text-slate-500 flex items-center gap-2">
                            <span>{formatDate(sheet.modifiedTime)}</span>
                            {sheet.owners && sheet.owners.length > 0 && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className="truncate">{sheet.owners[0]}</span>
                              </>
                            )}
                          </p>
                        </div>
                        <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>

                  {/* Load More */}
                  {nextPageToken && !searchTerm && (
                    <button
                      onClick={() => fetchSpreadsheets(nextPageToken)}
                      disabled={loadingMore}
                      className="w-full mt-3 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loadingMore ? (
                        <>
                          <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                          Loading...
                        </>
                      ) : (
                        'Load More Spreadsheets'
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab Selection */}
          {step === 'tabs' && (
            <div className="p-4">
              {/* Back button */}
              <button
                onClick={() => {
                  setStep('spreadsheets');
                  setSelectedSpreadsheet(null);
                  setTabs([]);
                }}
                className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to spreadsheets
              </button>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-500">Loading sheet tabs...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    {tabs.length} {tabs.length === 1 ? 'Sheet' : 'Sheets'} found
                  </p>
                  {tabs.map((tab) => (
                    <button
                      key={tab.sheetId}
                      onClick={() =>
                        selectedSpreadsheet &&
                        handleSelectTab(selectedSpreadsheet.id, tab)
                      }
                      className="w-full px-4 py-3.5 text-left rounded-xl border border-slate-200 hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/5 transition-all flex items-center gap-3 group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0 transition-colors">
                        <svg className="w-4 h-4 text-slate-500 group-hover:text-[var(--color-primary)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{tab.title}</p>
                        <p className="text-xs text-slate-500">
                          {tab.rowCount > 0 ? `~${tab.rowCount.toLocaleString()} rows` : 'Empty'} · {tab.columnCount} columns
                        </p>
                      </div>
                      <svg className="w-4 h-4 text-slate-300 group-hover:text-[var(--color-primary)] transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Loading Data */}
          {step === 'loading-data' && (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 border-3 border-[var(--color-primary)]/20 rounded-full" />
                  <div className="absolute inset-0 w-12 h-12 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700">Reading spreadsheet data...</p>
                  <p className="text-xs text-slate-500 mt-1">This may take a moment for large sheets</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
