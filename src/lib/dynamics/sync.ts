// lib/dynamics/sync.ts
// Microsoft Dynamics data sync operations - contacts, leads, users

import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { getDynamicsClient } from './auth';
import type {
  DynamicsIntegration,
  DynamicsContact,
  DynamicsLead,
  DynamicsUser,
  DynamicsPaginatedResponse,
  DynamicsSyncResult,
  DynamicsOutboundSyncResult,
} from '@/types/dynamics';

// ============================================================================
// QUERY HELPERS
// ============================================================================

const CONTACT_SELECT_FIELDS = [
  'contactid', 'firstname', 'lastname', 'fullname', 'emailaddress1',
  'telephone1', 'mobilephone', 'jobtitle', 'department',
  '_parentcustomerid_value', 'address1_line1', 'address1_city',
  'address1_stateorprovince', 'address1_postalcode', 'address1_country',
  'description', '_ownerid_value', 'createdon', 'modifiedon',
].join(',');

const LEAD_SELECT_FIELDS = [
  'leadid', 'firstname', 'lastname', 'fullname', 'emailaddress1',
  'telephone1', 'mobilephone', 'jobtitle', 'companyname',
  'statuscode', 'leadsourcecode', 'description',
  '_ownerid_value', 'createdon', 'modifiedon',
].join(',');

async function fetchDynamicsPage<T>(
  integration: DynamicsIntegration,
  path: string
): Promise<DynamicsPaginatedResponse<T>> {
  const client = await getDynamicsClient(integration);

  const res = await client.fetch(path);

  if (!res.ok) {
    const errBody = await res.text().catch(() => '(could not read error body)');
    throw new Error(`Dynamics API request failed (${res.status}): ${errBody}`);
  }

  return res.json() as Promise<DynamicsPaginatedResponse<T>>;
}

async function fetchAllPages<T>(
  integration: DynamicsIntegration,
  initialPath: string,
  maxPages: number = 10
): Promise<T[]> {
  const allRecords: T[] = [];
  let nextLink: string | null = initialPath;
  let page = 0;

  while (nextLink && page < maxPages) {
    try {
      const result: DynamicsPaginatedResponse<T> = await fetchDynamicsPage<T>(integration, nextLink);
      if (result.value && result.value.length > 0) {
        allRecords.push(...result.value);
        nextLink = result['@odata.nextLink'] || null;
        page++;
      } else {
        nextLink = null;
      }
    } catch {
      nextLink = null;
    }
  }

  return allRecords;
}

// ============================================================================
// FETCH OPERATIONS
// ============================================================================

/**
 * Fetch contacts from Microsoft Dynamics
 */
export async function fetchDynamicsContacts(
  integration: DynamicsIntegration,
  options: { limit?: number; modifiedSince?: string } = {}
): Promise<DynamicsContact[]> {
  const top = options.limit ? Math.min(options.limit, 5000) : 5000;
  let path = `/contacts?$select=${CONTACT_SELECT_FIELDS}&$orderby=modifiedon desc&$top=${top}`;

  if (options.modifiedSince) {
    const isoDate = new Date(options.modifiedSince).toISOString();
    path += `&$filter=modifiedon ge ${isoDate}`;
  }

  return fetchAllPages<DynamicsContact>(integration, path);
}

/**
 * Fetch specific contacts by IDs
 */
export async function fetchDynamicsContactsByIds(
  integration: DynamicsIntegration,
  ids: string[]
): Promise<DynamicsContact[]> {
  const contacts: DynamicsContact[] = [];
  const client = await getDynamicsClient(integration);

  // Dynamics Web API supports fetching by ID one at a time or with $filter
  // Use $filter with 'in' for batch fetch (chunks of 50)
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 50) {
    chunks.push(ids.slice(i, i + 50));
  }

  for (const chunk of chunks) {
    try {
      const filterValues = chunk.map((id) => `contactid eq ${id}`).join(' or ');
      const path = `/contacts?$select=${CONTACT_SELECT_FIELDS}&$filter=${filterValues}`;
      const res = await client.fetch(path);
      if (res.ok) {
        const data = await res.json();
        if (data.value) contacts.push(...data.value);
      }
    } catch {
      // Skip batch failures
    }
  }

  return contacts;
}

/**
 * Fetch leads from Microsoft Dynamics
 */
export async function fetchDynamicsLeads(
  integration: DynamicsIntegration,
  options: { limit?: number; modifiedSince?: string } = {}
): Promise<DynamicsLead[]> {
  const top = options.limit ? Math.min(options.limit, 5000) : 5000;
  let path = `/leads?$select=${LEAD_SELECT_FIELDS}&$orderby=modifiedon desc&$top=${top}`;

  if (options.modifiedSince) {
    const isoDate = new Date(options.modifiedSince).toISOString();
    path += `&$filter=modifiedon ge ${isoDate}`;
  }

  return fetchAllPages<DynamicsLead>(integration, path);
}

/**
 * Fetch specific leads by IDs
 */
export async function fetchDynamicsLeadsByIds(
  integration: DynamicsIntegration,
  ids: string[]
): Promise<DynamicsLead[]> {
  const leads: DynamicsLead[] = [];
  const client = await getDynamicsClient(integration);

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 50) {
    chunks.push(ids.slice(i, i + 50));
  }

  for (const chunk of chunks) {
    try {
      const filterValues = chunk.map((id) => `leadid eq ${id}`).join(' or ');
      const path = `/leads?$select=${LEAD_SELECT_FIELDS}&$filter=${filterValues}`;
      const res = await client.fetch(path);
      if (res.ok) {
        const data = await res.json();
        if (data.value) leads.push(...data.value);
      }
    } catch {
      // Skip batch failures
    }
  }

  return leads;
}

/**
 * Fetch active system users from Dynamics org
 */
export async function fetchDynamicsUsers(
  integration: DynamicsIntegration
): Promise<DynamicsUser[]> {
  const path = `/systemusers?$select=systemuserid,fullname,internalemailaddress,isdisabled,title,jobtitle&$filter=isdisabled eq false&$top=500`;
  return fetchAllPages<DynamicsUser>(integration, path, 5);
}

// ============================================================================
// SYNC: DYNAMICS → CALLENGO (INBOUND)
// ============================================================================

/**
 * Sync specific Dynamics Contacts (by ID) into Callengo contacts table
 */
export async function syncSelectedDynamicsContacts(
  integration: DynamicsIntegration,
  dynamicsIds: string[]
): Promise<DynamicsSyncResult> {
  const result: DynamicsSyncResult = {
    contacts_created: 0,
    contacts_updated: 0,
    contacts_skipped: 0,
    leads_created: 0,
    leads_updated: 0,
    leads_skipped: 0,
    errors: [],
  };

  try {
    const dynamicsContacts = await fetchDynamicsContactsByIds(integration, dynamicsIds);

    for (const dc of dynamicsContacts) {
      try {
        const { data: existingMapping } = await supabaseAdmin
          .from('dynamics_contact_mappings')
          .select('id, callengo_contact_id')
          .eq('integration_id', integration.id)
          .eq('dynamics_contact_id', dc.contactid)
          .maybeSingle();

        const phoneNumber = dc.telephone1 || dc.mobilephone || '';
        const contactName = dc.fullname || `${dc.firstname || ''} ${dc.lastname || ''}`.trim();
        const contactData = {
          company_id: integration.company_id,
          contact_name: contactName || 'Unknown',
          email: dc.emailaddress1 || null,
          phone_number: phoneNumber,
          company_name: dc.parentcustomerid_account?.name || 'Unknown',
          source: 'dynamics',
          tags: ['dynamics-import'],
          custom_fields: {
            dynamics_contact_id: dc.contactid,
            dynamics_firstname: dc.firstname,
            dynamics_lastname: dc.lastname,
            dynamics_jobtitle: dc.jobtitle,
            dynamics_department: dc.department,
            dynamics_city: dc.address1_city,
            dynamics_state: dc.address1_stateorprovince,
            dynamics_country: dc.address1_country,
          },
        };

        if (existingMapping?.callengo_contact_id) {
          await supabaseAdmin.from('contacts').update(contactData).eq('id', existingMapping.callengo_contact_id);
          await supabaseAdmin.from('dynamics_contact_mappings').update({ last_synced_at: new Date().toISOString() }).eq('id', existingMapping.id);
          result.contacts_updated++;
        } else {
          let duplicateId: string | null = null;
          if (dc.emailaddress1) {
            const { data: byEmail } = await supabaseAdmin.from('contacts').select('id').eq('company_id', integration.company_id).eq('email', dc.emailaddress1).maybeSingle();
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
            if (insertError || !newContact) { result.errors.push(`Failed to create contact for Dynamics ID ${dc.contactid}: ${insertError?.message}`); result.contacts_skipped++; continue; }
            callengoContactId = newContact.id;
            result.contacts_created++;
          }

          await supabaseAdmin.from('dynamics_contact_mappings').insert({
            company_id: integration.company_id,
            integration_id: integration.id,
            callengo_contact_id: callengoContactId,
            dynamics_contact_id: dc.contactid,
            dynamics_entity_type: 'contacts',
            last_synced_at: new Date().toISOString(),
            sync_direction: 'inbound',
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error syncing Dynamics Contact ${dc.contactid}: ${msg}`);
        result.contacts_skipped++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`Failed to fetch selected Dynamics contacts: ${msg}`);
  }

  return result;
}

/**
 * Sync specific Dynamics Leads (by ID) into Callengo contacts table
 */
export async function syncSelectedDynamicsLeads(
  integration: DynamicsIntegration,
  dynamicsIds: string[]
): Promise<DynamicsSyncResult> {
  const result: DynamicsSyncResult = {
    contacts_created: 0,
    contacts_updated: 0,
    contacts_skipped: 0,
    leads_created: 0,
    leads_updated: 0,
    leads_skipped: 0,
    errors: [],
  };

  try {
    const dynamicsLeads = await fetchDynamicsLeadsByIds(integration, dynamicsIds);

    for (const dl of dynamicsLeads) {
      try {
        const { data: existingMapping } = await supabaseAdmin
          .from('dynamics_contact_mappings')
          .select('id, callengo_contact_id')
          .eq('integration_id', integration.id)
          .eq('dynamics_contact_id', dl.leadid)
          .maybeSingle();

        const phoneNumber = dl.telephone1 || dl.mobilephone || '';
        const contactName = dl.fullname || `${dl.firstname || ''} ${dl.lastname || ''}`.trim();
        const contactData = {
          company_id: integration.company_id,
          contact_name: contactName || 'Unknown',
          email: dl.emailaddress1 || null,
          phone_number: phoneNumber,
          company_name: dl.companyname || 'Unknown',
          source: 'dynamics',
          tags: ['dynamics-import', 'dynamics-lead'],
          custom_fields: {
            dynamics_lead_id: dl.leadid,
            dynamics_firstname: dl.firstname,
            dynamics_lastname: dl.lastname,
            dynamics_jobtitle: dl.jobtitle,
            dynamics_statuscode: dl.statuscode,
            dynamics_leadsourcecode: dl.leadsourcecode,
          },
        };

        if (existingMapping?.callengo_contact_id) {
          await supabaseAdmin.from('contacts').update(contactData).eq('id', existingMapping.callengo_contact_id);
          await supabaseAdmin.from('dynamics_contact_mappings').update({ last_synced_at: new Date().toISOString() }).eq('id', existingMapping.id);
          result.leads_updated++;
        } else {
          let duplicateId: string | null = null;
          if (dl.emailaddress1) {
            const { data: byEmail } = await supabaseAdmin.from('contacts').select('id').eq('company_id', integration.company_id).eq('email', dl.emailaddress1).maybeSingle();
            if (byEmail) duplicateId = byEmail.id;
          }

          let callengoContactId: string;
          if (duplicateId) {
            await supabaseAdmin.from('contacts').update(contactData).eq('id', duplicateId);
            callengoContactId = duplicateId;
            result.leads_updated++;
          } else {
            const { data: newContact, error: insertError } = await supabaseAdmin.from('contacts').insert(contactData).select('id').single();
            if (insertError || !newContact) { result.errors.push(`Failed to create contact for Dynamics Lead ${dl.leadid}: ${insertError?.message}`); result.leads_skipped++; continue; }
            callengoContactId = newContact.id;
            result.leads_created++;
          }

          await supabaseAdmin.from('dynamics_contact_mappings').insert({
            company_id: integration.company_id,
            integration_id: integration.id,
            callengo_contact_id: callengoContactId,
            dynamics_contact_id: dl.leadid,
            dynamics_entity_type: 'leads',
            last_synced_at: new Date().toISOString(),
            sync_direction: 'inbound',
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error syncing Dynamics Lead ${dl.leadid}: ${msg}`);
        result.leads_skipped++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`Failed to fetch selected Dynamics leads: ${msg}`);
  }

  return result;
}

/**
 * Sync Dynamics Contacts into Callengo contacts table (full sync)
 */
export async function syncDynamicsContactsToCallengo(
  integration: DynamicsIntegration
): Promise<DynamicsSyncResult> {
  const result: DynamicsSyncResult = {
    contacts_created: 0,
    contacts_updated: 0,
    contacts_skipped: 0,
    leads_created: 0,
    leads_updated: 0,
    leads_skipped: 0,
    errors: [],
  };

  try {
    const dynamicsContacts = await fetchDynamicsContacts(integration, {
      modifiedSince: integration.last_synced_at || undefined,
    });

    for (const dc of dynamicsContacts) {
      try {
        const { data: existingMapping } = await supabaseAdmin
          .from('dynamics_contact_mappings')
          .select('id, callengo_contact_id')
          .eq('integration_id', integration.id)
          .eq('dynamics_contact_id', dc.contactid)
          .maybeSingle();

        const phoneNumber = dc.telephone1 || dc.mobilephone || '';
        const contactName = dc.fullname || `${dc.firstname || ''} ${dc.lastname || ''}`.trim();
        const contactData = {
          company_id: integration.company_id,
          contact_name: contactName || 'Unknown',
          email: dc.emailaddress1 || null,
          phone_number: phoneNumber,
          company_name: dc.parentcustomerid_account?.name || 'Unknown',
          source: 'dynamics',
          tags: ['dynamics-import'],
          custom_fields: {
            dynamics_contact_id: dc.contactid,
            dynamics_firstname: dc.firstname,
            dynamics_lastname: dc.lastname,
            dynamics_jobtitle: dc.jobtitle,
            dynamics_department: dc.department,
            dynamics_city: dc.address1_city,
            dynamics_state: dc.address1_stateorprovince,
            dynamics_country: dc.address1_country,
          },
        };

        if (existingMapping?.callengo_contact_id) {
          await supabaseAdmin.from('contacts').update(contactData).eq('id', existingMapping.callengo_contact_id);
          await supabaseAdmin.from('dynamics_contact_mappings').update({ last_synced_at: new Date().toISOString() }).eq('id', existingMapping.id);
          result.contacts_updated++;
        } else {
          let duplicateId: string | null = null;
          if (dc.emailaddress1) {
            const { data: byEmail } = await supabaseAdmin.from('contacts').select('id').eq('company_id', integration.company_id).eq('email', dc.emailaddress1).maybeSingle();
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
              result.errors.push(`Failed to create contact for Dynamics ID ${dc.contactid}: ${insertError?.message}`);
              result.contacts_skipped++;
              continue;
            }
            callengoContactId = newContact.id;
            result.contacts_created++;
          }

          await supabaseAdmin.from('dynamics_contact_mappings').insert({
            company_id: integration.company_id,
            integration_id: integration.id,
            callengo_contact_id: callengoContactId,
            dynamics_contact_id: dc.contactid,
            dynamics_entity_type: 'contacts',
            last_synced_at: new Date().toISOString(),
            sync_direction: 'inbound',
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error syncing Dynamics Contact ${dc.contactid}: ${msg}`);
        result.contacts_skipped++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`Failed to fetch Dynamics contacts: ${msg}`);
  }

  return result;
}

/**
 * Sync Dynamics Leads into Callengo contacts table (full sync)
 */
export async function syncDynamicsLeadsToCallengo(
  integration: DynamicsIntegration
): Promise<DynamicsSyncResult> {
  const result: DynamicsSyncResult = {
    contacts_created: 0,
    contacts_updated: 0,
    contacts_skipped: 0,
    leads_created: 0,
    leads_updated: 0,
    leads_skipped: 0,
    errors: [],
  };

  try {
    const dynamicsLeads = await fetchDynamicsLeads(integration, {
      modifiedSince: integration.last_synced_at || undefined,
    });

    for (const dl of dynamicsLeads) {
      try {
        const { data: existingMapping } = await supabaseAdmin
          .from('dynamics_contact_mappings')
          .select('id, callengo_contact_id')
          .eq('integration_id', integration.id)
          .eq('dynamics_contact_id', dl.leadid)
          .maybeSingle();

        const phoneNumber = dl.telephone1 || dl.mobilephone || '';
        const contactName = dl.fullname || `${dl.firstname || ''} ${dl.lastname || ''}`.trim();
        const contactData = {
          company_id: integration.company_id,
          contact_name: contactName || 'Unknown',
          email: dl.emailaddress1 || null,
          phone_number: phoneNumber,
          company_name: dl.companyname || 'Unknown',
          source: 'dynamics',
          tags: ['dynamics-import', 'dynamics-lead'],
          custom_fields: {
            dynamics_lead_id: dl.leadid,
            dynamics_firstname: dl.firstname,
            dynamics_lastname: dl.lastname,
            dynamics_jobtitle: dl.jobtitle,
            dynamics_statuscode: dl.statuscode,
            dynamics_leadsourcecode: dl.leadsourcecode,
          },
        };

        if (existingMapping?.callengo_contact_id) {
          await supabaseAdmin.from('contacts').update(contactData).eq('id', existingMapping.callengo_contact_id);
          await supabaseAdmin.from('dynamics_contact_mappings').update({ last_synced_at: new Date().toISOString() }).eq('id', existingMapping.id);
          result.leads_updated++;
        } else {
          let duplicateId: string | null = null;
          if (dl.emailaddress1) {
            const { data: byEmail } = await supabaseAdmin.from('contacts').select('id').eq('company_id', integration.company_id).eq('email', dl.emailaddress1).maybeSingle();
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
              result.errors.push(`Failed to create contact for Dynamics Lead ${dl.leadid}: ${insertError?.message}`);
              result.leads_skipped++;
              continue;
            }
            callengoContactId = newContact.id;
            result.leads_created++;
          }

          await supabaseAdmin.from('dynamics_contact_mappings').insert({
            company_id: integration.company_id,
            integration_id: integration.id,
            callengo_contact_id: callengoContactId,
            dynamics_contact_id: dl.leadid,
            dynamics_entity_type: 'leads',
            last_synced_at: new Date().toISOString(),
            sync_direction: 'inbound',
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error syncing Dynamics Lead ${dl.leadid}: ${msg}`);
        result.leads_skipped++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`Failed to fetch Dynamics leads: ${msg}`);
  }

  return result;
}

// ============================================================================
// OUTBOUND SYNC: CALLENGO → DYNAMICS (Notes only, NEVER deletes)
// ============================================================================

/**
 * Create a Note (annotation) on a Dynamics Contact/Lead with call result data.
 * IMPORTANT: This only CREATES notes — it NEVER DELETES from Dynamics.
 */
export async function pushCallResultToDynamics(
  integration: DynamicsIntegration,
  callengoContactId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: mapping } = await supabaseAdmin
    .from('dynamics_contact_mappings')
    .select('dynamics_contact_id, dynamics_entity_type')
    .eq('integration_id', integration.id)
    .eq('callengo_contact_id', callengoContactId)
    .maybeSingle();

  if (!mapping?.dynamics_contact_id) {
    return { success: false, error: 'No Dynamics mapping for this contact' };
  }

  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .eq('id', callengoContactId)
    .single();

  if (!contact) {
    return { success: false, error: 'Contact not found' };
  }

  const client = await getDynamicsClient(integration);
  const entityType = mapping.dynamics_entity_type === 'leads' ? 'leads' : 'contacts';
  const entityIdField = entityType === 'leads' ? 'leadid' : 'contactid';

  // Build note content
  const callStatus = (contact.call_status as string) || 'completed';
  const callOutcome = (contact.call_outcome as string) || '';
  const contactName = (contact.contact_name as string) || 'Unknown';
  const analysis = contact.analysis as Record<string, unknown> | null;

  const noteSubject = `Callengo Call: ${contactName} - ${callStatus}`;
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
    // Create annotation (note) in Dynamics
    const annotationData: Record<string, unknown> = {
      subject: noteSubject,
      notetext: noteParts.join('\n'),
      [`objectid_${entityType}@odata.bind`]: `/${entityType}(${mapping.dynamics_contact_id})`,
      objecttypecode: entityType === 'leads' ? 'lead' : 'contact',
    };

    const noteRes = await client.fetch('/annotations', {
      method: 'POST',
      body: JSON.stringify(annotationData),
    });

    if (!noteRes.ok) {
      const errBody = await noteRes.text().catch(() => '');
      return { success: false, error: `Dynamics note creation failed: ${errBody}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: `Note push failed: ${msg}` };
  }

  // Update mapping sync direction
  await supabaseAdmin
    .from('dynamics_contact_mappings')
    .update({
      last_synced_at: new Date().toISOString(),
      sync_direction: 'bidirectional',
    })
    .eq('integration_id', integration.id)
    .eq('callengo_contact_id', callengoContactId);

  return { success: true };
}

/**
 * Bulk outbound sync: push recently updated Callengo contacts to Dynamics.
 * IMPORTANT: Only pushes notes — NEVER deletes Dynamics records.
 */
export async function pushContactUpdatesToDynamics(
  integration: DynamicsIntegration
): Promise<DynamicsOutboundSyncResult> {
  const result: DynamicsOutboundSyncResult = {
    contacts_updated: 0,
    notes_created: 0,
    errors: [],
  };

  try {
    const { data: mappings } = await supabaseAdmin
      .from('dynamics_contact_mappings')
      .select('callengo_contact_id, dynamics_contact_id, dynamics_entity_type, last_synced_at')
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

        // Push call result as Note (never delete from Dynamics)
        if (contact.call_status && contact.call_status !== 'pending' && contact.call_status !== 'queued') {
          const callResult = await pushCallResultToDynamics(integration, mapping.callengo_contact_id);
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
 * Get the active Dynamics integration for a company (helper for webhook use).
 */
export async function getActiveDynamicsIntegration(
  companyId: string
): Promise<DynamicsIntegration | null> {
  const { data } = await supabaseAdmin
    .from('dynamics_integrations')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  return (data as unknown as DynamicsIntegration) || null;
}
