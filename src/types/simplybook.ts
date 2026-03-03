// types/simplybook.ts
// Complete type definitions for the SimplyBook.me integration

// ============================================================================
// SIMPLYBOOK AUTH TYPES (REST API v2 — token-based, NOT OAuth)
// ============================================================================

export interface SimplyBookAuthRequest {
  company: string;
  login: string;
  password: string;
}

export interface SimplyBookTokenResponse {
  token: string;
  company: string;
  login: string;
  refresh_token: string | null;
  domain: string | null;
  require2fa: boolean;
  allowed2fa_providers: string[];
  auth_session_id: string;
}

export interface SimplyBookRefreshTokenRequest {
  company: string;
  refresh_token: string;
  device_token?: string | null;
}

// ============================================================================
// SIMPLYBOOK API TYPES (REST API v2 entities)
// ============================================================================

export interface SimplyBookClient {
  id: number;
  name: string;
  email: string;
  phone: string;
}

export interface SimplyBookClientDetails {
  id: number;
  fields: SimplyBookClientFieldValue[];
}

export interface SimplyBookClientFieldValue {
  id: string;
  field?: SimplyBookClientFieldDetails;
  value: unknown;
}

export interface SimplyBookClientFieldDetails {
  id: string;
  title: string;
  default_value: unknown;
  values: SimplyBookClientFieldSelectOption[] | null;
  value: unknown;
  is_visible: boolean;
  is_optional: boolean;
  is_built_in: boolean;
  type: string;
}

export interface SimplyBookClientFieldSelectOption {
  value: string;
  is_default: boolean;
  position: number;
}

export interface SimplyBookProvider {
  id: number;
  name: string;
  qty: number;
  email: string;
  description: string;
  phone: string;
  picture: string;
  picture_preview: string;
  color: string;
  is_active: boolean;
  is_visible: boolean;
  services: number[];
}

export interface SimplyBookService {
  id: number;
  name: string;
  description: string;
  price: number;
  currency: string;
  deposit_price: number;
  tax_id: number | null;
  duration: number;
  buffer_time_after: number;
  recurring_settings: SimplyBookRecurringSettings | null;
  memberships: number[];
  providers: number[];
  picture: string;
  picture_preview: string;
  is_active: boolean;
  is_visible: boolean;
  limit_booking: number | null;
  min_group_booking: number | null;
}

export interface SimplyBookRecurringSettings {
  days: number;
  repeat_count: number;
  type: 'fixed' | 'weekly';
  mode: 'skip' | 'book_available' | 'book_and_move';
  price_per_session: boolean;
}

export interface SimplyBookBooking {
  id: number;
  code: string;
  is_confirmed: boolean;
  start_datetime: string;
  end_datetime: string;
  location_id: number | null;
  category_id: number | null;
  service_id: number;
  provider_id: number;
  client_id: number;
  duration: number;
  service: SimplyBookService;
  provider: SimplyBookProvider;
  location: SimplyBookLocation | null;
  category: SimplyBookCategory | null;
}

export interface SimplyBookBookingDetails extends SimplyBookBooking {
  client: SimplyBookClient;
  status: string;
  membership_id: number | null;
  invoice_id: number | null;
  invoice_status: string | null;
  invoice_payment_received: boolean | null;
  invoice_number: string | null;
  invoice_datetime: string | null;
  invoice_payment_processor: string | null;
  comment: string;
  user_status_id: number | null;
  can_be_edited: boolean;
  can_be_canceled: boolean;
}

export interface SimplyBookLocation {
  id: number;
  name: string;
  description: string | null;
  address1: string | null;
  address2: string | null;
  phone: string | null;
  city: string | null;
  zip: string | null;
  country_id: string | null;
  is_visible: boolean;
  lat: number;
  lng: number;
}

export interface SimplyBookCategory {
  id: number;
  name: string;
  services: number[];
  is_visible: boolean;
}

export interface SimplyBookCalendarNote {
  id: number;
  provider_id: number;
  service_id: number | null;
  provider?: SimplyBookProvider;
  service?: SimplyBookService;
  start_date_time: string;
  end_date_time: string;
  note_type_id: number;
  note_type?: SimplyBookCalendarNoteType;
  note: string;
  mode: string;
  time_blocked: boolean;
}

export interface SimplyBookCalendarNoteType {
  id: number;
  name: string;
  color: string;
  is_default: boolean;
  position: number;
}

export interface SimplyBookStatus {
  id: number;
  name: string;
  description: string;
  color: string;
  is_default: boolean;
}

export interface SimplyBookCompanyInfo {
  login: string;
  name: string;
  dashboard_url: string;
  public_url: string;
}

export interface SimplyBookUserInfo {
  id: number;
  login: string;
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  company: SimplyBookCompanyInfo;
}

export interface SimplyBookStatistic {
  most_popular_provider: SimplyBookProvider | null;
  most_popular_provider_bookings: number;
  most_popular_service: SimplyBookService | null;
  most_popular_service_bookings: number;
  bookings_today: number;
  bookings_this_week: number;
  bookings: number;
}

export interface SimplyBookTimeSlot {
  date: string;
  time: string;
}

// ============================================================================
// SIMPLYBOOK API RESPONSE WRAPPERS
// ============================================================================

export interface SimplyBookPaginatedResponse<T> {
  data: T[];
  metadata: {
    items_count: number;
    pages_count: number;
    page: number;
    on_page: number;
  };
}

// ============================================================================
// SIMPLYBOOK INTEGRATION (DB ROW)
// ============================================================================

export interface SimplyBookIntegration {
  id: string;
  company_id: string;
  user_id: string;
  sb_company_login: string;
  sb_user_login: string;
  sb_token: string;
  sb_refresh_token: string | null;
  token_expires_at: string | null;
  sb_user_id: string | null;
  sb_user_name: string | null;
  sb_user_email: string | null;
  sb_company_name: string | null;
  sb_domain: string | null;
  token_issued_at: string | null;
  last_synced_at: string | null;
  sync_token: string | null;
  is_active: boolean;
  raw_profile: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// SIMPLYBOOK SYNC LOG (DB ROW)
// ============================================================================

export interface SimplyBookSyncLog {
  id: string;
  company_id: string;
  integration_id: string;
  sync_type: 'full' | 'incremental' | 'selective' | 'clients' | 'bookings' | 'services' | 'providers';
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
// SIMPLYBOOK CONTACT MAPPING (DB ROW)
// Maps Callengo contacts to SimplyBook.me Client IDs
// ============================================================================

export interface SimplyBookContactMapping {
  id: string;
  company_id: string;
  integration_id: string;
  callengo_contact_id: string;
  sb_client_id: string;
  last_synced_at: string | null;
  sync_direction: 'inbound' | 'outbound' | 'bidirectional';
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API REQUEST / RESPONSE TYPES
// ============================================================================

export interface SimplyBookIntegrationStatus {
  connected: boolean;
  email?: string;
  displayName?: string;
  companyName?: string;
  companyLogin?: string;
  last_synced?: string;
  integration_id?: string;
}

export interface SimplyBookSyncRequest {
  integration_id: string;
  sync_type?: 'full' | 'selective' | 'clients' | 'bookings' | 'services' | 'providers';
}

export interface SimplyBookSyncResult {
  clients_created: number;
  clients_updated: number;
  clients_skipped: number;
  errors: string[];
}

export interface SimplyBookOutboundSyncResult {
  notes_created: number;
  bookings_created: number;
  errors: string[];
}

export interface SimplyBookOrgMember {
  sb_provider_id: number;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  is_visible: boolean;
  services: number[];
  already_in_callengo: boolean;
  callengo_user_id?: string;
}

// ============================================================================
// FEATURE GATING
// ============================================================================

export interface SimplyBookFeatureAccess {
  canConnectSimplyBook: boolean;
  canSyncClients: boolean;
  canSyncBookings: boolean;
  canViewProviders: boolean;
  canViewServices: boolean;
  canCreateNotes: boolean;
  canInviteFromSimplyBook: boolean;
}

export function getSimplyBookFeatureAccess(planSlug: string): SimplyBookFeatureAccess {
  const hasSimplyBook = ['starter', 'business', 'teams', 'enterprise'].includes(planSlug);
  return {
    canConnectSimplyBook: hasSimplyBook,
    canSyncClients: hasSimplyBook,
    canSyncBookings: hasSimplyBook,
    canViewProviders: hasSimplyBook,
    canViewServices: hasSimplyBook,
    canCreateNotes: hasSimplyBook,
    canInviteFromSimplyBook: hasSimplyBook,
  };
}
