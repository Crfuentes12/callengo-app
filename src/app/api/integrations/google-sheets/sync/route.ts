// app/api/integrations/google-sheets/sync/route.ts
// Trigger bidirectional sync for linked Google Sheets

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  getActiveGoogleSheetsIntegration,
  getLinkedSheets,
  syncLinkedSheet,
} from '@/lib/google-sheets';

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

    // Optional: sync a specific linked sheet only
    const body = await request.json().catch(() => ({}));
    const specificLinkedId = body.linkedSheetId;

    let linkedSheets = await getLinkedSheets(userData.company_id);
    if (specificLinkedId) {
      linkedSheets = linkedSheets.filter((ls) => ls.id === specificLinkedId);
    }

    if (linkedSheets.length === 0) {
      return NextResponse.json({ error: 'No linked sheets found. Link a spreadsheet first.' }, { status: 400 });
    }

    const results = [];
    for (const ls of linkedSheets) {
      const result = await syncLinkedSheet(integration, ls, userData.company_id);
      results.push({
        linkedSheetId: ls.id,
        spreadsheetName: ls.spreadsheet_name,
        sheetTab: ls.sheet_tab_title,
        ...result,
      });
    }

    const allSuccess = results.every((r) => r.success);
    return NextResponse.json({
      success: allSuccess,
      results,
    });
  } catch (error) {
    console.error('Error syncing Google Sheets:', error);
    const message = error instanceof Error ? error.message : 'Failed to sync';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
