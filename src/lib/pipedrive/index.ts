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
  // Inbound (Pipedrive → Callengo)
  fetchPipedrivePersons,
  fetchPipedriveOrganizations,
  fetchPipedriveDeals,
  fetchPipedriveActivities,
  fetchPipedriveUsers,
  fetchPipedrivePersonsByIds,
  syncPipedrivePersonsToCallengo,
  syncSelectedPipedrivePersons,
  // Outbound (Callengo → Pipedrive)
  pushContactToPipedrive,
  pushCallResultToPipedrive,
  pushContactUpdatesToPipedrive,
  createPipedriveActivity,
  createPipedriveNote,
  // Helpers
  getActivePipedriveIntegration,
  hasScope,
} from './sync';
