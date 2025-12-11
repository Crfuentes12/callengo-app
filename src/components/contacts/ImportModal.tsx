// components/contacts/ImportModal.tsx
'use client';

import { useState } from 'react';
import { parseCSV, detectColumnMapping } from '@/lib/call-agent-utils';
import { ColumnMapping } from '@/types/call-agent';

interface ImportModalProps {
  companyId: string;
  onClose: () => void;
  onComplete: () => void;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'complete';

export default function ImportModal({ companyId, onClose, onComplete }: ImportModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    companyName: null,
    address: null,
    city: null,
    state: null,
    zipCode: null,
    phoneNumber: null,
    contactName: null,
    email: null,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  const handleFileUpload = async (uploadedFile: File) => {
    setLoading(true);
    try {
      const text = await uploadedFile.text();
      const { headers: parsedHeaders, rows: parsedRows } = parseCSV(text);
      
      setFile(uploadedFile);
      setHeaders(parsedHeaders);
      setRows(parsedRows);
      
      const suggestedMapping = detectColumnMapping(parsedHeaders);
      setMapping(suggestedMapping);
      
      setStep('mapping');
    } catch (error) {
      alert('Failed to parse CSV file');
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

      const response = await fetch('/api/contacts/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setResult({ imported: data.imported, skipped: data.skipped });
      setStep('complete');
    } catch (error) {
      alert('Failed to import contacts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Import Contacts</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Progress */}
          <div className="flex items-center gap-2 mt-4">
            {(['upload', 'mapping', 'preview', 'complete'] as const).map((s, idx) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step === s ? 'bg-blue-600 text-white' : 
                  ['upload', 'mapping', 'preview', 'complete'].indexOf(step) > idx ? 'bg-blue-100 text-blue-600' : 
                  'bg-slate-100 text-slate-400'
                }`}>
                  {idx + 1}
                </div>
                {idx < 3 && (
                  <div className={`flex-1 h-1 mx-2 rounded ${
                    ['upload', 'mapping', 'preview', 'complete'].indexOf(step) > idx ? 'bg-blue-600' : 'bg-slate-200'
                  }`}></div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">
          {step === 'upload' && (
            <div>
              <div
                className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer transition-all"
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
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0];
                    if (selectedFile) handleFileUpload(selectedFile);
                  }}
                />
                {loading ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-slate-600">Processing...</span>
                  </div>
                ) : (
                  <>
                    <svg className="w-10 h-10 text-slate-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-slate-600 font-medium">Drag and drop a CSV file here</p>
                    <p className="text-sm text-slate-400 mt-1">or click to browse</p>
                  </>
                )}
              </div>
            </div>
          )}

          {step === 'mapping' && (
            <div>
              <p className="text-sm text-slate-600 mb-4">
                Map your CSV columns to contact fields. Found {rows.length} rows.
              </p>
              <div className="space-y-3">
                {Object.entries({
                  companyName: 'Company Name',
                  phoneNumber: 'Phone Number *',
                  address: 'Address',
                  city: 'City',
                  state: 'State',
                  zipCode: 'Zip Code',
                  contactName: 'Contact Name',
                  email: 'Email',
                }).map(([field, label]) => (
                  <div key={field} className="flex items-center gap-4">
                    <label className="w-36 text-sm font-medium text-slate-700">{label}</label>
                    <select
                      value={mapping[field as keyof ColumnMapping] || ''}
                      onChange={(e) => setMapping({ ...mapping, [field]: e.target.value || null })}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
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
                  onClick={() => setStep('upload')}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('preview')}
                  disabled={!mapping.phoneNumber}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Preview
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div>
              <p className="text-sm text-slate-600 mb-4">Preview of first 5 rows:</p>
              <div className="overflow-x-auto mb-6 rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {headers.slice(0, 6).map((header) => (
                        <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {rows.slice(0, 5).map((row, i) => (
                      <tr key={i}>
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
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? 'Importing...' : `Import ${rows.length} Contacts`}
                </button>
              </div>
            </div>
          )}

          {step === 'complete' && result && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Import Complete!</h3>
              <p className="text-slate-600 mb-6">
                Successfully imported {result.imported} contacts.
                {result.skipped > 0 && ` Skipped ${result.skipped} invalid rows.`}
              </p>
              <button
                onClick={onComplete}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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