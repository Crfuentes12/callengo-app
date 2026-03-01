// app/api/integrations/google-sheets/sync/route.ts
// Import contacts from linked Google Sheets with streaming progress updates (inbound only)

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  getActiveGoogleSheetsIntegration,
  getLinkedSheets,
  syncLinkedSheet,
  createSyncNotification,
  type SyncProgressCallback,
} from '@/lib/google-sheets';

export const maxDuration = 300; // Vercel max: 300s for Pro, 60s for Hobby

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

    const body = await request.json().catch(() => ({}));
    const specificLinkedId = body.linkedSheetId;
    const useStreaming = body.stream === true;

    let linkedSheets = await getLinkedSheets(userData.company_id);
    if (specificLinkedId) {
      linkedSheets = linkedSheets.filter((ls) => ls.id === specificLinkedId);
    }

    if (linkedSheets.length === 0) {
      return NextResponse.json({ error: 'No linked sheets found. Link a spreadsheet first.' }, { status: 400 });
    }

    // Streaming mode: return Server-Sent Events with real-time progress
    if (useStreaming) {
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          const sendEvent = (eventData: Record<string, unknown>) => {
            try {
              const data = JSON.stringify(eventData);
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            } catch {
              // Stream might be closed
            }
          };

          try {
            for (const ls of linkedSheets) {
              const onProgress: SyncProgressCallback = (progress) => {
                sendEvent({
                  type: 'progress',
                  linkedSheetId: ls.id,
                  spreadsheetName: ls.spreadsheet_name,
                  sheetTab: ls.sheet_tab_title,
                  ...progress,
                });
              };

              const result = await syncLinkedSheet(integration, ls, userData!.company_id, onProgress);

              // Send notification on completion
              await createSyncNotification(userData!.company_id, user!.id, {
                created: result.inbound.created,
                updated: result.inbound.updated,
                skipped: result.inbound.skipped,
                total: result.inbound.total,
                spreadsheetName: ls.spreadsheet_name,
                success: result.success,
                error: result.error,
              });

              sendEvent({
                type: 'sheet_complete',
                linkedSheetId: ls.id,
                spreadsheetName: ls.spreadsheet_name,
                sheetTab: ls.sheet_tab_title,
                ...result,
              });
            }

            sendEvent({ type: 'done' });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Sync failed';
            sendEvent({ type: 'error', error: message });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-streaming mode: process and return result (backwards compatible)
    const results = [];
    for (const ls of linkedSheets) {
      const result = await syncLinkedSheet(integration, ls, userData.company_id);

      // Send notification on completion
      await createSyncNotification(userData.company_id, user.id, {
        created: result.inbound.created,
        updated: result.inbound.updated,
        skipped: result.inbound.skipped,
        total: result.inbound.total,
        spreadsheetName: ls.spreadsheet_name,
        success: result.success,
        error: result.error,
      });

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
