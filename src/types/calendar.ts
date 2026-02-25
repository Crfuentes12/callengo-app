// types/calendar.ts
// Complete type definitions for the Calendar integration system

// ============================================================================
// DATABASE TYPES
// ============================================================================

export type CalendarProvider = 'google_calendar' | 'microsoft_outlook';

export type VideoProvider = 'google_meet' | 'zoom' | 'microsoft_teams';

export type IntegrationProvider =
  | CalendarProvider
  | VideoProvider
  | 'slack';

export type CalendarEventType =
  | 'call'
  | 'follow_up'
  | 'no_show_retry'
  | 'meeting'
  | 'appointment'
  | 'callback'
  | 'voicemail_followup';

export type CalendarEventStatus =
  | 'scheduled'
  | 'confirmed'
  | 'completed'
  | 'no_show'
  | 'cancelled'
  | 'rescheduled'
  | 'pending_confirmation';

export type CalendarEventSource =
  | 'manual'
  | 'campaign'
  | 'google_calendar'
  | 'microsoft_outlook'
  | 'ai_agent'
  | 'follow_up_queue'
  | 'webhook';

export type ConfirmationStatus =
  | 'unconfirmed'
  | 'confirmed'
  | 'declined'
  | 'tentative'
  | 'no_response';

export type SyncStatus =
  | 'synced'
  | 'pending_push'
  | 'pending_pull'
  | 'conflict'
  | 'error';

export type SyncType = 'full' | 'incremental' | 'push' | 'pull' | 'webhook';
export type SyncDirection = 'inbound' | 'outbound' | 'bidirectional';

// ============================================================================
// CALENDAR INTEGRATION (DB ROW)
// ============================================================================

export interface CalendarIntegration {
  id: string;
  company_id: string;
  user_id: string;
  provider: CalendarProvider;

  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;

  provider_email: string | null;
  provider_user_id: string | null;
  provider_user_name: string | null;

  // Microsoft specific
  microsoft_tenant_id: string | null;
  microsoft_calendar_id: string | null;

  google_calendar_id: string;

  last_synced_at: string | null;
  sync_token: string | null;
  is_active: boolean;

  scopes: string[] | null;
  raw_profile: Record<string, unknown> | null;

  created_at: string;
  updated_at: string;
}

// ============================================================================
// CALENDAR EVENT (DB ROW)
// ============================================================================

export interface CalendarEvent {
  id: string;
  company_id: string;
  integration_id: string | null;

  external_event_id: string | null;
  external_calendar_id: string | null;

  title: string;
  description: string | null;
  location: string | null;

  start_time: string;
  end_time: string;
  timezone: string;
  all_day: boolean;

  event_type: CalendarEventType;
  status: CalendarEventStatus;
  source: CalendarEventSource;

  // Video call link
  video_link: string | null;
  video_provider: VideoProvider | null;

  contact_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  agent_run_id: string | null;
  call_log_id: string | null;
  follow_up_id: string | null;

  agent_name: string | null;
  ai_notes: string | null;
  confirmation_status: ConfirmationStatus;
  confirmation_attempts: number;
  last_confirmation_at: string | null;

  original_start_time: string | null;
  rescheduled_count: number;
  rescheduled_reason: string | null;

  recurrence_rule: string | null;
  recurring_event_id: string | null;

  attendees: CalendarAttendee[];

  last_synced_at: string | null;
  sync_status: SyncStatus;
  sync_error: string | null;

  metadata: Record<string, unknown>;
  notes: string | null;
  created_by_feature: string | null;

  created_at: string;
  updated_at: string;
}

export interface CalendarAttendee {
  email: string;
  name?: string;
  response_status?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  organizer?: boolean;
}

// ============================================================================
// CALENDAR SYNC LOG (DB ROW)
// ============================================================================

export interface CalendarSyncLog {
  id: string;
  company_id: string;
  integration_id: string;
  sync_type: SyncType;
  sync_direction: SyncDirection;
  events_created: number;
  events_updated: number;
  events_deleted: number;
  errors: unknown[];
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
}

// ============================================================================
// API REQUEST / RESPONSE TYPES
// ============================================================================

export interface CreateCalendarEventRequest {
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  timezone?: string;
  all_day?: boolean;
  event_type: CalendarEventType;
  contact_id?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  notes?: string;
  video_provider?: VideoProvider;
  sync_to_google?: boolean;
  sync_to_microsoft?: boolean;
}

export interface UpdateCalendarEventRequest {
  title?: string;
  description?: string;
  location?: string;
  start_time?: string;
  end_time?: string;
  timezone?: string;
  status?: CalendarEventStatus;
  confirmation_status?: ConfirmationStatus;
  notes?: string;
  rescheduled_reason?: string;
}

export interface CalendarSyncRequest {
  integration_id: string;
  sync_type?: SyncType;
  time_min?: string;
  time_max?: string;
}

export interface CalendarIntegrationStatus {
  provider: CalendarProvider;
  connected: boolean;
  email?: string;
  user_name?: string;
  last_synced?: string;
  integration_id?: string;
}

// ============================================================================
// AVAILABILITY TYPES
// ============================================================================

export interface TimeSlot {
  start: string;
  end: string;
}

export interface AvailabilityResult {
  date: string;
  available_slots: TimeSlot[];
  busy_slots: TimeSlot[];
  is_working_day: boolean;
  is_holiday: boolean;
}

// ============================================================================
// GOOGLE CALENDAR API TYPES
// ============================================================================

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status: 'confirmed' | 'tentative' | 'cancelled';
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
    organizer?: boolean;
  }>;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
      label?: string;
    }>;
    conferenceSolution?: {
      name: string;
      iconUri?: string;
    };
    conferenceId?: string;
  };
  recurrence?: string[];
  recurringEventId?: string;
  created: string;
  updated: string;
  htmlLink?: string;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

// ============================================================================
// MICROSOFT GRAPH API TYPES
// ============================================================================

export interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface MicrosoftCalendarEvent {
  id: string;
  subject: string;
  body?: {
    contentType: string;
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
    locationType?: string;
  };
  attendees?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
    status?: {
      response: string;
    };
    type?: string;
  }>;
  organizer?: {
    emailAddress: {
      address: string;
      name?: string;
    };
  };
  onlineMeeting?: {
    joinUrl: string;
  };
  isOnlineMeeting?: boolean;
  onlineMeetingProvider?: string;
  webLink?: string;
  isCancelled?: boolean;
  isAllDay?: boolean;
  recurrence?: Record<string, unknown>;
  seriesMasterId?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
}

// ============================================================================
// SLACK TYPES
// ============================================================================

export interface SlackIntegration {
  id: string;
  company_id: string;
  access_token: string;
  bot_user_id: string;
  team_id: string;
  team_name: string;
  default_channel_id: string | null;
  default_channel_name: string | null;
  webhook_url: string | null;
  scopes: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SlackNotification {
  type: 'new_meeting' | 'no_show' | 'rescheduled' | 'confirmed' | 'cancelled' | 'reminder';
  channel_id?: string;
  user_id?: string;
  event: CalendarEvent;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// ZOOM TYPES
// ============================================================================

export interface ZoomTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface ZoomMeeting {
  id: number;
  uuid: string;
  topic: string;
  start_time: string;
  duration: number;
  timezone: string;
  join_url: string;
  start_url: string;
  password?: string;
  settings?: {
    host_video?: boolean;
    participant_video?: boolean;
    join_before_host?: boolean;
    mute_upon_entry?: boolean;
    auto_recording?: string;
    waiting_room?: boolean;
  };
}

// ============================================================================
// FEATURE GATING
// ============================================================================

export type PlanTier = 'free' | 'starter' | 'business' | 'enterprise';

export interface CalendarFeatureAccess {
  canConnectGoogleCalendar: boolean;     // free+
  canConnectMicrosoftOutlook: boolean;   // business+
  canConnectSlack: boolean;              // starter+
  canConnectZoom: boolean;               // starter+
  canSyncAppointments: boolean;          // free+
  canConfirmAppointments: boolean;       // starter+
  canRescheduleAppointments: boolean;    // starter+
  canSmartFollowUp: boolean;             // business+ (premium)
  canAutoScheduleFromContext: boolean;   // business+ (premium)
  canBidirectionalSync: boolean;         // starter+
  canWebhookIntegration: boolean;        // starter+
  canGoogleMeet: boolean;               // free+
  canMicrosoftTeams: boolean;           // business+
  canZoom: boolean;                      // starter+
  canAvailabilityCheck: boolean;         // free+
  maxCalendarIntegrations: number;       // free: 1, starter: 2, business: 5, enterprise: unlimited
}

export function getCalendarFeatureAccess(planSlug: string): CalendarFeatureAccess {
  switch (planSlug) {
    case 'free':
      return {
        canConnectGoogleCalendar: true,
        canConnectMicrosoftOutlook: false,
        canConnectSlack: false,
        canConnectZoom: false,
        canSyncAppointments: true,
        canConfirmAppointments: false,
        canRescheduleAppointments: false,
        canSmartFollowUp: false,
        canAutoScheduleFromContext: false,
        canBidirectionalSync: false,
        canWebhookIntegration: false,
        canGoogleMeet: true,
        canMicrosoftTeams: false,
        canZoom: false,
        canAvailabilityCheck: true,
        maxCalendarIntegrations: 1,
      };
    case 'starter':
      return {
        canConnectGoogleCalendar: true,
        canConnectMicrosoftOutlook: false,
        canConnectSlack: true,
        canConnectZoom: true,
        canSyncAppointments: true,
        canConfirmAppointments: true,
        canRescheduleAppointments: true,
        canSmartFollowUp: false,
        canAutoScheduleFromContext: false,
        canBidirectionalSync: true,
        canWebhookIntegration: true,
        canGoogleMeet: true,
        canMicrosoftTeams: false,
        canZoom: true,
        canAvailabilityCheck: true,
        maxCalendarIntegrations: 2,
      };
    case 'business':
      return {
        canConnectGoogleCalendar: true,
        canConnectMicrosoftOutlook: true,
        canConnectSlack: true,
        canConnectZoom: true,
        canSyncAppointments: true,
        canConfirmAppointments: true,
        canRescheduleAppointments: true,
        canSmartFollowUp: true,
        canAutoScheduleFromContext: true,
        canBidirectionalSync: true,
        canWebhookIntegration: true,
        canGoogleMeet: true,
        canMicrosoftTeams: true,
        canZoom: true,
        canAvailabilityCheck: true,
        maxCalendarIntegrations: 5,
      };
    case 'enterprise':
      return {
        canConnectGoogleCalendar: true,
        canConnectMicrosoftOutlook: true,
        canConnectSlack: true,
        canConnectZoom: true,
        canSyncAppointments: true,
        canConfirmAppointments: true,
        canRescheduleAppointments: true,
        canSmartFollowUp: true,
        canAutoScheduleFromContext: true,
        canBidirectionalSync: true,
        canWebhookIntegration: true,
        canGoogleMeet: true,
        canMicrosoftTeams: true,
        canZoom: true,
        canAvailabilityCheck: true,
        maxCalendarIntegrations: 999,
      };
    default:
      return getCalendarFeatureAccess('free');
  }
}

// ============================================================================
// CAMPAIGN CALENDAR CONFIGURATION
// ============================================================================

/**
 * Calendar configuration for a campaign (stored in agent_runs.settings.calendarConfig).
 * This is set during the calendar step of campaign creation and used by agents
 * to make scheduling decisions during calls.
 */
export interface CalendarStepConfig {
  // Timezone & work schedule
  timezone: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  workingDays: string[];
  excludeUSHolidays: boolean;

  // Follow-ups & Callbacks
  followUpEnabled: boolean;
  followUpMaxAttempts: number;
  followUpIntervalHours: number;
  smartFollowUp: boolean;
  callbackEnabled: boolean;
  callbackMaxAttempts: number;

  // Calendar awareness (always enabled by default)
  calendarContextEnabled: boolean;

  // Appointment Confirmation specific
  appointmentAvailabilityEnabled: boolean;
  defaultMeetingDuration: number;
  allowRescheduling: boolean;
  noShowAutoRetry: boolean;
  noShowRetryDelayHours: number;

  // Video conferencing preference
  preferredVideoProvider: 'none' | 'google_meet' | 'zoom' | 'microsoft_teams';

  // Connected integrations snapshot at campaign creation time
  connectedIntegrations: string[];
}
