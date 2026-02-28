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
} from '@/types/pipedrive';

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
