// lib/google-sheets.ts
// Google Sheets API service - handles OAuth, spreadsheet operations, and bidirectional sync

import { google } from 'googleapis';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';

// ============================================================================
// CONFIGURATION
// ============================================================================

function getAppUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return url.replace(/\/+$/, '');
}

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables');
  }
  return {
    clientId,
    clientSecret,
    redirectUri: `${getAppUrl()}/api/integrations/google-sheets/callback`,
  };
}

// Full access to sheets (read + write) + drive (to list files) + user profile
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

// ============================================================================
// OAUTH HELPERS
// ============================================================================

function createOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = getGoogleConfig();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/** Generate the Google OAuth consent URL for Sheets access */
export function getGoogleSheetsAuthUrl(state: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
    prompt: 'consent',
    include_granted_scopes: true,
  });
}

/** Exchange authorization code for tokens */
export async function exchangeGoogleSheetsCode(code: string) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token || undefined,
    expires_in: tokens.expiry_date
      ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
      : 3600,
    token_type: tokens.token_type || 'Bearer',
    scope: tokens.scope || SCOPES.join(' '),
  };
}

/** Get the Google user's profile info */
export async function getGoogleSheetsUserInfo(accessToken: string) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();
  return {
    id: data.id || '',
    email: data.email || '',
    name: data.name || '',
  };
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

interface SheetsIntegration {
  id: string;
  company_id: string;
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  is_active: boolean;
}

/** Get an authenticated OAuth2 client for the integration, refreshing token if needed */
async function getAuthenticatedClient(integration: SheetsIntegration) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token,
  });

  // Check if token needs refresh (5-minute buffer)
  const expiresAt = integration.token_expires_at
    ? new Date(integration.token_expires_at).getTime()
    : 0;
  const needsRefresh = Date.now() > expiresAt - 5 * 60 * 1000;

  if (needsRefresh && integration.refresh_token) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      const newExpiry = credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : new Date(Date.now() + 3600 * 1000).toISOString();

      // Update tokens in database
      await supabaseAdmin
        .from('google_sheets_integrations')
        .update({
          access_token: credentials.access_token,
          token_expires_at: newExpiry,
          ...(credentials.refresh_token ? { refresh_token: credentials.refresh_token } : {}),
        })
        .eq('id', integration.id);

      oauth2Client.setCredentials(credentials);
    } catch (error) {
      console.error('Failed to refresh Google Sheets token:', error);
      // Mark integration as inactive
      await supabaseAdmin
        .from('google_sheets_integrations')
        .update({ is_active: false })
        .eq('id', integration.id);
      throw new Error('Google Sheets token expired. Please reconnect your account.');
    }
  }

  return oauth2Client;
}

// ============================================================================
// SPREADSHEET OPERATIONS
// ============================================================================

export interface SpreadsheetInfo {
  id: string;
  name: string;
  modifiedTime: string;
  iconLink?: string;
  webViewLink?: string;
  owners?: string[];
}

export interface SheetTab {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetDetail {
  spreadsheetId: string;
  title: string;
  sheets: SheetTab[];
}

export interface SheetData {
  headers: string[];
  rows: string[][];
  sheetTitle: string;
  totalRows: number;
}

/** List the user's Google Sheets spreadsheets (recent 50) */
export async function listSpreadsheets(
  integration: SheetsIntegration,
  pageToken?: string
): Promise<{ files: SpreadsheetInfo[]; nextPageToken?: string }> {
  const auth = await getAuthenticatedClient(integration);
  const drive = google.drive({ version: 'v3', auth });

  const response = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    fields: 'nextPageToken, files(id, name, modifiedTime, iconLink, webViewLink, owners)',
    orderBy: 'modifiedTime desc',
    pageSize: 50,
    pageToken: pageToken || undefined,
  });

  const files: SpreadsheetInfo[] = (response.data.files || []).map((f) => ({
    id: f.id!,
    name: f.name || 'Untitled',
    modifiedTime: f.modifiedTime || '',
    iconLink: f.iconLink || undefined,
    webViewLink: f.webViewLink || undefined,
    owners: f.owners?.map((o) => o.displayName || o.emailAddress || '') || [],
  }));

  return {
    files,
    nextPageToken: response.data.nextPageToken || undefined,
  };
}

/** Get spreadsheet metadata (list of tabs/sheets) */
export async function getSpreadsheetTabs(
  integration: SheetsIntegration,
  spreadsheetId: string
): Promise<SpreadsheetDetail> {
  const auth = await getAuthenticatedClient(integration);
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'spreadsheetId,properties.title,sheets.properties(sheetId,title,gridProperties(rowCount,columnCount))',
  });

  return {
    spreadsheetId: response.data.spreadsheetId!,
    title: response.data.properties?.title || 'Untitled',
    sheets: (response.data.sheets || []).map((s) => ({
      sheetId: s.properties?.sheetId || 0,
      title: s.properties?.title || 'Sheet1',
      rowCount: s.properties?.gridProperties?.rowCount || 0,
      columnCount: s.properties?.gridProperties?.columnCount || 0,
    })),
  };
}

/** Fetch data from a specific sheet tab */
export async function getSheetData(
  integration: SheetsIntegration,
  spreadsheetId: string,
  sheetTitle: string,
  maxRows: number = 10000
): Promise<SheetData> {
  const auth = await getAuthenticatedClient(integration);
  const sheetsApi = google.sheets({ version: 'v4', auth });

  // Fetch all data from the sheet
  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetTitle}'`,
    valueRenderOption: 'FORMATTED_VALUE',
  });

  const allRows = response.data.values || [];

  if (allRows.length === 0) {
    return { headers: [], rows: [], sheetTitle, totalRows: 0 };
  }

  const headers = allRows[0].map((h: unknown) => String(h || ''));
  const dataRows = allRows
    .slice(1, maxRows + 1)
    .map((row: unknown[]) =>
      headers.map((_, i) => String(row[i] ?? ''))
    );

  // Update last_used_at
  await supabaseAdmin
    .from('google_sheets_integrations')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', integration.id);

  return {
    headers,
    rows: dataRows,
    sheetTitle,
    totalRows: dataRows.length,
  };
}

/** Get the active Google Sheets integration for a company */
export async function getActiveGoogleSheetsIntegration(
  companyId: string
): Promise<SheetsIntegration | null> {
  const { data } = await supabaseAdmin
    .from('google_sheets_integrations')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  return data as SheetsIntegration | null;
}

// ============================================================================
// LINKED SHEETS
// ============================================================================

export interface LinkedSheet {
  id: string;
  company_id: string;
  integration_id: string;
  spreadsheet_id: string;
  spreadsheet_name: string;
  sheet_tab_title: string;
  sheet_tab_id: number;
  column_mapping: Record<string, string>;
  sync_direction: 'inbound' | 'outbound' | 'bidirectional';
  last_synced_at: string | null;
  last_sync_row_count: number;
  is_active: boolean;
}

/** Get all active linked sheets for a company */
export async function getLinkedSheets(companyId: string): Promise<LinkedSheet[]> {
  const { data, error } = await supabaseAdmin
    .from('google_sheets_linked_sheets')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  // Gracefully return empty if table doesn't exist yet (migration not run)
  if (error) {
    console.warn('getLinkedSheets error (migration may not be applied):', error.message);
    return [];
  }

  return (data || []) as LinkedSheet[];
}

/** Link a spreadsheet tab for sync */
export async function linkSheet(params: {
  companyId: string;
  integrationId: string;
  spreadsheetId: string;
  spreadsheetName: string;
  sheetTabTitle: string;
  sheetTabId: number;
  columnMapping: Record<string, string>;
  syncDirection?: 'inbound' | 'outbound' | 'bidirectional';
}): Promise<LinkedSheet> {
  const { data, error } = await supabaseAdmin
    .from('google_sheets_linked_sheets')
    .upsert(
      {
        company_id: params.companyId,
        integration_id: params.integrationId,
        spreadsheet_id: params.spreadsheetId,
        spreadsheet_name: params.spreadsheetName,
        sheet_tab_title: params.sheetTabTitle,
        sheet_tab_id: params.sheetTabId,
        column_mapping: params.columnMapping,
        sync_direction: params.syncDirection || 'bidirectional',
        is_active: true,
      },
      { onConflict: 'company_id,spreadsheet_id,sheet_tab_title' }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to link sheet: ${error.message}`);
  return data as LinkedSheet;
}

/** Unlink a spreadsheet tab */
export async function unlinkSheet(linkedSheetId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('google_sheets_linked_sheets')
    .update({ is_active: false })
    .eq('id', linkedSheetId);

  if (error) throw new Error(`Failed to unlink sheet: ${error.message}`);
}

// ============================================================================
// OUTBOUND SYNC — Write Callengo data to Google Sheets
// ============================================================================

// Standard headers for the Callengo contact sheet
const CALLENGO_HEADERS = [
  'Contact Name',
  'Phone Number',
  'Email',
  'Company',
  'Status',
  'Call Status',
  'Call Outcome',
  'Last Call Date',
  'Call Duration (s)',
  'Call Attempts',
  'Sentiment',
  'Interest Level',
  'Follow-up Required',
  'Summary',
  'Tags',
  'Notes',
  'Source',
  'Created At',
  'Updated At',
];

interface ContactForSheet {
  contact_name?: string | null;
  phone_number: string;
  email?: string | null;
  company_name?: string | null;
  status?: string | null;
  call_status?: string | null;
  call_outcome?: string | null;
  last_call_date?: string | null;
  call_duration?: number | null;
  call_attempts?: number | null;
  analysis?: unknown;
  call_metadata?: unknown;
  tags?: string[] | unknown;
  notes?: string | null;
  source?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function contactToRow(c: ContactForSheet): string[] {
  const analysis = (c.analysis && typeof c.analysis === 'object' ? c.analysis : {}) as Record<string, unknown>;
  const metadata = (c.call_metadata && typeof c.call_metadata === 'object' ? c.call_metadata : {}) as Record<string, unknown>;
  const tags = Array.isArray(c.tags) ? c.tags : [];
  return [
    c.contact_name || '',
    c.phone_number || '',
    c.email || '',
    c.company_name || '',
    c.status || '',
    c.call_status || '',
    c.call_outcome || '',
    c.last_call_date ? new Date(c.last_call_date).toLocaleString() : '',
    c.call_duration != null ? String(c.call_duration) : '',
    c.call_attempts != null ? String(c.call_attempts) : '',
    String(analysis.callSentiment || ''),
    String(analysis.customerInterestLevel || ''),
    analysis.followUpRequired ? 'Yes' : analysis.followUpRequired === false ? 'No' : '',
    String(metadata.summary || c.call_outcome || ''),
    tags.join(', '),
    c.notes || '',
    c.source || 'callengo',
    c.created_at ? new Date(c.created_at).toLocaleString() : '',
    c.updated_at ? new Date(c.updated_at).toLocaleString() : '',
  ];
}

/** Push all company contacts to a linked Google Sheet (full overwrite) */
export async function pushContactsToSheet(
  integration: SheetsIntegration,
  linkedSheet: LinkedSheet,
  companyId: string
): Promise<{ success: boolean; rowCount: number; error?: string }> {
  try {
    // Fetch all contacts for this company
    const { data: contacts, error: fetchError } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (fetchError) throw new Error(`Failed to fetch contacts: ${fetchError.message}`);

    const auth = await getAuthenticatedClient(integration);
    const sheetsApi = google.sheets({ version: 'v4', auth });

    // Build the data: headers + rows
    const rows = (contacts || []).map((c: ContactForSheet) => contactToRow(c));
    const values = [CALLENGO_HEADERS, ...rows];

    // Clear existing content first
    await sheetsApi.spreadsheets.values.clear({
      spreadsheetId: linkedSheet.spreadsheet_id,
      range: `'${linkedSheet.sheet_tab_title}'`,
    });

    // Write new data
    await sheetsApi.spreadsheets.values.update({
      spreadsheetId: linkedSheet.spreadsheet_id,
      range: `'${linkedSheet.sheet_tab_title}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    // Format header row as bold
    try {
      await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: linkedSheet.spreadsheet_id,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: linkedSheet.sheet_tab_id,
                  startRowIndex: 0,
                  endRowIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: { bold: true },
                    backgroundColor: { red: 0.93, green: 0.93, blue: 0.93 },
                  },
                },
                fields: 'userEnteredFormat(textFormat,backgroundColor)',
              },
            },
          ],
        },
      });
    } catch {
      // Non-fatal: formatting failed but data is written
    }

    // Update sync metadata
    await supabaseAdmin
      .from('google_sheets_linked_sheets')
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_row_count: rows.length,
      })
      .eq('id', linkedSheet.id);

    await supabaseAdmin
      .from('google_sheets_integrations')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', integration.id);

    return { success: true, rowCount: rows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to push contacts to sheet:', message);
    return { success: false, rowCount: 0, error: message };
  }
}

/** Push a single contact update to the linked sheet (append or update row) */
export async function pushSingleContactToSheet(
  integration: SheetsIntegration,
  linkedSheet: LinkedSheet,
  contact: ContactForSheet
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await getAuthenticatedClient(integration);
    const sheetsApi = google.sheets({ version: 'v4', auth });

    // Read existing data to find the contact row by phone number
    const existing = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: linkedSheet.spreadsheet_id,
      range: `'${linkedSheet.sheet_tab_title}'`,
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const allRows = existing.data.values || [];
    const phoneColIndex = 1; // Phone Number is column B (index 1)

    // Find existing row by phone number
    let rowIndex = -1;
    for (let i = 1; i < allRows.length; i++) {
      const rowPhone = (allRows[i]?.[phoneColIndex] || '').replace(/\D/g, '');
      const contactPhone = (contact.phone_number || '').replace(/\D/g, '');
      if (rowPhone && contactPhone && rowPhone === contactPhone) {
        rowIndex = i;
        break;
      }
    }

    const newRow = contactToRow(contact);

    if (rowIndex > 0) {
      // Update existing row
      await sheetsApi.spreadsheets.values.update({
        spreadsheetId: linkedSheet.spreadsheet_id,
        range: `'${linkedSheet.sheet_tab_title}'!A${rowIndex + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [newRow] },
      });
    } else {
      // Ensure headers exist
      if (allRows.length === 0) {
        await sheetsApi.spreadsheets.values.update({
          spreadsheetId: linkedSheet.spreadsheet_id,
          range: `'${linkedSheet.sheet_tab_title}'!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [CALLENGO_HEADERS] },
        });
      }

      // Append new row
      await sheetsApi.spreadsheets.values.append({
        spreadsheetId: linkedSheet.spreadsheet_id,
        range: `'${linkedSheet.sheet_tab_title}'!A1`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [newRow] },
      });
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to push single contact to sheet:', message);
    return { success: false, error: message };
  }
}

/** Progress callback for sync operations */
export type SyncProgressCallback = (progress: {
  phase: 'reading' | 'importing' | 'complete' | 'error';
  processed: number;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  message: string;
}) => void;

const BATCH_SIZE = 200;

/** Inbound sync: read contacts from a linked sheet and upsert into Callengo (batch processing) */
export async function pullContactsFromSheet(
  integration: SheetsIntegration,
  linkedSheet: LinkedSheet,
  companyId: string,
  onProgress?: SyncProgressCallback
): Promise<{ success: boolean; created: number; updated: number; skipped: number; total: number; error?: string }> {
  try {
    onProgress?.({ phase: 'reading', processed: 0, total: 0, created: 0, updated: 0, skipped: 0, message: 'Reading spreadsheet data...' });

    const data = await getSheetData(integration, linkedSheet.spreadsheet_id, linkedSheet.sheet_tab_title);

    if (data.headers.length === 0 || data.rows.length === 0) {
      onProgress?.({ phase: 'complete', processed: 0, total: 0, created: 0, updated: 0, skipped: 0, message: 'Sheet is empty' });
      return { success: true, created: 0, updated: 0, skipped: 0, total: 0 };
    }

    const totalRows = data.rows.length;

    // Use the stored column mapping or auto-detect
    const mapping = linkedSheet.column_mapping || {};
    const headerLower = data.headers.map((h) => h.toLowerCase().trim());

    // Helper to find column index by mapping key or common header names
    const findCol = (key: string, ...aliases: string[]): number => {
      if (mapping[key]) {
        const idx = headerLower.indexOf(mapping[key].toLowerCase());
        if (idx >= 0) return idx;
      }
      for (const alias of aliases) {
        const idx = headerLower.findIndex((h) => h.includes(alias.toLowerCase()));
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const phoneCol = findCol('phoneNumber', 'phone', 'tel', 'mobile', 'cell');
    if (phoneCol < 0) {
      const errMsg = 'No phone number column found in sheet';
      onProgress?.({ phase: 'error', processed: 0, total: totalRows, created: 0, updated: 0, skipped: 0, message: errMsg });
      return { success: false, created: 0, updated: 0, skipped: 0, total: totalRows, error: errMsg };
    }

    const nameCol = findCol('contactName', 'name', 'contact name', 'full name', 'nombre');
    const emailCol = findCol('email', 'e-mail', 'correo');
    const companyCol = findCol('companyName', 'company', 'empresa', 'organization');
    const notesCol = findCol('notes', 'note', 'notas', 'comentarios');

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let processed = 0;

    // Prepare all contacts from the sheet
    const sheetContacts: { phone: string; data: Record<string, unknown> }[] = [];
    for (const row of data.rows) {
      const phone = (row[phoneCol] || '').trim();
      if (!phone) {
        skipped++;
        processed++;
        continue;
      }

      const contactData: Record<string, unknown> = {
        company_id: companyId,
        phone_number: phone,
        source: 'google_sheets',
      };

      if (nameCol >= 0 && row[nameCol]) contactData.contact_name = row[nameCol].trim();
      if (emailCol >= 0 && row[emailCol]) contactData.email = row[emailCol].trim();
      if (companyCol >= 0 && row[companyCol]) contactData.company_name = row[companyCol].trim();
      if (notesCol >= 0 && row[notesCol]) contactData.notes = row[notesCol].trim();

      sheetContacts.push({ phone, data: contactData });
    }

    // Process in batches
    for (let i = 0; i < sheetContacts.length; i += BATCH_SIZE) {
      const batch = sheetContacts.slice(i, i + BATCH_SIZE);
      const batchPhones = batch.map((c) => c.phone);

      // Single query: get all existing contacts for this batch by phone number
      const { data: existingContacts } = await supabaseAdmin
        .from('contacts')
        .select('id, phone_number, source')
        .eq('company_id', companyId)
        .in('phone_number', batchPhones);

      const existingMap = new Map<string, { id: string; source: string | null }>();
      for (const ec of existingContacts || []) {
        existingMap.set(ec.phone_number, { id: ec.id, source: ec.source });
      }

      // Separate into inserts and updates
      const toInsert: Record<string, unknown>[] = [];
      const toUpdate: { id: string; data: Record<string, unknown> }[] = [];

      for (const contact of batch) {
        const existing = existingMap.get(contact.phone);
        if (existing) {
          // PROTECTION: For contacts from other sources, only update non-critical fields
          // Never overwrite the source of a contact that came from another integration
          const updateData = { ...contact.data };
          if (existing.source && existing.source !== 'google_sheets' && existing.source !== 'manual') {
            // Preserve the original source — don't overwrite salesforce/hubspot/pipedrive contacts
            delete updateData.source;
          }
          // Remove company_id from update payload (it's the match key, not an update field)
          delete updateData.company_id;
          toUpdate.push({ id: existing.id, data: updateData });
        } else {
          toInsert.push(contact.data);
        }
      }

      // Batch insert new contacts
      if (toInsert.length > 0) {
        const { error } = await supabaseAdmin
          .from('contacts')
          .insert(toInsert);
        if (!error) {
          created += toInsert.length;
        } else {
          // Fallback: try inserting one by one to skip duplicates
          for (const row of toInsert) {
            const { error: singleErr } = await supabaseAdmin.from('contacts').insert(row);
            if (!singleErr) created++;
            else skipped++;
          }
        }
      }

      // Batch update existing contacts (updates must be done per-row due to different IDs)
      for (const upd of toUpdate) {
        const { error } = await supabaseAdmin
          .from('contacts')
          .update(upd.data)
          .eq('id', upd.id);
        if (!error) updated++;
        else skipped++;
      }

      processed += batch.length;

      onProgress?.({
        phase: 'importing',
        processed,
        total: totalRows,
        created,
        updated,
        skipped,
        message: `Importing contacts... ${processed} of ${totalRows}`,
      });
    }

    // Update sync metadata
    await supabaseAdmin
      .from('google_sheets_linked_sheets')
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_row_count: data.rows.length,
      })
      .eq('id', linkedSheet.id);

    onProgress?.({
      phase: 'complete',
      processed: totalRows,
      total: totalRows,
      created,
      updated,
      skipped,
      message: `Import complete! ${created} created, ${updated} updated`,
    });

    return { success: true, created, updated, skipped, total: totalRows };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to pull contacts from sheet:', message);
    onProgress?.({ phase: 'error', processed: 0, total: 0, created: 0, updated: 0, skipped: 0, message });
    return { success: false, created: 0, updated: 0, skipped: 0, total: 0, error: message };
  }
}

/** Full sync: pull inbound then optionally push outbound */
export async function syncLinkedSheet(
  integration: SheetsIntegration,
  linkedSheet: LinkedSheet,
  companyId: string,
  onProgress?: SyncProgressCallback
): Promise<{
  success: boolean;
  inbound: { created: number; updated: number; skipped: number; total: number };
  outbound: { rowCount: number };
  error?: string;
}> {
  const direction = linkedSheet.sync_direction;
  let inbound = { created: 0, updated: 0, skipped: 0, total: 0 };
  let outbound = { rowCount: 0 };

  // Inbound first (pull new contacts from sheet)
  if (direction === 'inbound' || direction === 'bidirectional') {
    const inResult = await pullContactsFromSheet(integration, linkedSheet, companyId, onProgress);
    if (!inResult.success) {
      return { success: false, inbound, outbound, error: inResult.error };
    }
    inbound = { created: inResult.created, updated: inResult.updated, skipped: inResult.skipped, total: inResult.total };
  }

  // Outbound (push all contacts to sheet — only if explicitly set to outbound or bidirectional)
  // SAFETY: outbound push overwrites the Google Sheet, so only do it when explicitly requested
  if (direction === 'outbound' || direction === 'bidirectional') {
    const outResult = await pushContactsToSheet(integration, linkedSheet, companyId);
    if (!outResult.success) {
      return { success: false, inbound, outbound, error: outResult.error };
    }
    outbound = { rowCount: outResult.rowCount };
  }

  return { success: true, inbound, outbound };
}

/** Create a notification for sync completion */
export async function createSyncNotification(
  companyId: string,
  userId: string,
  result: { created: number; updated: number; skipped: number; total: number; spreadsheetName: string; success: boolean; error?: string }
): Promise<void> {
  try {
    const isSuccess = result.success;
    await supabaseAdmin.from('notifications').insert({
      company_id: companyId,
      user_id: userId,
      type: isSuccess ? 'campaign_completed' : 'campaign_failed',
      title: isSuccess ? 'Google Sheets Import Complete' : 'Google Sheets Import Failed',
      message: isSuccess
        ? `"${result.spreadsheetName}" — ${result.created} contacts created, ${result.updated} updated, ${result.skipped} skipped (${result.total} total rows processed)`
        : `"${result.spreadsheetName}" — Import failed: ${result.error || 'Unknown error'}`,
      read: false,
      metadata: {
        source: 'google_sheets',
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        total: result.total,
      },
    });
  } catch (err) {
    console.error('Failed to create sync notification:', err);
  }
}
