// components/contacts/GoogleSheetsSyncProgress.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleSheetsIcon } from '@/components/icons/BrandIcons';

export interface SyncJobInfo {
  linkedSheetId: string;
  spreadsheetName: string;
  sheetTab?: string;
}

interface SyncProgressState {
  phase: 'connecting' | 'reading' | 'importing' | 'complete' | 'error';
  processed: number;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  message: string;
}

interface GoogleSheetsSyncProgressProps {
  syncJob: SyncJobInfo | null;
  onComplete: () => void;
  onDismiss: () => void;
}

export default function GoogleSheetsSyncProgress({
  syncJob,
  onComplete,
  onDismiss,
}: GoogleSheetsSyncProgressProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [progress, setProgress] = useState<SyncProgressState>({
    phase: 'connecting',
    processed: 0,
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    message: 'Starting sync...',
  });
  const [showComplete, setShowComplete] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasStartedRef = useRef(false);

  const percent = progress.total > 0
    ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
    : progress.phase === 'reading' ? 5 : 0;

  const startSync = useCallback(async () => {
    if (!syncJob || hasStartedRef.current) return;
    hasStartedRef.current = true;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/integrations/google-sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkedSheetId: syncJob.linkedSheetId,
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Sync failed' }));
        setProgress((prev: SyncProgressState) => ({
          ...prev,
          phase: 'error' as const,
          message: errData.error || 'Sync failed',
        }));
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setProgress((prev: SyncProgressState) => ({ ...prev, phase: 'error' as const, message: 'No stream available' }));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const dataLine = line.replace(/^data: /, '').trim();
          if (!dataLine) continue;

          try {
            const event = JSON.parse(dataLine);

            if (event.type === 'progress') {
              setProgress({
                phase: event.phase || 'importing',
                processed: event.processed || 0,
                total: event.total || 0,
                created: event.created || 0,
                updated: event.updated || 0,
                skipped: event.skipped || 0,
                message: event.message || 'Syncing...',
              });
            } else if (event.type === 'sheet_complete') {
              setProgress({
                phase: 'complete',
                processed: event.inbound?.total || 0,
                total: event.inbound?.total || 0,
                created: event.inbound?.created || 0,
                updated: event.inbound?.updated || 0,
                skipped: event.inbound?.skipped || 0,
                message: `Import complete!`,
              });
            } else if (event.type === 'done') {
              setShowComplete(true);
              setTimeout(() => onComplete(), 5000);
            } else if (event.type === 'error') {
              setProgress((prev: SyncProgressState) => ({
                ...prev,
                phase: 'error' as const,
                message: event.error || 'Sync failed',
              }));
            }
          } catch {
            // Invalid JSON, skip
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setProgress((prev: SyncProgressState) => ({
          ...prev,
          phase: 'error' as const,
          message: (err as Error).message || 'Connection failed',
        }));
      }
    }
  }, [syncJob, onComplete]);

  useEffect(() => {
    startSync();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [startSync]);

  if (!syncJob) return null;

  const isComplete = progress.phase === 'complete' || showComplete;
  const isError = progress.phase === 'error';
  const isWorking = !isComplete && !isError;

  // Minimized floating button
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-3 bg-white rounded-2xl shadow-xl border border-slate-200 hover:shadow-2xl hover:scale-[1.02] transition-all group"
        style={{ animation: 'slideUpIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="relative">
          <div className="w-9 h-9 rounded-xl bg-white border border-green-200 flex items-center justify-center">
            <GoogleSheetsIcon className="w-5 h-5" />
          </div>
          {isWorking && (
            <div className="absolute -top-1 -right-1 w-3 h-3">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-ping absolute" />
              <div className="w-3 h-3 rounded-full bg-green-500 relative" />
            </div>
          )}
          {isComplete && (
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>

        <div className="text-left">
          <p className="text-xs font-semibold text-slate-700 group-hover:text-green-700 transition-colors">
            {isComplete ? 'Import Complete' : isError ? 'Import Failed' : 'Importing...'}
          </p>
          <p className="text-[10px] text-slate-500">
            {isComplete
              ? `${progress.created + progress.updated} contacts`
              : isError
              ? 'Click to view details'
              : `${percent}% — ${progress.processed} of ${progress.total}`}
          </p>
        </div>

        {isWorking && (
          <div className="w-8 h-8 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e2e8f0" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3"
                strokeDasharray={`${percent * 0.974} 97.4`}
                strokeLinecap="round"
                transform="rotate(-90 18 18)"
                className="transition-all duration-300"
              />
            </svg>
            <span className="absolute text-[8px] font-bold text-green-700">{percent}%</span>
          </div>
        )}
      </button>
    );
  }

  // Expanded floating panel
  return (
    <div
      className="fixed bottom-6 right-6 z-[60] w-[340px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      style={{ animation: 'slideUpIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white border border-green-200 flex items-center justify-center">
            <GoogleSheetsIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              {isComplete ? 'Import Complete' : isError ? 'Import Failed' : 'Importing Contacts'}
            </p>
            <p className="text-[10px] text-slate-500 truncate max-w-[180px]">
              {syncJob.spreadsheetName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isWorking && (
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Minimize"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
              </svg>
            </button>
          )}
          {(isComplete || isError) && (
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Progress bar */}
        {isWorking && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">
                {progress.phase === 'reading' ? 'Reading sheet...' : `${percent}% complete`}
              </span>
              <span className="text-xs text-slate-500">
                {progress.total > 0 ? `${progress.processed.toLocaleString()} / ${progress.total.toLocaleString()}` : '...'}
              </span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.max(percent, 2)}%` }}
              />
            </div>
          </div>
        )}

        {/* Success state */}
        {isComplete && (
          <div className="text-center py-2">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3"
                 style={{ animation: 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-bold text-slate-900 mb-1">Import Finished!</p>
            <p className="text-xs text-slate-500">
              A notification has been sent to your inbox
            </p>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="text-center py-2">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-sm font-bold text-red-900 mb-1">Import Failed</p>
            <p className="text-xs text-red-600">{progress.message}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="bg-green-50 rounded-xl p-2.5 text-center border border-green-100">
            <p className="text-lg font-bold text-green-700">{progress.created.toLocaleString()}</p>
            <p className="text-[10px] text-green-600 font-medium">Created</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-2.5 text-center border border-blue-100">
            <p className="text-lg font-bold text-blue-700">{progress.updated.toLocaleString()}</p>
            <p className="text-[10px] text-blue-600 font-medium">Updated</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
            <p className="text-lg font-bold text-slate-500">{progress.skipped.toLocaleString()}</p>
            <p className="text-[10px] text-slate-500 font-medium">Skipped</p>
          </div>
        </div>

        {/* Working animation */}
        {isWorking && (
          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-slate-400">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-bounce [animation-delay:0ms]" />
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-bounce [animation-delay:150ms]" />
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-bounce [animation-delay:300ms]" />
            </div>
            <span>You can minimize this and continue working</span>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slideUpIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
