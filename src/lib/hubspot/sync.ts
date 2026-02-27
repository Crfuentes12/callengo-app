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
            const { data: newContact, error: insertError } = await supabaseAdmin.from('contacts').insert(contactData).select('id').single();
            if (insertError || !newContact) {
              result.errors.push(`Failed to create contact for HS ID ${hsContact.id}: ${insertError?.message}`);
              result.contacts_skipped++;
              continue;
            }
            callengoContactId = newContact.id;
            result.contacts_created++;
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
            // Create new contact
            const { data: newContact, error: insertError } = await supabaseAdmin
              .from('contacts')
              .insert(contactData)
              .select('id')
              .single();

            if (insertError || !newContact) {
              result.errors.push(`Failed to create contact for HS ID ${hsContact.id}: ${insertError?.message}`);
              result.contacts_skipped++;
              continue;
            }
            callengoContactId = newContact.id;
            result.contacts_created++;
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
