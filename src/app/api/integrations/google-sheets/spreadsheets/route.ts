// app/api/integrations/google-sheets/spreadsheets/route.ts
// Lists the user's Google Sheets spreadsheets

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  getActiveGoogleSheetsIntegration,
  listSpreadsheets,
  getSpreadsheetTabs,
} from '@/lib/google-sheets';

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

    const integration = await getActiveGoogleSheetsIntegration(userData.company_id);
    if (!integration) {
      return NextResponse.json(
        { error: 'Google Sheets not connected' },
        { status: 400 }
      );
    }

    // If a specific spreadsheet ID is provided, return its tabs
    const spreadsheetId = request.nextUrl.searchParams.get('spreadsheetId');
    if (spreadsheetId) {
      const detail = await getSpreadsheetTabs(integration, spreadsheetId);
      return NextResponse.json(detail);
    }

    // Otherwise list all spreadsheets
    const pageToken = request.nextUrl.searchParams.get('pageToken') || undefined;
    const result = await listSpreadsheets(integration, pageToken);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing spreadsheets:', error);
    const message = error instanceof Error ? error.message : 'Failed to list spreadsheets';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
