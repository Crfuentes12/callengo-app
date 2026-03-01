// lib/clio/sync.ts
// Clio data sync operations - contacts, matters, calendar entries, users

import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { getClioClient } from './auth';
import type {
  ClioIntegration,
  ClioContact,
  ClioCalendarEntry,
  ClioUser,
  ClioPaginatedResponse,
  ClioSyncResult,
  ClioOutboundSyncResult,
} from '@/types/clio';

// ============================================================================
// QUERY HELPERS
// ============================================================================

async function fetchClioPage<T>(
  integration: ClioIntegration,
  path: string
): Promise<ClioPaginatedResponse<T>> {
  const client = await getClioClient(integration);

  const res = await client.fetch(path);

  if (!res.ok) {
    const errBody = await res.text().catch(() => '(could not read error body)');
    throw new Error(`Clio API request failed (${res.status}): ${errBody}`);
  }

  return res.json() as Promise<ClioPaginatedResponse<T>>;
}

async function fetchAllPages<T>(
  integration: ClioIntegration,
  initialPath: string
): Promise<T[]> {
  const allRecords: T[] = [];

  let result = await fetchClioPage<T>(integration, initialPath);
  allRecords.push(...result.data);

  while (result.meta.paging?.next) {
    result = await fetchClioPage<T>(integration, result.meta.paging.next);
    allRecords.push(...result.data);
  }

  return allRecords;
}

// ============================================================================
// FETCH OPERATIONS
// ============================================================================

/**
 * Fetch contacts from Clio
 */
export async function fetchClioContacts(
  integration: ClioIntegration,
  options: { limit?: number; modifiedSince?: string } = {}
): Promise<ClioContact[]> {
  const limit = options.limit || 200;
  const fields = 'id,etag,name,first_name,last_name,type,prefix,title,company,primary_email_address,primary_phone_number,email_addresses,phone_numbers,addresses,created_at,updated_at';

  let path = `/contacts.json?fields=${fields}&limit=${limit}&order=updated_at(desc)`;

  if (options.modifiedSince) {
    path += `&updated_since=${encodeURIComponent(options.modifiedSince)}`;
  }

  return fetchAllPages<ClioContact>(integration, path);
}

/**
 * Fetch specific contacts by IDs
 */
export async function fetchClioContactsByIds(
  integration: ClioIntegration,
  ids: string[]
): Promise<ClioContact[]> {
  const contacts: ClioContact[] = [];
  const client = await getClioClient(integration);
  const fields = 'id,etag,name,first_name,last_name,type,prefix,title,company,primary_email_address,primary_phone_number,email_addresses,phone_numbers,addresses,created_at,updated_at';

  for (const id of ids) {
    try {
      const res = await client.fetch(`/contacts/${id}.json?fields=${fields}`);
      if (res.ok) {
        const data = await res.json();
        contacts.push(data.data);
      }
    } catch {
      // Skip individual failures
    }
  }

  return contacts;
}

/**
 * Fetch calendar entries from Clio
 */
export async function fetchClioCalendarEntries(
  integration: ClioIntegration,
  options: { limit?: number; modifiedSince?: string } = {}
): Promise<ClioCalendarEntry[]> {
  const limit = options.limit || 200;
  const fields = 'id,etag,summary,description,start_at,end_at,all_day,location,recurrence_rule,matter,attendees,calendar_owner,created_at,updated_at';

  let path = `/calendar_entries.json?fields=${fields}&limit=${limit}&order=start_at(desc)`;

  if (options.modifiedSince) {
    path += `&updated_since=${encodeURIComponent(options.modifiedSince)}`;
  }

  return fetchAllPages<ClioCalendarEntry>(integration, path);
}

/**
 * Fetch active users from Clio firm
 */
export async function fetchClioUsers(
  integration: ClioIntegration
): Promise<ClioUser[]> {
  const fields = 'id,name,first_name,last_name,email,enabled,subscription_type,account_owner,created_at,updated_at';
  const path = `/users.json?fields=${fields}&limit=200&order=name(asc)`;

  return fetchAllPages<ClioUser>(integration, path);
}

// ============================================================================
// SYNC: CLIO → CALLENGO
// ============================================================================

/**
 * Sync specific Clio Contacts (by ID) into Callengo contacts table
 */
export async function syncSelectedClioContacts(
  integration: ClioIntegration,
  clioIds: string[]
): Promise<ClioSyncResult> {
  const result: ClioSyncResult = {
    contacts_created: 0,
    contacts_updated: 0,
    contacts_skipped: 0,
    errors: [],
  };

  try {
    const clioContacts = await fetchClioContactsByIds(integration, clioIds);

    for (const clioContact of clioContacts) {
      try {
        const contactId = String(clioContact.id);

        const { data: existingMapping } = await supabaseAdmin
          .from('clio_contact_mappings')
          .select('id, callengo_contact_id')
          .eq('integration_id', integration.id)
          .eq('clio_contact_id', contactId)
          .maybeSingle();

        const email = clioContact.primary_email_address || null;
        const phone = clioContact.primary_phone_number || '';
        const contactData = {
          company_id: integration.company_id,
          contact_name: clioContact.name || `${clioContact.first_name || ''} ${clioContact.last_name || ''}`.trim(),
          email,
          phone_number: phone,
          company_name: clioContact.company?.name || 'Unknown',
          source: 'clio',
          tags: ['clio-import'],
          custom_fields: {
            clio_contact_id: clioContact.id,
            clio_first_name: clioContact.first_name,
            clio_last_name: clioContact.last_name,
            clio_type: clioContact.type,
            clio_title: clioContact.title,
            clio_prefix: clioContact.prefix,
            clio_addresses: clioContact.addresses,
          },
        };

        if (existingMapping?.callengo_contact_id) {
          await supabaseAdmin.from('contacts').update(contactData).eq('id', existingMapping.callengo_contact_id);
          await supabaseAdmin.from('clio_contact_mappings').update({ last_synced_at: new Date().toISOString() }).eq('id', existingMapping.id);
          result.contacts_updated++;
        } else {
          let duplicateId: string | null = null;
          if (email) {
            const { data: byEmail } = await supabaseAdmin.from('contacts').select('id').eq('company_id', integration.company_id).eq('email', email).maybeSingle();
            if (byEmail) duplicateId = byEmail.id;
          }
          if (!duplicateId && phone) {
            const { data: byPhone } = await supabaseAdmin.from('contacts').select('id').eq('company_id', integration.company_id).eq('phone_number', phone).maybeSingle();
            if (byPhone) duplicateId = byPhone.id;
          }

          let callengoContactId: string;
          if (duplicateId) {
            await supabaseAdmin.from('contacts').update(contactData).eq('id', duplicateId);
            callengoContactId = duplicateId;
            result.contacts_updated++;
          } else {
            const { data: newContact, error: insertError } = await supabaseAdmin.from('contacts').insert(contactData).select('id').single();
            if (insertError || !newContact) { result.errors.push(`Failed to create contact for Clio ID ${clioContact.id}: ${insertError?.message}`); result.contacts_skipped++; continue; }
            callengoContactId = newContact.id;
            result.contacts_created++;
          }

          await supabaseAdmin.from('clio_contact_mappings').insert({
            company_id: integration.company_id,
            integration_id: integration.id,
            callengo_contact_id: callengoContactId,
            clio_contact_id: contactId,
            clio_contact_type: clioContact.type || 'Person',
            last_synced_at: new Date().toISOString(),
            sync_direction: 'inbound',
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error syncing Clio Contact ${clioContact.id}: ${msg}`);
        result.contacts_skipped++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`Failed to fetch selected Clio contacts: ${msg}`);
  }

  return result;
}

/**
 * Sync Clio Contacts into Callengo contacts table
 */
export async function syncClioContactsToCallengo(
  integration: ClioIntegration
): Promise<ClioSyncResult> {
  const result: ClioSyncResult = {
    contacts_created: 0,
    contacts_updated: 0,
    contacts_skipped: 0,
    errors: [],
  };

  try {
    const clioContacts = await fetchClioContacts(integration, {
      modifiedSince: integration.last_synced_at || undefined,
    });

    for (const clioContact of clioContacts) {
      try {
        const contactId = String(clioContact.id);

        // Check if mapping already exists
        const { data: existingMapping } = await supabaseAdmin
          .from('clio_contact_mappings')
          .select('id, callengo_contact_id')
          .eq('integration_id', integration.id)
          .eq('clio_contact_id', contactId)
          .maybeSingle();

        const email = clioContact.primary_email_address || null;
        const phone = clioContact.primary_phone_number || '';
        const contactData = {
          company_id: integration.company_id,
          contact_name: clioContact.name || `${clioContact.first_name || ''} ${clioContact.last_name || ''}`.trim(),
          email,
          phone_number: phone,
          company_name: clioContact.company?.name || 'Unknown',
          source: 'clio',
          tags: ['clio-import'],
          custom_fields: {
            clio_contact_id: clioContact.id,
            clio_first_name: clioContact.first_name,
            clio_last_name: clioContact.last_name,
            clio_type: clioContact.type,
            clio_title: clioContact.title,
            clio_prefix: clioContact.prefix,
            clio_addresses: clioContact.addresses,
          },
        };

        if (existingMapping?.callengo_contact_id) {
          // Update existing contact
          await supabaseAdmin
            .from('contacts')
            .update(contactData)
            .eq('id', existingMapping.callengo_contact_id);

          await supabaseAdmin
            .from('clio_contact_mappings')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', existingMapping.id);

          result.contacts_updated++;
        } else {
          // Check for duplicate by email or phone
          let duplicateId: string | null = null;
          if (email) {
            const { data: byEmail } = await supabaseAdmin
              .from('contacts')
              .select('id')
              .eq('company_id', integration.company_id)
              .eq('email', email)
              .maybeSingle();
            if (byEmail) duplicateId = byEmail.id;
          }

          if (!duplicateId && phone) {
            const { data: byPhone } = await supabaseAdmin
              .from('contacts')
              .select('id')
              .eq('company_id', integration.company_id)
              .eq('phone_number', phone)
              .maybeSingle();
            if (byPhone) duplicateId = byPhone.id;
          }

          let callengoContactId: string;
          if (duplicateId) {
            // Update existing contact with Clio data
            await supabaseAdmin
              .from('contacts')
              .update(contactData)
              .eq('id', duplicateId);
            callengoContactId = duplicateId;
            result.contacts_updated++;
          } else {
            // Create new contact
            const { data: newContact, error: insertError } = await supabaseAdmin
              .from('contacts')
              .insert(contactData)
              .select('id')
              .single();

            if (insertError || !newContact) {
              result.errors.push(`Failed to create contact for Clio ID ${clioContact.id}: ${insertError?.message}`);
              result.contacts_skipped++;
              continue;
            }
            callengoContactId = newContact.id;
            result.contacts_created++;
          }

          // Create mapping
          await supabaseAdmin
            .from('clio_contact_mappings')
            .insert({
              company_id: integration.company_id,
              integration_id: integration.id,
              callengo_contact_id: callengoContactId,
              clio_contact_id: contactId,
              clio_contact_type: clioContact.type || 'Person',
              last_synced_at: new Date().toISOString(),
              sync_direction: 'inbound',
            });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error syncing Clio Contact ${clioContact.id}: ${msg}`);
        result.contacts_skipped++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`Failed to fetch Clio contacts: ${msg}`);
  }

  return result;
}

// ============================================================================
// OUTBOUND SYNC: CALLENGO → CLIO
// ============================================================================

/**
 * Update a Clio Contact with Callengo contact data
 */
export async function pushContactToClio(
  integration: ClioIntegration,
  callengoContactId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: mapping } = await supabaseAdmin
    .from('clio_contact_mappings')
    .select('clio_contact_id')
    .eq('integration_id', integration.id)
    .eq('callengo_contact_id', callengoContactId)
    .maybeSingle();

  if (!mapping?.clio_contact_id) {
    return { success: false, error: 'No Clio mapping found for this contact' };
  }

  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .eq('id', callengoContactId)
    .single();

  if (!contact) {
    return { success: false, error: 'Contact not found in Callengo' };
  }

  const client = await getClioClient(integration);

  // Build update payload following Clio API v4 format
  const updatePayload: Record<string, unknown> = {};
  if (contact.contact_name) {
    const nameParts = (contact.contact_name as string).split(' ');
    updatePayload.first_name = nameParts[0] || '';
    updatePayload.last_name = nameParts.slice(1).join(' ') || '';
  }
  if (contact.email) {
    updatePayload.email_addresses = [{ name: 'Work', address: contact.email, default_email: true }];
  }
  if (contact.phone_number) {
    updatePayload.phone_numbers = [{ name: 'Work', number: contact.phone_number, default_number: true }];
  }

  const res = await client.fetch(`/contacts/${mapping.clio_contact_id}.json`, {
    method: 'PATCH',
    body: JSON.stringify({ data: updatePayload }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    return { success: false, error: `Clio API error ${res.status}: ${errBody}` };
  }

  // Update mapping direction
  await supabaseAdmin
    .from('clio_contact_mappings')
    .update({
      last_synced_at: new Date().toISOString(),
      sync_direction: 'bidirectional',
    })
    .eq('integration_id', integration.id)
    .eq('callengo_contact_id', callengoContactId);

  return { success: true };
}

/**
 * Create a Clio Note on a Contact (for call transcripts, AI analysis, etc.)
 */
export async function createClioNote(
  integration: ClioIntegration,
  note: { subject: string; detail: string; contactId: number }
): Promise<{ success: boolean; noteId?: number; error?: string }> {
  const client = await getClioClient(integration);

  const res = await client.fetch('/notes.json', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        subject: note.subject,
        detail: note.detail,
        type: 'Contact',
        regarding: { id: note.contactId, type: 'Contact' },
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    return { success: false, error: `Clio API error ${res.status}: ${errBody}` };
  }

  const data = await res.json();
  return { success: true, noteId: data.data?.id };
}

/**
 * Build a formatted HTML note from call data for Clio
 */
function buildClioCallNoteContent(contact: Record<string, unknown>): string {
  const parts: string[] = [];

  parts.push('<b>Callengo Call Log</b>');
  parts.push(`<b>Date:</b> ${contact.last_call_date || new Date().toISOString()}`);

  if (contact.call_status) parts.push(`<b>Call Status:</b> ${contact.call_status}`);
  if (contact.call_outcome) parts.push(`<b>Outcome:</b> ${contact.call_outcome}`);
  if (contact.status) parts.push(`<b>Contact Status:</b> ${contact.status}`);

  if (contact.call_duration) {
    const mins = Math.floor((contact.call_duration as number) / 60);
    const secs = (contact.call_duration as number) % 60;
    parts.push(`<b>Duration:</b> ${mins}m ${secs}s`);
  }

  const analysis = contact.analysis as Record<string, unknown> | null;
  if (analysis) {
    if (analysis.callSentiment) parts.push(`<b>Sentiment:</b> ${analysis.callSentiment}`);
    if (analysis.customerInterestLevel) parts.push(`<b>Interest Level:</b> ${analysis.customerInterestLevel}`);
    if (analysis.callCategory) parts.push(`<b>Category:</b> ${analysis.callCategory}`);
    if (analysis.outcomeNotes) parts.push(`<b>Notes:</b> ${analysis.outcomeNotes}`);
    if (analysis.keyPoints && Array.isArray(analysis.keyPoints) && analysis.keyPoints.length > 0) {
      parts.push(`<b>Key Points:</b><br/>- ${(analysis.keyPoints as string[]).join('<br/>- ')}`);
    }
    if (analysis.followUpRequired) {
      parts.push(`<b>Follow-up Required:</b> Yes${analysis.followUpReason ? ` — ${analysis.followUpReason}` : ''}`);
    }
  }

  const metadata = contact.call_metadata as Record<string, unknown> | null;
  if (metadata?.summary) parts.push(`<br/><b>AI Summary:</b><br/>${metadata.summary}`);
  if (metadata?.answeredBy) parts.push(`<b>Answered By:</b> ${metadata.answeredBy}`);

  if (contact.notes) parts.push(`<br/><b>Manual Notes:</b><br/>${contact.notes}`);

  return parts.join('<br/>');
}

/**
 * Map a Callengo call status to a Clio note subject
 */
function mapCallStatusToClioSubject(callStatus: string, callOutcome: string | null, contactName: string): string {
  switch (callStatus) {
    case 'completed':
      return `Call completed: ${contactName}`;
    case 'no_answer':
      return `No answer: ${contactName}`;
    case 'voicemail':
      return `Voicemail left: ${contactName}`;
    case 'busy':
      return `Busy/unavailable: ${contactName}`;
    case 'failed':
      return `Call failed: ${contactName}`;
    default:
      if (callOutcome === 'Follow-up Scheduled') {
        return `Follow-up needed: ${contactName}`;
      }
      return `Call: ${contactName}`;
  }
}

/**
 * Push a single call result to Clio (Contact Note).
 * Called from the Bland webhook after a call completes.
 */
export async function pushCallResultToClio(
  integration: ClioIntegration,
  callengoContactId: string
): Promise<{ success: boolean; noteId?: number; error?: string }> {
  const { data: mapping } = await supabaseAdmin
    .from('clio_contact_mappings')
    .select('clio_contact_id')
    .eq('integration_id', integration.id)
    .eq('callengo_contact_id', callengoContactId)
    .maybeSingle();

  if (!mapping?.clio_contact_id) {
    return { success: false, error: 'No Clio mapping for this contact' };
  }

  const clioContactId = Number(mapping.clio_contact_id);

  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .eq('id', callengoContactId)
    .single();

  if (!contact) {
    return { success: false, error: 'Contact not found' };
  }

  const contactName = (contact.contact_name as string) || (contact.phone_number as string) || 'Unknown';
  const callStatus = (contact.call_status as string) || 'completed';
  const callOutcome = (contact.call_outcome as string) || null;

  // Create Contact Note with call details
  const subject = mapCallStatusToClioSubject(callStatus, callOutcome, contactName);
  const detail = buildClioCallNoteContent(contact as Record<string, unknown>);

  const noteResult = await createClioNote(integration, {
    subject,
    detail,
    contactId: clioContactId,
  });

  // Push updated contact info back to Clio
  await pushContactToClio(integration, callengoContactId);

  // Update mapping sync direction
  await supabaseAdmin
    .from('clio_contact_mappings')
    .update({
      last_synced_at: new Date().toISOString(),
      sync_direction: 'bidirectional',
    })
    .eq('integration_id', integration.id)
    .eq('callengo_contact_id', callengoContactId);

  return { success: true, noteId: noteResult.noteId };
}

/**
 * Bulk outbound sync: push all recently updated Callengo contacts to Clio.
 */
export async function pushContactUpdatesToClio(
  integration: ClioIntegration
): Promise<ClioOutboundSyncResult> {
  const result: ClioOutboundSyncResult = {
    contacts_pushed: 0,
    notes_created: 0,
    errors: [],
  };

  try {
    const { data: mappings } = await supabaseAdmin
      .from('clio_contact_mappings')
      .select('callengo_contact_id, clio_contact_id, last_synced_at')
      .eq('integration_id', integration.id);

    if (!mappings || mappings.length === 0) return result;

    for (const mapping of mappings) {
      try {
        const { data: contact } = await supabaseAdmin
          .from('contacts')
          .select('*')
          .eq('id', mapping.callengo_contact_id)
          .single();

        if (!contact) continue;

        // Only sync contacts updated after last sync
        const contactUpdated = new Date(contact.updated_at as string).getTime();
        const lastSynced = mapping.last_synced_at ? new Date(mapping.last_synced_at).getTime() : 0;
        if (contactUpdated <= lastSynced) continue;

        // Push contact data update
        const pushResult = await pushContactToClio(integration, mapping.callengo_contact_id);
        if (pushResult.success) {
          result.contacts_pushed++;
        } else if (pushResult.error) {
          result.errors.push(`Contact ${mapping.callengo_contact_id}: ${pushResult.error}`);
        }

        // If there's a completed call, push note
        if (contact.call_status && contact.call_status !== 'pending' && contact.call_status !== 'queued') {
          const callResult = await pushCallResultToClio(integration, mapping.callengo_contact_id);
          if (callResult.noteId) result.notes_created++;
          if (!callResult.success && callResult.error) {
            result.errors.push(`Call sync for ${mapping.callengo_contact_id}: ${callResult.error}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error pushing contact ${mapping.callengo_contact_id}: ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`Outbound sync failed: ${msg}`);
  }

  return result;
}

/**
 * Get the active Clio integration for a company (helper for webhook use).
 */
export async function getActiveClioIntegration(
  companyId: string
): Promise<ClioIntegration | null> {
  const { data } = await supabaseAdmin
    .from('clio_integrations')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  return (data as unknown as ClioIntegration) || null;
}
