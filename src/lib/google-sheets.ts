// lib/google-sheets.ts
// Google Sheets API service - handles OAuth and spreadsheet operations for contact import

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

// Only request read-only access to sheets + drive metadata (to list files) + user profile
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
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
    fields: 'spreadsheetId, properties.title, sheets.properties',
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
