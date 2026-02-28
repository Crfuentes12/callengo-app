// lib/pipedrive/index.ts
// Pipedrive CRM integration service - handles OAuth, API calls, and sync

export {
  getPipedriveConfig,
  getPipedriveAuthUrl,
  exchangePipedriveCode,
  getPipedriveUserInfo,
  refreshPipedriveToken,
  getPipedriveClient,
} from './auth';

export {
  fetchPipedrivePersons,
  fetchPipedriveOrganizations,
  fetchPipedriveDeals,
  fetchPipedriveActivities,
  fetchPipedriveUsers,
  fetchPipedrivePersonsByIds,
  syncPipedrivePersonsToCallengo,
  syncSelectedPipedrivePersons,
} from './sync';
