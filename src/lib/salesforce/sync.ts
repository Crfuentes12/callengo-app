// lib/salesforce/sync.ts
// Salesforce data sync operations - contacts, leads, events, users

import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { getSalesforceClient } from './auth';
import type {
  SalesforceIntegration,
  SalesforceContact,
  SalesforceLead,
  SalesforceEvent,
  SalesforceUser,
  SalesforceQueryResponse,
  SalesforceSyncResult,
} from '@/types/salesforce';

// ============================================================================
// SOQL QUERY HELPERS
// ============================================================================

async function querySalesforce<T>(
  integration: SalesforceIntegration,
  soql: string
): Promise<SalesforceQueryResponse<T>> {
  const client = await getSalesforceClient(integration);
  const encodedQuery = encodeURIComponent(soql);

  let res: Response;
  try {
    res = await client.fetch(`/services/data/v59.0/query?q=${encodedQuery}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown network error';
    throw new Error(`Salesforce API request failed (instance: ${integration.instance_url}): ${msg}`);
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '(could not read error body)');
    throw new Error(`Salesforce query failed (${res.status}): ${errBody}`);
  }

  return res.json() as Promise<SalesforceQueryResponse<T>>;
}

async function queryAllPages<T>(
  integration: SalesforceIntegration,
  soql: string
): Promise<T[]> {
  const client = await getSalesforceClient(integration);
  const allRecords: T[] = [];

  let result = await querySalesforce<T>(integration, soql);
  allRecords.push(...result.records);

  while (!result.done && result.nextRecordsUrl) {
    const res = await client.fetch(result.nextRecordsUrl);
    if (!res.ok) break;
    result = await res.json() as SalesforceQueryResponse<T>;
    allRecords.push(...result.records);
  }

  return allRecords;
}

// ============================================================================
// FETCH OPERATIONS
// ============================================================================

/**
 * Fetch contacts from Salesforce
 */
export async function fetchSalesforceContacts(
  integration: SalesforceIntegration,
  options: { limit?: number; offset?: number; modifiedSince?: string } = {}
): Promise<SalesforceContact[]> {
  let soql = `SELECT Id, FirstName, LastName, Name, Email, Phone, MobilePhone, Title, Department,
    AccountId, Account.Name, MailingStreet, MailingCity, MailingState, MailingPostalCode,
    MailingCountry, Description, OwnerId, CreatedDate, LastModifiedDate
    FROM Contact`;

  if (options.modifiedSince) {
    soql += ` WHERE LastModifiedDate > ${options.modifiedSince}`;
  }

  soql += ` ORDER BY LastModifiedDate DESC`;

  if (options.limit) {
    soql += ` LIMIT ${options.limit}`;
  }
  if (options.offset) {
    soql += ` OFFSET ${options.offset}`;
  }

  return queryAllPages<SalesforceContact>(integration, soql);
}

/**
 * Fetch leads from Salesforce
 */
export async function fetchSalesforceLeads(
  integration: SalesforceIntegration,
  options: { limit?: number; offset?: number; modifiedSince?: string } = {}
): Promise<SalesforceLead[]> {
  let soql = `SELECT Id, FirstName, LastName, Name, Email, Phone, MobilePhone, Title,
    Company, Status, LeadSource, Description, OwnerId, CreatedDate, LastModifiedDate
    FROM Lead`;

  if (options.modifiedSince) {
    soql += ` WHERE LastModifiedDate > ${options.modifiedSince}`;
  }

  soql += ` ORDER BY LastModifiedDate DESC`;

  if (options.limit) {
    soql += ` LIMIT ${options.limit}`;
  }
  if (options.offset) {
    soql += ` OFFSET ${options.offset}`;
  }

  return queryAllPages<SalesforceLead>(integration, soql);
}

/**
 * Fetch events from Salesforce
 */
export async function fetchSalesforceEvents(
  integration: SalesforceIntegration,
  options: { limit?: number; modifiedSince?: string } = {}
): Promise<SalesforceEvent[]> {
  let soql = `SELECT Id, Subject, Description, StartDateTime, EndDateTime, Location,
    IsAllDayEvent, WhoId, WhatId, OwnerId, ActivityDate, CreatedDate, LastModifiedDate
    FROM Event`;

  if (options.modifiedSince) {
    soql += ` WHERE LastModifiedDate > ${options.modifiedSince}`;
  }

  soql += ` ORDER BY StartDateTime DESC`;

  if (options.limit) {
    soql += ` LIMIT ${options.limit}`;
  }

  return queryAllPages<SalesforceEvent>(integration, soql);
}

/**
 * Fetch active users from Salesforce org
 */
export async function fetchSalesforceUsers(
  integration: SalesforceIntegration
): Promise<SalesforceUser[]> {
  const soql = `SELECT Id, Username, Name, FirstName, LastName, Email, IsActive,
    Profile.Name, UserRole.Name, SmallPhotoUrl, CreatedDate, LastModifiedDate
    FROM User
    WHERE IsActive = true
    ORDER BY Name ASC`;

  return queryAllPages<SalesforceUser>(integration, soql);
}

// ============================================================================
// SYNC: SALESFORCE → CALLENGO
// ============================================================================

/**
 * Fetch specific Salesforce Contacts by IDs
 */
export async function fetchSalesforceContactsByIds(
  integration: SalesforceIntegration,
  ids: string[]
): Promise<SalesforceContact[]> {
  const escapedIds = ids.map(id => `'${id.replace(/'/g, "\\'")}'`).join(',');
  const soql = `SELECT Id, FirstName, LastName, Name, Email, Phone, MobilePhone, Title, Department,
    AccountId, Account.Name, MailingStreet, MailingCity, MailingState, MailingPostalCode,
    MailingCountry, Description, OwnerId, CreatedDate, LastModifiedDate
    FROM Contact WHERE Id IN (${escapedIds})`;
  return queryAllPages<SalesforceContact>(integration, soql);
}

/**
 * Fetch specific Salesforce Leads by IDs
 */
export async function fetchSalesforceLeadsByIds(
  integration: SalesforceIntegration,
  ids: string[]
): Promise<SalesforceLead[]> {
  const escapedIds = ids.map(id => `'${id.replace(/'/g, "\\'")}'`).join(',');
  const soql = `SELECT Id, FirstName, LastName, Name, Email, Phone, MobilePhone, Title,
    Company, Status, LeadSource, Description, OwnerId, CreatedDate, LastModifiedDate
    FROM Lead WHERE Id IN (${escapedIds})`;
  return queryAllPages<SalesforceLead>(integration, soql);
}

/**
 * Sync specific Salesforce Contacts (by ID) into Callengo contacts table
 */
export async function syncSelectedSalesforceContacts(
  integration: SalesforceIntegration,
  sfIds: string[]
): Promise<SalesforceSyncResult> {
  const result: SalesforceSyncResult = {
    contacts_created: 0,
    contacts_updated: 0,
    contacts_skipped: 0,
    leads_created: 0,
    leads_updated: 0,
    leads_skipped: 0,
    errors: [],
  };

  try {
    const sfContacts = await fetchSalesforceContactsByIds(integration, sfIds);

    for (const sfContact of sfContacts) {
      try {
        const { data: existingMapping } = await supabaseAdmin
          .from('salesforce_contact_mappings')
          .select('id, callengo_contact_id')
          .eq('integration_id', integration.id)
          .eq('sf_contact_id', sfContact.Id)
          .maybeSingle();

        const contactData = {
          company_id: integration.company_id,
          first_name: sfContact.FirstName || '',
          last_name: sfContact.LastName || '',
          full_name: sfContact.Name || `${sfContact.FirstName || ''} ${sfContact.LastName || ''}`.trim(),
          email: sfContact.Email || null,
          phone: sfContact.Phone || sfContact.MobilePhone || null,
          title: sfContact.Title || null,
          company_name: sfContact.Account?.Name || null,
          source: 'salesforce' as const,
          tags: ['salesforce-import'],
          custom_fields: {
            sf_contact_id: sfContact.Id,
            sf_department: sfContact.Department,
            sf_account_id: sfContact.AccountId,
            sf_mailing_city: sfContact.MailingCity,
            sf_mailing_state: sfContact.MailingState,
            sf_mailing_country: sfContact.MailingCountry,
          },
        };

        if (existingMapping?.callengo_contact_id) {
          await supabaseAdmin.from('contacts').update(contactData).eq('id', existingMapping.callengo_contact_id);
          await supabaseAdmin.from('salesforce_contact_mappings').update({ last_synced_at: new Date().toISOString() }).eq('id', existingMapping.id);
          result.contacts_updated++;
        } else {
          let duplicateId: string | null = null;
          if (sfContact.Email) {
            const { data: byEmail } = await supabaseAdmin.from('contacts').select('id').eq('company_id', integration.company_id).eq('email', sfContact.Email).maybeSingle();
            if (byEmail) duplicateId = byEmail.id;
          }
          if (!duplicateId && (sfContact.Phone || sfContact.MobilePhone)) {
            const { data: byPhone } = await supabaseAdmin.from('contacts').select('id').eq('company_id', integration.company_id).eq('phone', (sfContact.Phone || sfContact.MobilePhone)!).maybeSingle();
            if (byPhone) duplicateId = byPhone.id;
          }

          let callengoContactId: string;
          if (duplicateId) {
            await supabaseAdmin.from('contacts').update(contactData).eq('id', duplicateId);
            callengoContactId = duplicateId;
            result.contacts_updated++;
          } else {
            const { data: newContact, error: insertError } = await supabaseAdmin.from('contacts').insert(contactData).select('id').single();
            if (insertError || !newContact) { result.errors.push(`Failed to create contact for SF ID ${sfContact.Id}: ${insertError?.message}`); result.contacts_skipped++; continue; }
            callengoContactId = newContact.id;
            result.contacts_created++;
          }

          await supabaseAdmin.from('salesforce_contact_mappings').insert({
            company_id: integration.company_id,
            integration_id: integration.id,
            callengo_contact_id: callengoContactId,
            sf_contact_id: sfContact.Id,
            sf_lead_id: null,
            sf_object_type: 'Contact',
            last_synced_at: new Date().toISOString(),
            sync_direction: 'inbound',
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error syncing SF Contact ${sfContact.Id}: ${msg}`);
        result.contacts_skipped++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`Failed to fetch selected Salesforce contacts: ${msg}`);
  }

  return result;
}

/**
 * Sync specific Salesforce Leads (by ID) into Callengo contacts table
 */
export async function syncSelectedSalesforceLeads(
  integration: SalesforceIntegration,
  sfIds: string[]
): Promise<SalesforceSyncResult> {
  const result: SalesforceSyncResult = {
    contacts_created: 0,
    contacts_updated: 0,
    contacts_skipped: 0,
    leads_created: 0,
    leads_updated: 0,
    leads_skipped: 0,
    errors: [],
  };

  try {
    const sfLeads = await fetchSalesforceLeadsByIds(integration, sfIds);

    for (const sfLead of sfLeads) {
      try {
        const { data: existingMapping } = await supabaseAdmin
          .from('salesforce_contact_mappings')
          .select('id, callengo_contact_id')
          .eq('integration_id', integration.id)
          .eq('sf_lead_id', sfLead.Id)
          .maybeSingle();

        const contactData = {
          company_id: integration.company_id,
          first_name: sfLead.FirstName || '',
          last_name: sfLead.LastName || '',
          full_name: sfLead.Name || `${sfLead.FirstName || ''} ${sfLead.LastName || ''}`.trim(),
          email: sfLead.Email || null,
          phone: sfLead.Phone || sfLead.MobilePhone || null,
          title: sfLead.Title || null,
          company_name: sfLead.Company || null,
          source: 'salesforce' as const,
          tags: ['salesforce-import', 'salesforce-lead'],
          custom_fields: {
            sf_lead_id: sfLead.Id,
            sf_lead_status: sfLead.Status,
            sf_lead_source: sfLead.LeadSource,
          },
        };

        if (existingMapping?.callengo_contact_id) {
          await supabaseAdmin.from('contacts').update(contactData).eq('id', existingMapping.callengo_contact_id);
          await supabaseAdmin.from('salesforce_contact_mappings').update({ last_synced_at: new Date().toISOString() }).eq('id', existingMapping.id);
          result.leads_updated++;
        } else {
          let duplicateId: string | null = null;
          if (sfLead.Email) {
            const { data: byEmail } = await supabaseAdmin.from('contacts').select('id').eq('company_id', integration.company_id).eq('email', sfLead.Email).maybeSingle();
            if (byEmail) duplicateId = byEmail.id;
          }

          let callengoContactId: string;
          if (duplicateId) {
            await supabaseAdmin.from('contacts').update(contactData).eq('id', duplicateId);
            callengoContactId = duplicateId;
            result.leads_updated++;
          } else {
            const { data: newContact, error: insertError } = await supabaseAdmin.from('contacts').insert(contactData).select('id').single();
            if (insertError || !newContact) { result.errors.push(`Failed to create contact for SF Lead ${sfLead.Id}: ${insertError?.message}`); result.leads_skipped++; continue; }
            callengoContactId = newContact.id;
            result.leads_created++;
          }

          await supabaseAdmin.from('salesforce_contact_mappings').insert({
            company_id: integration.company_id,
            integration_id: integration.id,
            callengo_contact_id: callengoContactId,
            sf_contact_id: null,
            sf_lead_id: sfLead.Id,
            sf_object_type: 'Lead',
            last_synced_at: new Date().toISOString(),
            sync_direction: 'inbound',
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error syncing SF Lead ${sfLead.Id}: ${msg}`);
        result.leads_skipped++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`Failed to fetch selected Salesforce leads: ${msg}`);
  }

  return result;
}

/**
 * Sync Salesforce Contacts into Callengo contacts table
 */
export async function syncSalesforceContactsToCallengo(
  integration: SalesforceIntegration
): Promise<SalesforceSyncResult> {
  const result: SalesforceSyncResult = {
    contacts_created: 0,
    contacts_updated: 0,
    contacts_skipped: 0,
    leads_created: 0,
    leads_updated: 0,
    leads_skipped: 0,
    errors: [],
  };

  try {
    const sfContacts = await fetchSalesforceContacts(integration, {
      modifiedSince: integration.last_synced_at || undefined,
    });

    for (const sfContact of sfContacts) {
      try {
        // Check if mapping already exists
        const { data: existingMapping } = await supabaseAdmin
          .from('salesforce_contact_mappings')
          .select('id, callengo_contact_id')
          .eq('integration_id', integration.id)
          .eq('sf_contact_id', sfContact.Id)
          .maybeSingle();

        const contactData = {
          company_id: integration.company_id,
          first_name: sfContact.FirstName || '',
          last_name: sfContact.LastName || '',
          full_name: sfContact.Name || `${sfContact.FirstName || ''} ${sfContact.LastName || ''}`.trim(),
          email: sfContact.Email || null,
          phone: sfContact.Phone || sfContact.MobilePhone || null,
          title: sfContact.Title || null,
          company_name: sfContact.Account?.Name || null,
          source: 'salesforce' as const,
          tags: ['salesforce-import'],
          custom_fields: {
            sf_contact_id: sfContact.Id,
            sf_department: sfContact.Department,
            sf_account_id: sfContact.AccountId,
            sf_mailing_city: sfContact.MailingCity,
            sf_mailing_state: sfContact.MailingState,
            sf_mailing_country: sfContact.MailingCountry,
          },
        };

        if (existingMapping?.callengo_contact_id) {
          // Update existing contact
          await supabaseAdmin
            .from('contacts')
            .update(contactData)
            .eq('id', existingMapping.callengo_contact_id);

          await supabaseAdmin
            .from('salesforce_contact_mappings')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', existingMapping.id);

          result.contacts_updated++;
        } else {
          // Check for duplicate by email or phone
          let duplicateId: string | null = null;
          if (sfContact.Email) {
            const { data: byEmail } = await supabaseAdmin
              .from('contacts')
              .select('id')
              .eq('company_id', integration.company_id)
              .eq('email', sfContact.Email)
              .maybeSingle();
            if (byEmail) duplicateId = byEmail.id;
          }

          if (!duplicateId && (sfContact.Phone || sfContact.MobilePhone)) {
            const phone = sfContact.Phone || sfContact.MobilePhone;
            const { data: byPhone } = await supabaseAdmin
              .from('contacts')
              .select('id')
              .eq('company_id', integration.company_id)
              .eq('phone', phone!)
              .maybeSingle();
            if (byPhone) duplicateId = byPhone.id;
          }

          let callengoContactId: string;
          if (duplicateId) {
            // Update existing contact with SF data
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
              result.errors.push(`Failed to create contact for SF ID ${sfContact.Id}: ${insertError?.message}`);
              result.contacts_skipped++;
              continue;
            }
            callengoContactId = newContact.id;
            result.contacts_created++;
          }

          // Create mapping
          await supabaseAdmin
            .from('salesforce_contact_mappings')
            .insert({
              company_id: integration.company_id,
              integration_id: integration.id,
              callengo_contact_id: callengoContactId,
              sf_contact_id: sfContact.Id,
              sf_lead_id: null,
              sf_object_type: 'Contact',
              last_synced_at: new Date().toISOString(),
              sync_direction: 'inbound',
            });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error syncing SF Contact ${sfContact.Id}: ${msg}`);
        result.contacts_skipped++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`Failed to fetch Salesforce contacts: ${msg}`);
  }

  return result;
}

/**
 * Sync Salesforce Leads into Callengo contacts table
 */
export async function syncSalesforceLeadsToCallengo(
  integration: SalesforceIntegration
): Promise<SalesforceSyncResult> {
  const result: SalesforceSyncResult = {
    contacts_created: 0,
    contacts_updated: 0,
    contacts_skipped: 0,
    leads_created: 0,
    leads_updated: 0,
    leads_skipped: 0,
    errors: [],
  };

  try {
    const sfLeads = await fetchSalesforceLeads(integration, {
      modifiedSince: integration.last_synced_at || undefined,
    });

    for (const sfLead of sfLeads) {
      try {
        // Check if mapping already exists
        const { data: existingMapping } = await supabaseAdmin
          .from('salesforce_contact_mappings')
          .select('id, callengo_contact_id')
          .eq('integration_id', integration.id)
          .eq('sf_lead_id', sfLead.Id)
          .maybeSingle();

        const contactData = {
          company_id: integration.company_id,
          first_name: sfLead.FirstName || '',
          last_name: sfLead.LastName || '',
          full_name: sfLead.Name || `${sfLead.FirstName || ''} ${sfLead.LastName || ''}`.trim(),
          email: sfLead.Email || null,
          phone: sfLead.Phone || sfLead.MobilePhone || null,
          title: sfLead.Title || null,
          company_name: sfLead.Company || null,
          source: 'salesforce' as const,
          tags: ['salesforce-import', 'salesforce-lead'],
          custom_fields: {
            sf_lead_id: sfLead.Id,
            sf_lead_status: sfLead.Status,
            sf_lead_source: sfLead.LeadSource,
          },
        };

        if (existingMapping?.callengo_contact_id) {
          await supabaseAdmin
            .from('contacts')
            .update(contactData)
            .eq('id', existingMapping.callengo_contact_id);

          await supabaseAdmin
            .from('salesforce_contact_mappings')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', existingMapping.id);

          result.leads_updated++;
        } else {
          // Check for duplicate by email
          let duplicateId: string | null = null;
          if (sfLead.Email) {
            const { data: byEmail } = await supabaseAdmin
              .from('contacts')
              .select('id')
              .eq('company_id', integration.company_id)
              .eq('email', sfLead.Email)
              .maybeSingle();
            if (byEmail) duplicateId = byEmail.id;
          }

          let callengoContactId: string;
          if (duplicateId) {
            await supabaseAdmin
              .from('contacts')
              .update(contactData)
              .eq('id', duplicateId);
            callengoContactId = duplicateId;
            result.leads_updated++;
          } else {
            const { data: newContact, error: insertError } = await supabaseAdmin
              .from('contacts')
              .insert(contactData)
              .select('id')
              .single();

            if (insertError || !newContact) {
              result.errors.push(`Failed to create contact for SF Lead ${sfLead.Id}: ${insertError?.message}`);
              result.leads_skipped++;
              continue;
            }
            callengoContactId = newContact.id;
            result.leads_created++;
          }

          await supabaseAdmin
            .from('salesforce_contact_mappings')
            .insert({
              company_id: integration.company_id,
              integration_id: integration.id,
              callengo_contact_id: callengoContactId,
              sf_contact_id: null,
              sf_lead_id: sfLead.Id,
              sf_object_type: 'Lead',
              last_synced_at: new Date().toISOString(),
              sync_direction: 'inbound',
            });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error syncing SF Lead ${sfLead.Id}: ${msg}`);
        result.leads_skipped++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    result.errors.push(`Failed to fetch Salesforce leads: ${msg}`);
  }

  return result;
}
