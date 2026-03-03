// types/dynamics.ts
// Complete type definitions for the Microsoft Dynamics integration

// ============================================================================
// MICROSOFT OAUTH TYPES
// ============================================================================

export interface DynamicsTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface DynamicsUserInfo {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  jobTitle: string | null;
  officeLocation: string | null;
}

export interface DynamicsOrgInfo {
  id: string;
  organizationName: string;
  uniqueName: string;
  version: string;
  instanceUrl: string;
  tenantId: string | null;
}

// ============================================================================
// DYNAMICS API TYPES
// ============================================================================

export interface DynamicsContact {
  contactid: string;
  firstname: string | null;
  lastname: string | null;
  fullname: string | null;
  emailaddress1: string | null;
  telephone1: string | null;
  mobilephone: string | null;
  jobtitle: string | null;
  department: string | null;
  _parentcustomerid_value: string | null;
  parentcustomerid_account?: { name: string; accountid: string } | null;
  address1_line1: string | null;
  address1_city: string | null;
  address1_stateorprovince: string | null;
  address1_postalcode: string | null;
  address1_country: string | null;
  description: string | null;
  _ownerid_value: string | null;
  createdon: string;
  modifiedon: string;
}

export interface DynamicsLead {
  leadid: string;
  firstname: string | null;
  lastname: string | null;
  fullname: string | null;
  emailaddress1: string | null;
  telephone1: string | null;
  mobilephone: string | null;
  jobtitle: string | null;
  companyname: string | null;
  statuscode: number | null;
  leadsourcecode: number | null;
  description: string | null;
  _ownerid_value: string | null;
  createdon: string;
  modifiedon: string;
}

export interface DynamicsUser {
  systemuserid: string;
  fullname: string;
  internalemailaddress: string;
  isdisabled: boolean;
  title: string | null;
  jobtitle: string | null;
  businessunitid?: { name: string } | null;
}

// ============================================================================
// DYNAMICS API RESPONSE WRAPPERS
// ============================================================================

export interface DynamicsPaginatedResponse<T> {
  value: T[];
  '@odata.count'?: number;
  '@odata.nextLink'?: string;
}

// ============================================================================
// DYNAMICS INTEGRATION (DB ROW)
// ============================================================================

export interface DynamicsIntegration {
  id: string;
  company_id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
  dynamics_user_id: string;
  dynamics_user_name: string | null;
  dynamics_user_email: string | null;
  dynamics_org_name: string | null;
  dynamics_org_id: string | null;
  dynamics_instance_url: string;
  tenant_id: string | null;
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
// DYNAMICS SYNC LOG (DB ROW)
// ============================================================================

export interface DynamicsSyncLog {
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
// DYNAMICS CONTACT MAPPING (DB ROW)
// ============================================================================

export interface DynamicsContactMapping {
  id: string;
  company_id: string;
  integration_id: string;
  callengo_contact_id: string;
  dynamics_contact_id: string;
  dynamics_entity_type: 'contacts' | 'leads';
  last_synced_at: string | null;
  sync_direction: 'inbound' | 'outbound' | 'bidirectional';
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API REQUEST / RESPONSE TYPES
// ============================================================================

export interface DynamicsIntegrationStatus {
  connected: boolean;
  email?: string;
  displayName?: string;
  orgName?: string;
  orgId?: string;
  instanceUrl?: string;
  last_synced?: string;
  integration_id?: string;
}

export interface DynamicsSyncResult {
  contacts_created: number;
  contacts_updated: number;
  contacts_skipped: number;
  leads_created: number;
  leads_updated: number;
  leads_skipped: number;
  errors: string[];
}

export interface DynamicsOutboundSyncResult {
  contacts_updated: number;
  notes_created: number;
  errors: string[];
}

export interface DynamicsOrgMember {
  dynamics_user_id: string;
  name: string;
  email: string;
  is_active: boolean;
  role?: string;
  title?: string;
  already_in_callengo: boolean;
  callengo_user_id?: string;
}

// ============================================================================
// FEATURE GATING
// ============================================================================

export interface DynamicsFeatureAccess {
  canConnectDynamics: boolean;
  canSyncContacts: boolean;
  canSyncLeads: boolean;
  canViewOrgMembers: boolean;
  canInviteFromDynamics: boolean;
}

export function getDynamicsFeatureAccess(planSlug: string): DynamicsFeatureAccess {
  const hasDynamics = ['teams', 'enterprise'].includes(planSlug);
  return {
    canConnectDynamics: hasDynamics,
    canSyncContacts: hasDynamics,
    canSyncLeads: hasDynamics,
    canViewOrgMembers: hasDynamics,
    canInviteFromDynamics: hasDynamics,
  };
}
