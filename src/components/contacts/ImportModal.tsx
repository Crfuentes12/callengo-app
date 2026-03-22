// components/contacts/ImportModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n';
import { parseCSV, detectColumnMapping } from '@/lib/call-agent-utils';
import { parseFile } from '@/lib/import-parsers';
import { ColumnMapping } from '@/types/call-agent';
import { createClient } from '@/lib/supabase/client';
import { ContactList } from '@/types/supabase';
import { phContactEvents } from '@/lib/posthog';

interface ImportModalProps {
  companyId: string;
  onClose: () => void;
  onComplete: () => void;
  importType?: 'csv' | 'xlsx' | 'google' | 'txt' | 'xml' | 'json' | null;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  preloadedData?: { headers: string[]; rows: string[][] };
}

type ImportStep = 'upload' | 'list-select' | 'mapping' | 'preview' | 'complete';

const getImportTypeInfo = (type?: 'csv' | 'xlsx' | 'google' | 'txt' | 'xml' | 'json' | null) => {
  switch (type) {
    case 'csv':
      return { title: 'Import CSV', accept: '.csv', icon: 'table' };
    case 'xlsx':
      return { title: 'Import XLSX', accept: '.xlsx,.xls', icon: 'table' };
    case 'google':
      return { title: 'Import from Google Sheets', accept: '', icon: 'cloud' };
    case 'txt':
      return { title: 'Import TXT', accept: '.txt', icon: 'document' };
    case 'xml':
      return { title: 'Import XML', accept: '.xml', icon: 'code' };
    case 'json':
      return { title: 'Import JSON', accept: '.json', icon: 'code' };
    default:
      return { title: 'Import Contacts', accept: '.csv', icon: 'table' };
  }
};

export default function ImportModal({ companyId, onClose, onComplete, importType, onShowToast, preloadedData }: ImportModalProps) {
  const { t } = useTranslation();
  const typeInfo = getImportTypeInfo(importType);
  const supabase = createClient();
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    companyName: null,
    firstName: null,
    lastName: null,
    contactName: null,
    address: null,
    city: null,
    state: null,
    zipCode: null,
    phoneNumber: null,
    email: null,
    extraFields: {},
  });
  const [showExtraFields, setShowExtraFields] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [showCreateList, setShowCreateList] = useState(false);
  const importStartTimeRef = useRef<number>(Date.now());
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');

  // Load contact lists on mount
  useEffect(() => {
    loadContactLists();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on mount
  }, []);

  // Handle preloaded data from Google Sheets picker
  useEffect(() => {
    if (preloadedData && preloadedData.headers.length > 0) {
      setHeaders(preloadedData.headers);
      setRows(preloadedData.rows);
      const suggestedMapping = detectColumnMapping(preloadedData.headers);
      setMapping(suggestedMapping);
      setStep('list-select');
    }
  }, [preloadedData]);

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

  const handleCreateList = async () => {
    if (!newListName.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contact_lists')
        .insert({
          company_id: companyId,
          name: newListName.trim(),
          description: newListDescription.trim() || null,
          color: '#3b82f6',
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setContactLists([...contactLists, data]);
        setSelectedListId(data.id);
        setNewListName('');
        setNewListDescription('');
        setShowCreateList(false);
      }
    } catch {
      onShowToast?.('Failed to create list', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSheetImport = async () => {
    if (!googleSheetUrl.trim()) {
      onShowToast?.('Please enter a Google Sheets URL', 'error');
      return;
    }

    setLoading(true);
    try {
      // Extract sheet ID from URL
      const urlPattern = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
      const match = googleSheetUrl.match(urlPattern);

      if (!match) {
        throw new Error('Invalid Google Sheets URL. Please check the URL and try again.');
      }

      const sheetId = match[1];

      // Use Google Sheets API v4 public endpoint to fetch CSV export
      // Note: Sheet must be publicly accessible (view permissions for "Anyone with the link")
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

      const response = await fetch(csvUrl);

      if (!response.ok) {
        throw new Error('Failed to fetch Google Sheet. Make sure the sheet is publicly accessible (Anyone with link can view).');
      }

      const csvText = await response.text();

      // Parse CSV
      const parsed = parseCSV(csvText);

      setHeaders(parsed.headers);
      setRows(parsed.rows);

      const suggestedMapping = detectColumnMapping(parsed.headers);
      setMapping(suggestedMapping);

      setStep('list-select');
    } catch (error) {
      console.error('Google Sheets import error:', error);
      phContactEvents.importValidationError('google_sheets_parse_error');
      onShowToast?.(`Failed to import from Google Sheets: ${(error as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (uploadedFile: File) => {
    setLoading(true);
    try {
      let parsedHeaders: string[];
      let parsedRows: string[][];

      // Determine file type from importType or file extension
      const fileType = importType || (uploadedFile.name.endsWith('.xlsx') || uploadedFile.name.endsWith('.xls') ? 'xlsx' :
        uploadedFile.name.endsWith('.xml') ? 'xml' :
        uploadedFile.name.endsWith('.json') ? 'json' :
        uploadedFile.name.endsWith('.txt') ? 'txt' : 'csv');

      if (fileType === 'csv' || fileType === 'txt' || fileType === 'xlsx' || fileType === 'xml' || fileType === 'json') {
        // Use new universal parser
        const parsed = await parseFile(uploadedFile, fileType);
        parsedHeaders = parsed.headers;
        parsedRows = parsed.rows;
      } else {
        // Fallback to old CSV parser
        const text = await uploadedFile.text();
        const parsed = parseCSV(text);
        parsedHeaders = parsed.headers;
        parsedRows = parsed.rows;
      }

      setFile(uploadedFile);
      setHeaders(parsedHeaders);
      setRows(parsedRows);

      const suggestedMapping = detectColumnMapping(parsedHeaders);
      setMapping(suggestedMapping);

      setStep('list-select');
    } catch (error) {
      console.error('File parsing error:', error);
      phContactEvents.importValidationError('file_parse_error');
      onShowToast?.(`Failed to parse file: ${(error as Error).message || 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!mapping.phoneNumber) return;

    // Need either a file or preloaded data (from Google Sheets picker)
    const hasData = file || (preloadedData && headers.length > 0);
    if (!hasData) return;

    setLoading(true);
    try {
      const formData = new FormData();

      if (file) {
        formData.append('file', file);
      } else {
        // Create CSV from in-memory data (Google Sheets picker)
        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        const csvBlob = new Blob([csvContent], { type: 'text/csv' });
        formData.append('file', csvBlob, 'google-sheets-import.csv');
      }

      formData.append('mapping', JSON.stringify(mapping));
      if (selectedListId) {
        formData.append('listId', selectedListId);
      }

      const response = await fetch('/api/contacts/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setResult({ imported: data.imported, skipped: data.skipped });
      setStep('complete');
      const durationSeconds = Math.round((Date.now() - importStartTimeRef.current) / 1000);
      phContactEvents.csvImportFlowCompleted(data.imported, durationSeconds);
    } catch {
      phContactEvents.importValidationError('import_failed');
      onShowToast?.('Failed to import contacts', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-[var(--border-default)]/50 overflow-hidden">
        <div className="p-6 border-b border-[var(--border-subtle)]">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[var(--color-ink)] flex items-center gap-2">
              {typeInfo.icon === 'table' && <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125m0 0h-7.5" /></svg>}
              {typeInfo.icon === 'cloud' && <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" /></svg>}
              {typeInfo.icon === 'document' && <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}
              {typeInfo.icon === 'code' && <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>}
              {typeInfo.title}
            </h2>
            <button onClick={onClose} className="w-9 h-9 rounded-lg bg-white border border-[var(--border-default)] text-[var(--color-neutral-600)] hover:text-white hover:bg-red-600 hover:border-red-500 transition-all duration-300 flex items-center justify-center group">
              <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mt-5">
            {(['upload', 'list-select', 'mapping', 'preview', 'complete'] as const).map((s, idx) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  step === s ? 'gradient-bg text-white shadow-md' :
                  ['upload', 'list-select', 'mapping', 'preview', 'complete'].indexOf(step) > idx ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' :
                  'bg-[var(--color-neutral-100)] text-[var(--color-neutral-400)]'
                }`}>
                  {['upload', 'list-select', 'mapping', 'preview', 'complete'].indexOf(step) > idx ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : idx + 1}
                </div>
                {idx < 4 && (
                  <div className={`flex-1 h-1 mx-2 rounded-full transition-all ${
                    ['upload', 'list-select', 'mapping', 'preview', 'complete'].indexOf(step) > idx ? 'gradient-bg' : 'bg-[var(--color-neutral-200)]'
                  }`}></div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-b-2xl">
          {step === 'upload' && (
            <div>
              {importType === 'google' ? (
                // Google Sheets Import Interface
                <div className="space-y-4">
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-sm text-blue-800">
                        <p className="font-semibold mb-1">Important:</p>
                        <p>Make sure your Google Sheet is <strong>publicly accessible</strong> (set sharing to &quot;Anyone with the link can view&quot;)</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[var(--color-neutral-700)] mb-2">
                      Google Sheets URL
                    </label>
                    <input
                      type="text"
                      value={googleSheetUrl}
                      onChange={(e) => setGoogleSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="w-full px-4 py-3 border-2 border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      disabled={loading}
                    />
                    <p className="text-xs text-[var(--color-neutral-500)] mt-2">Paste the full URL of your Google Sheet</p>
                  </div>

                  <button
                    onClick={handleGoogleSheetImport}
                    disabled={!googleSheetUrl.trim() || loading}
                    className="w-full px-6 py-3 gradient-bg text-white rounded-xl hover:opacity-90 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Importing...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Import from Google Sheets
                      </>
                    )}
                  </button>
                </div>
              ) : (
                // File Upload Interface
                <div
                  className="border-2 border-dashed border-[var(--border-default)] rounded-xl p-12 text-center hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 cursor-pointer transition-all group"
                  onClick={() => document.getElementById('csv-upload')?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const droppedFile = e.dataTransfer.files[0];
                    if (droppedFile) handleFileUpload(droppedFile);
                  }}
                >
                  <input
                    id="csv-upload"
                    type="file"
                    accept={typeInfo.accept}
                    className="hidden"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0];
                      if (selectedFile) handleFileUpload(selectedFile);
                    }}
                  />
                  {loading ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-[var(--color-neutral-600)] font-medium">Processing...</span>
                    </div>
                  ) : (
                    <>
                      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--color-neutral-100)] group-hover:bg-[var(--color-primary)]/10 flex items-center justify-center transition-colors">
                        <svg className="w-7 h-7 text-[var(--color-neutral-400)] group-hover:text-[var(--color-primary)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="text-[var(--color-neutral-700)] font-semibold">{t.contacts.importModal.dragDrop}</p>
                      <p className="text-sm text-[var(--color-neutral-500)] mt-1">{t.contacts.importModal.supportedFormats}</p>
                      <p className="text-xs text-[var(--color-neutral-400)] mt-3">{typeInfo.accept}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'list-select' && (
            <div>
              <p className="text-sm text-[var(--color-neutral-600)] mb-4">
                Assign these <span className="font-semibold text-[var(--color-ink)]">{rows.length} contacts</span> to a list (optional):
              </p>

              <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                <button
                  onClick={() => setSelectedListId('')}
                  className={`w-full p-3 rounded-lg border transition-all duration-300 text-left ${
                    selectedListId === ''
                      ? 'bg-[var(--color-primary)]/5 border-[var(--color-primary)] shadow-md'
                      : 'bg-white border-[var(--border-default)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        selectedListId === ''
                          ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                          : 'border-[var(--border-strong)]'
                      }`}
                    >
                      {selectedListId === '' && (
                        <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-ink)]">{t.contacts.allLists}</p>
                      <p className="text-xs text-[var(--color-neutral-500)]">{t.contacts.importContacts}</p>
                    </div>
                  </div>
                </button>

                {contactLists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => setSelectedListId(list.id)}
                    className={`w-full p-3 rounded-lg border transition-all duration-300 text-left ${
                      selectedListId === list.id
                        ? 'bg-[var(--color-primary)]/5 border-[var(--color-primary)] shadow-md'
                        : 'bg-white border-[var(--border-default)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            selectedListId === list.id
                              ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                              : 'border-[var(--border-strong)]'
                          }`}
                        >
                          {selectedListId === list.id && (
                            <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--color-ink)]">{list.name}</p>
                          {list.description && (
                            <p className="text-xs text-[var(--color-neutral-500)] mt-0.5">{list.description}</p>
                          )}
                        </div>
                      </div>
                      {list.color && (
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: list.color }}
                        />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {!showCreateList ? (
                <button
                  onClick={() => setShowCreateList(true)}
                  className="w-full p-3 border-2 border-dashed border-[var(--border-strong)] rounded-lg text-[var(--color-neutral-600)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all flex items-center justify-center gap-2 font-medium"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t.common.create} {t.contacts.list}
                </button>
              ) : (
                <div className="border border-[var(--color-primary)]/20 rounded-lg p-4 bg-[var(--color-primary)]/5">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-[var(--color-neutral-700)] mb-1.5">{t.contacts.name}</label>
                      <input
                        type="text"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        placeholder="e.g., Summer Campaign 2025"
                        className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[var(--color-neutral-700)] mb-1.5">{t.common.description}</label>
                      <input
                        type="text"
                        value={newListDescription}
                        onChange={(e) => setNewListDescription(e.target.value)}
                        placeholder="Brief description..."
                        className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowCreateList(false)}
                        className="flex-1 px-3 py-2 border border-[var(--border-strong)] text-[var(--color-neutral-700)] rounded-lg hover:bg-[var(--color-neutral-50)] transition-all text-sm font-medium"
                      >
                        {t.common.cancel}
                      </button>
                      <button
                        onClick={handleCreateList}
                        disabled={!newListName.trim() || loading}
                        className="flex-1 px-3 py-2 gradient-bg text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium"
                      >
                        {loading ? t.common.loading : t.common.create}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep('upload')}
                  className="flex-1 px-4 py-2.5 border border-[var(--border-default)] text-[var(--color-neutral-700)] rounded-xl hover:bg-[var(--color-neutral-50)] hover:border-[var(--border-strong)] transition-all font-medium"
                >
                  {t.common.back}
                </button>
                <button
                  onClick={() => setStep('mapping')}
                  className="flex-1 px-4 py-2.5 gradient-bg text-white rounded-xl hover:opacity-90 transition-all font-medium"
                >
                  {t.common.next}
                </button>
              </div>
            </div>
          )}

          {step === 'mapping' && (
            <div>
              <p className="text-sm text-[var(--color-neutral-600)] mb-4">
                Map your CSV columns to contact fields. Found <span className="font-semibold text-[var(--color-ink)]">{rows.length}</span> rows with <span className="font-semibold text-[var(--color-ink)]">{headers.length}</span> columns.
              </p>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                <div className="text-[10px] font-bold text-[var(--color-neutral-400)] uppercase tracking-wider mb-1">{t.contacts.importModal.mapping}</div>
                {Object.entries({
                  firstName: 'First Name',
                  lastName: 'Last Name',
                  contactName: 'Full Name (if no First/Last)',
                  companyName: 'Company Name',
                  phoneNumber: 'Phone Number *',
                  email: 'Email',
                  address: 'Address',
                  city: 'City',
                  state: 'State',
                  zipCode: 'Zip Code',
                }).map(([field, label]) => (
                  <div key={field} className="flex items-center gap-4">
                    <label className="w-36 text-sm font-medium text-[var(--color-neutral-700)] flex-shrink-0">{label}</label>
                    <select
                      value={(mapping as unknown as Record<string, unknown>)[field] as string || ''}
                      onChange={(e) => setMapping({ ...mapping, [field]: e.target.value || null })}
                      className="flex-1 px-3 py-2 border border-[var(--border-default)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-white transition-all cursor-pointer text-sm"
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Extra Fields Section */}
              {mapping.extraFields && Object.keys(mapping.extraFields).length > 0 && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowExtraFields(!showExtraFields)}
                    className="flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] hover:underline"
                  >
                    <svg className={`w-4 h-4 transition-transform ${showExtraFields ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {Object.keys(mapping.extraFields).length} Additional Columns Detected (stored in Custom Fields)
                  </button>
                  {showExtraFields && (
                    <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1 border border-[var(--border-subtle)] rounded-xl p-3 bg-[var(--color-neutral-50)]/50">
                      {Object.entries(mapping.extraFields).map(([fieldName, headerName]) => (
                        <div key={fieldName} className="flex items-center gap-3">
                          <span className="w-40 text-xs font-medium text-[var(--color-neutral-600)] truncate flex-shrink-0" title={fieldName}>
                            {fieldName.replace(/_/g, ' ')}
                          </span>
                          <svg className="w-3 h-3 text-[var(--color-neutral-300)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          <span className="text-xs text-[var(--color-neutral-500)] truncate">{headerName}</span>
                          <button
                            onClick={() => {
                              const newExtra = { ...mapping.extraFields };
                              delete newExtra[fieldName];
                              setMapping({ ...mapping, extraFields: newExtra });
                            }}
                            className="ml-auto flex-shrink-0 w-5 h-5 rounded text-[var(--color-neutral-400)] hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all"
                            title="Remove this mapping"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep('list-select')}
                  className="flex-1 px-4 py-2.5 border border-[var(--border-default)] text-[var(--color-neutral-700)] rounded-xl hover:bg-[var(--color-neutral-50)] hover:border-[var(--border-strong)] transition-all font-medium"
                >
                  {t.common.back}
                </button>
                <button
                  onClick={() => setStep('preview')}
                  disabled={!mapping.phoneNumber}
                  className="flex-1 px-4 py-2.5 gradient-bg text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                >
                  {t.contacts.importModal.preview}
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div>
              <p className="text-sm text-[var(--color-neutral-600)] mb-4">Preview of first 5 rows:</p>
              <div className="overflow-x-auto mb-6 rounded-xl border border-[var(--border-default)]/80 shadow-sm">
                <table className="min-w-full divide-y divide-[var(--border-subtle)] text-sm">
                  <thead className="bg-[var(--color-neutral-50)]/80">
                    <tr>
                      {headers.slice(0, 6).map((header) => (
                        <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] bg-white">
                    {rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-[var(--color-neutral-50)]/50">
                        {row.slice(0, 6).map((cell, j) => (
                          <td key={j} className="px-4 py-3 text-[var(--color-neutral-700)] truncate max-w-xs">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('mapping')}
                  className="flex-1 px-4 py-2.5 border border-[var(--border-default)] text-[var(--color-neutral-700)] rounded-xl hover:bg-[var(--color-neutral-50)] hover:border-[var(--border-strong)] transition-all font-medium"
                >
                  {t.common.back}
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-sm"
                >
                  {loading ? t.contacts.importModal.importing : `${t.contacts.importModal.importButton} ${rows.length} ${t.contacts.title}`}
                </button>
              </div>
            </div>
          )}

          {step === 'complete' && result && (
            <div className="text-center py-10">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[var(--color-ink)] mb-2">{t.contacts.importModal.success}</h3>
              <p className="text-[var(--color-neutral-600)] mb-6">
                <span className="font-semibold text-emerald-600">{result.imported}</span> {t.contacts.importModal.success}
                {result.skipped > 0 && <span className="text-amber-600"> {result.skipped}</span>}
              </p>
              <button
                onClick={onComplete}
                className="px-6 py-2.5 gradient-bg text-white rounded-xl hover:opacity-90 transition-all font-medium shadow-sm"
              >
                {t.contacts.viewDetails}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}