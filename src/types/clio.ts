// types/clio.ts
// Complete type definitions for the Clio CRM integration

// ============================================================================
// CLIO OAUTH TYPES
// ============================================================================

export interface ClioTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface ClioUserInfo {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  enabled: boolean;
  subscription_type: string;
  account_owner: boolean;
}

export interface ClioFirmInfo {
  id: number;
  name: string;
  time_zone: string;
  currency: string;
}

// ============================================================================
// CLIO API TYPES
// ============================================================================

export interface ClioContact {
  id: number;
  etag: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  type: 'Person' | 'Company';
  prefix: string | null;
  title: string | null;
  company?: { id: number; name: string } | null;
  primary_email_address: string | null;
  primary_phone_number: string | null;
  email_addresses: { name: string; address: string; default_email: boolean }[];
  phone_numbers: { name: string; number: string; default_number: boolean }[];
  addresses: {
    name: string;
    street: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    country: string | null;
  }[];
  created_at: string;
  updated_at: string;
}

export interface ClioMatter {
  id: number;
  display_number: string;
  description: string;
  status: string;
  open_date: string | null;
  close_date: string | null;
  client: { id: number; name: string } | null;
  responsible_attorney: { id: number; name: string } | null;
  practice_area: { id: number; name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface ClioCalendarEntry {
  id: number;
  etag: string;
  summary: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  location: string | null;
  recurrence_rule: string | null;
  matter: { id: number; display_number: string } | null;
  attendees: { id: number; type: string; name: string; email: string }[];
  calendar_owner: { id: number; name: string; enabled: boolean } | null;
  created_at: string;
  updated_at: string;
}

export interface ClioUser {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  enabled: boolean;
  subscription_type: string;
  account_owner: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CLIO API RESPONSE WRAPPERS
// ============================================================================

export interface ClioPaginatedResponse<T> {
  data: T[];
  meta: {
    records: number;
    paging?: {
      next?: string;
      previous?: string;
    };
  };
}

export interface ClioSingleResponse<T> {
  data: T;
}

// ============================================================================
// CLIO INTEGRATION (DB ROW)
// ============================================================================

export interface ClioIntegration {
  id: string;
  company_id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
  clio_user_id: string;
  clio_user_name: string | null;
  clio_user_email: string | null;
  clio_firm_name: string | null;
  clio_firm_id: string | null;
  clio_subscription_type: string | null;
  token_issued_at: string | null;
  last_synced_at: string | null;
  sync_token: string | null;
  is_active: boolean;
  scopes: string[] | null;
  raw_profile: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CLIO SYNC LOG (DB ROW)
// ============================================================================

export interface ClioSyncLog {
  id: string;
  company_id: string;
  integration_id: string;
  sync_type: 'full' | 'incremental' | 'selective' | 'contacts' | 'matters' | 'calendar';
  sync_direction: 'inbound' | 'outbound' | 'bidirectional';
  records_created: number;
  records_updated: number;
  records_skipped: number;
  errors: unknown[];
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'completed_with_errors' | 'failed';
  error_message: string | null;
  created_at: string;
}

// ============================================================================
// CLIO CONTACT MAPPING (DB ROW)
// ============================================================================

export interface ClioContactMapping {
  id: string;
  company_id: string;
  integration_id: string;
  callengo_contact_id: string;
  clio_contact_id: string;
  clio_contact_type: 'Person' | 'Company';
  last_synced_at: string | null;
  sync_direction: 'inbound' | 'outbound' | 'bidirectional';
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API REQUEST / RESPONSE TYPES
// ============================================================================

export interface ClioIntegrationStatus {
  connected: boolean;
  email?: string;
  displayName?: string;
  firmName?: string;
  firmId?: string;
  last_synced?: string;
  integration_id?: string;
}

export interface ClioSyncRequest {
  integration_id: string;
  sync_type?: 'full' | 'selective' | 'contacts' | 'matters' | 'calendar';
}

export interface ClioSyncResult {
  contacts_created: number;
  contacts_updated: number;
  contacts_skipped: number;
  errors: string[];
}

export interface ClioOutboundSyncResult {
  notes_created: number;
  errors: string[];
}

export interface ClioNoteCreate {
  subject: string;
  detail: string;
  type: 'Contact' | 'Matter';
  regarding: { id: number; type: 'Contact' | 'Matter' };
}

export interface ClioOrgMember {
  clio_user_id: string;
  name: string;
  email: string;
  is_active: boolean;
  subscription_type?: string;
  account_owner: boolean;
  already_in_callengo: boolean;
  callengo_user_id?: string;
}

// ============================================================================
// FEATURE GATING
// ============================================================================

export interface ClioFeatureAccess {
  canConnectClio: boolean;
  canSyncContacts: boolean;
  canSyncMatters: boolean;
  canSyncCalendar: boolean;
  canViewOrgMembers: boolean;
  canInviteFromClio: boolean;
}

export function getClioFeatureAccess(planSlug: string): ClioFeatureAccess {
  const hasClio = ['business', 'teams', 'enterprise'].includes(planSlug);
  return {
    canConnectClio: hasClio,
    canSyncContacts: hasClio,
    canSyncMatters: hasClio,
    canSyncCalendar: hasClio,
    canViewOrgMembers: hasClio,
    canInviteFromClio: hasClio,
  };
}
