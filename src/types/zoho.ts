// types/zoho.ts
// Complete type definitions for the Zoho CRM integration

// ============================================================================
// ZOHO OAUTH TYPES
// ============================================================================

export interface ZohoTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  api_domain: string;
}

export interface ZohoUserInfo {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  status: string;
  role: { name: string; id: string };
  profile: { name: string; id: string };
}

export interface ZohoOrgInfo {
  id: string;
  company_name: string;
  alias: string | null;
  primary_email: string | null;
  domain_name: string | null;
  time_zone: string | null;
  currency: string | null;
  country_code: string | null;
}

// ============================================================================
// ZOHO API TYPES
// ============================================================================

export interface ZohoContact {
  id: string;
  First_Name: string | null;
  Last_Name: string;
  Full_Name: string | null;
  Email: string | null;
  Phone: string | null;
  Mobile: string | null;
  Title: string | null;
  Department: string | null;
  Account_Name: { name: string; id: string } | null;
  Mailing_Street: string | null;
  Mailing_City: string | null;
  Mailing_State: string | null;
  Mailing_Zip: string | null;
  Mailing_Country: string | null;
  Description: string | null;
  Owner: { name: string; id: string; email: string } | null;
  Created_Time: string;
  Modified_Time: string;
}

export interface ZohoLead {
  id: string;
  First_Name: string | null;
  Last_Name: string;
  Full_Name: string | null;
  Email: string | null;
  Phone: string | null;
  Mobile: string | null;
  Title: string | null;
  Company: string | null;
  Lead_Status: string | null;
  Lead_Source: string | null;
  Description: string | null;
  Owner: { name: string; id: string; email: string } | null;
  Created_Time: string;
  Modified_Time: string;
}

export interface ZohoUser {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  status: string;
  role: { name: string; id: string };
  profile: { name: string; id: string };
  confirm: boolean;
}

// ============================================================================
// ZOHO API RESPONSE WRAPPERS
// ============================================================================

export interface ZohoPaginatedResponse<T> {
  data: T[];
  info: {
    per_page: number;
    count: number;
    page: number;
    more_records: boolean;
  };
}

export interface ZohoSingleResponse<T> {
  data: T[];
}

// ============================================================================
// ZOHO INTEGRATION (DB ROW)
// ============================================================================

export interface ZohoIntegration {
  id: string;
  company_id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
  zoho_user_id: string;
  zoho_user_name: string | null;
  zoho_user_email: string | null;
  zoho_org_name: string | null;
  zoho_org_id: string | null;
  zoho_domain: string;
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
// ZOHO SYNC LOG (DB ROW)
// ============================================================================

export interface ZohoSyncLog {
  id: string;
  company_id: string;
  integration_id: string;
  sync_type: 'full' | 'incremental' | 'selective' | 'contacts' | 'leads';
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
// ZOHO CONTACT MAPPING (DB ROW)
// ============================================================================

export interface ZohoContactMapping {
  id: string;
  company_id: string;
  integration_id: string;
  callengo_contact_id: string;
  zoho_contact_id: string;
  zoho_object_type: 'Contacts' | 'Leads';
  last_synced_at: string | null;
  sync_direction: 'inbound' | 'outbound' | 'bidirectional';
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API REQUEST / RESPONSE TYPES
// ============================================================================

export interface ZohoIntegrationStatus {
  connected: boolean;
  email?: string;
  displayName?: string;
  orgName?: string;
  orgId?: string;
  last_synced?: string;
  integration_id?: string;
}

export interface ZohoSyncResult {
  contacts_created: number;
  contacts_updated: number;
  contacts_skipped: number;
  leads_created: number;
  leads_updated: number;
  leads_skipped: number;
  errors: string[];
}

export interface ZohoOutboundSyncResult {
  contacts_updated: number;
  notes_created: number;
  errors: string[];
}

export interface ZohoOrgMember {
  zoho_user_id: string;
  name: string;
  email: string;
  is_active: boolean;
  role?: string;
  profile?: string;
  already_in_callengo: boolean;
  callengo_user_id?: string;
}

// ============================================================================
// FEATURE GATING
// ============================================================================

export interface ZohoFeatureAccess {
  canConnectZoho: boolean;
  canSyncContacts: boolean;
  canSyncLeads: boolean;
  canViewOrgMembers: boolean;
  canInviteFromZoho: boolean;
}

export function getZohoFeatureAccess(planSlug: string): ZohoFeatureAccess {
  const hasZoho = ['business', 'teams', 'enterprise'].includes(planSlug);
  return {
    canConnectZoho: hasZoho,
    canSyncContacts: hasZoho,
    canSyncLeads: hasZoho,
    canViewOrgMembers: hasZoho,
    canInviteFromZoho: hasZoho,
  };
}
