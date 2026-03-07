// lib/zoho/sync.ts
// Zoho CRM data sync operations - contacts, leads, users

import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { getZohoClient } from './auth';
import type {
  ZohoIntegration,
  ZohoContact,
  ZohoLead,
  ZohoUser,
  ZohoPaginatedResponse,
  ZohoSyncResult,
  ZohoOutboundSyncResult,
} from '@/types/zoho';

// ============================================================================
// QUERY HELPERS
// ============================================================================

async function fetchZohoPage<T>(
  integration: ZohoIntegration,
  path: string
): Promise<ZohoPaginatedResponse<T>> {
  const client = await getZohoClient(integration);

  const res = await client.fetch(path);

  if (!res.ok) {
    const errBody = await res.text().catch(() => '(could not read error body)');
    throw new Error(`Zoho API request failed (${res.status}): ${errBody}`);
  }

  return res.json() as Promise<ZohoPaginatedResponse<T>>;
}

async function fetchAllPages<T>(
  integration: ZohoIntegration,
  basePath: string,
  maxPages: number = 10
): Promise<T[]> {
  const allRecords: T[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= maxPages) {
    const separator = basePath.includes('?') ? '&' : '?';
    const path = `${basePath}${separator}page=${page}&per_page=200`;

    try {
      const result = await fetchZohoPage<T>(integration, path);
      if (result.data && result.data.length > 0) {
        allRecords.push(...result.data);
        hasMore = result.info?.more_records || false;
        page++;
      } else {
        hasMore = false;
      }
    } catch {
      hasMore = false;
    }
  }

  return allRecords;
}

// ============================================================================
// FETCH OPERATIONS
// ============================================================================

/**
 * Fetch contacts from Zoho CRM
 */
export async function fetchZohoContacts(
  integration: ZohoIntegration,
  options: { limit?: number; modifiedSince?: string } = {}
): Promise<ZohoContact[]> {
  let path = '/Contacts?fields=First_Name,Last_Name,Full_Name,Email,Phone,Mobile,Title,Department,Account_Name,Mailing_Street,Mailing_City,Mailing_State,Mailing_Zip,Mailing_Country,Description,Owner,Created_Time,Modified_Time&sort_by=Modified_Time&sort_order=desc';

  if (options.modifiedSince) {
    // Use If-Modified-Since header instead of query param
  }

  if (options.limit) {
    path += `&per_page=${Math.min(options.limit, 200)}`;
  }

  if (options.modifiedSince) {
    return fetchAllPagesWithModifiedSince<ZohoContact>(integration, path, options.modifiedSince);
  }

  return fetchAllPages<ZohoContact>(integration, path);
}

async function fetchAllPagesWithModifiedSince<T>(
  integration: ZohoIntegration,
  basePath: string,
  modifiedSince: string
): Promise<T[]> {
  const allRecords: T[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 10) {
    const separator = basePath.includes('?') ? '&' : '?';
    const path = `${basePath}${separator}page=${page}&per_page=200`;
    const client = await getZohoClient(integration);

    try {
      const res = await client.fetch(path, {
        headers: {
          'If-Modified-Since': new Date(modifiedSince).toUTCString(),
        },
      });

      if (res.status === 304) {
        // No modifications since the given date
        hasMore = false;
        break;
      }

      if (!res.ok) break;

      const result = await res.json() as ZohoPaginatedResponse<T>;
      if (result.data && result.data.length > 0) {
        allRecords.push(...result.data);
        hasMore = result.info?.more_records || false;
        page++;
      } else {
        hasMore = false;
      }
    } catch {
      hasMore = false;
    }
  }

  return allRecords;
}

/**
 * Fetch specific contacts by IDs
 */
export async function fetchZohoContactsByIds(
  integration: ZohoIntegration,
  ids: string[]
): Promise<ZohoContact[]> {
  const contacts: ZohoContact[] = [];
  const client = await getZohoClient(integration);

  // Zoho supports batch get with comma-separated IDs (up to 100 at a time)
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) {
    chunks.push(ids.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    try {
      const path = `/Contacts?ids=${chunk.join(',')}&fields=First_Name,Last_Name,Full_Name,Email,Phone,Mobile,Title,Department,Account_Name,Mailing_Street,Mailing_City,Mailing_State,Mailing_Zip,Mailing_Country,Description,Owner,Created_Time,Modified_Time`;
      const res = await client.fetch(path);
      if (res.ok) {
        const data = await res.json();
        if (data.data) contacts.push(...data.data);
      }
    } catch {
      // Skip batch failures
    }
  }

  return contacts;
}

/**
 * Fetch leads from Zoho CRM
 */
export async function fetchZohoLeads(
  integration: ZohoIntegration,
  options: { limit?: number; modifiedSince?: string } = {}
): Promise<ZohoLead[]> {
  let path = '/Leads?fields=First_Name,Last_Name,Full_Name,Email,Phone,Mobile,Title,Company,Lead_Status,Lead_Source,Description,Owner,Created_Time,Modified_Time&sort_by=Modified_Time&sort_order=desc';

  if (options.limit) {
    path += `&per_page=${Math.min(options.limit, 200)}`;
  }

  if (options.modifiedSince) {
    return fetchAllPagesWithModifiedSince<ZohoLead>(integration, path, options.modifiedSince);
  }

  return fetchAllPages<ZohoLead>(integration, path);
}

/**
 * Fetch specific leads by IDs
 */
export async function fetchZohoLeadsByIds(
  integration: ZohoIntegration,
  ids: string[]
): Promise<ZohoLead[]> {
  const leads: ZohoLead[] = [];
  const client = await getZohoClient(integration);

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) {
    chunks.push(ids.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    try {
      const path = `/Leads?ids=${chunk.join(',')}&fields=First_Name,Last_Name,Full_Name,Email,Phone,Mobile,Title,Company,Lead_Status,Lead_Source,Description,Owner,Created_Time,Modified_Time`;
      const res = await client.fetch(path);
      if (res.ok) {
        const data = await res.json();
        if (data.data) leads.push(...data.data);
      }
    } catch {
      // Skip batch failures
    }
  }

  return leads;
}

/**
 * Fetch active users from Zoho org
 */
export async function fetchZohoUsers(
  integration: ZohoIntegration
): Promise<ZohoUser[]> {
  const client = await getZohoClient(integration);
  const allUsers: ZohoUser[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 5) {
    try {
      const res = await client.fetch(`/users?type=AllUsers&page=${page}&per_page=200`);
      if (!res.ok) break;

      const data = await res.json();
      if (data.users && data.users.length > 0) {
        allUsers.push(...data.users.map((u: Record<string, unknown>) => ({
          id: u.id as string,
          first_name: (u.first_name as string) || '',
          last_name: (u.last_name as string) || '',
          full_name: (u.full_name as string) || `${u.first_name || ''} ${u.last_name || ''}`.trim(),
          email: u.email as string,
          status: (u.status as string) || 'active',
          role: (u.role as { name: string; id: string }) || { name: '', id: '' },
          profile: (u.profile as { name: string; id: string }) || { name: '', id: '' },
          confirm: (u.confirm as boolean) || false,
        })));
        hasMore = data.info?.more_records || false;
        page++;
      } else {
        hasMore = false;
      }
    } catch {
      hasMore = false;
    }
  }

  return allUsers;
}

// ============================================================================
// SYNC: ZOHO → CALLENGO (INBOUND)
// ============================================================================

/**
 * Sync specific Zoho Contacts (by ID) into Callengo contacts table
 */
export async function syncSelectedZohoContacts(
  integration: ZohoIntegration,
  zohoIds: string[]
): Promise<ZohoSyncResult> {
  const result: ZohoSyncResult = {
    contacts_created: 0,
    contacts_updated: 0,
    contacts_skipped: 0,
    leads_created: 0,
    leads_updated: 0,
    leads_skipped: 0,
    errors: [],
  };

  try {
    const zohoContacts = await fetchZohoContactsByIds(integration, zohoIds);

    for (const zohoContact of zohoContacts) {
      try {
        const { data: existingMapping } = await supabaseAdmin
          .from('zoho_contact_mappings')
          .select('id, callengo_contact_id')
          .eq('integration_id', integration.id)
          .eq('zoho_contact_id', zohoContact.id)
          .maybeSingle();

        const phoneNumber = zohoContact.Phone || zohoContact.Mobile || '';
        const contactName = zohoContact.Full_Name || `${zohoContact.First_Name || ''} ${zohoContact.Last_Name || ''}`.trim();
        const contactData = {
          company_id: integration.company_id,
          contact_name: contactName,
          email: zohoContact.Email || null,
          phone_number: phoneNumber,
          company_name: zohoContact.Account_Name?.name || 'Unknown',
          source: 'zoho',
          tags: ['zoho-import'],
          custom_fields: {
            zoho_contact_id: zohoContact.id,
            zoho_first_name: zohoContact.First_Name,
            zoho_last_name: zohoContact.Last_Name,
            zoho_title: zohoContact.Title,
            zoho_department: zohoContact.Department,
            zoho_mailing_city: zohoContact.Mailing_City,
            zoho_mailing_state: zohoContact.Mailing_State,
            zoho_mailing_country: zohoContact.Mailing_Country,
          },
        };

        if (existingMapping?.callengo_contact_id) {
          await supabaseAdmin.from('contacts').update(contactData).eq('id', existingMapping.callengo_contact_id);
          await supabaseAdmin.from('zoho_contact_mappings').update({ last_synced_at: new Date().toISOString() }).eq('id', existingMapping.id);
          result.contacts_updated++;
        } else {
          let duplicateId: string | null = null;
          if (zohoContact.Email) {
            const { data: byEmail } = await supabaseAdmin.from('contacts').select('id').eq('company_id', integration.company_id).eq('email', zohoContact.Email).maybeSingle();
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
            if (insertError || !newContact) { result.errors.push(`Failed to create contact for Zoho ID ${zohoContact.id}: ${insertError?.message}`); result.contacts_skipped++; continue; }
            callengoContactId = newContact.id;
            result.contacts_created++;
          }

          await supabaseAdmin.from('zoho_contact_mappings').insert({
            company_id: integration.company_id,
            integration_id: integration.id,
            callengo_contact_id: callengoContactId,
            zoho_contact_id: zohoContact.id,
            zoho_object_type: 'Contacts',
            last_synced_at: new Date().toISOString(),
            sync_direction: 'inbound',
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error syncing Zoho Contact ${zohoContact.id}: ${msg}`);
        result.contacts_skipped++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`Failed to fetch selected Zoho contacts: ${msg}`);
  }

  return result;
}

/**
 * Sync specific Zoho Leads (by ID) into Callengo contacts table
 */
export async function syncSelectedZohoLeads(
  integration: ZohoIntegration,
  zohoIds: string[]
): Promise<ZohoSyncResult> {
  const result: ZohoSyncResult = {
    contacts_created: 0,
    contacts_updated: 0,
    contacts_skipped: 0,
    leads_created: 0,
    leads_updated: 0,
    leads_skipped: 0,
    errors: [],
  };

  try {
    const zohoLeads = await fetchZohoLeadsByIds(integration, zohoIds);

    for (const zohoLead of zohoLeads) {
      try {
        const { data: existingMapping } = await supabaseAdmin
          .from('zoho_contact_mappings')
          .select('id, callengo_contact_id')
          .eq('integration_id', integration.id)
          .eq('zoho_contact_id', zohoLead.id)
          .maybeSingle();

        const phoneNumber = zohoLead.Phone || zohoLead.Mobile || '';
        const contactName = zohoLead.Full_Name || `${zohoLead.First_Name || ''} ${zohoLead.Last_Name || ''}`.trim();
        const contactData = {
          company_id: integration.company_id,
          contact_name: contactName,
          email: zohoLead.Email || null,
          phone_number: phoneNumber,
          company_name: zohoLead.Company || 'Unknown',
          source: 'zoho',
          tags: ['zoho-import', 'zoho-lead'],
          custom_fields: {
            zoho_lead_id: zohoLead.id,
            zoho_first_name: zohoLead.First_Name,
            zoho_last_name: zohoLead.Last_Name,
            zoho_title: zohoLead.Title,
            zoho_lead_status: zohoLead.Lead_Status,
            zoho_lead_source: zohoLead.Lead_Source,
          },
        };

        if (existingMapping?.callengo_contact_id) {
          await supabaseAdmin.from('contacts').update(contactData).eq('id', existingMapping.callengo_contact_id);
          await supabaseAdmin.from('zoho_contact_mappings').update({ last_synced_at: new Date().toISOString() }).eq('id', existingMapping.id);
          result.leads_updated++;
        } else {
          let duplicateId: string | null = null;
          if (zohoLead.Email) {
            const { data: byEmail } = await supabaseAdmin.from('contacts').select('id').eq('company_id', integration.company_id).eq('email', zohoLead.Email).maybeSingle();
            if (byEmail) duplicateId = byEmail.id;
          }

          let callengoContactId: string;
          if (duplicateId) {
            await supabaseAdmin.from('contacts').update(contactData).eq('id', duplicateId);
            callengoContactId = duplicateId;
            result.leads_updated++;
          } else {
            const { data: newContact, error: insertError } = await supabaseAdmin.from('contacts').insert(contactData).select('id').single();
            if (insertError || !newContact) { result.errors.push(`Failed to create contact for Zoho Lead ${zohoLead.id}: ${insertError?.message}`); result.leads_skipped++; continue; }
            callengoContactId = newContact.id;
            result.leads_created++;
          }

          await supabaseAdmin.from('zoho_contact_mappings').insert({
            company_id: integration.company_id,
            integration_id: integration.id,
            callengo_contact_id: callengoContactId,
            zoho_contact_id: zohoLead.id,
            zoho_object_type: 'Leads',
            last_synced_at: new Date().toISOString(),
            sync_direction: 'inbound',
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error syncing Zoho Lead ${zohoLead.id}: ${msg}`);
        result.leads_skipped++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`Failed to fetch selected Zoho leads: ${msg}`);
  }

  return result;
}

/**
 * Sync Zoho Contacts into Callengo contacts table (full sync)
 */
export async function syncZohoContactsToCallengo(
  integration: ZohoIntegration
): Promise<ZohoSyncResult> {
  const result: ZohoSyncResult = {
    contacts_created: 0,
    contacts_updated: 0,
    contacts_skipped: 0,
    leads_created: 0,
    leads_updated: 0,
    leads_skipped: 0,
    errors: [],
  };

  try {
    const zohoContacts = await fetchZohoContacts(integration, {
      modifiedSince: integration.last_synced_at || undefined,
    });

    for (const zohoContact of zohoContacts) {
      try {
        const { data: existingMapping } = await supabaseAdmin
          .from('zoho_contact_mappings')
          .select('id, callengo_contact_id')
          .eq('integration_id', integration.id)
          .eq('zoho_contact_id', zohoContact.id)
          .maybeSingle();

        const phoneNumber = zohoContact.Phone || zohoContact.Mobile || '';
        const contactName = zohoContact.Full_Name || `${zohoContact.First_Name || ''} ${zohoContact.Last_Name || ''}`.trim();
        const contactData = {
          company_id: integration.company_id,
          contact_name: contactName,
          email: zohoContact.Email || null,
          phone_number: phoneNumber,
          company_name: zohoContact.Account_Name?.name || 'Unknown',
          source: 'zoho',
          tags: ['zoho-import'],
          custom_fields: {
            zoho_contact_id: zohoContact.id,
            zoho_first_name: zohoContact.First_Name,
            zoho_last_name: zohoContact.Last_Name,
            zoho_title: zohoContact.Title,
            zoho_department: zohoContact.Department,
            zoho_mailing_city: zohoContact.Mailing_City,
            zoho_mailing_state: zohoContact.Mailing_State,
            zoho_mailing_country: zohoContact.Mailing_Country,
          },
        };

        if (existingMapping?.callengo_contact_id) {
          await supabaseAdmin.from('contacts').update(contactData).eq('id', existingMapping.callengo_contact_id);
          await supabaseAdmin.from('zoho_contact_mappings').update({ last_synced_at: new Date().toISOString() }).eq('id', existingMapping.id);
          result.contacts_updated++;
        } else {
          let duplicateId: string | null = null;
          if (zohoContact.Email) {
            const { data: byEmail } = await supabaseAdmin.from('contacts').select('id').eq('company_id', integration.company_id).eq('email', zohoContact.Email).maybeSingle();
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
              result.errors.push(`Failed to create contact for Zoho ID ${zohoContact.id}: ${insertError?.message}`);
              result.contacts_skipped++;
              continue;
            }
            callengoContactId = newContact.id;
            result.contacts_created++;
          }

          await supabaseAdmin.from('zoho_contact_mappings').insert({
            company_id: integration.company_id,
            integration_id: integration.id,
            callengo_contact_id: callengoContactId,
            zoho_contact_id: zohoContact.id,
            zoho_object_type: 'Contacts',
            last_synced_at: new Date().toISOString(),
            sync_direction: 'inbound',
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error syncing Zoho Contact ${zohoContact.id}: ${msg}`);
        result.contacts_skipped++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`Failed to fetch Zoho contacts: ${msg}`);
  }

  return result;
}

/**
 * Sync Zoho Leads into Callengo contacts table (full sync)
 */
export async function syncZohoLeadsToCallengo(
  integration: ZohoIntegration
): Promise<ZohoSyncResult> {
  const result: ZohoSyncResult = {
    contacts_created: 0,
    contacts_updated: 0,
    contacts_skipped: 0,
    leads_created: 0,
    leads_updated: 0,
    leads_skipped: 0,
    errors: [],
  };

  try {
    const zohoLeads = await fetchZohoLeads(integration, {
      modifiedSince: integration.last_synced_at || undefined,
    });

    for (const zohoLead of zohoLeads) {
      try {
        const { data: existingMapping } = await supabaseAdmin
          .from('zoho_contact_mappings')
          .select('id, callengo_contact_id')
          .eq('integration_id', integration.id)
          .eq('zoho_contact_id', zohoLead.id)
          .maybeSingle();

        const phoneNumber = zohoLead.Phone || zohoLead.Mobile || '';
        const contactName = zohoLead.Full_Name || `${zohoLead.First_Name || ''} ${zohoLead.Last_Name || ''}`.trim();
        const contactData = {
          company_id: integration.company_id,
          contact_name: contactName,
          email: zohoLead.Email || null,
          phone_number: phoneNumber,
          company_name: zohoLead.Company || 'Unknown',
          source: 'zoho',
          tags: ['zoho-import', 'zoho-lead'],
          custom_fields: {
            zoho_lead_id: zohoLead.id,
            zoho_first_name: zohoLead.First_Name,
            zoho_last_name: zohoLead.Last_Name,
            zoho_title: zohoLead.Title,
            zoho_lead_status: zohoLead.Lead_Status,
            zoho_lead_source: zohoLead.Lead_Source,
          },
        };

        if (existingMapping?.callengo_contact_id) {
          await supabaseAdmin.from('contacts').update(contactData).eq('id', existingMapping.callengo_contact_id);
          await supabaseAdmin.from('zoho_contact_mappings').update({ last_synced_at: new Date().toISOString() }).eq('id', existingMapping.id);
          result.leads_updated++;
        } else {
          let duplicateId: string | null = null;
          if (zohoLead.Email) {
            const { data: byEmail } = await supabaseAdmin.from('contacts').select('id').eq('company_id', integration.company_id).eq('email', zohoLead.Email).maybeSingle();
            if (byEmail) duplicateId = byEmail.id;
          }

          let callengoContactId: string;
          if (duplicateId) {
            await supabaseAdmin.from('contacts').update(contactData).eq('id', duplicateId);
            callengoContactId = duplicateId;
            result.leads_updated++;
          } else {
            const { data: newContact, error: insertError } = await supabaseAdmin.from('contacts').insert(contactData).select('id').single();
            if (insertError || !newContact) {
              result.errors.push(`Failed to create contact for Zoho Lead ${zohoLead.id}: ${insertError?.message}`);
              result.leads_skipped++;
              continue;
            }
            callengoContactId = newContact.id;
            result.leads_created++;
          }

          await supabaseAdmin.from('zoho_contact_mappings').insert({
            company_id: integration.company_id,
            integration_id: integration.id,
            callengo_contact_id: callengoContactId,
            zoho_contact_id: zohoLead.id,
            zoho_object_type: 'Leads',
            last_synced_at: new Date().toISOString(),
            sync_direction: 'inbound',
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error syncing Zoho Lead ${zohoLead.id}: ${msg}`);
        result.leads_skipped++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`Failed to fetch Zoho leads: ${msg}`);
  }

  return result;
}

// ============================================================================
// OUTBOUND SYNC: CALLENGO → ZOHO (Updates + Notes)
// ============================================================================

/**
 * Update a Zoho Contact with call result data from Callengo.
 * IMPORTANT: This only UPDATES existing contacts — it NEVER DELETES from Zoho.
 */
export async function pushCallResultToZoho(
  integration: ZohoIntegration,
  callengoContactId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: mapping } = await supabaseAdmin
    .from('zoho_contact_mappings')
    .select('zoho_contact_id, zoho_object_type')
    .eq('integration_id', integration.id)
    .eq('callengo_contact_id', callengoContactId)
    .maybeSingle();

  if (!mapping?.zoho_contact_id) {
    return { success: false, error: 'No Zoho mapping for this contact' };
  }

  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .eq('id', callengoContactId)
    .single();

  if (!contact) {
    return { success: false, error: 'Contact not found' };
  }

  const client = await getZohoClient(integration);
  const zohoModule = mapping.zoho_object_type === 'Leads' ? 'Leads' : 'Contacts';

  // Create a note with call details on the Zoho record
  const callStatus = (contact.call_status as string) || 'completed';
  const callOutcome = (contact.call_outcome as string) || '';
  const contactName = (contact.contact_name as string) || 'Unknown';
  const analysis = contact.analysis as Record<string, unknown> | null;

  const noteTitle = `Callengo Call: ${contactName} - ${callStatus}`;
  const noteParts: string[] = [];
  noteParts.push(`Call Status: ${callStatus}`);
  if (callOutcome) noteParts.push(`Outcome: ${callOutcome}`);
  if (contact.call_duration) {
    const mins = Math.floor((contact.call_duration as number) / 60);
    const secs = (contact.call_duration as number) % 60;
    noteParts.push(`Duration: ${mins}m ${secs}s`);
  }
  if (analysis?.callSentiment) noteParts.push(`Sentiment: ${analysis.callSentiment}`);
  if (analysis?.customerInterestLevel) noteParts.push(`Interest Level: ${analysis.customerInterestLevel}`);
  if (analysis?.outcomeNotes) noteParts.push(`Notes: ${analysis.outcomeNotes}`);
  if (analysis?.keyPoints && Array.isArray(analysis.keyPoints)) {
    noteParts.push(`Key Points:\n- ${(analysis.keyPoints as string[]).join('\n- ')}`);
  }

  try {
    const noteRes = await client.fetch('/Notes', {
      method: 'POST',
      body: JSON.stringify({
        data: [{
          Note_Title: noteTitle,
          Note_Content: noteParts.join('\n'),
          Parent_Id: { module: zohoModule, id: mapping.zoho_contact_id },
          se_module: zohoModule,
        }],
      }),
    });

    if (!noteRes.ok) {
      const errBody = await noteRes.text().catch(() => '');
      return { success: false, error: `Zoho note creation failed: ${errBody}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: `Note push failed: ${msg}` };
  }

  // Update mapping sync direction
  await supabaseAdmin
    .from('zoho_contact_mappings')
    .update({
      last_synced_at: new Date().toISOString(),
      sync_direction: 'bidirectional',
    })
    .eq('integration_id', integration.id)
    .eq('callengo_contact_id', callengoContactId);

  return { success: true };
}

/**
 * Bulk outbound sync: push recently updated Callengo contacts to Zoho.
 * IMPORTANT: Only pushes updates/notes — NEVER deletes Zoho records.
 */
export async function pushContactUpdatesToZoho(
  integration: ZohoIntegration
): Promise<ZohoOutboundSyncResult> {
  const result: ZohoOutboundSyncResult = {
    contacts_updated: 0,
    notes_created: 0,
    errors: [],
  };

  try {
    const { data: mappings } = await supabaseAdmin
      .from('zoho_contact_mappings')
      .select('callengo_contact_id, zoho_contact_id, zoho_object_type, last_synced_at')
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

        // Push call result as Note (never delete from Zoho)
        if (contact.call_status && contact.call_status !== 'pending' && contact.call_status !== 'queued') {
          const callResult = await pushCallResultToZoho(integration, mapping.callengo_contact_id);
          if (callResult.success) result.notes_created++;
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
 * Get the active Zoho integration for a company (helper for webhook use).
 */
export async function getActiveZohoIntegration(
  companyId: string
): Promise<ZohoIntegration | null> {
  const { data } = await supabaseAdmin
    .from('zoho_integrations')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  return (data as unknown as ZohoIntegration) || null;
}
