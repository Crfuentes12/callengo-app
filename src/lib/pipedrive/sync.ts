// lib/pipedrive/sync.ts
// Pipedrive data sync operations - persons, organizations, deals, activities, users

import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { getPipedriveClient } from './auth';
import type {
  PipedriveIntegration,
  PipedrivePerson,
  PipedriveOrganization,
  PipedriveDeal,
  PipedriveActivity,
  PipedriveUser,
  PipedriveApiResponse,
  PipedriveSyncResult,
  PipedriveOutboundSyncResult,
  PipedriveActivityCreate,
  PipedriveNoteCreate,
} from '@/types/pipedrive';

// ============================================================================
// SCOPE HELPERS
// ============================================================================

/**
 * Required scopes for each Pipedrive resource.
 * Configured in Pipedrive Marketplace Manager → OAuth & Access scopes.
 * Full access is needed for bidirectional sync (read + write).
 */
const REQUIRED_SCOPES: Record<string, string[]> = {
  persons: ['contacts:read', 'contacts:full'],
  persons_write: ['contacts:full'],
  organizations: ['contacts:read', 'contacts:full'],
  deals: ['deals:read', 'deals:full'],
  deals_write: ['deals:full'],
  activities: ['activities:read', 'activities:full'],
  activities_write: ['activities:full'],
  users: ['users:read'],
};

/**
 * Check if the integration has the required scope for a resource.
 * Returns true if scopes array is null/empty (legacy integrations or scope not tracked).
 */
export function hasScope(integration: PipedriveIntegration, resource: keyof typeof REQUIRED_SCOPES): boolean {
  if (!integration.scopes || integration.scopes.length === 0) return true;
  const required = REQUIRED_SCOPES[resource];
  if (!required) return true;
  return required.some((scope) => integration.scopes!.includes(scope));
}

// ============================================================================
// API QUERY HELPERS
// ============================================================================

async function fetchAllPages<T>(
  integration: PipedriveIntegration,
  path: string,
  queryParams: Record<string, string> = {}
): Promise<T[]> {
  const client = await getPipedriveClient(integration);
  const allResults: T[] = [];
  let start = 0;
  const limit = 100;

  do {
    const params = new URLSearchParams({
      ...queryParams,
      start: String(start),
      limit: String(limit),
    });

    const url = `${path}?${params.toString()}`;
    const res = await client.fetch(url);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '(could not read error body)');
      throw new Error(`Pipedrive API request failed (${res.status}): ${errBody}`);
    }

    const data = (await res.json()) as PipedriveApiResponse<T[]>;

    if (!data.success || !data.data) {
      break;
    }

    allResults.push(...data.data);

    const pagination = data.additional_data?.pagination;
    if (pagination?.more_items_in_collection && pagination.next_start !== undefined) {
      start = pagination.next_start;
    } else {
      break;
    }
  } while (true);

  return allResults;
}

// ============================================================================
// FETCH OPERATIONS
// ============================================================================

/**
 * Fetch persons (contacts) from Pipedrive
 */
export async function fetchPipedrivePersons(
  integration: PipedriveIntegration,
  options: { limit?: number; start?: number; modifiedSince?: string } = {}
): Promise<PipedrivePerson[]> {
  if (!hasScope(integration, 'persons')) {
    console.warn('Pipedrive integration missing contacts:read scope — skipping persons fetch');
    return [];
  }
  const queryParams: Record<string, string> = {};
  if (options.modifiedSince) {
    queryParams.since = options.modifiedSince;
  }
  if (options.limit) {
    queryParams.limit = String(options.limit);
  }

  return fetchAllPages<PipedrivePerson>(integration, '/api/v1/persons', queryParams);
}

/**
 * Fetch organizations from Pipedrive
 */
export async function fetchPipedriveOrganizations(
  integration: PipedriveIntegration,
  options: { limit?: number } = {}
): Promise<PipedriveOrganization[]> {
  if (!hasScope(integration, 'organizations')) {
    console.warn('Pipedrive integration missing contacts:read scope — skipping organizations fetch');
    return [];
  }
  const queryParams: Record<string, string> = {};
  if (options.limit) {
    queryParams.limit = String(options.limit);
  }

  return fetchAllPages<PipedriveOrganization>(integration, '/api/v1/organizations', queryParams);
}

/**
 * Fetch deals from Pipedrive
 */
export async function fetchPipedriveDeals(
  integration: PipedriveIntegration,
  options: { limit?: number; status?: string } = {}
): Promise<PipedriveDeal[]> {
  if (!hasScope(integration, 'deals')) {
    console.warn('Pipedrive integration missing deals:read scope — skipping deals fetch');
    return [];
  }
  const queryParams: Record<string, string> = {};
  if (options.limit) {
    queryParams.limit = String(options.limit);
  }
  if (options.status) {
    queryParams.status = options.status;
  }

  return fetchAllPages<PipedriveDeal>(integration, '/api/v1/deals', queryParams);
}

/**
 * Fetch activities from Pipedrive
 */
export async function fetchPipedriveActivities(
  integration: PipedriveIntegration,
  options: { limit?: number; done?: boolean } = {}
): Promise<PipedriveActivity[]> {
  if (!hasScope(integration, 'activities')) {
    console.warn('Pipedrive integration missing activities:read scope — skipping activities fetch');
    return [];
  }
  const queryParams: Record<string, string> = {};
  if (options.limit) {
    queryParams.limit = String(options.limit);
  }
  if (options.done !== undefined) {
    queryParams.done = options.done ? '1' : '0';
  }

  return fetchAllPages<PipedriveActivity>(integration, '/api/v1/activities', queryParams);
}

/**
 * Fetch active users from Pipedrive account
 */
export async function fetchPipedriveUsers(
  integration: PipedriveIntegration
): Promise<PipedriveUser[]> {
  if (!hasScope(integration, 'users')) {
    console.warn('Pipedrive integration missing users:read scope — skipping users fetch');
    return [];
  }
  const client = await getPipedriveClient(integration);

  const res = await client.fetch('/api/v1/users');

  if (!res.ok) {
    const errBody = await res.text().catch(() => '(could not read error body)');
    throw new Error(`Pipedrive users fetch failed (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as PipedriveApiResponse<PipedriveUser[]>;
  return data.data || [];
}

// ============================================================================
// SYNC: PIPEDRIVE → CALLENGO
// ============================================================================

/**
 * Helper to extract the primary email from a Pipedrive person
 */
function getPrimaryEmail(person: PipedrivePerson): string | null {
  if (!person.email || person.email.length === 0) return null;
  const primary = person.email.find((e) => e.primary);
  return (primary?.value || person.email[0]?.value) || null;
}

/**
 * Helper to extract the primary phone from a Pipedrive person
 */
function getPrimaryPhone(person: PipedrivePerson): string | null {
  if (!person.phone || person.phone.length === 0) return null;
  const primary = person.phone.find((p) => p.primary);
  return (primary?.value || person.phone[0]?.value) || null;
}

/**
 * Fetch specific Pipedrive Persons by IDs
 */
export async function fetchPipedrivePersonsByIds(
  integration: PipedriveIntegration,
  ids: number[]
): Promise<PipedrivePerson[]> {
  const client = await getPipedriveClient(integration);
  const persons: PipedrivePerson[] = [];

  for (const id of ids) {
    const res = await client.fetch(`/api/v1/persons/${id}`);
    if (res.ok) {
      const data = (await res.json()) as PipedriveApiResponse<PipedrivePerson>;
      if (data.success && data.data) {
        persons.push(data.data);
      }
    }
  }

  return persons;
}

/**
 * Sync specific Pipedrive Persons (by ID) into Callengo contacts table
 */
export async function syncSelectedPipedrivePersons(
  integration: PipedriveIntegration,
  pdIds: number[]
): Promise<PipedriveSyncResult> {
  const result: PipedriveSyncResult = {
    persons_created: 0,
    persons_updated: 0,
    persons_skipped: 0,
    errors: [],
  };

  try {
    const persons = await fetchPipedrivePersonsByIds(integration, pdIds);

    for (const person of persons) {
      try {
        const pdPersonId = String(person.id);
        const { data: existingMapping } = await supabaseAdmin
          .from('pipedrive_contact_mappings')
          .select('id, callengo_contact_id')
          .eq('integration_id', integration.id)
          .eq('pd_person_id', pdPersonId)
          .maybeSingle();

        const email = getPrimaryEmail(person);
        const phoneNumber = getPrimaryPhone(person) || '';
        const contactName = person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unknown';
        const orgName = person.org_id?.name || 'Unknown';

        const contactData = {
          company_id: integration.company_id,
          contact_name: contactName,
          email: email || null,
          phone_number: phoneNumber,
          company_name: orgName,
          source: 'pipedrive',
          tags: ['pipedrive-import'],
          custom_fields: {
            pd_person_id: person.id,
            pd_first_name: person.first_name,
            pd_last_name: person.last_name,
            pd_org_id: person.org_id?.value,
            pd_org_name: person.org_id?.name,
            pd_owner_name: person.owner_id?.name,
            pd_open_deals: person.open_deals_count,
            pd_closed_deals: person.closed_deals_count,
            pd_label: person.label,
          },
        };

        if (existingMapping?.callengo_contact_id) {
          await supabaseAdmin.from('contacts').update(contactData).eq('id', existingMapping.callengo_contact_id);
          await supabaseAdmin.from('pipedrive_contact_mappings').update({ last_synced_at: new Date().toISOString() }).eq('id', existingMapping.id);
          result.persons_updated++;
        } else {
          let duplicateId: string | null = null;
          if (email) {
            const { data: byEmail } = await supabaseAdmin.from('contacts').select('id').eq('company_id', integration.company_id).eq('email', email).maybeSingle();
            if (byEmail) duplicateId = byEmail.id;
          }
          if (!duplicateId && phoneNumber) {
            const { data: byPhone } = await supabaseAdmin.from('contacts').select('id').eq('company_id', integration.company_id).eq('phone_number', phoneNumber).maybeSingle();
            if (byPhone) duplicateId = byPhone.id;
          }

          let callengoContactId: string;
          if (duplicateId) {
            await supabaseAdmin.from('contacts').update(contactData).eq('id', duplicateId);
            callengoContactId = duplicateId;
            result.persons_updated++;
          } else {
            const { data: newContact, error: insertError } = await supabaseAdmin.from('contacts').insert(contactData).select('id').single();
            if (insertError || !newContact) {
              result.errors.push(`Failed to create contact for PD Person ${person.id}: ${insertError?.message}`);
              result.persons_skipped++;
              continue;
            }
            callengoContactId = newContact.id;
            result.persons_created++;
          }

          await supabaseAdmin.from('pipedrive_contact_mappings').insert({
            company_id: integration.company_id,
            integration_id: integration.id,
            callengo_contact_id: callengoContactId,
            pd_person_id: pdPersonId,
            pd_object_type: 'Person',
            last_synced_at: new Date().toISOString(),
            sync_direction: 'inbound',
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error syncing PD Person ${person.id}: ${msg}`);
        result.persons_skipped++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`Failed to fetch selected Pipedrive persons: ${msg}`);
  }

  return result;
}

/**
 * Sync Pipedrive Persons into Callengo contacts table (full sync)
 */
export async function syncPipedrivePersonsToCallengo(
  integration: PipedriveIntegration
): Promise<PipedriveSyncResult> {
  const result: PipedriveSyncResult = {
    persons_created: 0,
    persons_updated: 0,
    persons_skipped: 0,
    errors: [],
  };

  try {
    const persons = await fetchPipedrivePersons(integration, {
      modifiedSince: integration.last_synced_at || undefined,
    });

    for (const person of persons) {
      try {
        const pdPersonId = String(person.id);
        // Check if mapping already exists
        const { data: existingMapping } = await supabaseAdmin
          .from('pipedrive_contact_mappings')
          .select('id, callengo_contact_id')
          .eq('integration_id', integration.id)
          .eq('pd_person_id', pdPersonId)
          .maybeSingle();

        const email = getPrimaryEmail(person);
        const phoneNumber = getPrimaryPhone(person) || '';
        const contactName = person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Unknown';
        const orgName = person.org_id?.name || 'Unknown';

        const contactData = {
          company_id: integration.company_id,
          contact_name: contactName,
          email: email || null,
          phone_number: phoneNumber,
          company_name: orgName,
          source: 'pipedrive',
          tags: ['pipedrive-import'],
          custom_fields: {
            pd_person_id: person.id,
            pd_first_name: person.first_name,
            pd_last_name: person.last_name,
            pd_org_id: person.org_id?.value,
            pd_org_name: person.org_id?.name,
            pd_owner_name: person.owner_id?.name,
            pd_open_deals: person.open_deals_count,
            pd_closed_deals: person.closed_deals_count,
            pd_label: person.label,
          },
        };

        if (existingMapping?.callengo_contact_id) {
          // Update existing contact
          await supabaseAdmin
            .from('contacts')
            .update(contactData)
            .eq('id', existingMapping.callengo_contact_id);

          await supabaseAdmin
            .from('pipedrive_contact_mappings')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', existingMapping.id);

          result.persons_updated++;
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

          if (!duplicateId && phoneNumber) {
            const { data: byPhone } = await supabaseAdmin
              .from('contacts')
              .select('id')
              .eq('company_id', integration.company_id)
              .eq('phone_number', phoneNumber)
              .maybeSingle();
            if (byPhone) duplicateId = byPhone.id;
          }

          let callengoContactId: string;
          if (duplicateId) {
            // Update existing contact with PD data
            await supabaseAdmin
              .from('contacts')
              .update(contactData)
              .eq('id', duplicateId);
            callengoContactId = duplicateId;
            result.persons_updated++;
          } else {
            // Create new contact
            const { data: newContact, error: insertError } = await supabaseAdmin
              .from('contacts')
              .insert(contactData)
              .select('id')
              .single();

            if (insertError || !newContact) {
              result.errors.push(`Failed to create contact for PD Person ${person.id}: ${insertError?.message}`);
              result.persons_skipped++;
              continue;
            }
            callengoContactId = newContact.id;
            result.persons_created++;
          }

          // Create mapping
          await supabaseAdmin
            .from('pipedrive_contact_mappings')
            .insert({
              company_id: integration.company_id,
              integration_id: integration.id,
              callengo_contact_id: callengoContactId,
              pd_person_id: pdPersonId,
              pd_object_type: 'Person',
              last_synced_at: new Date().toISOString(),
              sync_direction: 'inbound',
            });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error syncing PD Person ${person.id}: ${msg}`);
        result.persons_skipped++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`Failed to fetch Pipedrive persons: ${msg}`);
  }

  return result;
}

// ============================================================================
// OUTBOUND SYNC: CALLENGO → PIPEDRIVE
// ============================================================================

/**
 * Update a Pipedrive Person with Callengo contact data
 */
export async function pushContactToPipedrive(
  integration: PipedriveIntegration,
  callengoContactId: string
): Promise<{ success: boolean; error?: string }> {
  if (!hasScope(integration, 'persons_write')) {
    return { success: false, error: 'Missing contacts:full scope for writing to Pipedrive' };
  }

  // Get mapping
  const { data: mapping } = await supabaseAdmin
    .from('pipedrive_contact_mappings')
    .select('pd_person_id')
    .eq('integration_id', integration.id)
    .eq('callengo_contact_id', callengoContactId)
    .maybeSingle();

  if (!mapping?.pd_person_id) {
    return { success: false, error: 'No Pipedrive mapping found for this contact' };
  }

  // Get Callengo contact data
  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .eq('id', callengoContactId)
    .single();

  if (!contact) {
    return { success: false, error: 'Contact not found in Callengo' };
  }

  const client = await getPipedriveClient(integration);

  // Build update payload
  const updatePayload: Record<string, unknown> = {};

  if (contact.contact_name) {
    updatePayload.name = contact.contact_name;
  }
  if (contact.email) {
    updatePayload.email = [{ value: contact.email, primary: true, label: 'work' }];
  }
  if (contact.phone_number) {
    updatePayload.phone = [{ value: contact.phone_number, primary: true, label: 'work' }];
  }

  const res = await client.fetch(`/api/v1/persons/${mapping.pd_person_id}`, {
    method: 'PUT',
    body: JSON.stringify(updatePayload),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    return { success: false, error: `Pipedrive API error ${res.status}: ${errBody}` };
  }

  // Update mapping direction
  await supabaseAdmin
    .from('pipedrive_contact_mappings')
    .update({
      last_synced_at: new Date().toISOString(),
      sync_direction: 'bidirectional',
    })
    .eq('integration_id', integration.id)
    .eq('callengo_contact_id', callengoContactId);

  return { success: true };
}

/**
 * Create a Pipedrive Activity (for logging calls, no-shows, follow-ups, etc.)
 */
export async function createPipedriveActivity(
  integration: PipedriveIntegration,
  activity: PipedriveActivityCreate
): Promise<{ success: boolean; activityId?: number; error?: string }> {
  if (!hasScope(integration, 'activities_write')) {
    return { success: false, error: 'Missing activities:full scope for creating activities in Pipedrive' };
  }

  const client = await getPipedriveClient(integration);

  const res = await client.fetch('/api/v1/activities', {
    method: 'POST',
    body: JSON.stringify(activity),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    return { success: false, error: `Pipedrive API error ${res.status}: ${errBody}` };
  }

  const data = (await res.json()) as PipedriveApiResponse<{ id: number }>;
  return { success: true, activityId: data.data?.id };
}

/**
 * Create a Pipedrive Note on a Person (for call transcripts, AI analysis, etc.)
 */
export async function createPipedriveNote(
  integration: PipedriveIntegration,
  note: PipedriveNoteCreate
): Promise<{ success: boolean; noteId?: number; error?: string }> {
  // Notes use the base scope (no dedicated scope needed)
  const client = await getPipedriveClient(integration);

  const res = await client.fetch('/api/v1/notes', {
    method: 'POST',
    body: JSON.stringify(note),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    return { success: false, error: `Pipedrive API error ${res.status}: ${errBody}` };
  }

  const data = (await res.json()) as PipedriveApiResponse<{ id: number }>;
  return { success: true, noteId: data.data?.id };
}

// ============================================================================
// CALL RESULT SYNC: Push call outcomes to Pipedrive
// ============================================================================

/**
 * Map a Callengo call status to a Pipedrive activity type and subject
 */
function mapCallStatusToActivity(callStatus: string, callOutcome: string | null, contactName: string): {
  subject: string;
  type: string;
  done: boolean;
} {
  switch (callStatus) {
    case 'completed':
      return { subject: `Call completed: ${contactName}`, type: 'call', done: true };
    case 'no_answer':
      return { subject: `No answer: ${contactName}`, type: 'call', done: true };
    case 'voicemail':
      return { subject: `Voicemail left: ${contactName}`, type: 'call', done: true };
    case 'busy':
      return { subject: `Busy/unavailable: ${contactName}`, type: 'call', done: true };
    case 'failed':
      return { subject: `Call failed: ${contactName}`, type: 'call', done: true };
    default:
      if (callOutcome === 'Follow-up Scheduled') {
        return { subject: `Follow-up needed: ${contactName}`, type: 'task', done: false };
      }
      return {
        subject: `Call: ${contactName}`,
        type: 'call',
        done: callStatus !== 'pending' && callStatus !== 'queued' && callStatus !== 'in_progress',
      };
  }
}

/**
 * Build a formatted HTML note from call data for Pipedrive
 */
function buildCallNoteContent(contact: Record<string, unknown>): string {
  const parts: string[] = [];

  parts.push('<b>Callengo Call Log</b>');
  parts.push(`<b>Date:</b> ${contact.last_call_date || new Date().toISOString()}`);

  if (contact.call_status) parts.push(`<b>Status:</b> ${contact.call_status}`);
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
 * Push a single call result to Pipedrive (Activity + Note on the Person).
 * Called from the Bland webhook after a call completes.
 */
export async function pushCallResultToPipedrive(
  integration: PipedriveIntegration,
  callengoContactId: string
): Promise<{ success: boolean; activityId?: number; noteId?: number; error?: string }> {
  const { data: mapping } = await supabaseAdmin
    .from('pipedrive_contact_mappings')
    .select('pd_person_id')
    .eq('integration_id', integration.id)
    .eq('callengo_contact_id', callengoContactId)
    .maybeSingle();

  if (!mapping?.pd_person_id) {
    return { success: false, error: 'No Pipedrive mapping for this contact' };
  }

  const pdPersonId = Number(mapping.pd_person_id);

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

  let activityId: number | undefined;
  let noteId: number | undefined;

  // 1. Create Activity (call log entry in Pipedrive)
  if (hasScope(integration, 'activities_write')) {
    const activityInfo = mapCallStatusToActivity(callStatus, callOutcome, contactName);
    const dueDate = (contact.last_call_date as string)
      ? new Date(contact.last_call_date as string).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    const dueTime = (contact.last_call_date as string)
      ? new Date(contact.last_call_date as string).toISOString().split('T')[1]?.substring(0, 5)
      : undefined;

    let duration: string | undefined;
    if (contact.call_duration) {
      const totalMinutes = Math.ceil((contact.call_duration as number) / 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      duration = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    const metadata = contact.call_metadata as Record<string, unknown> | null;
    const activityNote = [
      callOutcome ? `Outcome: ${callOutcome}` : null,
      contact.status ? `Status: ${contact.status}` : null,
      metadata?.summary ? `Summary: ${metadata.summary}` : null,
    ].filter(Boolean).join('\n');

    const activityResult = await createPipedriveActivity(integration, {
      ...activityInfo,
      due_date: dueDate,
      due_time: dueTime,
      duration,
      person_id: pdPersonId,
      note: activityNote || undefined,
    });

    if (activityResult.success) activityId = activityResult.activityId;
  }

  // 2. Create Note with full call details
  const noteContent = buildCallNoteContent(contact as Record<string, unknown>);
  const noteResult = await createPipedriveNote(integration, {
    content: noteContent,
    person_id: pdPersonId,
  });

  if (noteResult.success) noteId = noteResult.noteId;

  // 3. Push updated contact info back to Pipedrive Person
  await pushContactToPipedrive(integration, callengoContactId);

  // Update mapping sync direction
  await supabaseAdmin
    .from('pipedrive_contact_mappings')
    .update({
      last_synced_at: new Date().toISOString(),
      sync_direction: 'bidirectional',
    })
    .eq('integration_id', integration.id)
    .eq('callengo_contact_id', callengoContactId);

  return { success: true, activityId, noteId };
}

/**
 * Bulk outbound sync: push all recently updated Callengo contacts to Pipedrive.
 */
export async function pushContactUpdatesToPipedrive(
  integration: PipedriveIntegration
): Promise<PipedriveOutboundSyncResult> {
  const result: PipedriveOutboundSyncResult = {
    persons_pushed: 0,
    activities_created: 0,
    notes_created: 0,
    errors: [],
  };

  try {
    const { data: mappings } = await supabaseAdmin
      .from('pipedrive_contact_mappings')
      .select('callengo_contact_id, pd_person_id, last_synced_at')
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
        const pushResult = await pushContactToPipedrive(integration, mapping.callengo_contact_id);
        if (pushResult.success) {
          result.persons_pushed++;
        } else if (pushResult.error) {
          result.errors.push(`Contact ${mapping.callengo_contact_id}: ${pushResult.error}`);
        }

        // If there's a completed call, push activity + note
        if (contact.call_status && contact.call_status !== 'pending' && contact.call_status !== 'queued') {
          const callResult = await pushCallResultToPipedrive(integration, mapping.callengo_contact_id);
          if (callResult.activityId) result.activities_created++;
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
 * Get the active Pipedrive integration for a company (helper for webhook use).
 */
export async function getActivePipedriveIntegration(
  companyId: string
): Promise<PipedriveIntegration | null> {
  const { data } = await supabaseAdmin
    .from('pipedrive_integrations')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  return (data as unknown as PipedriveIntegration) || null;
}
