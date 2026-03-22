// components/contacts/ContactDetailModal.tsx
'use client';

import { useTranslation } from '@/i18n';
import { Contact, CallAnalysis, CallMetadata } from '@/types/call-agent';
import {
  formatPhoneForDisplay,
  formatDuration,
  getSentimentColor,
  getInterestLevelColor
} from '@/lib/call-agent-utils';

interface ContactDetailModalProps {
  contact: Contact;
  onClose: () => void;
  onRefresh: () => void;
}

export default function ContactDetailModal({ contact, onClose }: ContactDetailModalProps) {
  const { t } = useTranslation();
  const analysis = contact.analysis as CallAnalysis | null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const metadata = contact.call_metadata as CallMetadata | null;

  return (
    <div className="fixed inset-0 bg-[var(--color-neutral-900)]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-[var(--border-default)]/50">
        {/* Header */}
        <div className="gradient-bg px-6 py-5">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-white">{contact.company_name}</h2>
              <p className="text-[var(--color-neutral-300)] text-sm mt-1 font-mono">{formatPhoneForDisplay(contact.phone_number)}</p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-[var(--color-neutral-800)]/80 backdrop-blur-sm border border-[var(--color-neutral-700)] text-[var(--color-neutral-400)] hover:text-white hover:bg-red-600 hover:border-red-500 transition-all duration-300 flex items-center justify-center group"
            >
              <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <h3 className="text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider mb-3">{t.contacts.viewDetails}</h3>
              <div className="bg-[var(--color-neutral-50)]/80 rounded-xl p-4 border border-[var(--border-subtle)]">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-[var(--color-neutral-400)] uppercase tracking-wide">{t.contacts.address}</p>
                    <p className="text-sm font-medium text-[var(--color-ink)] mt-1">
                      {contact.address ? `${contact.address}, ${contact.city}, ${contact.state} ${contact.zip_code}` : <span className="text-[var(--color-neutral-300)]">—</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-neutral-400)] uppercase tracking-wide">{t.contacts.name}</p>
                    <p className="text-sm font-medium text-[var(--color-ink)] mt-1">{contact.contact_name || <span className="text-[var(--color-neutral-300)]">—</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-neutral-400)] uppercase tracking-wide">{t.contacts.email}</p>
                    <p className="text-sm font-medium text-[var(--color-ink)] mt-1">{contact.email || <span className="text-[var(--color-neutral-300)]">—</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-neutral-400)] uppercase tracking-wide">{t.contacts.status}</p>
                    <p className="text-sm font-medium text-[var(--color-ink)] mt-1">{contact.status}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Call Stats */}
            <div>
              <h3 className="text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider mb-3">{t.contacts.call}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--color-neutral-50)]/80 rounded-xl p-4 text-center border border-[var(--border-subtle)]">
                  <p className="text-2xl font-bold text-[var(--color-ink)]">{contact.call_attempts}</p>
                  <p className="text-xs text-[var(--color-neutral-500)] mt-1 font-medium">Attempts</p>
                </div>
                <div className="bg-[var(--color-neutral-50)]/80 rounded-xl p-4 text-center border border-[var(--border-subtle)]">
                  <p className="text-2xl font-bold text-[var(--color-ink)]">
                    {formatDuration(contact.call_duration)}
                  </p>
                  <p className="text-xs text-[var(--color-neutral-500)] mt-1 font-medium">Duration</p>
                </div>
              </div>
            </div>

            {/* Analysis */}
            {analysis && (
              <div>
                <h3 className="text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider mb-3">{t.contacts.call}</h3>
                <div className="bg-emerald-50/80 rounded-xl p-4 border border-emerald-100 space-y-4">
                  {analysis.verifiedAddress && (
                    <div>
                      <p className="text-xs text-emerald-600 uppercase tracking-wide font-medium">{t.contacts.address}</p>
                      <p className="text-sm text-[var(--color-ink)] mt-1">{analysis.verifiedAddress}</p>
                    </div>
                  )}
                  {analysis.contactName && (
                    <div>
                      <p className="text-xs text-emerald-600 uppercase tracking-wide font-medium">{t.contacts.name}</p>
                      <p className="text-sm text-[var(--color-ink)] mt-1">{analysis.contactName}</p>
                    </div>
                  )}
                  {analysis.verifiedEmail && (
                    <div>
                      <p className="text-xs text-emerald-600 uppercase tracking-wide font-medium">{t.contacts.email}</p>
                      <p className="text-sm text-[var(--color-ink)] mt-1">{analysis.verifiedEmail}</p>
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
                          <li key={idx} className="text-sm text-[var(--color-neutral-700)] flex items-start gap-2">
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
                <h3 className="text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider mb-3">Transcript</h3>
                <div className="bg-[var(--color-neutral-50)]/80 rounded-xl p-4 max-h-64 overflow-y-auto border border-[var(--border-subtle)]">
                  <pre className="text-sm whitespace-pre-wrap text-[var(--color-neutral-700)] font-mono leading-relaxed">
                    {contact.transcript_text}
                  </pre>
                </div>
              </div>
            )}

            {/* Recording */}
            {contact.recording_url && (
              <div>
                <h3 className="text-xs font-semibold text-[var(--color-neutral-500)] uppercase tracking-wider mb-3">Recording</h3>
                <audio controls className="w-full rounded-xl">
                  <source src={contact.recording_url} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border-subtle)] px-6 py-4 bg-[var(--color-neutral-50)]/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-[var(--color-neutral-700)] bg-white border border-[var(--border-default)] rounded-xl hover:bg-[var(--color-neutral-50)] hover:border-[var(--border-strong)] transition-all"
          >
            {t.common.close}
          </button>
        </div>
      </div>
    </div>
  );
}