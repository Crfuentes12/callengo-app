// lib/clio/index.ts
// Clio CRM integration service - handles OAuth, API calls, and sync

export {
  getClioConfig,
  getClioAuthUrl,
  exchangeClioCode,
  getClioUserInfo,
  refreshClioToken,
  getClioClient,
} from './auth';

export {
  fetchClioContacts,
  fetchClioContactsByIds,
  fetchClioCalendarEntries,
  fetchClioUsers,
  syncClioContactsToCallengo,
  syncSelectedClioContacts,
  pushContactToClio,
  pushCallResultToClio,
  pushContactUpdatesToClio,
  createClioNote,
  getActiveClioIntegration,
} from './sync';
