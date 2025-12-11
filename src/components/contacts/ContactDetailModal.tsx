// components/contacts/ContactDetailModal.tsx
'use client';

import { Contact, CallAnalysis, CallMetadata } from '@/types/call-agent';
import { 
  formatPhoneForDisplay, 
  formatDuration, 
  formatCurrency, 
  getSentimentColor, 
  getInterestLevelColor 
} from '@/lib/call-agent-utils';

interface ContactDetailModalProps {
  contact: Contact;
  onClose: () => void;
  onRefresh: () => void;
}

export default function ContactDetailModal({ contact, onClose }: ContactDetailModalProps) {
  const analysis = contact.analysis as CallAnalysis | null;
  const metadata = contact.call_metadata as CallMetadata | null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient from-slate-900 to-slate-800 px-6 py-5">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-white">{contact.company_name}</h2>
              <p className="text-slate-400 text-sm mt-1">{formatPhoneForDisplay(contact.phone_number)}</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="space-y-6">
            {/* Contact Info */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">Contact Information</h3>
              <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Address</p>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">
                      {contact.address ? `${contact.address}, ${contact.city}, ${contact.state} ${contact.zip_code}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Contact Name</p>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">{contact.contact_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Email</p>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">{contact.email || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Status</p>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">{contact.status}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Call Stats */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">Call Statistics</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">{contact.call_attempts}</p>
                  <p className="text-xs text-slate-500 mt-1">Attempts</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">
                    {formatDuration(contact.call_duration)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Duration</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(metadata?.price)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Cost</p>
                </div>
              </div>
            </div>

            {/* Analysis */}
            {analysis && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">Call Analysis</h3>
                <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100 space-y-3">
                  {analysis.verifiedAddress && (
                    <div>
                      <p className="text-xs text-emerald-600 uppercase">Verified Address</p>
                      <p className="text-sm text-slate-900 mt-0.5">{analysis.verifiedAddress}</p>
                    </div>
                  )}
                  {analysis.contactName && (
                    <div>
                      <p className="text-xs text-emerald-600 uppercase">Contact Name</p>
                      <p className="text-sm text-slate-900 mt-0.5">{analysis.contactName}</p>
                    </div>
                  )}
                  {analysis.verifiedEmail && (
                    <div>
                      <p className="text-xs text-emerald-600 uppercase">Email</p>
                      <p className="text-sm text-slate-900 mt-0.5">{analysis.verifiedEmail}</p>
                    </div>
                  )}
                  {analysis.callSentiment && (
                    <div>
                      <p className="text-xs text-emerald-600 uppercase">Sentiment</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium capitalize ${getSentimentColor(analysis.callSentiment)}`}>
                        {analysis.callSentiment}
                      </span>
                    </div>
                  )}
                  {analysis.customerInterestLevel && (
                    <div>
                      <p className="text-xs text-emerald-600 uppercase">Interest Level</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium capitalize ${getInterestLevelColor(analysis.customerInterestLevel)}`}>
                        {analysis.customerInterestLevel}
                      </span>
                    </div>
                  )}
                  {analysis.keyPoints && analysis.keyPoints.length > 0 && (
                    <div>
                      <p className="text-xs text-emerald-600 uppercase mb-2">Key Points</p>
                      <ul className="space-y-1">
                        {analysis.keyPoints.map((point, idx) => (
                          <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                            <span className="text-emerald-500 mt-1">•</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Transcript */}
            {contact.transcript_text && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">Transcript</h3>
                <div className="bg-slate-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <pre className="text-sm whitespace-pre-wrap text-slate-700 font-mono">
                    {contact.transcript_text}
                  </pre>
                </div>
              </div>
            )}

            {/* Recording */}
            {contact.recording_url && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">Recording</h3>
                <audio controls className="w-full">
                  <source src={contact.recording_url} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}