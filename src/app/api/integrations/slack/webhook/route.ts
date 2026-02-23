// app/api/integrations/slack/webhook/route.ts
// Handle Slack interactive actions and slash commands

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { confirmAppointment, cancelCalendarEvent, markEventNoShow } from '@/lib/calendar/sync';
import crypto from 'crypto';

function verifySlackSignature(request: NextRequest, body: string): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return false;

  const timestamp = request.headers.get('x-slack-request-timestamp');
  const signature = request.headers.get('x-slack-signature');

  if (!timestamp || !signature) return false;

  // Reject requests older than 5 minutes
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;

  const baseString = `v0:${timestamp}:${body}`;
  const hash = 'v0=' + crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Verify Slack signature
    if (process.env.SLACK_SIGNING_SECRET && !verifySlackSignature(request, rawBody)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const params = new URLSearchParams(rawBody);

    // Handle slash commands (/callengo)
    if (params.has('command')) {
      const command = params.get('command');
      const text = params.get('text') || '';
      const responseUrl = params.get('response_url');

      if (command === '/callengo') {
        const [action, ...args] = text.trim().split(' ');

        switch (action) {
          case 'reschedule':
            return NextResponse.json({
              response_type: 'ephemeral',
              text: `To reschedule an event, use the interactive buttons on event notifications, or visit your Callengo dashboard.`,
            });

          case 'mark-no-show':
          case 'no-show':
            return NextResponse.json({
              response_type: 'ephemeral',
              text: `To mark an event as no-show, use the interactive buttons on event notifications, or visit your Callengo dashboard.`,
            });

          case 'today':
          case 'upcoming':
            return NextResponse.json({
              response_type: 'ephemeral',
              text: `View your today's schedule and upcoming events at your Callengo dashboard.`,
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: ':calendar: *View your schedule on Callengo*',
                  },
                  accessory: {
                    type: 'button',
                    text: { type: 'plain_text', text: 'Open Dashboard' },
                    url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/calendar`,
                    action_id: 'open_dashboard',
                  },
                },
              ],
            });

          default:
            return NextResponse.json({
              response_type: 'ephemeral',
              text: '*Callengo Slash Commands:*\n- `/callengo today` - View today\'s schedule\n- `/callengo upcoming` - View upcoming events\n- `/callengo reschedule` - Reschedule an event\n- `/callengo mark-no-show` - Mark a no-show',
            });
        }
      }
    }

    // Handle interactive actions (button clicks)
    if (params.has('payload')) {
      const payload = JSON.parse(params.get('payload')!);

      if (payload.type === 'block_actions') {
        for (const action of payload.actions) {
          const [actionType, eventId] = (action.action_id || '').split(':');

          if (!eventId) continue;

          switch (actionType) {
            case 'confirm_event':
              await confirmAppointment(eventId);
              return NextResponse.json({
                replace_original: true,
                text: `:white_check_mark: Event confirmed successfully.`,
              });

            case 'cancel_event':
              await cancelCalendarEvent(eventId);
              return NextResponse.json({
                replace_original: true,
                text: `:x: Event cancelled.`,
              });

            case 'no_show_event':
              await markEventNoShow(eventId, { scheduleRetry: true });
              return NextResponse.json({
                replace_original: true,
                text: `:warning: Marked as no-show. Retry has been auto-scheduled.`,
              });
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Slack webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
