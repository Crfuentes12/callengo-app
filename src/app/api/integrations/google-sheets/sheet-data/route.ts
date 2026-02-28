// app/api/integrations/google-sheets/sheet-data/route.ts
// Fetches data from a specific sheet tab for import

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getActiveGoogleSheetsIntegration, getSheetData } from '@/lib/google-sheets';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 400 });
    }

    const spreadsheetId = request.nextUrl.searchParams.get('spreadsheetId');
    const sheetTitle = request.nextUrl.searchParams.get('sheetTitle');

    if (!spreadsheetId || !sheetTitle) {
      return NextResponse.json(
        { error: 'Missing spreadsheetId or sheetTitle' },
        { status: 400 }
      );
    }

    const integration = await getActiveGoogleSheetsIntegration(userData.company_id);
    if (!integration) {
      return NextResponse.json(
        { error: 'Google Sheets not connected' },
        { status: 400 }
      );
    }

    const data = await getSheetData(integration, spreadsheetId, sheetTitle);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch sheet data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
