// lib/hubspot/index.ts
// HubSpot CRM integration service - handles OAuth, API calls, and sync

export {
  getHubSpotConfig,
  getHubSpotAuthUrl,
  exchangeHubSpotCode,
  getHubSpotTokenInfo,
  refreshHubSpotToken,
  getHubSpotClient,
} from './auth';

export {
  fetchHubSpotContacts,
  fetchHubSpotCompanies,
  fetchHubSpotOwners,
  fetchHubSpotContactsByIds,
  syncHubSpotContactsToCallengo,
  syncSelectedHubSpotContacts,
} from './sync';
