// types/pipedrive.ts
// Complete type definitions for the Pipedrive CRM integration

// ============================================================================
// PIPEDRIVE OAUTH TYPES
// ============================================================================

export interface PipedriveTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  api_domain: string;
}

export interface PipedriveUserInfo {
  data: {
    id: number;
    name: string;
    email: string;
    company_id: number;
    company_name: string;
    company_domain: string;
    locale: string;
    is_admin: number;
    active_flag: boolean;
    phone: string | null;
    icon_url: string | null;
    role_id: number;
    timezone_name: string;
    timezone_offset: string;
    created: string;
    modified: string;
  };
}

// ============================================================================
// PIPEDRIVE API TYPES (REST API v1 shapes)
// ============================================================================

export interface PipedrivePerson {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  email: { value: string; primary: boolean; label: string }[];
  phone: { value: string; primary: boolean; label: string }[];
  org_id: { value: number; name: string } | null;
  owner_id: { id: number; name: string; email: string } | null;
  label: number | null;
  open_deals_count: number;
  closed_deals_count: number;
  active_flag: boolean;
  add_time: string;
  update_time: string;
  visible_to: string;
  notes_count: number;
  // Custom fields can be added dynamically
  [key: string]: unknown;
}

export interface PipedriveOrganization {
  id: number;
  name: string;
  owner_id: { id: number; name: string; email: string } | null;
  address: string | null;
  address_street_number: string | null;
  address_route: string | null;
  address_subpremise: string | null;
  address_locality: string | null;
  address_admin_area_level_1: string | null;
  address_admin_area_level_2: string | null;
  address_country: string | null;
  address_postal_code: string | null;
  cc_email: string | null;
  people_count: number;
  open_deals_count: number;
  active_flag: boolean;
  add_time: string;
  update_time: string;
  [key: string]: unknown;
}

export interface PipedriveDeal {
  id: number;
  title: string;
  value: number;
  currency: string;
  status: 'open' | 'won' | 'lost' | 'deleted';
  stage_id: number;
  pipeline_id: number;
  person_id: { value: number; name: string } | null;
  org_id: { value: number; name: string } | null;
  owner_id: { id: number; name: string; email: string } | null;
  expected_close_date: string | null;
  add_time: string;
  update_time: string;
  stage_change_time: string | null;
  won_time: string | null;
  lost_time: string | null;
  close_time: string | null;
  lost_reason: string | null;
  active: boolean;
  [key: string]: unknown;
}

export interface PipedriveActivity {
  id: number;
  type: string;
  subject: string;
  note: string | null;
  done: boolean;
  due_date: string;
  due_time: string | null;
  duration: string | null;
  location: string | null;
  person_id: number | null;
  org_id: number | null;
  deal_id: number | null;
  user_id: number;
  add_time: string;
  update_time: string;
  marked_as_done_time: string | null;
  [key: string]: unknown;
}

export interface PipedriveUser {
  id: number;
  name: string;
  email: string;
  active_flag: boolean;
  is_admin: number;
  role_id: number;
  phone: string | null;
  icon_url: string | null;
  created: string;
  modified: string;
  [key: string]: unknown;
}

// ============================================================================
// PIPEDRIVE API LIST / PAGINATION RESPONSES
// ============================================================================

export interface PipedriveApiResponse<T> {
  success: boolean;
  data: T | null;
  additional_data?: {
    pagination?: {
      start: number;
      limit: number;
      more_items_in_collection: boolean;
      next_start?: number;
    };
  };
  error?: string;
  error_info?: string;
}

// ============================================================================
// PIPEDRIVE INTEGRATION (DB ROW)
// ============================================================================

export interface PipedriveIntegration {
  id: string;
  company_id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  pd_company_id: string;
  pd_company_name: string | null;
  pd_company_domain: string | null;
  pd_user_id: string;
  pd_user_email: string;
  pd_user_name: string | null;
  token_issued_at: string | null;
  last_synced_at: string | null;
  sync_token: string | null;
  is_active: boolean;
  scopes: string[] | null;
  raw_profile: Record<string, unknown> | null;
  api_domain: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// PIPEDRIVE SYNC LOG (DB ROW)
// ============================================================================

export interface PipedriveSyncLog {
  id: string;
  company_id: string;
  integration_id: string;
  sync_type: 'full' | 'incremental' | 'selective' | 'persons' | 'organizations' | 'deals' | 'activities' | 'users';
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
// PIPEDRIVE CONTACT MAPPING (DB ROW)
// Maps Callengo contacts to Pipedrive Person IDs
// ============================================================================

export interface PipedriveContactMapping {
  id: string;
  company_id: string;
  integration_id: string;
  callengo_contact_id: string;
  pd_person_id: string | null;
  pd_object_type: 'Person' | 'Organization';
  last_synced_at: string | null;
  sync_direction: 'inbound' | 'outbound' | 'bidirectional';
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API REQUEST / RESPONSE TYPES
// ============================================================================

export interface PipedriveIntegrationStatus {
  connected: boolean;
  pd_company_domain?: string;
  pd_user_email?: string;
  pd_user_name?: string;
  pd_company_name?: string;
  last_synced?: string;
  integration_id?: string;
}

export interface PipedriveSyncRequest {
  integration_id: string;
  sync_type?: 'full' | 'selective' | 'persons' | 'organizations' | 'deals' | 'activities' | 'users';
}

export interface PipedriveSyncResult {
  persons_created: number;
  persons_updated: number;
  persons_skipped: number;
  errors: string[];
}

export interface PipedriveOutboundSyncResult {
  persons_pushed: number;
  activities_created: number;
  notes_created: number;
  errors: string[];
}

/**
 * Data payload for pushing a Callengo contact update to Pipedrive Person
 */
export interface PipedrivePersonUpdate {
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string[];
  phone?: string[];
  visible_to?: string;
}

/**
 * Data payload for creating a Pipedrive Activity (call log, no-show, follow-up, etc.)
 */
export interface PipedriveActivityCreate {
  subject: string;
  type: string;
  done: boolean;
  due_date: string;
  due_time?: string;
  duration?: string;
  person_id?: number;
  org_id?: number;
  deal_id?: number;
  note?: string;
}

/**
 * Data payload for creating a Pipedrive Note on a Person
 */
export interface PipedriveNoteCreate {
  content: string;
  person_id?: number;
  org_id?: number;
  deal_id?: number;
}

export interface PipedriveOrgMember {
  pd_user_id: number;
  name: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  phone?: string;
  icon_url?: string;
  already_in_callengo: boolean;
  callengo_user_id?: string;
}

// ============================================================================
// FEATURE GATING
// ============================================================================

export interface PipedriveFeatureAccess {
  canConnectPipedrive: boolean;
  canSyncPersons: boolean;
  canSyncOrganizations: boolean;
  canSyncDeals: boolean;
  canSyncActivities: boolean;
  canViewOrgMembers: boolean;
  canInviteFromPipedrive: boolean;
  canPushCallResults: boolean;
  canPushContactUpdates: boolean;
}

export function getPipedriveFeatureAccess(planSlug: string): PipedriveFeatureAccess {
  const hasPipedrive = ['business', 'teams', 'enterprise'].includes(planSlug);
  return {
    canConnectPipedrive: hasPipedrive,
    canSyncPersons: hasPipedrive,
    canSyncOrganizations: hasPipedrive,
    canSyncDeals: hasPipedrive,
    canSyncActivities: hasPipedrive,
    canViewOrgMembers: hasPipedrive,
    canInviteFromPipedrive: hasPipedrive,
    canPushCallResults: hasPipedrive,
    canPushContactUpdates: hasPipedrive,
  };
}
