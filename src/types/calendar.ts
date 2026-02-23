// types/calendar.ts
// Complete type definitions for the Calendar integration system

// ============================================================================
// DATABASE TYPES
// ============================================================================

export type CalendarProvider = 'google_calendar' | 'calendly';

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
  | 'calendly'
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

  calendly_organization_uri: string | null;
  calendly_webhook_uri: string | null;

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
  sync_to_google?: boolean;
  sync_to_calendly?: boolean;
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
// CALENDLY API TYPES
// ============================================================================

export interface CalendlyUser {
  uri: string;
  name: string;
  email: string;
  scheduling_url: string;
  timezone: string;
  current_organization: string;
  avatar_url?: string;
}

export interface CalendlyEventType {
  uri: string;
  name: string;
  active: boolean;
  slug: string;
  scheduling_url: string;
  duration: number;
  color: string;
  description_plain?: string;
}

export interface CalendlyScheduledEvent {
  uri: string;
  name: string;
  status: 'active' | 'canceled';
  start_time: string;
  end_time: string;
  event_type: string;
  location?: {
    type: string;
    location?: string;
    join_url?: string;
  };
  invitees_counter: {
    total: number;
    active: number;
    limit: number;
  };
  created_at: string;
  updated_at: string;
  event_memberships: Array<{
    user: string;
    user_email: string;
    user_name: string;
  }>;
  event_guests: Array<{
    email: string;
    created_at: string;
    updated_at: string;
  }>;
  calendar_event?: {
    kind: string;
    external_id: string;
  };
}

export interface CalendlyInvitee {
  uri: string;
  email: string;
  name: string;
  status: 'active' | 'canceled';
  timezone: string;
  created_at: string;
  updated_at: string;
  questions_and_answers: Array<{
    question: string;
    answer: string;
    position: number;
  }>;
  tracking: Record<string, string>;
  cancel_url: string;
  reschedule_url: string;
  scheduling_method?: string;
  payment?: Record<string, unknown>;
  no_show?: { uri: string; created_at: string } | null;
}

export interface CalendlyWebhookPayload {
  event: string; // 'invitee.created' | 'invitee.canceled' | 'routing_form_submission.created'
  created_at: string;
  created_by: string;
  payload: {
    cancel_url?: string;
    created_at: string;
    email: string;
    event: string;
    name: string;
    new_invitee?: string;
    old_invitee?: string;
    reschedule_url?: string;
    rescheduled: boolean;
    status: string;
    timezone: string;
    updated_at: string;
    uri: string;
    scheduled_event?: CalendlyScheduledEvent;
    questions_and_answers?: Array<{
      question: string;
      answer: string;
      position: number;
    }>;
    tracking?: Record<string, string>;
    payment?: Record<string, unknown>;
    no_show?: { uri: string; created_at: string } | null;
  };
}

export interface CalendlyTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  created_at: number;
  owner: string;
  organization: string;
}

// ============================================================================
// FEATURE GATING
// ============================================================================

export type PlanTier = 'free' | 'starter' | 'business' | 'enterprise';

export interface CalendarFeatureAccess {
  canConnectCalendars: boolean;        // starter+
  canSyncAppointments: boolean;        // starter+
  canConfirmAppointments: boolean;     // starter+
  canRescheduleAppointments: boolean;  // starter+
  canSmartFollowUp: boolean;           // business+ (premium)
  canAutoScheduleFromContext: boolean; // business+ (premium)
  canBidirectionalSync: boolean;       // starter+
  canWebhookIntegration: boolean;      // starter+
  maxCalendarIntegrations: number;     // starter: 2, business: 5, enterprise: unlimited
}

export function getCalendarFeatureAccess(planSlug: string): CalendarFeatureAccess {
  switch (planSlug) {
    case 'free':
      return {
        canConnectCalendars: false,
        canSyncAppointments: false,
        canConfirmAppointments: false,
        canRescheduleAppointments: false,
        canSmartFollowUp: false,
        canAutoScheduleFromContext: false,
        canBidirectionalSync: false,
        canWebhookIntegration: false,
        maxCalendarIntegrations: 0,
      };
    case 'starter':
      return {
        canConnectCalendars: true,
        canSyncAppointments: true,
        canConfirmAppointments: true,
        canRescheduleAppointments: true,
        canSmartFollowUp: false,
        canAutoScheduleFromContext: false,
        canBidirectionalSync: true,
        canWebhookIntegration: true,
        maxCalendarIntegrations: 2,
      };
    case 'business':
      return {
        canConnectCalendars: true,
        canSyncAppointments: true,
        canConfirmAppointments: true,
        canRescheduleAppointments: true,
        canSmartFollowUp: true,
        canAutoScheduleFromContext: true,
        canBidirectionalSync: true,
        canWebhookIntegration: true,
        maxCalendarIntegrations: 5,
      };
    case 'enterprise':
      return {
        canConnectCalendars: true,
        canSyncAppointments: true,
        canConfirmAppointments: true,
        canRescheduleAppointments: true,
        canSmartFollowUp: true,
        canAutoScheduleFromContext: true,
        canBidirectionalSync: true,
        canWebhookIntegration: true,
        maxCalendarIntegrations: 999,
      };
    default:
      return getCalendarFeatureAccess('free');
  }
}
