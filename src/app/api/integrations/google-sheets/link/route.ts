// app/api/integrations/google-sheets/link/route.ts
// Link/unlink a Google Sheet for contact import

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  getActiveGoogleSheetsIntegration,
  linkSheet,
  unlinkSheet,
  getLinkedSheets,
} from '@/lib/google-sheets';

// GET — list linked sheets for the company
export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();
    if (!userData?.company_id) return NextResponse.json({ error: 'No company found' }, { status: 400 });

    const linked = await getLinkedSheets(userData.company_id);
    return NextResponse.json({ linkedSheets: linked });
  } catch (error) {
    console.error('Error fetching linked sheets:', error);
    return NextResponse.json({ error: 'Failed to fetch linked sheets' }, { status: 500 });
  }
}

// POST — link a new sheet
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();
    if (!userData?.company_id) return NextResponse.json({ error: 'No company found' }, { status: 400 });

    const integration = await getActiveGoogleSheetsIntegration(userData.company_id);
    if (!integration) {
      return NextResponse.json({ error: 'Google Sheets not connected' }, { status: 400 });
    }

    const body = await request.json();
    const { spreadsheetId, spreadsheetName, sheetTabTitle, sheetTabId, columnMapping, syncDirection } = body;

    if (!spreadsheetId || !sheetTabTitle) {
      return NextResponse.json({ error: 'Missing spreadsheetId or sheetTabTitle' }, { status: 400 });
    }

    const linked = await linkSheet({
      companyId: userData.company_id,
      integrationId: integration.id,
      spreadsheetId,
      spreadsheetName: spreadsheetName || 'Untitled',
      sheetTabTitle,
      sheetTabId: sheetTabId || 0,
      columnMapping: columnMapping || {},
      syncDirection: 'inbound',
    });

    return NextResponse.json({ success: true, linkedSheet: linked });
  } catch (error) {
    console.error('Error linking sheet:', error);
    const message = error instanceof Error ? error.message : 'Failed to link sheet';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — unlink a sheet
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const linkedSheetId = request.nextUrl.searchParams.get('id');
    if (!linkedSheetId) {
      return NextResponse.json({ error: 'Missing linked sheet id' }, { status: 400 });
    }

    await unlinkSheet(linkedSheetId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unlinking sheet:', error);
    return NextResponse.json({ error: 'Failed to unlink sheet' }, { status: 500 });
  }
}
