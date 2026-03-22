// lib/hubspot/sync.ts
// HubSpot data sync operations - contacts, companies, owners

import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { getHubSpotClient } from './auth';
import type {
  HubSpotIntegration,
  HubSpotContact,
  HubSpotCompany,
  HubSpotOwner,
  HubSpotPaginatedResponse,
  HubSpotSyncResult,
  HubSpotOutboundSyncResult,
} from '@/types/hubspot';

// ============================================================================
// API QUERY HELPERS
// ============================================================================

const CONTACT_PROPERTIES = [
  'firstname', 'lastname', 'email', 'phone', 'mobilephone',
  'jobtitle', 'company', 'lifecyclestage', 'hs_lead_status',
  'address', 'city', 'state', 'zip', 'country',
  'hubspot_owner_id', 'notes_last_updated', 'createdate', 'lastmodifieddate',
];

const COMPANY_PROPERTIES = [
  'name', 'domain', 'phone', 'website', 'industry',
  'description', 'numberofemployees', 'annualrevenue',
  'city', 'state', 'country', 'createdate', 'hs_lastmodifieddate',
];

async function fetchAllPages<T>(
  integration: HubSpotIntegration,
  path: string,
  queryParams: Record<string, string> = {}
): Promise<T[]> {
  const client = await getHubSpotClient(integration);
  const allResults: T[] = [];
  let after: string | undefined;

  do {
    const params = new URLSearchParams(queryParams);
    if (after) {
      params.set('after', after);
    }

    const url = `${path}?${params.toString()}`;
    const res = await client.fetch(url);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '(could not read error body)');
      throw new Error(`HubSpot API request failed (${res.status}): ${errBody}`);
    }

    const data = (await res.json()) as HubSpotPaginatedResponse<T>;
    allResults.push(...data.results);
    after = data.paging?.next?.after;
  } while (after);

  return allResults;
}

// ============================================================================
// FETCH OPERATIONS
// ============================================================================

/**
 * Fetch contacts from HubSpot
 */
export async function fetchHubSpotContacts(
  integration: HubSpotIntegration,
  options: { limit?: number; modifiedAfter?: string } = {}
): Promise<HubSpotContact[]> {
  const client = await getHubSpotClient(integration);
  const allContacts: HubSpotContact[] = [];
  let after: string | undefined;
  const limit = options.limit || 100;
  const pageSize = Math.min(limit, 100);

  do {
    const params = new URLSearchParams({
      limit: String(pageSize),
      properties: CONTACT_PROPERTIES.join(','),
    });
    if (after) params.set('after', after);

    const url = `/crm/v3/objects/contacts?${params.toString()}`;
    const res = await client.fetch(url);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '(could not read error body)');
      throw new Error(`HubSpot contacts fetch failed (${res.status}): ${errBody}`);
    }

    const data = (await res.json()) as HubSpotPaginatedResponse<HubSpotContact>;

    // Filter by modification date if specified
    let contacts = data.results;
    if (options.modifiedAfter) {
      const modifiedAfterDate = new Date(options.modifiedAfter).getTime();
      contacts = contacts.filter(
        (c) => new Date(c.updatedAt).getTime() > modifiedAfterDate
      );
    }

    allContacts.push(...contacts);
    after = data.paging?.next?.after;

    // Stop if we've reached the limit
    if (allContacts.length >= limit) {
      return allContacts.slice(0, limit);
    }
  } while (after);

  return allContacts;
}

/**
 * Fetch companies from HubSpot
 */
export async function fetchHubSpotCompanies(
  integration: HubSpotIntegration,
  options: { limit?: number } = {}
): Promise<HubSpotCompany[]> {
  const client = await getHubSpotClient(integration);
  const allCompanies: HubSpotCompany[] = [];
  let after: string | undefined;
  const limit = options.limit || 100;
  const pageSize = Math.min(limit, 100);

  do {
    const params = new URLSearchParams({
      limit: String(pageSize),
      properties: COMPANY_PROPERTIES.join(','),
    });
    if (after) params.set('after', after);

    const url = `/crm/v3/objects/companies?${params.toString()}`;
    const res = await client.fetch(url);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '(could not read error body)');
      throw new Error(`HubSpot companies fetch failed (${res.status}): ${errBody}`);
    }

    const data = (await res.json()) as HubSpotPaginatedResponse<HubSpotCompany>;
    allCompanies.push(...data.results);
    after = data.paging?.next?.after;

    if (allCompanies.length >= limit) {
      return allCompanies.slice(0, limit);
    }
  } while (after);

  return allCompanies;
}

/**
 * Fetch owners (users) from HubSpot
 */
export async function fetchHubSpotOwners(
  integration: HubSpotIntegration
): Promise<HubSpotOwner[]> {
  return fetchAllPages<HubSpotOwner>(integration, '/crm/v3/owners', {
    limit: '100',
  });
}

/**
 * Fetch specific HubSpot Contacts by IDs
 */
export async function fetchHubSpotContactsByIds(
  integration: HubSpotIntegration,
  ids: string[]
): Promise<HubSpotContact[]> {
  const client = await getHubSpotClient(integration);

  const res = await client.fetch('/crm/v3/objects/contacts/batch/read', {
    method: 'POST',
    body: JSON.stringify({
      properties: CONTACT_PROPERTIES,
      inputs: ids.map((id) => ({ id })),
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '(could not read error body)');
    throw new Error(`HubSpot batch read failed (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return (data.results || []) as HubSpotContact[];
}

// ============================================================================
// SYNC: HUBSPOT → CALLENGO
// ============================================================================

/**
 * Sync specific HubSpot Contacts (by ID) into Callengo contacts table
 */
export async function syncSelectedHubSpotContacts(
  integration: HubSpotIntegration,
  hsIds: string[]
): Promise<HubSpotSyncResult> {
  const result: HubSpotSyncResult = {
    contacts_created: 0,
    contacts_updated: 0,
    contacts_skipped: 0,
    errors: [],
  };

  try {
    const hsContacts = await fetchHubSpotContactsByIds(integration, hsIds);

    for (const hsContact of hsContacts) {
      try {
        const { data: existingMapping } = await supabaseAdmin
          .from('hubspot_contact_mappings')
          .select('id, callengo_contact_id')
          .eq('integration_id', integration.id)
          .eq('hs_contact_id', hsContact.id)
          .maybeSingle();

        const props = hsContact.properties;
        const phoneNumber = props.phone || props.mobilephone || '';
        const contactName = [props.firstname, props.lastname].filter(Boolean).join(' ').trim() || 'Unknown';

        const contactData = {
          company_id: integration.company_id,
          contact_name: contactName,
          email: props.email || null,
          phone_number: phoneNumber,
          company_name: props.company || 'Unknown',
          source: 'hubspot',
          tags: ['hubspot-import'],
          custom_fields: {
            hs_contact_id: hsContact.id,
            hs_firstname: props.firstname,
            hs_lastname: props.lastname,
            hs_jobtitle: props.jobtitle,
            hs_company: props.company,
            hs_lifecyclestage: props.lifecyclestage,
            hs_lead_status: props.hs_lead_status,
            hs_city: props.city,
            hs_state: props.state,
            hs_country: props.country,
          },
        };

        if (existingMapping?.callengo_contact_id) {
          await supabaseAdmin.from('contacts').update(contactData).eq('id', existingMapping.callengo_contact_id);
          await supabaseAdmin.from('hubspot_contact_mappings').update({ last_synced_at: new Date().toISOString() }).eq('id', existingMapping.id);
          result.contacts_updated++;
        } else {
          let duplicateId: string | null = null;
          if (props.email) {
            const { data: byEmail } = await supabaseAdmin.from('contacts').select('id').eq('company_id', integration.company_id).eq('email', props.email).maybeSingle();
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
            result.contacts_updated++;
          } else {
            // Use try-catch to handle race condition: concurrent syncs may insert
            // the same contact between our SELECT check and this INSERT
            const { data: newContact, error: insertError } = await supabaseAdmin.from('contacts').insert(contactData).select('id').single();
            if (insertError || !newContact) {
              // Insert failed — likely a concurrent insert created the contact. Try to find it.
              const { data: existing } = await supabaseAdmin.from('contacts')
                .select('id')
                .eq('company_id', integration.company_id)
                .or(`email.eq.${props.email || ''},phone_number.eq.${phoneNumber || ''}`)
                .limit(1)
                .maybeSingle();
              if (existing) {
                await supabaseAdmin.from('contacts').update(contactData).eq('id', existing.id);
                callengoContactId = existing.id;
                result.contacts_updated++;
              } else {
                result.errors.push(`Failed to create contact for HS ID ${hsContact.id}: ${insertError?.message}`);
                result.contacts_skipped++;
                continue;
              }
            } else {
              callengoContactId = newContact.id;
              result.contacts_created++;
            }
          }

          await supabaseAdmin.from('hubspot_contact_mappings').insert({
            company_id: integration.company_id,
            integration_id: integration.id,
            callengo_contact_id: callengoContactId,
            hs_contact_id: hsContact.id,
            hs_object_type: 'Contact',
            last_synced_at: new Date().toISOString(),
            sync_direction: 'inbound',
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error syncing HS Contact ${hsContact.id}: ${msg}`);
        result.contacts_skipped++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`Failed to fetch selected HubSpot contacts: ${msg}`);
  }

  return result;
}

/**
 * Sync HubSpot Contacts into Callengo contacts table (full sync)
 */
export async function syncHubSpotContactsToCallengo(
  integration: HubSpotIntegration
): Promise<HubSpotSyncResult> {
  const result: HubSpotSyncResult = {
    contacts_created: 0,
    contacts_updated: 0,
    contacts_skipped: 0,
    errors: [],
  };

  try {
    const hsContacts = await fetchHubSpotContacts(integration, {
      modifiedAfter: integration.last_synced_at || undefined,
    });

    for (const hsContact of hsContacts) {
      try {
        // Check if mapping already exists
        const { data: existingMapping } = await supabaseAdmin
          .from('hubspot_contact_mappings')
          .select('id, callengo_contact_id')
          .eq('integration_id', integration.id)
          .eq('hs_contact_id', hsContact.id)
          .maybeSingle();

        const props = hsContact.properties;
        const phoneNumber = props.phone || props.mobilephone || '';
        const contactName = [props.firstname, props.lastname].filter(Boolean).join(' ').trim() || 'Unknown';

        const contactData = {
          company_id: integration.company_id,
          contact_name: contactName,
          email: props.email || null,
          phone_number: phoneNumber,
          company_name: props.company || 'Unknown',
          source: 'hubspot',
          tags: ['hubspot-import'],
          custom_fields: {
            hs_contact_id: hsContact.id,
            hs_firstname: props.firstname,
            hs_lastname: props.lastname,
            hs_jobtitle: props.jobtitle,
            hs_company: props.company,
            hs_lifecyclestage: props.lifecyclestage,
            hs_lead_status: props.hs_lead_status,
            hs_city: props.city,
            hs_state: props.state,
            hs_country: props.country,
          },
        };

        if (existingMapping?.callengo_contact_id) {
          // Update existing contact
          await supabaseAdmin
            .from('contacts')
            .update(contactData)
            .eq('id', existingMapping.callengo_contact_id);

          await supabaseAdmin
            .from('hubspot_contact_mappings')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', existingMapping.id);

          result.contacts_updated++;
        } else {
          // Check for duplicate by email or phone
          let duplicateId: string | null = null;
          if (props.email) {
            const { data: byEmail } = await supabaseAdmin
              .from('contacts')
              .select('id')
              .eq('company_id', integration.company_id)
              .eq('email', props.email)
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
            // Update existing contact with HS data
            await supabaseAdmin
              .from('contacts')
              .update(contactData)
              .eq('id', duplicateId);
            callengoContactId = duplicateId;
            result.contacts_updated++;
          } else {
            // Create new contact — use try-catch to handle race condition:
            // concurrent syncs may insert the same contact between our SELECT check and this INSERT
            const { data: newContact, error: insertError } = await supabaseAdmin
              .from('contacts')
              .insert(contactData)
              .select('id')
              .single();

            if (insertError || !newContact) {
              // Insert failed — likely a concurrent insert created the contact. Try to find it.
              const { data: existing } = await supabaseAdmin.from('contacts')
                .select('id')
                .eq('company_id', integration.company_id)
                .or(`email.eq.${props.email || ''},phone_number.eq.${phoneNumber || ''}`)
                .limit(1)
                .maybeSingle();
              if (existing) {
                await supabaseAdmin.from('contacts').update(contactData).eq('id', existing.id);
                callengoContactId = existing.id;
                result.contacts_updated++;
              } else {
                result.errors.push(`Failed to create contact for HS ID ${hsContact.id}: ${insertError?.message}`);
                result.contacts_skipped++;
                continue;
              }
            } else {
              callengoContactId = newContact.id;
              result.contacts_created++;
            }
          }

          // Create mapping
          await supabaseAdmin
            .from('hubspot_contact_mappings')
            .insert({
              company_id: integration.company_id,
              integration_id: integration.id,
              callengo_contact_id: callengoContactId,
              hs_contact_id: hsContact.id,
              hs_object_type: 'Contact',
              last_synced_at: new Date().toISOString(),
              sync_direction: 'inbound',
            });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error syncing HS Contact ${hsContact.id}: ${msg}`);
        result.contacts_skipped++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`Failed to fetch HubSpot contacts: ${msg}`);
  }

  return result;
}

// ============================================================================
// OUTBOUND SYNC: CALLENGO → HUBSPOT (Notes via Engagements API)
// ============================================================================

/**
 * Build a plain-text note body from call data for HubSpot
 */
function buildHubSpotCallNoteContent(contact: Record<string, unknown>): string {
  const parts: string[] = [];

  parts.push('Callengo Call Log');
  parts.push(`Date: ${contact.last_call_date || new Date().toISOString()}`);

  if (contact.call_status) parts.push(`Call Status: ${contact.call_status}`);
  if (contact.call_outcome) parts.push(`Outcome: ${contact.call_outcome}`);
  if (contact.status) parts.push(`Contact Status: ${contact.status}`);

  if (contact.call_duration) {
    const mins = Math.floor((contact.call_duration as number) / 60);
    const secs = (contact.call_duration as number) % 60;
    parts.push(`Duration: ${mins}m ${secs}s`);
  }

  const analysis = contact.analysis as Record<string, unknown> | null;
  if (analysis) {
    if (analysis.callSentiment) parts.push(`Sentiment: ${analysis.callSentiment}`);
    if (analysis.customerInterestLevel) parts.push(`Interest Level: ${analysis.customerInterestLevel}`);
    if (analysis.callCategory) parts.push(`Category: ${analysis.callCategory}`);
    if (analysis.outcomeNotes) parts.push(`Notes: ${analysis.outcomeNotes}`);
    if (analysis.keyPoints && Array.isArray(analysis.keyPoints) && analysis.keyPoints.length > 0) {
      parts.push(`Key Points:\n- ${(analysis.keyPoints as string[]).join('\n- ')}`);
    }
    if (analysis.followUpRequired) {
      parts.push(`Follow-up Required: Yes${analysis.followUpReason ? ` — ${analysis.followUpReason}` : ''}`);
    }
  }

  const metadata = contact.call_metadata as Record<string, unknown> | null;
  if (metadata?.summary) parts.push(`\nAI Summary:\n${metadata.summary}`);
  if (metadata?.answeredBy) parts.push(`Answered By: ${metadata.answeredBy}`);

  if (contact.notes) parts.push(`\nManual Notes:\n${contact.notes}`);

  return parts.join('\n');
}

/**
 * Create a HubSpot Note (engagement) on a contact.
 * Uses the CRM v3 notes API.
 */
export async function createHubSpotNote(
  integration: HubSpotIntegration,
  note: { body: string; contactId: string; timestamp?: number }
): Promise<{ success: boolean; noteId?: string; error?: string }> {
  const client = await getHubSpotClient(integration);

  // Create the note using CRM v3 objects/notes endpoint
  const res = await client.fetch('/crm/v3/objects/notes', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        hs_timestamp: String(note.timestamp || Date.now()),
        hs_note_body: note.body,
      },
      associations: [
        {
          to: { id: note.contactId },
          types: [
            {
              associationCategory: 'HUBSPOT_DEFINED',
              associationTypeId: 202, // Note to Contact
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    return { success: false, error: `HubSpot note creation failed (${res.status}): ${errBody}` };
  }

  const data = await res.json();
  return { success: true, noteId: data.id };
}

/**
 * Push a single call result to HubSpot (Note on the Contact).
 * Called from webhook after a call completes.
 * IMPORTANT: This only CREATES notes — it NEVER DELETES from HubSpot.
 */
export async function pushCallResultToHubSpot(
  integration: HubSpotIntegration,
  callengoContactId: string
): Promise<{ success: boolean; noteId?: string; error?: string }> {
  const { data: mapping } = await supabaseAdmin
    .from('hubspot_contact_mappings')
    .select('hs_contact_id')
    .eq('integration_id', integration.id)
    .eq('callengo_contact_id', callengoContactId)
    .maybeSingle();

  if (!mapping?.hs_contact_id) {
    return { success: false, error: 'No HubSpot mapping for this contact' };
  }

  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .eq('id', callengoContactId)
    .single();

  if (!contact) {
    return { success: false, error: 'Contact not found' };
  }

  const noteBody = buildHubSpotCallNoteContent(contact as Record<string, unknown>);

  const noteResult = await createHubSpotNote(integration, {
    body: noteBody,
    contactId: mapping.hs_contact_id,
    timestamp: Date.now(),
  });

  // Update mapping sync direction
  await supabaseAdmin
    .from('hubspot_contact_mappings')
    .update({
      last_synced_at: new Date().toISOString(),
      sync_direction: 'bidirectional',
    })
    .eq('integration_id', integration.id)
    .eq('callengo_contact_id', callengoContactId);

  return noteResult;
}

/**
 * Bulk outbound sync: push all recently updated Callengo contacts to HubSpot.
 * IMPORTANT: Only pushes notes — NEVER deletes HubSpot records.
 */
export async function pushContactUpdatesToHubSpot(
  integration: HubSpotIntegration
): Promise<HubSpotOutboundSyncResult> {
  const result: HubSpotOutboundSyncResult = {
    notes_created: 0,
    errors: [],
  };

  try {
    const { data: mappings } = await supabaseAdmin
      .from('hubspot_contact_mappings')
      .select('callengo_contact_id, hs_contact_id, last_synced_at')
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

        // Push call result as Note
        if (contact.call_status && contact.call_status !== 'pending' && contact.call_status !== 'queued') {
          const callResult = await pushCallResultToHubSpot(integration, mapping.callengo_contact_id);
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
 * Get the active HubSpot integration for a company (helper for webhook use).
 */
export async function getActiveHubSpotIntegration(
  companyId: string
): Promise<HubSpotIntegration | null> {
  const { data } = await supabaseAdmin
    .from('hubspot_integrations')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  return (data as unknown as HubSpotIntegration) || null;
}
