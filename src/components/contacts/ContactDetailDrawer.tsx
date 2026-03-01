// components/contacts/ContactDetailDrawer.tsx
'use client';

import { useState, useEffect } from 'react';
import { Contact, CallAnalysis, CallMetadata, ContactStatus } from '@/types/call-agent';
import {
  formatPhoneForDisplay,
  formatDuration,
  getSentimentColor,
  getInterestLevelColor,
  getStatusColor,
} from '@/lib/call-agent-utils';

interface CrmMappings {
  salesforce: { sf_contact_id?: string; sf_lead_id?: string; sf_object_type?: string } | null;
  hubspot: { hs_contact_id?: string; hs_object_type?: string } | null;
  pipedrive: { pd_person_id?: string; pd_object_type?: string } | null;
}

interface ContactDetailDrawerProps {
  contact: Contact;
  onClose: () => void;
  onRefresh: () => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
  sfConnected?: boolean;
  hsConnected?: boolean;
  pdConnected?: boolean;
}

type TabType = 'details' | 'activity' | 'edit';

export default function ContactDetailDrawer({
  contact,
  onClose,
  onRefresh,
  onShowToast,
  sfConnected,
  hsConnected,
  pdConnected,
}: ContactDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    company_name: contact.company_name || '',
    contact_name: contact.contact_name || '',
    email: contact.email || '',
    phone_number: contact.phone_number || '',
    address: contact.address || '',
    city: contact.city || '',
    state: contact.state || '',
    zip_code: contact.zip_code || '',
    status: contact.status || 'Pending',
    notes: contact.notes || '',
    tags: (contact.tags || []).join(', '),
  });
  const [saving, setSaving] = useState(false);
  const [crmMappings, setCrmMappings] = useState<CrmMappings | null>(null);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [syncSelections, setSyncSelections] = useState<string[]>([]);

  const analysis = contact.analysis as CallAnalysis | null;
  const metadata = contact.call_metadata as CallMetadata | null;

  useEffect(() => {
    // Fetch CRM mappings
    fetch(`/api/contacts/${contact.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.crmMappings) setCrmMappings(data.crmMappings);
      })
      .catch(() => {});
  }, [contact.id]);

  const handleSave = async () => {
    const updates: Record<string, unknown> = {};
    if (editData.company_name !== contact.company_name) updates.company_name = editData.company_name;
    if (editData.contact_name !== (contact.contact_name || '')) updates.contact_name = editData.contact_name || null;
    if (editData.email !== (contact.email || '')) updates.email = editData.email || null;
    if (editData.phone_number !== contact.phone_number) updates.phone_number = editData.phone_number;
    if (editData.address !== (contact.address || '')) updates.address = editData.address || null;
    if (editData.city !== (contact.city || '')) updates.city = editData.city || null;
    if (editData.state !== (contact.state || '')) updates.state = editData.state || null;
    if (editData.zip_code !== (contact.zip_code || '')) updates.zip_code = editData.zip_code || null;
    if (editData.status !== contact.status) updates.status = editData.status;
    if (editData.notes !== (contact.notes || '')) updates.notes = editData.notes || null;
    const newTags = editData.tags.split(',').map(t => t.trim()).filter(Boolean);
    const oldTags = contact.tags || [];
    if (JSON.stringify(newTags) !== JSON.stringify(oldTags)) updates.tags = newTags;

    if (Object.keys(updates).length === 0) {
      setIsEditing(false);
      return;
    }

    // Check if we should offer CRM sync
    const hasCrmConnection = (sfConnected && crmMappings?.salesforce) ||
                             (hsConnected && crmMappings?.hubspot) ||
                             (pdConnected && crmMappings?.pipedrive);

    if (hasCrmConnection) {
      setShowSyncDialog(true);
      return;
    }

    await saveContact(updates, []);
  };

  const saveContact = async (updates: Record<string, unknown>, syncTo: string[]) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates, syncTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      // Report sync results
      if (data.syncResults) {
        const synced = Object.entries(data.syncResults)
          .filter(([, r]) => (r as { success: boolean }).success)
          .map(([k]) => k);
        if (synced.length > 0) {
          onShowToast(`Contact updated and synced to ${synced.join(', ')}`, 'success');
        } else {
          onShowToast('Contact updated in Callengo', 'success');
        }
      } else {
        onShowToast('Contact updated successfully', 'success');
      }

      setIsEditing(false);
      setShowSyncDialog(false);
      onRefresh();
    } catch (error) {
      onShowToast(error instanceof Error ? error.message : 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncDialogConfirm = async () => {
    const updates: Record<string, unknown> = {};
    if (editData.company_name !== contact.company_name) updates.company_name = editData.company_name;
    if (editData.contact_name !== (contact.contact_name || '')) updates.contact_name = editData.contact_name || null;
    if (editData.email !== (contact.email || '')) updates.email = editData.email || null;
    if (editData.phone_number !== contact.phone_number) updates.phone_number = editData.phone_number;
    if (editData.address !== (contact.address || '')) updates.address = editData.address || null;
    if (editData.city !== (contact.city || '')) updates.city = editData.city || null;
    if (editData.state !== (contact.state || '')) updates.state = editData.state || null;
    if (editData.zip_code !== (contact.zip_code || '')) updates.zip_code = editData.zip_code || null;
    if (editData.status !== contact.status) updates.status = editData.status;
    if (editData.notes !== (contact.notes || '')) updates.notes = editData.notes || null;
    const newTags = editData.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (JSON.stringify(newTags) !== JSON.stringify(contact.tags || [])) updates.tags = newTags;

    await saveContact(updates, syncSelections);
  };

  const statusOptions = [
    'Pending', 'Calling', 'Fully Verified', 'Research Needed', 'No Answer',
    'For Callback', 'Wrong Number', 'Number Disconnected', 'Withheld & Hung Up', 'Voicemail Left',
  ];

  const InputField = ({ label, field, type = 'text' }: { label: string; field: keyof typeof editData; type?: string }) => (
    <div>
      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</label>
      {isEditing ? (
        <input
          type={type}
          value={editData[field]}
          onChange={(e) => setEditData(prev => ({ ...prev, [field]: e.target.value }))}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none transition-all bg-white"
        />
      ) : (
        <p className="text-sm font-medium text-slate-900 py-2">
          {editData[field] || <span className="text-slate-300">—</span>}
        </p>
      )}
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40 transition-opacity" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col animate-slideInRight border-l border-slate-200/80">
        {/* Header */}
        <div className="gradient-bg px-5 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {(contact.company_name || '?')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white truncate">{contact.company_name}</h2>
                <p className="text-slate-300 text-xs font-mono">{formatPhoneForDisplay(contact.phone_number)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 text-xs font-medium bg-white/15 text-white rounded-lg hover:bg-white/25 transition-all border border-white/20"
                >
                  Edit
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-red-600 transition-all flex items-center justify-center"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* CRM badges */}
          {crmMappings && (
            <div className="flex gap-1.5 mt-2">
              {crmMappings.salesforce && <span className="px-2 py-0.5 text-[10px] font-medium bg-[#00A1E0]/20 text-white rounded-full border border-[#00A1E0]/30">Salesforce</span>}
              {crmMappings.hubspot && <span className="px-2 py-0.5 text-[10px] font-medium bg-[#FF7A59]/20 text-white rounded-full border border-[#FF7A59]/30">HubSpot</span>}
              {crmMappings.pipedrive && <span className="px-2 py-0.5 text-[10px] font-medium bg-white/20 text-white rounded-full border border-white/30">Pipedrive</span>}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mt-3">
            {(['details', 'activity'] as TabType[]).map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); if (tab !== 'edit') setIsEditing(false); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all capitalize ${
                  activeTab === tab
                    ? 'bg-white/20 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'details' && (
            <>
              {/* Status badge */}
              <div className="flex items-center gap-3">
                {isEditing ? (
                  <select
                    value={editData.status}
                    onChange={(e) => setEditData(prev => ({ ...prev, status: e.target.value as ContactStatus }))}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none"
                  >
                    {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-lg border ${getStatusColor(contact.status)}`}>
                    {contact.status}
                  </span>
                )}
                {contact.source && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded font-medium capitalize">
                    via {contact.source}
                  </span>
                )}
              </div>

              {/* Contact Info */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100 space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="Company" field="company_name" />
                  <InputField label="Contact Name" field="contact_name" />
                  <InputField label="Email" field="email" type="email" />
                  <InputField label="Phone" field="phone_number" type="tel" />
                  <InputField label="Address" field="address" />
                  <InputField label="City" field="city" />
                  <InputField label="State" field="state" />
                  <InputField label="Zip Code" field="zip_code" />
                </div>
              </div>

              {/* Tags */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tags</h3>
                {isEditing ? (
                  <input
                    value={editData.tags}
                    onChange={(e) => setEditData(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="tag1, tag2, tag3..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none"
                  />
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {contact.tags && contact.tags.length > 0 ? (
                      contact.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 bg-white text-slate-600 text-xs rounded-md border border-slate-200 font-medium">{tag}</span>
                      ))
                    ) : (
                      <span className="text-slate-300 text-sm">No tags</span>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</h3>
                {isEditing ? (
                  <textarea
                    value={editData.notes}
                    onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    placeholder="Add notes..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-200)] focus:border-[var(--color-primary)] outline-none resize-none"
                  />
                ) : (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{contact.notes || <span className="text-slate-300">No notes</span>}</p>
                )}
              </div>

              {/* Call Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50/80 rounded-xl p-4 text-center border border-slate-100">
                  <p className="text-2xl font-bold text-slate-900">{contact.call_attempts}</p>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">Attempts</p>
                </div>
                <div className="bg-slate-50/80 rounded-xl p-4 text-center border border-slate-100">
                  <p className="text-2xl font-bold text-slate-900">{formatDuration(contact.call_duration)}</p>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">Duration</p>
                </div>
              </div>

              {/* Analysis */}
              {analysis && (
                <div className="bg-emerald-50/80 rounded-xl p-4 border border-emerald-100 space-y-3">
                  <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Call Analysis</h3>
                  {analysis.verifiedAddress && (
                    <div>
                      <p className="text-[10px] text-emerald-600 uppercase tracking-wide font-semibold">Verified Address</p>
                      <p className="text-sm text-slate-900 mt-0.5">{analysis.verifiedAddress}</p>
                    </div>
                  )}
                  {analysis.contactName && (
                    <div>
                      <p className="text-[10px] text-emerald-600 uppercase tracking-wide font-semibold">Contact Name</p>
                      <p className="text-sm text-slate-900 mt-0.5">{analysis.contactName}</p>
                    </div>
                  )}
                  {analysis.verifiedEmail && (
                    <div>
                      <p className="text-[10px] text-emerald-600 uppercase tracking-wide font-semibold">Email</p>
                      <p className="text-sm text-slate-900 mt-0.5">{analysis.verifiedEmail}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {analysis.callSentiment && (
                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold capitalize border ${getSentimentColor(analysis.callSentiment)}`}>
                        {analysis.callSentiment}
                      </span>
                    )}
                    {analysis.customerInterestLevel && (
                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold capitalize border ${getInterestLevelColor(analysis.customerInterestLevel)}`}>
                        {analysis.customerInterestLevel} interest
                      </span>
                    )}
                  </div>
                  {analysis.keyPoints && analysis.keyPoints.length > 0 && (
                    <div>
                      <p className="text-[10px] text-emerald-600 uppercase tracking-wide font-semibold mb-1">Key Points</p>
                      <ul className="space-y-1">
                        {analysis.keyPoints.map((point, idx) => (
                          <li key={idx} className="text-sm text-slate-700 flex items-start gap-1.5">
                            <span className="text-emerald-500 mt-0.5 text-xs">&#x2022;</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Transcript */}
              {contact.transcript_text && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Transcript</h3>
                  <div className="bg-slate-50/80 rounded-xl p-4 max-h-48 overflow-y-auto border border-slate-100">
                    <pre className="text-xs whitespace-pre-wrap text-slate-700 font-mono leading-relaxed">
                      {contact.transcript_text}
                    </pre>
                  </div>
                </div>
              )}

              {/* Recording */}
              {contact.recording_url && (
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Recording</h3>
                  <audio controls className="w-full rounded-xl">
                    <source src={contact.recording_url} type="audio/mpeg" />
                  </audio>
                </div>
              )}
            </>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Activity Timeline</h3>
              {/* Call history timeline */}
              {contact.last_call_date ? (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">Last Call</p>
                      <p className="text-xs text-slate-500">{new Date(contact.last_call_date).toLocaleString()}</p>
                      {contact.call_outcome && (
                        <p className="text-xs text-slate-600 mt-1">Outcome: {contact.call_outcome}</p>
                      )}
                      {contact.call_duration && (
                        <p className="text-xs text-slate-500">Duration: {formatDuration(contact.call_duration)}</p>
                      )}
                    </div>
                  </div>
                  {metadata?.summary && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">Call Summary</p>
                        <p className="text-xs text-slate-600 mt-0.5">{metadata.summary}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500">No activity yet</p>
                  <p className="text-xs text-slate-400 mt-0.5">Activity will appear here after calls</p>
                </div>
              )}

              {/* Contact metadata */}
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Created</span>
                  <span className="text-slate-600">{new Date(contact.created_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Updated</span>
                  <span className="text-slate-600">{new Date(contact.updated_at).toLocaleString()}</span>
                </div>
                {contact.source && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Source</span>
                    <span className="text-slate-600 capitalize">{contact.source}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CRM Sync Dialog */}
      {showSyncDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 animate-slideUp">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Sync Changes</h3>
              <p className="text-sm text-slate-600 mb-4">
                Where would you like to save these changes?
              </p>

              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-all">
                  <input type="checkbox" checked disabled className="w-4 h-4 text-[var(--color-primary)] rounded" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">Callengo</p>
                    <p className="text-xs text-slate-500">Always saved locally</p>
                  </div>
                </label>

                {sfConnected && crmMappings?.salesforce && (
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-all">
                    <input
                      type="checkbox"
                      checked={syncSelections.includes('salesforce')}
                      onChange={(e) => setSyncSelections(prev => e.target.checked ? [...prev, 'salesforce'] : prev.filter(s => s !== 'salesforce'))}
                      className="w-4 h-4 text-[#00A1E0] rounded"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">Salesforce</p>
                      <p className="text-xs text-slate-500">Sync as {crmMappings.salesforce.sf_object_type}</p>
                    </div>
                  </label>
                )}

                {hsConnected && crmMappings?.hubspot && (
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-all">
                    <input
                      type="checkbox"
                      checked={syncSelections.includes('hubspot')}
                      onChange={(e) => setSyncSelections(prev => e.target.checked ? [...prev, 'hubspot'] : prev.filter(s => s !== 'hubspot'))}
                      className="w-4 h-4 text-[#FF7A59] rounded"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">HubSpot</p>
                      <p className="text-xs text-slate-500">Sync as {crmMappings.hubspot.hs_object_type}</p>
                    </div>
                  </label>
                )}

                {pdConnected && crmMappings?.pipedrive && (
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-all">
                    <input
                      type="checkbox"
                      checked={syncSelections.includes('pipedrive')}
                      onChange={(e) => setSyncSelections(prev => e.target.checked ? [...prev, 'pipedrive'] : prev.filter(s => s !== 'pipedrive'))}
                      className="w-4 h-4 text-slate-900 rounded"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">Pipedrive</p>
                      <p className="text-xs text-slate-500">Sync as {crmMappings.pipedrive.pd_object_type}</p>
                    </div>
                  </label>
                )}
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 rounded-b-2xl flex gap-3">
              <button
                onClick={() => { setShowSyncDialog(false); setSyncSelections([]); }}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-white transition-all font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSyncDialogConfirm}
                disabled={saving}
                className="flex-1 px-4 py-2.5 gradient-bg text-white rounded-xl transition-all font-medium text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slideInRight {
          animation: slideInRight 0.25s ease-out;
        }
      `}</style>
    </>
  );
}
