// lib/simplybook/sync.ts
// SimplyBook.me data sync operations — clients, bookings, services, providers

import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { getSimplyBookClient } from './auth';
import type {
  SimplyBookIntegration,
  SimplyBookClient,
  SimplyBookBookingDetails,
  SimplyBookService,
  SimplyBookProvider,
  SimplyBookPaginatedResponse,
  SimplyBookSyncResult,
  SimplyBookOutboundSyncResult,
  SimplyBookCalendarNote,
} from '@/types/simplybook';

// ============================================================================
// FETCH OPERATIONS
// ============================================================================

/**
 * Fetch clients from SimplyBook.me (paginated)
 */
export async function fetchSimplyBookClients(
  integration: SimplyBookIntegration,
  options: { page?: number; limit?: number; search?: string } = {}
): Promise<SimplyBookPaginatedResponse<SimplyBookClient>> {
  const client = await getSimplyBookClient(integration);
  const params = new URLSearchParams();
  if (options.page) params.set('page', String(options.page));
  if (options.limit) params.set('on_page', String(options.limit));
  if (options.search) params.set('filter[search]', options.search);

  const queryStr = params.toString();
  const path = `/clients${queryStr ? `?${queryStr}` : ''}`;

  const res = await client.fetch(path);

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`SimplyBook.me clients fetch failed (${res.status}): ${errBody}`);
  }

  return res.json() as Promise<SimplyBookPaginatedResponse<SimplyBookClient>>;
}

/**
 * Fetch all clients across pages (for full sync)
 */
async function fetchAllClients(
  integration: SimplyBookIntegration,
  maxPages: number = 20
): Promise<SimplyBookClient[]> {
  const allClients: SimplyBookClient[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= maxPages) {
    try {
      const result = await fetchSimplyBookClients(integration, { page, limit: 100 });
      if (result.data && result.data.length > 0) {
        allClients.push(...result.data);
        hasMore = page < result.metadata.pages_count;
        page++;
      } else {
        hasMore = false;
      }
    } catch {
      hasMore = false;
    }
  }

  return allClients;
}

/**
 * Fetch a single client by ID
 */
export async function fetchSimplyBookClientById(
  integration: SimplyBookIntegration,
  clientId: number
): Promise<SimplyBookClient | null> {
  const client = await getSimplyBookClient(integration);

  const res = await client.fetch(`/clients/${clientId}`);
  if (!res.ok) return null;

  return res.json() as Promise<SimplyBookClient>;
}

/**
 * Fetch bookings from SimplyBook.me (paginated)
 */
export async function fetchSimplyBookBookings(
  integration: SimplyBookIntegration,
  options: { page?: number; limit?: number; upcomingOnly?: boolean; status?: string; dateFrom?: string; dateTo?: string } = {}
): Promise<SimplyBookPaginatedResponse<SimplyBookBookingDetails>> {
  const client = await getSimplyBookClient(integration);
  const params = new URLSearchParams();
  if (options.page) params.set('page', String(options.page));
  if (options.limit) params.set('on_page', String(options.limit));
  if (options.upcomingOnly) params.set('filter[upcoming_only]', '1');
  if (options.status) params.set('filter[status]', options.status);
  if (options.dateFrom) params.set('filter[date_from]', options.dateFrom);
  if (options.dateTo) params.set('filter[date_to]', options.dateTo);

  const queryStr = params.toString();
  const path = `/bookings${queryStr ? `?${queryStr}` : ''}`;

  const res = await client.fetch(path);

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`SimplyBook.me bookings fetch failed (${res.status}): ${errBody}`);
  }

  return res.json() as Promise<SimplyBookPaginatedResponse<SimplyBookBookingDetails>>;
}

/**
 * Fetch services from SimplyBook.me
 */
export async function fetchSimplyBookServices(
  integration: SimplyBookIntegration
): Promise<SimplyBookPaginatedResponse<SimplyBookService>> {
  const client = await getSimplyBookClient(integration);

  const res = await client.fetch('/services');

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`SimplyBook.me services fetch failed (${res.status}): ${errBody}`);
  }

  return res.json() as Promise<SimplyBookPaginatedResponse<SimplyBookService>>;
}

/**
 * Fetch providers (staff/performers) from SimplyBook.me
 */
export async function fetchSimplyBookProviders(
  integration: SimplyBookIntegration
): Promise<SimplyBookPaginatedResponse<SimplyBookProvider>> {
  const client = await getSimplyBookClient(integration);

  const res = await client.fetch('/providers');

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`SimplyBook.me providers fetch failed (${res.status}): ${errBody}`);
  }

  return res.json() as Promise<SimplyBookPaginatedResponse<SimplyBookProvider>>;
}

// ============================================================================
// INBOUND SYNC — SimplyBook clients → Callengo contacts
// ============================================================================

/**
 * Sync all SimplyBook.me clients to Callengo contacts table.
 * Deduplicates by email and phone. NEVER deletes from SimplyBook.
 */
export async function syncSimplyBookClientsToCallengo(
  integration: SimplyBookIntegration
): Promise<SimplyBookSyncResult> {
  const result: SimplyBookSyncResult = {
    clients_created: 0,
    clients_updated: 0,
    clients_skipped: 0,
    errors: [],
  };

  // Create sync log
  const { data: syncLog } = await supabaseAdmin
    .from('simplybook_sync_logs')
    .insert({
      company_id: integration.company_id,
      integration_id: integration.id,
      sync_type: 'clients',
      sync_direction: 'inbound',
      started_at: new Date().toISOString(),
      status: 'running',
    })
    .select('id')
    .single();

  try {
    const allClients = await fetchAllClients(integration);

    for (const sbClient of allClients) {
      try {
        await upsertClientAsContact(integration, sbClient, result);
      } catch (err) {
        result.errors.push(`Error syncing client ${sbClient.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Update sync log
    await supabaseAdmin
      .from('simplybook_sync_logs')
      .update({
        records_created: result.clients_created,
        records_updated: result.clients_updated,
        records_skipped: result.clients_skipped,
        errors: result.errors,
        completed_at: new Date().toISOString(),
        status: result.errors.length > 0 ? 'completed_with_errors' : 'completed',
      })
      .eq('id', syncLog?.id);

    // Update last_synced_at on integration
    await supabaseAdmin
      .from('simplybook_integrations')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', integration.id);

  } catch (err) {
    await supabaseAdmin
      .from('simplybook_sync_logs')
      .update({
        completed_at: new Date().toISOString(),
        status: 'failed',
        error_message: err instanceof Error ? err.message : String(err),
      })
      .eq('id', syncLog?.id);
    throw err;
  }

  return result;
}

/**
 * Upsert a single SimplyBook client as a Callengo contact
 */
async function upsertClientAsContact(
  integration: SimplyBookIntegration,
  sbClient: SimplyBookClient,
  result: SimplyBookSyncResult
): Promise<void> {
  const email = sbClient.email?.trim() || null;
  const phone = sbClient.phone?.trim() || null;
  const name = sbClient.name?.trim() || '';

  if (!email && !phone) {
    result.clients_skipped++;
    return;
  }

  // Split name into first/last
  const nameParts = name.split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Check for existing mapping
  const { data: existingMapping } = await supabaseAdmin
    .from('simplybook_contact_mappings')
    .select('callengo_contact_id')
    .eq('integration_id', integration.id)
    .eq('sb_client_id', String(sbClient.id))
    .maybeSingle();

  if (existingMapping) {
    // Update existing contact
    await supabaseAdmin
      .from('contacts')
      .update({
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone_number: phone,
        source: 'simplybook',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingMapping.callengo_contact_id);

    await supabaseAdmin
      .from('simplybook_contact_mappings')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('integration_id', integration.id)
      .eq('sb_client_id', String(sbClient.id));

    result.clients_updated++;
    return;
  }

  // Deduplicate by email or phone
  let existingContactId: string | null = null;

  if (email) {
    const { data: byEmail } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('company_id', integration.company_id)
      .ilike('email', email)
      .limit(1)
      .maybeSingle();
    if (byEmail) existingContactId = byEmail.id;
  }

  if (!existingContactId && phone) {
    const { data: byPhone } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('company_id', integration.company_id)
      .eq('phone_number', phone)
      .limit(1)
      .maybeSingle();
    if (byPhone) existingContactId = byPhone.id;
  }

  if (existingContactId) {
    // Link to existing contact
    await supabaseAdmin.from('simplybook_contact_mappings').insert({
      company_id: integration.company_id,
      integration_id: integration.id,
      callengo_contact_id: existingContactId,
      sb_client_id: String(sbClient.id),
      last_synced_at: new Date().toISOString(),
      sync_direction: 'inbound',
    });
    result.clients_updated++;
    return;
  }

  // Create new contact
  const { data: newContact, error: insertErr } = await supabaseAdmin
    .from('contacts')
    .insert({
      company_id: integration.company_id,
      first_name: firstName,
      last_name: lastName,
      email: email,
      phone_number: phone,
      source: 'simplybook',
      status: 'active',
    })
    .select('id')
    .single();

  if (insertErr || !newContact) {
    result.errors.push(`Failed to create contact for SB client ${sbClient.id}: ${insertErr?.message}`);
    return;
  }

  // Create mapping
  await supabaseAdmin.from('simplybook_contact_mappings').insert({
    company_id: integration.company_id,
    integration_id: integration.id,
    callengo_contact_id: newContact.id,
    sb_client_id: String(sbClient.id),
    last_synced_at: new Date().toISOString(),
    sync_direction: 'inbound',
  });

  result.clients_created++;
}

/**
 * Sync selected SimplyBook clients by their IDs
 */
export async function syncSelectedSimplyBookClients(
  integration: SimplyBookIntegration,
  clientIds: number[]
): Promise<SimplyBookSyncResult> {
  const result: SimplyBookSyncResult = {
    clients_created: 0,
    clients_updated: 0,
    clients_skipped: 0,
    errors: [],
  };

  for (const clientId of clientIds) {
    try {
      const sbClient = await fetchSimplyBookClientById(integration, clientId);
      if (sbClient) {
        await upsertClientAsContact(integration, sbClient, result);
      } else {
        result.clients_skipped++;
      }
    } catch (err) {
      result.errors.push(`Error syncing client ${clientId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}

// ============================================================================
// OUTBOUND SYNC — Callengo call results → SimplyBook notes
// ============================================================================

/**
 * Build plain-text call note content for SimplyBook calendar note
 */
function buildSimplyBookCallNoteContent(callData: {
  contact_name?: string;
  call_status?: string;
  call_duration?: number;
  call_summary?: string;
  sentiment?: string;
  key_points?: string[];
}): string {
  const lines: string[] = ['[Callengo Call Result]'];

  if (callData.contact_name) lines.push(`Contact: ${callData.contact_name}`);
  if (callData.call_status) lines.push(`Status: ${callData.call_status}`);
  if (callData.call_duration) {
    const mins = Math.floor(callData.call_duration / 60);
    const secs = callData.call_duration % 60;
    lines.push(`Duration: ${mins}m ${secs}s`);
  }
  if (callData.sentiment) lines.push(`Sentiment: ${callData.sentiment}`);
  if (callData.call_summary) lines.push(`\nSummary:\n${callData.call_summary}`);
  if (callData.key_points && callData.key_points.length > 0) {
    lines.push(`\nKey Points:\n${callData.key_points.map(p => `• ${p}`).join('\n')}`);
  }

  lines.push(`\nLogged at: ${new Date().toISOString()}`);
  return lines.join('\n');
}

/**
 * Create a calendar note in SimplyBook.me linked to a provider
 */
export async function createSimplyBookCalendarNote(
  integration: SimplyBookIntegration,
  providerId: number,
  noteContent: string,
  startDateTime: string,
  endDateTime: string
): Promise<SimplyBookCalendarNote | null> {
  const client = await getSimplyBookClient(integration);

  const res = await client.fetch('/calendar-notes', {
    method: 'POST',
    body: JSON.stringify({
      provider_id: providerId,
      service_id: null,
      start_date_time: startDateTime,
      end_date_time: endDateTime,
      note_type_id: null, // uses default note type
      note: noteContent,
      mode: 'provider',
      time_blocked: false,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Failed to create SimplyBook note: ${res.status} ${errBody}`);
  }

  return res.json() as Promise<SimplyBookCalendarNote>;
}

/**
 * Push a Callengo call result to SimplyBook.me as a calendar note.
 * Requires a provider_id to attach the note to.
 */
export async function pushCallResultToSimplyBook(
  integration: SimplyBookIntegration,
  callData: {
    contact_name?: string;
    call_status?: string;
    call_duration?: number;
    call_summary?: string;
    sentiment?: string;
    key_points?: string[];
    provider_id: number;
    call_datetime?: string;
  }
): Promise<SimplyBookOutboundSyncResult> {
  const result: SimplyBookOutboundSyncResult = {
    notes_created: 0,
    bookings_created: 0,
    errors: [],
  };

  try {
    const noteContent = buildSimplyBookCallNoteContent(callData);
    const startDt = callData.call_datetime || new Date().toISOString().replace('T', ' ').substring(0, 19);
    // Note end = start + 15 min
    const startDate = new Date(startDt.replace(' ', 'T'));
    const endDate = new Date(startDate.getTime() + 15 * 60 * 1000);
    const endDt = endDate.toISOString().replace('T', ' ').substring(0, 19);

    await createSimplyBookCalendarNote(
      integration,
      callData.provider_id,
      noteContent,
      startDt,
      endDt
    );

    result.notes_created++;

    // Log outbound sync
    await supabaseAdmin.from('simplybook_sync_logs').insert({
      company_id: integration.company_id,
      integration_id: integration.id,
      sync_type: 'full',
      sync_direction: 'outbound',
      records_created: 1,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      status: 'completed',
    });
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
  }

  return result;
}

/**
 * Bulk outbound sync: push multiple call results to SimplyBook.me
 */
export async function pushContactUpdatesToSimplyBook(
  integration: SimplyBookIntegration,
  callResults: Array<{
    contact_name?: string;
    call_status?: string;
    call_duration?: number;
    call_summary?: string;
    sentiment?: string;
    key_points?: string[];
    provider_id: number;
    call_datetime?: string;
  }>
): Promise<SimplyBookOutboundSyncResult> {
  const result: SimplyBookOutboundSyncResult = {
    notes_created: 0,
    bookings_created: 0,
    errors: [],
  };

  for (const callData of callResults) {
    try {
      const singleResult = await pushCallResultToSimplyBook(integration, callData);
      result.notes_created += singleResult.notes_created;
      result.bookings_created += singleResult.bookings_created;
      result.errors.push(...singleResult.errors);
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return result;
}

// ============================================================================
// AVAILABILITY & BOOKING — for appointment confirmation workflow
// ============================================================================

/**
 * Get available time slots from SimplyBook.me for a specific service and date range.
 *
 * Returns an array of { date, time } objects (e.g. [{ date: "2025-03-26", time: "09:00" }]).
 * An empty array means no slots are available in the requested window.
 */
export async function getSimplyBookAvailableSlots(
  integration: SimplyBookIntegration,
  options: {
    serviceId: number;
    providerId?: number;
    dateFrom: string; // YYYY-MM-DD
    dateTo: string;   // YYYY-MM-DD
  }
): Promise<Array<{ date: string; time: string }>> {
  const client = await getSimplyBookClient(integration);
  const params = new URLSearchParams({
    service_id: String(options.serviceId),
    date_from: options.dateFrom,
    date_to: options.dateTo,
  });
  if (options.providerId != null) {
    params.set('provider_id', String(options.providerId));
  }

  const res = await client.fetch(`/slots?${params.toString()}`);

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`SimplyBook.me available slots fetch failed (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  if (Array.isArray(data)) return data as Array<{ date: string; time: string }>;
  return [];
}

/**
 * Create a new booking in SimplyBook.me.
 *
 * Either client_id (existing client) or client object (new client details) must be provided.
 * start_datetime must be in "YYYY-MM-DD HH:MM:SS" format.
 */
export async function createSimplyBookBooking(
  integration: SimplyBookIntegration,
  bookingData: {
    start_datetime: string; // "YYYY-MM-DD HH:MM:SS"
    service_id: number;
    provider_id: number;
    client_id?: number;
    client?: { name: string; email?: string; phone?: string };
    comment?: string;
  }
): Promise<SimplyBookBookingDetails> {
  const client = await getSimplyBookClient(integration);

  const res = await client.fetch('/bookings', {
    method: 'POST',
    body: JSON.stringify(bookingData),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`SimplyBook.me booking creation failed (${res.status}): ${errBody}`);
  }

  return res.json() as Promise<SimplyBookBookingDetails>;
}

/**
 * Fetch busy time slots from SimplyBook.me for a date range.
 * Used by the availability engine to block confirmed bookings.
 *
 * Returns TimeSlot objects ({start, end} as ISO strings) for each confirmed booking.
 */
export async function getSimplyBookBusySlots(
  integration: SimplyBookIntegration,
  startDate: string, // YYYY-MM-DD or ISO datetime
  endDate: string
): Promise<{ start: string; end: string }[]> {
  try {
    // Normalize to YYYY-MM-DD for the filter
    const dateFrom = startDate.split('T')[0];
    const dateTo = endDate.split('T')[0];

    const result = await fetchSimplyBookBookings(integration, {
      dateFrom,
      dateTo,
      limit: 200,
    });

    return (result.data || [])
      .filter((b) => b.status !== 'canceled' && b.status !== 'cancelled')
      .map((b) => ({
        start: b.start_datetime.includes('T')
          ? b.start_datetime
          : b.start_datetime.replace(' ', 'T') + 'Z',
        end: b.end_datetime.includes('T')
          ? b.end_datetime
          : b.end_datetime.replace(' ', 'T') + 'Z',
      }));
  } catch {
    return [];
  }
}

// ============================================================================
// HELPER
// ============================================================================

/**
 * Get the active SimplyBook.me integration for a company
 */
export async function getActiveSimplyBookIntegration(
  companyId: string
): Promise<SimplyBookIntegration | null> {
  const { data } = await supabaseAdmin
    .from('simplybook_integrations')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  return (data as SimplyBookIntegration) || null;
}
