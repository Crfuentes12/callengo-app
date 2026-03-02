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
  SalesforceOutboundSyncResult,
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

        const phoneNumber = sfContact.Phone || sfContact.MobilePhone || '';
        const contactData = {
          company_id: integration.company_id,
          contact_name: sfContact.Name || `${sfContact.FirstName || ''} ${sfContact.LastName || ''}`.trim(),
          email: sfContact.Email || null,
          phone_number: phoneNumber,
          company_name: sfContact.Account?.Name || 'Unknown',
          source: 'salesforce',
          tags: ['salesforce-import'],
          custom_fields: {
            sf_contact_id: sfContact.Id,
            sf_first_name: sfContact.FirstName,
            sf_last_name: sfContact.LastName,
            sf_title: sfContact.Title,
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

        const phoneNumber = sfLead.Phone || sfLead.MobilePhone || '';
        const contactData = {
          company_id: integration.company_id,
          contact_name: sfLead.Name || `${sfLead.FirstName || ''} ${sfLead.LastName || ''}`.trim(),
          email: sfLead.Email || null,
          phone_number: phoneNumber,
          company_name: sfLead.Company || 'Unknown',
          source: 'salesforce',
          tags: ['salesforce-import', 'salesforce-lead'],
          custom_fields: {
            sf_lead_id: sfLead.Id,
            sf_first_name: sfLead.FirstName,
            sf_last_name: sfLead.LastName,
            sf_title: sfLead.Title,
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

        const phoneNumber = sfContact.Phone || sfContact.MobilePhone || '';
        const contactData = {
          company_id: integration.company_id,
          contact_name: sfContact.Name || `${sfContact.FirstName || ''} ${sfContact.LastName || ''}`.trim(),
          email: sfContact.Email || null,
          phone_number: phoneNumber,
          company_name: sfContact.Account?.Name || 'Unknown',
          source: 'salesforce',
          tags: ['salesforce-import'],
          custom_fields: {
            sf_contact_id: sfContact.Id,
            sf_first_name: sfContact.FirstName,
            sf_last_name: sfContact.LastName,
            sf_title: sfContact.Title,
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

        const phoneNumber = sfLead.Phone || sfLead.MobilePhone || '';
        const contactData = {
          company_id: integration.company_id,
          contact_name: sfLead.Name || `${sfLead.FirstName || ''} ${sfLead.LastName || ''}`.trim(),
          email: sfLead.Email || null,
          phone_number: phoneNumber,
          company_name: sfLead.Company || 'Unknown',
          source: 'salesforce',
          tags: ['salesforce-import', 'salesforce-lead'],
          custom_fields: {
            sf_lead_id: sfLead.Id,
            sf_first_name: sfLead.FirstName,
            sf_last_name: sfLead.LastName,
            sf_title: sfLead.Title,
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

// ============================================================================
// OUTBOUND SYNC: CALLENGO → SALESFORCE (Tasks + Notes)
// ============================================================================

/**
 * Map a Callengo call status to a Salesforce Task subject
 */
function mapCallStatusToSalesforceSubject(callStatus: string, callOutcome: string | null, contactName: string): string {
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
      return `Callengo Call: ${contactName}`;
  }
}

/**
 * Build a plain-text note body from call data for Salesforce
 */
function buildSalesforceCallNoteContent(contact: Record<string, unknown>): string {
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
 * Create a Salesforce Task for a call result.
 * Uses the standard Salesforce Task sobject.
 */
export async function createSalesforceTask(
  integration: SalesforceIntegration,
  task: { subject: string; description: string; whoId: string; status: string; priority?: string; activityDate?: string }
): Promise<{ success: boolean; taskId?: string; error?: string }> {
  const client = await getSalesforceClient(integration);

  const res = await client.fetch('/services/data/v59.0/sobjects/Task', {
    method: 'POST',
    body: JSON.stringify({
      Subject: task.subject,
      Description: task.description,
      WhoId: task.whoId,
      Status: task.status,
      Priority: task.priority || 'Normal',
      ActivityDate: task.activityDate || new Date().toISOString().split('T')[0],
      Type: 'Call',
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    return { success: false, error: `Salesforce Task creation failed (${res.status}): ${errBody}` };
  }

  const data = await res.json();
  return { success: true, taskId: data.id };
}

/**
 * Push a single call result to Salesforce (Task on the Contact/Lead).
 * Called from webhook after a call completes.
 * IMPORTANT: This only CREATES tasks — it NEVER DELETES from Salesforce.
 */
export async function pushCallResultToSalesforce(
  integration: SalesforceIntegration,
  callengoContactId: string
): Promise<{ success: boolean; taskId?: string; error?: string }> {
  const { data: mapping } = await supabaseAdmin
    .from('salesforce_contact_mappings')
    .select('sf_contact_id, sf_lead_id, sf_object_type')
    .eq('integration_id', integration.id)
    .eq('callengo_contact_id', callengoContactId)
    .maybeSingle();

  if (!mapping) {
    return { success: false, error: 'No Salesforce mapping for this contact' };
  }

  const whoId = mapping.sf_contact_id || mapping.sf_lead_id;
  if (!whoId) {
    return { success: false, error: 'No Salesforce Contact/Lead ID in mapping' };
  }

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

  const subject = mapCallStatusToSalesforceSubject(callStatus, callOutcome, contactName);
  const description = buildSalesforceCallNoteContent(contact as Record<string, unknown>);

  const isCompleted = !['pending', 'queued', 'in_progress'].includes(callStatus);

  const taskResult = await createSalesforceTask(integration, {
    subject,
    description,
    whoId,
    status: isCompleted ? 'Completed' : 'Not Started',
    activityDate: new Date().toISOString().split('T')[0],
  });

  // Update mapping sync direction
  await supabaseAdmin
    .from('salesforce_contact_mappings')
    .update({
      last_synced_at: new Date().toISOString(),
      sync_direction: 'bidirectional',
    })
    .eq('integration_id', integration.id)
    .eq('callengo_contact_id', callengoContactId);

  return taskResult;
}

/**
 * Bulk outbound sync: push all recently updated Callengo contacts to Salesforce.
 * IMPORTANT: Only pushes tasks — NEVER deletes Salesforce records.
 */
export async function pushContactUpdatesToSalesforce(
  integration: SalesforceIntegration
): Promise<SalesforceOutboundSyncResult> {
  const result: SalesforceOutboundSyncResult = {
    tasks_created: 0,
    notes_created: 0,
    errors: [],
  };

  try {
    const { data: mappings } = await supabaseAdmin
      .from('salesforce_contact_mappings')
      .select('callengo_contact_id, sf_contact_id, sf_lead_id, last_synced_at')
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

        // Push call result as Task
        if (contact.call_status && contact.call_status !== 'pending' && contact.call_status !== 'queued') {
          const callResult = await pushCallResultToSalesforce(integration, mapping.callengo_contact_id);
          if (callResult.taskId) result.tasks_created++;
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
 * Get the active Salesforce integration for a company (helper for webhook use).
 */
export async function getActiveSalesforceIntegration(
  companyId: string
): Promise<SalesforceIntegration | null> {
  const { data } = await supabaseAdmin
    .from('salesforce_integrations')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  return (data as unknown as SalesforceIntegration) || null;
}
