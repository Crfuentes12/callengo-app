// components/contacts/ImportModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { parseCSV, detectColumnMapping } from '@/lib/call-agent-utils';
import { parseFile } from '@/lib/import-parsers';
import { ColumnMapping } from '@/types/call-agent';
import { createClient } from '@/lib/supabase/client';
import { ContactList } from '@/types/supabase';

interface ImportModalProps {
  companyId: string;
  onClose: () => void;
  onComplete: () => void;
  importType?: 'csv' | 'xlsx' | 'google' | 'txt' | 'xml' | 'json' | null;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

type ImportStep = 'upload' | 'list-select' | 'mapping' | 'preview' | 'complete';

const getImportTypeInfo = (type?: 'csv' | 'xlsx' | 'google' | 'txt' | 'xml' | 'json' | null) => {
  switch (type) {
    case 'csv':
      return { title: 'Import CSV', accept: '.csv', icon: '📊' };
    case 'xlsx':
      return { title: 'Import XLSX', accept: '.xlsx,.xls', icon: '📈' };
    case 'google':
      return { title: 'Import from Google Sheets', accept: '', icon: '📑' };
    case 'txt':
      return { title: 'Import TXT', accept: '.txt', icon: '📄' };
    case 'xml':
      return { title: 'Import XML', accept: '.xml', icon: '📋' };
    case 'json':
      return { title: 'Import JSON', accept: '.json', icon: '📦' };
    default:
      return { title: 'Import Contacts', accept: '.csv', icon: '📊' };
  }
};

export default function ImportModal({ companyId, onClose, onComplete, importType, onShowToast }: ImportModalProps) {
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
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [showCreateList, setShowCreateList] = useState(false);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');

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
    } catch (error) {
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
      onShowToast?.(`Failed to parse file: ${(error as Error).message || 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !mapping.phoneNumber) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
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
    } catch (error) {
      onShowToast?.('Failed to import contacts', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200/50 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">{typeInfo.icon} {typeInfo.title}</h2>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mt-5">
            {(['upload', 'list-select', 'mapping', 'preview', 'complete'] as const).map((s, idx) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  step === s ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' :
                  ['upload', 'list-select', 'mapping', 'preview', 'complete'].indexOf(step) > idx ? 'bg-indigo-100 text-indigo-600' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  {['upload', 'list-select', 'mapping', 'preview', 'complete'].indexOf(step) > idx ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : idx + 1}
                </div>
                {idx < 4 && (
                  <div className={`flex-1 h-1 mx-2 rounded-full transition-all ${
                    ['upload', 'list-select', 'mapping', 'preview', 'complete'].indexOf(step) > idx ? 'bg-indigo-600' : 'bg-slate-200'
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
                        <p>Make sure your Google Sheet is <strong>publicly accessible</strong> (set sharing to "Anyone with the link can view")</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Google Sheets URL
                    </label>
                    <input
                      type="text"
                      value={googleSheetUrl}
                      onChange={(e) => setGoogleSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      disabled={loading}
                    />
                    <p className="text-xs text-slate-500 mt-2">Paste the full URL of your Google Sheet</p>
                  </div>

                  <button
                    onClick={handleGoogleSheetImport}
                    disabled={!googleSheetUrl.trim() || loading}
                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                  className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center hover:border-indigo-400 hover:bg-indigo-50/50 cursor-pointer transition-all group"
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
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-slate-600 font-medium">Processing...</span>
                    </div>
                  ) : (
                    <>
                      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
                        <svg className="w-7 h-7 text-slate-400 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="text-slate-700 font-semibold">Drag and drop your {typeInfo.title.replace('Import ', '')} file here</p>
                      <p className="text-sm text-slate-500 mt-1">or click to browse</p>
                      <p className="text-xs text-slate-400 mt-3">Supported: {typeInfo.accept}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'list-select' && (
            <div>
              <p className="text-sm text-slate-600 mb-4">
                Assign these <span className="font-semibold text-slate-900">{rows.length} contacts</span> to a list (optional):
              </p>

              <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                <button
                  onClick={() => setSelectedListId('')}
                  className={`w-full p-3 rounded-lg border-2 transition-all duration-300 text-left ${
                    selectedListId === ''
                      ? 'bg-indigo-50 border-indigo-500 shadow-md'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        selectedListId === ''
                          ? 'bg-indigo-600 border-indigo-600'
                          : 'border-slate-300'
                      }`}
                    >
                      {selectedListId === '' && (
                        <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">No List (All Contacts)</p>
                      <p className="text-xs text-slate-500">Import without assigning to a list</p>
                    </div>
                  </div>
                </button>

                {contactLists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => setSelectedListId(list.id)}
                    className={`w-full p-3 rounded-lg border-2 transition-all duration-300 text-left ${
                      selectedListId === list.id
                        ? 'bg-indigo-50 border-indigo-500 shadow-md'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            selectedListId === list.id
                              ? 'bg-indigo-600 border-indigo-600'
                              : 'border-slate-300'
                          }`}
                        >
                          {selectedListId === list.id && (
                            <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{list.name}</p>
                          {list.description && (
                            <p className="text-xs text-slate-500 mt-0.5">{list.description}</p>
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
                  className="w-full p-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2 font-medium"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create New List
                </button>
              ) : (
                <div className="border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50/50">
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
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowCreateList(false)}
                        className="flex-1 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateList}
                        disabled={!newListName.trim() || loading}
                        className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium"
                      >
                        {loading ? 'Creating...' : 'Create'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep('upload')}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all font-medium"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('mapping')}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 'mapping' && (
            <div>
              <p className="text-sm text-slate-600 mb-4">
                Map your CSV columns to contact fields. Found <span className="font-semibold text-slate-900">{rows.length}</span> rows.
              </p>
              <div className="space-y-3">
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
                    <label className="w-36 text-sm font-medium text-slate-700">{label}</label>
                    <select
                      value={mapping[field as keyof ColumnMapping] || ''}
                      onChange={(e) => setMapping({ ...mapping, [field]: e.target.value || null })}
                      className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white transition-all cursor-pointer"
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep('list-select')}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all font-medium"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('preview')}
                  disabled={!mapping.phoneNumber}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                >
                  Preview
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div>
              <p className="text-sm text-slate-600 mb-4">Preview of first 5 rows:</p>
              <div className="overflow-x-auto mb-6 rounded-xl border border-slate-200/80 shadow-sm">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50/80">
                    <tr>
                      {headers.slice(0, 6).map((header) => (
                        <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        {row.slice(0, 6).map((cell, j) => (
                          <td key={j} className="px-4 py-3 text-slate-700 truncate max-w-xs">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('mapping')}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all font-medium"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-sm"
                >
                  {loading ? 'Importing...' : `Import ${rows.length} Contacts`}
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
              <h3 className="text-xl font-bold text-slate-900 mb-2">Import Complete!</h3>
              <p className="text-slate-600 mb-6">
                Successfully imported <span className="font-semibold text-emerald-600">{result.imported}</span> contacts.
                {result.skipped > 0 && <span className="text-amber-600"> Skipped {result.skipped} invalid rows.</span>}
              </p>
              <button
                onClick={onComplete}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium shadow-sm"
              >
                View Contacts
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}