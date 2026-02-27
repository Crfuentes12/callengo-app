// lib/salesforce/index.ts
// Salesforce CRM integration service - handles OAuth, API calls, and sync

export {
  getSalesforceConfig,
  getSalesforceAuthUrl,
  exchangeSalesforceCode,
  getSalesforceUserInfo,
  refreshSalesforceToken,
  getSalesforceClient,
} from './auth';

export {
  fetchSalesforceContacts,
  fetchSalesforceLeads,
  fetchSalesforceEvents,
  fetchSalesforceUsers,
  fetchSalesforceContactsByIds,
  fetchSalesforceLeadsByIds,
  syncSalesforceContactsToCallengo,
  syncSalesforceLeadsToCallengo,
  syncSelectedSalesforceContacts,
  syncSelectedSalesforceLeads,
} from './sync';
