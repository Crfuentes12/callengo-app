// lib/zoho/index.ts
// Zoho CRM integration service - handles OAuth, API calls, and sync

export {
  getZohoConfig,
  getZohoAuthUrl,
  exchangeZohoCode,
  getZohoUserInfo,
  getZohoOrgInfo,
  refreshZohoToken,
  getZohoClient,
} from './auth';

export {
  fetchZohoContacts,
  fetchZohoContactsByIds,
  fetchZohoLeads,
  fetchZohoLeadsByIds,
  fetchZohoUsers,
  syncZohoContactsToCallengo,
  syncZohoLeadsToCallengo,
  syncSelectedZohoContacts,
  syncSelectedZohoLeads,
  pushCallResultToZoho,
  pushContactUpdatesToZoho,
  getActiveZohoIntegration,
} from './sync';
