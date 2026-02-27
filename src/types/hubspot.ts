// types/hubspot.ts
// Complete type definitions for the HubSpot CRM integration

// ============================================================================
// HUBSPOT OAUTH TYPES
// ============================================================================

export interface HubSpotTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface HubSpotUserInfo {
  user: string; // email
  hub_id: number;
  hub_domain: string;
  user_id: number;
  token: string;
  scopes: string[];
}

export interface HubSpotAccountInfo {
  portalId: number;
  uiDomain: string;
  dataHostingLocation: string;
  timeZone: string;
  companyCurrency: string;
  additionalCurrencies: string[];
  utcOffset: string;
  utcOffsetMilliseconds: number;
  accountType: string;
}

// ============================================================================
// HUBSPOT API TYPES (CRM Object shapes from HubSpot API v3)
// ============================================================================

export interface HubSpotContact {
  id: string;
  properties: {
    firstname: string | null;
    lastname: string | null;
    email: string | null;
    phone: string | null;
    mobilephone: string | null;
    jobtitle: string | null;
    company: string | null;
    lifecyclestage: string | null;
    hs_lead_status: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
    hubspot_owner_id: string | null;
    notes_last_updated: string | null;
    createdate: string;
    lastmodifieddate: string;
    [key: string]: string | null;
  };
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface HubSpotCompany {
  id: string;
  properties: {
    name: string | null;
    domain: string | null;
    phone: string | null;
    website: string | null;
    industry: string | null;
    description: string | null;
    numberofemployees: string | null;
    annualrevenue: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    createdate: string;
    hs_lastmodifieddate: string;
    [key: string]: string | null;
  };
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface HubSpotDeal {
  id: string;
  properties: {
    dealname: string | null;
    dealstage: string | null;
    pipeline: string | null;
    amount: string | null;
    closedate: string | null;
    hubspot_owner_id: string | null;
    createdate: string;
    hs_lastmodifieddate: string;
    [key: string]: string | null;
  };
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface HubSpotOwner {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  teams?: { id: string; name: string; primary: boolean }[];
}

export interface HubSpotContactList {
  listId: number;
  name: string;
  dynamic: boolean;
  metaData: {
    size: number;
    processing: string;
    lastProcessingStateChangeAt: number;
    lastSizeChangeAt: number;
  };
  createdAt: number;
  updatedAt: number;
  archived: boolean;
}

// ============================================================================
// HUBSPOT API LIST / PAGINATION RESPONSES
// ============================================================================

export interface HubSpotPaginatedResponse<T> {
  results: T[];
  paging?: {
    next?: {
      after: string;
      link: string;
    };
  };
}

export interface HubSpotContactListsResponse {
  lists: HubSpotContactList[];
  'has-more': boolean;
  offset: number;
}

// ============================================================================
// HUBSPOT INTEGRATION (DB ROW)
// ============================================================================

export interface HubSpotIntegration {
  id: string;
  company_id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  hub_id: string;
  hub_domain: string | null;
  hs_user_id: string;
  hs_user_email: string;
  hs_display_name: string | null;
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
// HUBSPOT SYNC LOG (DB ROW)
// ============================================================================

export interface HubSpotSyncLog {
  id: string;
  company_id: string;
  integration_id: string;
  sync_type: 'full' | 'incremental' | 'selective' | 'contacts' | 'companies' | 'deals' | 'users';
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
// HUBSPOT CONTACT MAPPING (DB ROW)
// Maps Callengo contacts to HubSpot Contact IDs
// ============================================================================

export interface HubSpotContactMapping {
  id: string;
  company_id: string;
  integration_id: string;
  callengo_contact_id: string;
  hs_contact_id: string | null;
  hs_object_type: 'Contact' | 'Company' | 'Deal';
  last_synced_at: string | null;
  sync_direction: 'inbound' | 'outbound' | 'bidirectional';
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API REQUEST / RESPONSE TYPES
// ============================================================================

export interface HubSpotIntegrationStatus {
  connected: boolean;
  hub_domain?: string;
  hs_user_email?: string;
  hs_display_name?: string;
  hub_id?: string;
  last_synced?: string;
  integration_id?: string;
}

export interface HubSpotSyncRequest {
  integration_id: string;
  sync_type?: 'full' | 'selective' | 'contacts' | 'companies' | 'deals' | 'users';
}

export interface HubSpotSyncResult {
  contacts_created: number;
  contacts_updated: number;
  contacts_skipped: number;
  errors: string[];
}

export interface HubSpotOrgMember {
  hs_owner_id: string;
  user_id: number;
  name: string;
  email: string;
  is_active: boolean;
  teams?: string[];
  already_in_callengo: boolean;
  callengo_user_id?: string;
}

// ============================================================================
// FEATURE GATING
// ============================================================================

export interface HubSpotFeatureAccess {
  canConnectHubSpot: boolean;
  canSyncContacts: boolean;
  canSyncCompanies: boolean;
  canSyncDeals: boolean;
  canViewOrgMembers: boolean;
  canInviteFromHubSpot: boolean;
}

export function getHubSpotFeatureAccess(planSlug: string): HubSpotFeatureAccess {
  const hasHubSpot = ['business', 'teams', 'enterprise'].includes(planSlug);
  return {
    canConnectHubSpot: hasHubSpot,
    canSyncContacts: hasHubSpot,
    canSyncCompanies: hasHubSpot,
    canSyncDeals: hasHubSpot,
    canViewOrgMembers: hasHubSpot,
    canInviteFromHubSpot: hasHubSpot,
  };
}
