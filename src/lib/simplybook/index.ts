// lib/simplybook/index.ts
// SimplyBook.me integration service — handles auth, API calls, and sync

export {
  getSimplyBookConfig,
  authenticateSimplyBook,
  getSimplyBookUserInfo,
  getSimplyBookCompanyInfo,
  refreshSimplyBookToken,
  getSimplyBookClient,
} from './auth';

export {
  fetchSimplyBookClients,
  fetchSimplyBookClientById,
  fetchSimplyBookBookings,
  fetchSimplyBookServices,
  fetchSimplyBookProviders,
  syncSimplyBookClientsToCallengo,
  syncSelectedSimplyBookClients,
  createSimplyBookCalendarNote,
  pushCallResultToSimplyBook,
  pushContactUpdatesToSimplyBook,
  getActiveSimplyBookIntegration,
} from './sync';
