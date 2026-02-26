// types/salesforce.ts
// Complete type definitions for the Salesforce CRM integration

// ============================================================================
// SALESFORCE OAUTH TYPES
// ============================================================================

export interface SalesforceTokenResponse {
  access_token: string;
  refresh_token: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
  signature: string;
  scope?: string;
}

export interface SalesforceUserInfo {
  user_id: string;
  organization_id: string;
  username: string;
  display_name: string;
  email: string;
  photos?: {
    picture?: string;
    thumbnail?: string;
  };
  urls?: Record<string, string>;
}

// ============================================================================
// SALESFORCE API TYPES (SObject shapes)
// ============================================================================

export interface SalesforceContact {
  Id: string;
  FirstName: string | null;
  LastName: string;
  Name: string;
  Email: string | null;
  Phone: string | null;
  MobilePhone: string | null;
  Title: string | null;
  Department: string | null;
  AccountId: string | null;
  Account?: { Name: string } | null;
  MailingStreet: string | null;
  MailingCity: string | null;
  MailingState: string | null;
  MailingPostalCode: string | null;
  MailingCountry: string | null;
  Description: string | null;
  OwnerId: string | null;
  CreatedDate: string;
  LastModifiedDate: string;
}

export interface SalesforceLead {
  Id: string;
  FirstName: string | null;
  LastName: string;
  Name: string;
  Email: string | null;
  Phone: string | null;
  MobilePhone: string | null;
  Title: string | null;
  Company: string | null;
  Status: string;
  LeadSource: string | null;
  Description: string | null;
  OwnerId: string | null;
  CreatedDate: string;
  LastModifiedDate: string;
}

export interface SalesforceAccount {
  Id: string;
  Name: string;
  Phone: string | null;
  Website: string | null;
  Industry: string | null;
  Type: string | null;
  Description: string | null;
  CreatedDate: string;
  LastModifiedDate: string;
}

export interface SalesforceEvent {
  Id: string;
  Subject: string;
  Description: string | null;
  StartDateTime: string;
  EndDateTime: string;
  Location: string | null;
  IsAllDayEvent: boolean;
  WhoId: string | null;
  WhatId: string | null;
  OwnerId: string;
  ActivityDate: string | null;
  CreatedDate: string;
  LastModifiedDate: string;
}

export interface SalesforceUser {
  Id: string;
  Username: string;
  Name: string;
  FirstName: string | null;
  LastName: string;
  Email: string;
  IsActive: boolean;
  Profile?: { Name: string } | null;
  UserRole?: { Name: string } | null;
  SmallPhotoUrl: string | null;
  CreatedDate: string;
  LastModifiedDate: string;
}

export interface SalesforceCampaign {
  Id: string;
  Name: string;
  Status: string;
  Type: string | null;
  Description: string | null;
  StartDate: string | null;
  EndDate: string | null;
  NumberOfContacts: number;
  NumberOfLeads: number;
  CreatedDate: string;
  LastModifiedDate: string;
}

// ============================================================================
// SALESFORCE QUERY RESPONSE
// ============================================================================

export interface SalesforceQueryResponse<T> {
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  records: T[];
}

// ============================================================================
// SALESFORCE INTEGRATION (DB ROW)
// ============================================================================

export interface SalesforceIntegration {
  id: string;
  company_id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  instance_url: string;
  sf_org_id: string;
  sf_user_id: string;
  sf_username: string;
  sf_display_name: string | null;
  sf_email: string | null;
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
// SALESFORCE SYNC LOG (DB ROW)
// ============================================================================

export interface SalesforceSyncLog {
  id: string;
  company_id: string;
  integration_id: string;
  sync_type: 'full' | 'incremental' | 'contacts' | 'leads' | 'events' | 'users';
  sync_direction: 'inbound' | 'outbound' | 'bidirectional';
  records_created: number;
  records_updated: number;
  records_skipped: number;
  errors: unknown[];
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
}

// ============================================================================
// SALESFORCE CONTACT MAPPING (DB ROW)
// Maps Callengo contacts to Salesforce Contact/Lead IDs
// ============================================================================

export interface SalesforceContactMapping {
  id: string;
  company_id: string;
  integration_id: string;
  callengo_contact_id: string;
  sf_contact_id: string | null;
  sf_lead_id: string | null;
  sf_object_type: 'Contact' | 'Lead';
  last_synced_at: string | null;
  sync_direction: 'inbound' | 'outbound' | 'bidirectional';
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API REQUEST / RESPONSE TYPES
// ============================================================================

export interface SalesforceIntegrationStatus {
  connected: boolean;
  instance_url?: string;
  sf_username?: string;
  sf_display_name?: string;
  sf_email?: string;
  sf_org_id?: string;
  last_synced?: string;
  integration_id?: string;
}

export interface SalesforceSyncRequest {
  integration_id: string;
  sync_type?: 'full' | 'contacts' | 'leads' | 'events' | 'users';
}

export interface SalesforceSyncResult {
  contacts_created: number;
  contacts_updated: number;
  contacts_skipped: number;
  leads_created: number;
  leads_updated: number;
  leads_skipped: number;
  errors: string[];
}

export interface SalesforceOrgMember {
  sf_user_id: string;
  username: string;
  name: string;
  email: string;
  is_active: boolean;
  profile_name?: string;
  role_name?: string;
  photo_url?: string;
  already_in_callengo: boolean;
  callengo_user_id?: string;
}

// ============================================================================
// FEATURE GATING
// ============================================================================

export interface SalesforceFeatureAccess {
  canConnectSalesforce: boolean;
  canSyncContacts: boolean;
  canSyncLeads: boolean;
  canSyncEvents: boolean;
  canViewOrgMembers: boolean;
  canInviteFromSalesforce: boolean;
}

export function getSalesforceFeatureAccess(planSlug: string): SalesforceFeatureAccess {
  const hasSalesforce = ['business', 'teams', 'enterprise'].includes(planSlug);
  return {
    canConnectSalesforce: hasSalesforce,
    canSyncContacts: hasSalesforce,
    canSyncLeads: hasSalesforce,
    canSyncEvents: hasSalesforce,
    canViewOrgMembers: hasSalesforce,
    canInviteFromSalesforce: hasSalesforce,
  };
}
