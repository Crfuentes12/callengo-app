// components/calls/CallDetailModal.tsx
'use client';

import { useState } from 'react';
import { formatDuration } from '@/lib/call-agent-utils';

interface CallDetailData {
  id: string;
  call_id: string;
  status: string | null;
  completed: boolean;
  call_length: number | null;
  answered_by: string | null;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  analysis: any;
  error_message: string | null;
  metadata: any;
  created_at: string;
  voicemail_detected?: boolean;
  voicemail_left?: boolean;
  voicemail_message_url?: string | null;
  voicemail_duration?: number | null;
  contacts?: {
    company_name: string;
    contact_name: string | null;
    phone_number: string;
  } | null;
  agent_runs?: { name: string } | null;
}

interface CallDetailModalProps {
  call: CallDetailData;
  onClose: () => void;
}

export default function CallDetailModal({ call, onClose }: CallDetailModalProps) {
  const [activeSection, setActiveSection] = useState<'overview' | 'transcript' | 'analysis' | 'recording'>('overview');

  const analysis = call.analysis || {};
  const hasTranscript = !!call.transcript;
  const hasRecording = !!call.recording_url || !!call.voicemail_message_url;
  const hasAnalysis = call.analysis && Object.keys(call.analysis).length > 0;

  const getStatusConfig = (status: string | null) => {
    switch (status) {
      case 'completed': return { label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'failed': case 'error': return { label: 'Failed', color: 'bg-red-50 text-red-700 border-red-200' };
      case 'no_answer': case 'no-answer': return { label: 'No Answer', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'voicemail': return { label: 'Voicemail', color: 'bg-violet-50 text-violet-700 border-violet-200' };
      case 'in_progress': case 'in-progress': case 'ringing': return { label: 'In Progress', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      default: return { label: status || 'Unknown', color: 'bg-slate-50 text-slate-600 border-slate-200' };
    }
  };

  const statusConfig = getStatusConfig(call.status);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'negative': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getInterestColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'medium': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'low': return 'bg-orange-50 text-orange-700 border-orange-200';
      default: return 'bg-red-50 text-red-700 border-red-200';
    }
  };

  const sections = [
    { id: 'overview' as const, label: 'Overview', always: true },
    { id: 'transcript' as const, label: 'Transcript', always: false, available: hasTranscript },
    { id: 'analysis' as const, label: 'Analysis', always: false, available: hasAnalysis },
    { id: 'recording' as const, label: 'Recording', always: false, available: hasRecording },
  ].filter(s => s.always || s.available);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {call.contacts?.contact_name || call.contacts?.company_name || 'Call Detail'}
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    {call.contacts?.phone_number && <span className="font-mono">{call.contacts.phone_number}</span>}
                    {call.agent_runs?.name && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span>{call.agent_runs.name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
                {call.answered_by && (
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    call.answered_by === 'human' ? 'bg-emerald-100 text-emerald-700' :
                    call.answered_by === 'voicemail' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {call.answered_by === 'human' ? 'Answered by Human' : call.answered_by === 'voicemail' ? 'Voicemail' : call.answered_by}
                  </span>
                )}
                {call.voicemail_left && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-violet-100 text-violet-700">
                    Voicemail Left
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Section tabs */}
          <div className="flex gap-1 mt-4">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeSection === s.id
                    ? 'gradient-bg text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeSection === 'overview' && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500 font-semibold mb-1">Duration</p>
                  <p className="text-xl font-bold text-slate-900">{formatDuration(call.call_length)}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500 font-semibold mb-1">Status</p>
                  <p className="text-xl font-bold text-slate-900 capitalize">{call.status || 'Unknown'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500 font-semibold mb-1">Answered By</p>
                  <p className="text-xl font-bold text-slate-900 capitalize">{call.answered_by || 'Unknown'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500 font-semibold mb-1">Date</p>
                  <p className="text-sm font-bold text-slate-900">
                    {new Date(call.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(call.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              {/* Summary */}
              {call.summary && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm font-semibold text-blue-800">Call Summary</p>
                  </div>
                  <p className="text-sm text-blue-900 leading-relaxed">{call.summary}</p>
                </div>
              )}

              {/* Analysis Quick View */}
              {hasAnalysis && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-900">Quick Analysis</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {analysis.callSentiment && (
                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">Sentiment</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getSentimentColor(analysis.callSentiment)}`}>
                          {analysis.callSentiment}
                        </span>
                      </div>
                    )}
                    {analysis.customerInterestLevel && (
                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">Interest Level</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getInterestColor(analysis.customerInterestLevel)}`}>
                          {analysis.customerInterestLevel}
                        </span>
                      </div>
                    )}
                    {analysis.callCategory && (
                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">Category</p>
                        <span className="text-sm font-medium text-slate-900 capitalize">{analysis.callCategory.replace(/_/g, ' ')}</span>
                      </div>
                    )}
                    {analysis.businessConfirmed !== undefined && (
                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">Business Confirmed</p>
                        <span className={`text-sm font-medium ${analysis.businessConfirmed ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {analysis.businessConfirmed ? 'Yes' : 'No'}
                        </span>
                      </div>
                    )}
                  </div>
                  {analysis.keyPoints && analysis.keyPoints.length > 0 && (
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-500 mb-2">Key Points</p>
                      <ul className="space-y-1">
                        {analysis.keyPoints.map((point: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] mt-1.5 flex-shrink-0"></span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analysis.outcomeNotes && (
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">Outcome Notes</p>
                      <p className="text-sm text-slate-700">{analysis.outcomeNotes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {call.error_message && (
                <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-sm font-semibold text-red-800">Error</p>
                  </div>
                  <p className="text-sm text-red-700">{call.error_message}</p>
                </div>
              )}

              {/* No data message */}
              {!call.summary && !hasAnalysis && !call.error_message && !hasTranscript && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-slate-900 font-semibold">Call not yet made</p>
                  <p className="text-sm text-slate-500 mt-1">Data will appear once this call is completed</p>
                </div>
              )}

              {/* Call ID */}
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 font-mono">Call ID: {call.call_id}</p>
              </div>
            </div>
          )}

          {activeSection === 'transcript' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-base font-semibold text-slate-900">Full Transcript</h3>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 max-h-[50vh] overflow-y-auto">
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{call.transcript}</pre>
              </div>
            </div>
          )}

          {activeSection === 'analysis' && hasAnalysis && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" />
                </svg>
                <h3 className="text-base font-semibold text-slate-900">Detailed Analysis</h3>
              </div>

              {/* Extracted Data */}
              {analysis.extractedData && Object.keys(analysis.extractedData).length > 0 && (
                <div className="bg-emerald-50 rounded-xl border border-emerald-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-emerald-200 flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h4 className="text-sm font-semibold text-emerald-800">Extracted Data</h4>
                  </div>
                  <table className="w-full">
                    <tbody>
                      {Object.entries(analysis.extractedData).map(([key, value]) => (
                        <tr key={key} className="border-b border-emerald-100 last:border-0">
                          <td className="py-2 px-4 text-xs font-medium text-slate-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</td>
                          <td className="py-2 px-4 text-sm font-mono text-emerald-700">{String(value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Validated Fields */}
              {analysis.validatedFields && Object.keys(analysis.validatedFields).length > 0 && (
                <div className="bg-blue-50 rounded-xl border border-blue-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-blue-200 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 className="text-sm font-semibold text-blue-800">Validated Fields</h4>
                  </div>
                  <table className="w-full">
                    <tbody>
                      {Object.entries(analysis.validatedFields).map(([key, value]) => (
                        <tr key={key} className="border-b border-blue-100 last:border-0">
                          <td className="py-2 px-4 text-xs font-medium text-slate-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</td>
                          <td className="py-2 px-4 text-sm">
                            {String(value).toLowerCase().includes('confirmed') ? (
                              <span className="text-emerald-600 font-medium flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                {String(value)}
                              </span>
                            ) : (
                              <span className="text-amber-600 font-medium">{String(value)}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Next Actions */}
              {analysis.nextActions && analysis.nextActions.length > 0 && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                  <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                    </svg>
                    Recommended Next Actions
                  </h4>
                  <ol className="space-y-1.5">
                    {analysis.nextActions.map((action: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-amber-900">
                        <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                        {action}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Call Quality */}
              {analysis.callQuality && (
                <div className="p-4 bg-white rounded-xl border border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">Call Quality</h4>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full gradient-bg rounded-full transition-all" style={{ width: `${(analysis.callQuality.rating || 0) * 10}%` }}></div>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{analysis.callQuality.rating}/10</span>
                  </div>
                  {analysis.callQuality.reason && (
                    <p className="text-xs text-slate-500 mt-2 italic">{analysis.callQuality.reason}</p>
                  )}
                </div>
              )}

              {/* Raw fields fallback */}
              {!analysis.extractedData && !analysis.validatedFields && !analysis.nextActions && !analysis.callQuality && (
                <div className="space-y-3">
                  {Object.entries(analysis).filter(([k]) => !['callSentiment', 'customerInterestLevel', 'callCategory', 'businessConfirmed', 'keyPoints', 'outcomeNotes', 'followUpRequired', 'followUpReason'].includes(k)).map(([key, value]) => (
                    <div key={key} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-500 font-medium mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                      <p className="text-sm text-slate-700">{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSection === 'recording' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
                <h3 className="text-base font-semibold text-slate-900">Call Recording</h3>
              </div>
              {call.recording_url && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500 font-medium mb-3">Call Recording</p>
                  <audio controls className="w-full" src={call.recording_url}>
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
              {call.voicemail_message_url && (
                <div className="p-4 bg-violet-50 rounded-xl border border-violet-200">
                  <p className="text-xs text-violet-600 font-medium mb-3">
                    Voicemail Message {call.voicemail_duration ? `(${Math.floor(call.voicemail_duration / 60)}:${(call.voicemail_duration % 60).toString().padStart(2, '0')})` : ''}
                  </p>
                  <audio controls className="w-full" src={call.voicemail_message_url}>
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
