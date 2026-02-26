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
  syncSalesforceContactsToCallengo,
  syncSalesforceLeadsToCallengo,
} from './sync';
