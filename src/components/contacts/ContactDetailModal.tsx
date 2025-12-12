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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200/50">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 px-6 py-5">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-white">{contact.company_name}</h2>
              <p className="text-slate-300 text-sm mt-1 font-mono">{formatPhoneForDisplay(contact.phone_number)}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Contact Information</h3>
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Address</p>
                    <p className="text-sm font-medium text-slate-900 mt-1">
                      {contact.address ? `${contact.address}, ${contact.city}, ${contact.state} ${contact.zip_code}` : <span className="text-slate-300">—</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Contact Name</p>
                    <p className="text-sm font-medium text-slate-900 mt-1">{contact.contact_name || <span className="text-slate-300">—</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Email</p>
                    <p className="text-sm font-medium text-slate-900 mt-1">{contact.email || <span className="text-slate-300">—</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Status</p>
                    <p className="text-sm font-medium text-slate-900 mt-1">{contact.status}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Call Stats */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Call Statistics</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50/80 rounded-xl p-4 text-center border border-slate-100">
                  <p className="text-2xl font-bold text-slate-900">{contact.call_attempts}</p>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Attempts</p>
                </div>
                <div className="bg-slate-50/80 rounded-xl p-4 text-center border border-slate-100">
                  <p className="text-2xl font-bold text-slate-900">
                    {formatDuration(contact.call_duration)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Duration</p>
                </div>
                <div className="bg-slate-50/80 rounded-xl p-4 text-center border border-slate-100">
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(metadata?.price)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Cost</p>
                </div>
              </div>
            </div>

            {/* Analysis */}
            {analysis && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Call Analysis</h3>
                <div className="bg-emerald-50/80 rounded-xl p-4 border border-emerald-100 space-y-4">
                  {analysis.verifiedAddress && (
                    <div>
                      <p className="text-xs text-emerald-600 uppercase tracking-wide font-medium">Verified Address</p>
                      <p className="text-sm text-slate-900 mt-1">{analysis.verifiedAddress}</p>
                    </div>
                  )}
                  {analysis.contactName && (
                    <div>
                      <p className="text-xs text-emerald-600 uppercase tracking-wide font-medium">Contact Name</p>
                      <p className="text-sm text-slate-900 mt-1">{analysis.contactName}</p>
                    </div>
                  )}
                  {analysis.verifiedEmail && (
                    <div>
                      <p className="text-xs text-emerald-600 uppercase tracking-wide font-medium">Email</p>
                      <p className="text-sm text-slate-900 mt-1">{analysis.verifiedEmail}</p>
                    </div>
                  )}
                  {analysis.callSentiment && (
                    <div>
                      <p className="text-xs text-emerald-600 uppercase tracking-wide font-medium">Sentiment</p>
                      <span className={`inline-block mt-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold capitalize border ${getSentimentColor(analysis.callSentiment)}`}>
                        {analysis.callSentiment}
                      </span>
                    </div>
                  )}
                  {analysis.customerInterestLevel && (
                    <div>
                      <p className="text-xs text-emerald-600 uppercase tracking-wide font-medium">Interest Level</p>
                      <span className={`inline-block mt-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold capitalize border ${getInterestLevelColor(analysis.customerInterestLevel)}`}>
                        {analysis.customerInterestLevel}
                      </span>
                    </div>
                  )}
                  {analysis.keyPoints && analysis.keyPoints.length > 0 && (
                    <div>
                      <p className="text-xs text-emerald-600 uppercase tracking-wide font-medium mb-2">Key Points</p>
                      <ul className="space-y-1.5">
                        {analysis.keyPoints.map((point, idx) => (
                          <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                            <span className="text-emerald-500 mt-0.5">•</span>
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
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Transcript</h3>
                <div className="bg-slate-50/80 rounded-xl p-4 max-h-64 overflow-y-auto border border-slate-100">
                  <pre className="text-sm whitespace-pre-wrap text-slate-700 font-mono leading-relaxed">
                    {contact.transcript_text}
                  </pre>
                </div>
              </div>
            )}

            {/* Recording */}
            {contact.recording_url && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Recording</h3>
                <audio controls className="w-full rounded-xl">
                  <source src={contact.recording_url} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}