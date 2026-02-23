// lib/calendar/slack.ts
// Slack integration service - handles OAuth, notifications, channels, and interactive messages

import axios from 'axios';
import crypto from 'crypto';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import type {
  SlackIntegration,
  SlackNotification,
  CalendarEvent,
  CalendarEventType,
} from '@/types/calendar';

// ============================================================================
// CONFIGURATION
// ============================================================================

function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return url.replace(/\/+$/, ''); // strip trailing slashes
}

function getSlackConfig() {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing SLACK_CLIENT_ID or SLACK_CLIENT_SECRET environment variables');
  }

  return {
    clientId,
    clientSecret,
    signingSecret: signingSecret || '',
    redirectUri: `${getAppUrl()}/api/integrations/slack/callback`,
  };
}

const SLACK_SCOPES = [
  'chat:write',
  'channels:read',
  'commands',
  'incoming-webhook',
  'users:read',
];

const SLACK_API_BASE = 'https://slack.com/api';

// ============================================================================
// SLACK BLOCK KIT TYPES
// ============================================================================

interface SlackTextObject {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
}

interface SlackBlockElement {
  type: 'button' | 'static_select' | 'overflow';
  text?: SlackTextObject;
  action_id?: string;
  value?: string;
  url?: string;
  style?: 'primary' | 'danger';
  confirm?: {
    title: SlackTextObject;
    text: SlackTextObject;
    confirm: SlackTextObject;
    deny: SlackTextObject;
  };
}

interface SlackBlock {
  type: 'section' | 'actions' | 'divider' | 'header' | 'context' | 'image';
  text?: SlackTextObject;
  block_id?: string;
  fields?: SlackTextObject[];
  accessory?: SlackBlockElement;
  elements?: (SlackBlockElement | SlackTextObject)[];
}

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Generate the Slack OAuth V2 authorization URL.
 * The `state` parameter should be a signed token containing company_id and user_id
 * to prevent CSRF and identify the user on callback.
 */
export function getSlackAuthUrl(state: string): string {
  const { clientId, redirectUri } = getSlackConfig();

  const params = new URLSearchParams({
    client_id: clientId,
    scope: SLACK_SCOPES.join(','),
    redirect_uri: redirectUri,
    state,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

/**
 * Exchange an authorization code for Slack OAuth V2 tokens.
 * Returns the full token response including access_token, team info, and bot_user_id.
 */
export async function exchangeSlackCode(code: string): Promise<{
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: { id: string; name: string };
  authed_user: { id: string; scope: string; access_token: string; token_type: string };
  incoming_webhook?: { channel: string; channel_id: string; configuration_url: string; url: string };
}> {
  const { clientId, clientSecret, redirectUri } = getSlackConfig();

  const response = await axios.post(
    'https://slack.com/api/oauth.v2.access',
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  if (!response.data.ok) {
    console.error('Slack OAuth error:', response.data);
    throw new Error(`Slack OAuth failed: ${response.data.error || 'Unknown error'}`);
  }

  return response.data;
}

// ============================================================================
// REQUEST VERIFICATION
// ============================================================================

/**
 * Verify that an incoming request is genuinely from Slack using the signing secret.
 * This should be called in API route handlers that receive Slack interactions or slash commands.
 *
 * @param timestamp - The X-Slack-Request-Timestamp header value
 * @param body - The raw request body string
 * @param signature - The X-Slack-Signature header value
 * @returns true if the signature is valid
 */
export function verifySlackRequest(
  timestamp: string,
  body: string,
  signature: string
): boolean {
  const { signingSecret } = getSlackConfig();

  if (!signingSecret) {
    console.warn('SLACK_SIGNING_SECRET not configured; skipping request verification');
    return true;
  }

  // Reject requests older than 5 minutes to prevent replay attacks
  const requestTimestamp = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - requestTimestamp) > 60 * 5) {
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature =
    'v0=' +
    crypto
      .createHmac('sha256', signingSecret)
      .update(sigBasestring, 'utf8')
      .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(mySignature, 'utf8'),
    Buffer.from(signature, 'utf8')
  );
}

// ============================================================================
// NOTIFICATION SENDING
// ============================================================================

/**
 * Color mapping for different event types - used as sidebar attachment color.
 */
function getEventColor(eventType: CalendarEventType): string {
  const colorMap: Record<CalendarEventType, string> = {
    call: '#4A90D9',
    follow_up: '#F5A623',
    no_show_retry: '#D94A4A',
    meeting: '#7B68EE',
    appointment: '#50C878',
    callback: '#FF8C00',
    voicemail_followup: '#8B8682',
  };
  return colorMap[eventType] || '#4A90D9';
}

/**
 * Map a notification type to a human-readable label and emoji.
 */
function getNotificationLabel(type: SlackNotification['type']): { label: string; emoji: string } {
  const labels: Record<SlackNotification['type'], { label: string; emoji: string }> = {
    new_meeting: { label: 'New Meeting Scheduled', emoji: ':calendar:' },
    no_show: { label: 'No-Show Detected', emoji: ':warning:' },
    rescheduled: { label: 'Meeting Rescheduled', emoji: ':arrows_counterclockwise:' },
    confirmed: { label: 'Meeting Confirmed', emoji: ':white_check_mark:' },
    cancelled: { label: 'Meeting Cancelled', emoji: ':x:' },
    reminder: { label: 'Upcoming Meeting Reminder', emoji: ':bell:' },
  };
  return labels[type] || { label: 'Notification', emoji: ':speech_balloon:' };
}

/**
 * Build rich Block Kit blocks for an event notification.
 * Includes event details, contact info, and action buttons.
 */
export function buildEventBlocks(event: CalendarEvent, type: string): SlackBlock[] {
  const { label, emoji } = getNotificationLabel(type as SlackNotification['type']);
  const appUrl = getAppUrl();
  const eventUrl = `${appUrl}/dashboard/calendar?event=${event.id}`;

  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);

  // Format dates for Slack (using Slack timestamp format for timezone-aware display)
  const startTimestamp = Math.floor(startDate.getTime() / 1000);
  const endTimestamp = Math.floor(endDate.getTime() / 1000);

  const blocks: SlackBlock[] = [];

  // Header
  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: `${emoji}  ${label}`,
      emoji: true,
    },
  });

  // Event title and type
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*<${eventUrl}|${event.title}>*\n_${event.event_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}_  |  Status: *${event.status}*`,
    },
  });

  // Event details fields
  const fields: SlackTextObject[] = [
    {
      type: 'mrkdwn',
      text: `*When:*\n<!date^${startTimestamp}^{date_long} at {time}|${startDate.toISOString()}>  -  <!date^${endTimestamp}^{time}|${endDate.toISOString()}>`,
    },
    {
      type: 'mrkdwn',
      text: `*Timezone:*\n${event.timezone}`,
    },
  ];

  if (event.contact_name) {
    fields.push({
      type: 'mrkdwn',
      text: `*Contact:*\n${event.contact_name}`,
    });
  }

  if (event.contact_phone) {
    fields.push({
      type: 'mrkdwn',
      text: `*Phone:*\n${event.contact_phone}`,
    });
  }

  if (event.contact_email) {
    fields.push({
      type: 'mrkdwn',
      text: `*Email:*\n${event.contact_email}`,
    });
  }

  if (event.agent_name) {
    fields.push({
      type: 'mrkdwn',
      text: `*Agent:*\n${event.agent_name}`,
    });
  }

  blocks.push({
    type: 'section',
    fields,
  });

  // Video link if available
  if (event.video_link) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:video_camera:  *Video Call:*  <${event.video_link}|Join ${event.video_provider || 'Meeting'}>`,
      },
    });
  }

  // AI notes if present
  if (event.ai_notes) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:robot_face:  *AI Notes:*\n>${event.ai_notes.replace(/\n/g, '\n>')}`,
      },
    });
  }

  // Notes if present
  if (event.notes) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:memo:  *Notes:*\n>${event.notes.replace(/\n/g, '\n>')}`,
      },
    });
  }

  blocks.push({ type: 'divider' });

  // Action buttons (only for actionable notification types)
  if (type !== 'cancelled') {
    const actionElements: SlackBlockElement[] = [];

    // Confirm button (not shown if already confirmed)
    if (type !== 'confirmed') {
      actionElements.push({
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Confirm',
          emoji: true,
        },
        style: 'primary',
        action_id: 'callengo_confirm_event',
        value: event.id,
      });
    }

    // Reschedule button
    actionElements.push({
      type: 'button',
      text: {
        type: 'plain_text',
        text: 'Reschedule',
        emoji: true,
      },
      action_id: 'callengo_reschedule_event',
      value: event.id,
    });

    // Mark No-Show button
    actionElements.push({
      type: 'button',
      text: {
        type: 'plain_text',
        text: 'Mark No-Show',
        emoji: true,
      },
      style: 'danger',
      action_id: 'callengo_mark_no_show',
      value: event.id,
      confirm: {
        title: {
          type: 'plain_text',
          text: 'Mark as No-Show?',
        },
        text: {
          type: 'mrkdwn',
          text: `Are you sure you want to mark *${event.title}* as a no-show? This will update the event status and may trigger a retry call.`,
        },
        confirm: {
          type: 'plain_text',
          text: 'Yes, Mark No-Show',
        },
        deny: {
          type: 'plain_text',
          text: 'Cancel',
        },
      },
    });

    // View in Callengo link button
    actionElements.push({
      type: 'button',
      text: {
        type: 'plain_text',
        text: 'View in Callengo',
        emoji: true,
      },
      action_id: 'callengo_view_event',
      url: eventUrl,
    });

    blocks.push({
      type: 'actions',
      block_id: `callengo_actions_${event.id}`,
      elements: actionElements,
    });
  }

  // Footer context
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Sent by *Callengo*  |  Event ID: \`${event.id.slice(0, 8)}\`  |  <!date^${Math.floor(Date.now() / 1000)}^{date_short} {time}|${new Date().toISOString()}>`,
      },
    ],
  });

  return blocks;
}

/**
 * Send a formatted Slack notification with Block Kit message.
 * Uses the integration's access_token to post via the Slack Web API.
 * Falls back to the webhook URL if the channel post fails.
 */
export async function sendSlackNotification(
  integration: SlackIntegration,
  notification: SlackNotification
): Promise<void> {
  if (!integration.is_active) {
    console.warn(`Slack integration ${integration.id} is not active; skipping notification`);
    return;
  }

  const channelId = notification.channel_id || integration.default_channel_id;
  if (!channelId && !integration.webhook_url) {
    console.error('No channel ID or webhook URL available for Slack notification');
    return;
  }

  const blocks = buildEventBlocks(notification.event, notification.type);
  const color = getEventColor(notification.event.event_type);
  const { label } = getNotificationLabel(notification.type);

  try {
    if (channelId) {
      // Post via Slack Web API (chat.postMessage) for full Block Kit support
      const response = await axios.post(
        `${SLACK_API_BASE}/chat.postMessage`,
        {
          channel: channelId,
          text: `${label}: ${notification.event.title}`, // fallback text for notifications
          blocks,
          attachments: [
            {
              color,
              blocks: [],
            },
          ],
          unfurl_links: false,
          unfurl_media: false,
          ...(notification.metadata && notification.metadata.thread_ts
            ? { thread_ts: notification.metadata.thread_ts as string }
            : {}),
        },
        {
          headers: {
            Authorization: `Bearer ${integration.access_token}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
        }
      );

      if (!response.data.ok) {
        throw new Error(`Slack API error: ${response.data.error}`);
      }

      // Store the message timestamp for threading follow-up notifications
      if (response.data.ts) {
        await supabaseAdmin
          .from('slack_notifications')
          .insert({
            company_id: integration.company_id,
            integration_id: integration.id,
            event_id: notification.event.id,
            channel_id: channelId,
            message_ts: response.data.ts,
            notification_type: notification.type,
            sent_at: new Date().toISOString(),
          })
          .then(({ error: insertError }: { error: { message: string } | null }) => {
            if (insertError) {
              // Non-fatal: log and continue even if we fail to track the notification
              console.warn('Failed to log Slack notification:', insertError.message);
            }
          });
      }
    } else if (integration.webhook_url) {
      // Fallback: post via incoming webhook (limited Block Kit support)
      await axios.post(integration.webhook_url, {
        text: `${label}: ${notification.event.title}`,
        blocks,
        attachments: [
          {
            color,
            blocks: [],
          },
        ],
      });
    }
  } catch (error) {
    console.error('Failed to send Slack notification:', error);

    // If the main method fails and we have a webhook, try that as a last resort
    if (channelId && integration.webhook_url) {
      try {
        await axios.post(integration.webhook_url, {
          text: `${label}: ${notification.event.title}`,
          blocks,
        });
      } catch (webhookError) {
        console.error('Webhook fallback also failed:', webhookError);
      }
    }

    throw error;
  }
}

/**
 * Send a reminder notification for an upcoming event.
 * This is called by the reminder scheduler (e.g. a cron job) at the specified minutes before the event.
 */
export async function sendSlackReminder(
  integration: SlackIntegration,
  event: CalendarEvent,
  minutesBefore: number
): Promise<void> {
  // Check if we already sent a notification for this event and thread onto it
  const { data: existingNotification } = await supabaseAdmin
    .from('slack_notifications')
    .select('message_ts, channel_id')
    .eq('event_id', event.id)
    .eq('integration_id', integration.id)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const notification: SlackNotification = {
    type: 'reminder',
    channel_id: existingNotification?.channel_id || integration.default_channel_id || undefined,
    event,
    metadata: {
      minutes_before: minutesBefore,
      ...(existingNotification?.message_ts && {
        thread_ts: existingNotification.message_ts,
      }),
    },
  };

  await sendSlackNotification(integration, notification);
}

// ============================================================================
// CHANNEL MANAGEMENT
// ============================================================================

/**
 * List all public channels the bot has access to in the workspace.
 * Useful for letting users pick a default notification channel.
 */
export async function listSlackChannels(
  integration: SlackIntegration
): Promise<Array<{ id: string; name: string; is_member: boolean; num_members: number }>> {
  const channels: Array<{ id: string; name: string; is_member: boolean; num_members: number }> = [];
  let cursor: string | undefined;

  do {
    const response = await axios.get(`${SLACK_API_BASE}/conversations.list`, {
      headers: {
        Authorization: `Bearer ${integration.access_token}`,
      },
      params: {
        types: 'public_channel',
        exclude_archived: true,
        limit: 200,
        ...(cursor && { cursor }),
      },
    });

    if (!response.data.ok) {
      throw new Error(`Slack API error: ${response.data.error}`);
    }

    for (const channel of response.data.channels || []) {
      channels.push({
        id: channel.id,
        name: channel.name,
        is_member: channel.is_member || false,
        num_members: channel.num_members || 0,
      });
    }

    cursor = response.data.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return channels;
}

/**
 * Post a simple text or Block Kit message to a specific channel.
 * Returns the message timestamp (ts) which can be used for threading.
 */
export async function postToChannel(
  integration: SlackIntegration,
  channelId: string,
  options: {
    text: string;
    blocks?: SlackBlock[];
    thread_ts?: string;
    unfurl_links?: boolean;
  }
): Promise<{ ok: boolean; ts?: string; channel?: string }> {
  const response = await axios.post(
    `${SLACK_API_BASE}/chat.postMessage`,
    {
      channel: channelId,
      text: options.text,
      ...(options.blocks && { blocks: options.blocks }),
      ...(options.thread_ts && { thread_ts: options.thread_ts }),
      unfurl_links: options.unfurl_links ?? false,
      unfurl_media: false,
    },
    {
      headers: {
        Authorization: `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
    }
  );

  if (!response.data.ok) {
    throw new Error(`Slack API error: ${response.data.error}`);
  }

  return {
    ok: true,
    ts: response.data.ts,
    channel: response.data.channel,
  };
}

/**
 * Update the default notification channel for a Slack integration.
 */
export async function setDefaultChannel(
  integrationId: string,
  channelId: string,
  channelName: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('slack_integrations')
    .update({
      default_channel_id: channelId,
      default_channel_name: channelName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', integrationId);

  if (error) {
    console.error('Failed to update default Slack channel:', error);
    throw new Error('Failed to update default channel');
  }
}

// ============================================================================
// INTERACTIVE MESSAGE HANDLING
// ============================================================================

/**
 * Payload structure for Slack interactive messages (block_actions).
 */
export interface SlackInteractionPayload {
  type: 'block_actions' | 'view_submission' | 'shortcut';
  trigger_id: string;
  user: {
    id: string;
    username: string;
    name: string;
    team_id: string;
  };
  channel?: {
    id: string;
    name: string;
  };
  message?: {
    ts: string;
    text: string;
    blocks: SlackBlock[];
  };
  actions?: Array<{
    action_id: string;
    block_id: string;
    value?: string;
    type: string;
  }>;
  team: {
    id: string;
    domain: string;
  };
  response_url: string;
}

/**
 * Parse and route an interactive message payload from Slack.
 * Returns a structured action result that API routes can process.
 */
export function parseInteractionPayload(payload: SlackInteractionPayload): {
  action: 'confirm' | 'reschedule' | 'mark_no_show' | 'view' | 'unknown';
  eventId: string | null;
  userId: string;
  teamId: string;
  channelId: string | null;
  messageTs: string | null;
  responseUrl: string;
} {
  const action = payload.actions?.[0];

  let parsedAction: 'confirm' | 'reschedule' | 'mark_no_show' | 'view' | 'unknown' = 'unknown';

  switch (action?.action_id) {
    case 'callengo_confirm_event':
      parsedAction = 'confirm';
      break;
    case 'callengo_reschedule_event':
      parsedAction = 'reschedule';
      break;
    case 'callengo_mark_no_show':
      parsedAction = 'mark_no_show';
      break;
    case 'callengo_view_event':
      parsedAction = 'view';
      break;
  }

  return {
    action: parsedAction,
    eventId: action?.value || null,
    userId: payload.user.id,
    teamId: payload.team.id,
    channelId: payload.channel?.id || null,
    messageTs: payload.message?.ts || null,
    responseUrl: payload.response_url,
  };
}

/**
 * Send an ephemeral response to an interaction via the response_url.
 * These are only visible to the user who clicked the button.
 */
export async function sendInteractionResponse(
  responseUrl: string,
  message: {
    text: string;
    replace_original?: boolean;
    blocks?: SlackBlock[];
  }
): Promise<void> {
  await axios.post(responseUrl, {
    response_type: 'ephemeral',
    text: message.text,
    replace_original: message.replace_original ?? false,
    ...(message.blocks && { blocks: message.blocks }),
  });
}

/**
 * Update the original message after an action is taken (e.g., mark buttons as completed).
 */
export async function updateInteractionMessage(
  integration: SlackIntegration,
  channelId: string,
  messageTs: string,
  blocks: SlackBlock[],
  text: string
): Promise<void> {
  const response = await axios.post(
    `${SLACK_API_BASE}/chat.update`,
    {
      channel: channelId,
      ts: messageTs,
      text,
      blocks,
    },
    {
      headers: {
        Authorization: `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
    }
  );

  if (!response.data.ok) {
    throw new Error(`Slack API error updating message: ${response.data.error}`);
  }
}

// ============================================================================
// SLASH COMMAND HELPERS
// ============================================================================

/**
 * Payload structure for incoming Slack slash commands.
 */
export interface SlackSlashCommandPayload {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  trigger_id: string;
  response_url: string;
}

/**
 * Parse a /callengo slash command into a structured action.
 * Supports:
 *   /callengo reschedule <event_id> [new_time]
 *   /callengo mark-no-show <event_id>
 *   /callengo confirm <event_id>
 *   /callengo status [event_id]
 *   /callengo upcoming
 *   /callengo help
 */
export function parseSlashCommand(text: string): {
  subcommand: 'reschedule' | 'mark-no-show' | 'confirm' | 'status' | 'upcoming' | 'help' | 'unknown';
  eventId: string | null;
  args: string[];
} {
  const parts = text.trim().split(/\s+/);
  const subcommand = (parts[0] || 'help').toLowerCase();
  const eventId = parts[1] || null;
  const args = parts.slice(2);

  const validSubcommands = ['reschedule', 'mark-no-show', 'confirm', 'status', 'upcoming', 'help'];

  return {
    subcommand: validSubcommands.includes(subcommand)
      ? (subcommand as 'reschedule' | 'mark-no-show' | 'confirm' | 'status' | 'upcoming' | 'help')
      : 'unknown',
    eventId,
    args,
  };
}

/**
 * Build a help response for the /callengo slash command.
 */
export function buildSlashCommandHelpBlocks(): SlackBlock[] {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Callengo Slash Commands',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          '*Available commands:*\n\n' +
          '`/callengo reschedule <event_id> [YYYY-MM-DD HH:MM]`\n' +
          'Reschedule an event to a new date/time.\n\n' +
          '`/callengo mark-no-show <event_id>`\n' +
          'Mark an event as a no-show and trigger retry logic.\n\n' +
          '`/callengo confirm <event_id>`\n' +
          'Confirm an upcoming event.\n\n' +
          '`/callengo status <event_id>`\n' +
          'View the current status of a specific event.\n\n' +
          '`/callengo upcoming`\n' +
          "View your team's upcoming events for today.\n\n" +
          '`/callengo help`\n' +
          'Show this help message.',
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: ':bulb:  Tip: You can also use the action buttons on event notifications to confirm, reschedule, or mark no-shows.',
        },
      ],
    },
  ];
}

/**
 * Build a response for the /callengo upcoming command.
 * Shows a summary of today's events.
 */
export function buildUpcomingEventsBlocks(events: CalendarEvent[]): SlackBlock[] {
  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: ":calendar:  Today's Upcoming Events",
        emoji: true,
      },
    },
  ];

  if (events.length === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'No upcoming events scheduled for today. :tada:',
      },
    });
    return blocks;
  }

  for (const event of events) {
    const startTs = Math.floor(new Date(event.start_time).getTime() / 1000);
    const statusEmoji = getStatusEmoji(event.status);

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          `${statusEmoji}  *${event.title}*\n` +
          `<!date^${startTs}^{time}|${event.start_time}>` +
          (event.contact_name ? `  |  ${event.contact_name}` : '') +
          `  |  \`${event.status}\``,
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'View',
          emoji: true,
        },
        action_id: 'callengo_view_event',
        url: `${getAppUrl()}/dashboard/calendar?event=${event.id}`,
      },
    });
  }

  blocks.push({ type: 'divider' });

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Showing *${events.length}* event${events.length === 1 ? '' : 's'} for today.`,
      },
    ],
  });

  return blocks;
}

/**
 * Map event status to an emoji for compact display.
 */
function getStatusEmoji(status: string): string {
  const emojiMap: Record<string, string> = {
    scheduled: ':clock3:',
    confirmed: ':white_check_mark:',
    completed: ':heavy_check_mark:',
    no_show: ':no_entry_sign:',
    cancelled: ':x:',
    rescheduled: ':arrows_counterclockwise:',
    pending_confirmation: ':hourglass_flowing_sand:',
  };
  return emojiMap[status] || ':grey_question:';
}

/**
 * Build the status response blocks for a single event (/callengo status <event_id>).
 */
export function buildEventStatusBlocks(event: CalendarEvent): SlackBlock[] {
  // Reuse buildEventBlocks with a "status" notification type for consistent formatting
  return buildEventBlocks(event, 'confirmed');
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

/**
 * Get the active Slack integration for a company.
 * Returns null if no active integration exists.
 */
export async function getActiveSlackIntegration(
  companyId: string
): Promise<SlackIntegration | null> {
  const { data, error } = await supabaseAdmin
    .from('slack_integrations')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching Slack integration:', error);
    return null;
  }

  return (data as unknown as SlackIntegration) || null;
}

/**
 * Get a Slack integration by team ID.
 * Useful for looking up the integration when processing interactive messages or slash commands.
 */
export async function getSlackIntegrationByTeam(
  teamId: string
): Promise<SlackIntegration | null> {
  const { data, error } = await supabaseAdmin
    .from('slack_integrations')
    .select('*')
    .eq('team_id', teamId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching Slack integration by team:', error);
    return null;
  }

  return (data as unknown as SlackIntegration) || null;
}

/**
 * Save or update a Slack integration after OAuth.
 * If an integration already exists for the company + team, it will be updated.
 */
export async function upsertSlackIntegration(
  companyId: string,
  tokenData: Awaited<ReturnType<typeof exchangeSlackCode>>
): Promise<SlackIntegration> {
  const integrationData = {
    company_id: companyId,
    access_token: tokenData.access_token,
    bot_user_id: tokenData.bot_user_id,
    team_id: tokenData.team.id,
    team_name: tokenData.team.name,
    scopes: tokenData.scope.split(','),
    is_active: true,
    webhook_url: tokenData.incoming_webhook?.url || null,
    default_channel_id: tokenData.incoming_webhook?.channel_id || null,
    default_channel_name: tokenData.incoming_webhook?.channel || null,
    updated_at: new Date().toISOString(),
  };

  // Check if integration already exists for this company + team
  const { data: existing } = await supabaseAdmin
    .from('slack_integrations')
    .select('id')
    .eq('company_id', companyId)
    .eq('team_id', tokenData.team.id)
    .maybeSingle();

  let result;

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('slack_integrations')
      .update(integrationData)
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to update Slack integration: ${error.message}`);
    result = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from('slack_integrations')
      .insert({
        ...integrationData,
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create Slack integration: ${error.message}`);
    result = data;
  }

  return result as unknown as SlackIntegration;
}

/**
 * Deactivate a Slack integration (soft delete).
 */
export async function deactivateSlackIntegration(integrationId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('slack_integrations')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', integrationId);

  if (error) {
    console.error('Failed to deactivate Slack integration:', error);
    throw new Error('Failed to deactivate Slack integration');
  }
}

// ============================================================================
// USER LOOKUP
// ============================================================================

/**
 * Look up a Slack user's profile by their Slack user ID.
 * Useful for enriching interaction payloads with user details.
 */
export async function getSlackUserInfo(
  integration: SlackIntegration,
  slackUserId: string
): Promise<{
  id: string;
  name: string;
  real_name: string;
  email?: string;
  image_url?: string;
} | null> {
  try {
    const response = await axios.get(`${SLACK_API_BASE}/users.info`, {
      headers: {
        Authorization: `Bearer ${integration.access_token}`,
      },
      params: {
        user: slackUserId,
      },
    });

    if (!response.data.ok) {
      console.error('Slack users.info error:', response.data.error);
      return null;
    }

    const user = response.data.user;
    return {
      id: user.id,
      name: user.name,
      real_name: user.real_name || user.name,
      email: user.profile?.email,
      image_url: user.profile?.image_72,
    };
  } catch (error) {
    console.error('Failed to fetch Slack user info:', error);
    return null;
  }
}
