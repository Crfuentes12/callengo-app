// lib/dynamics/index.ts
// Microsoft Dynamics integration service - handles OAuth, API calls, and sync

export {
  getDynamicsConfig,
  getDynamicsAuthUrl,
  exchangeDynamicsCode,
  getDynamicsUserInfo,
  getDynamicsOrgInfo,
  refreshDynamicsToken,
  getDynamicsClient,
} from './auth';

export {
  fetchDynamicsContacts,
  fetchDynamicsContactsByIds,
  fetchDynamicsLeads,
  fetchDynamicsLeadsByIds,
  fetchDynamicsUsers,
  syncDynamicsContactsToCallengo,
  syncDynamicsLeadsToCallengo,
  syncSelectedDynamicsContacts,
  syncSelectedDynamicsLeads,
  pushCallResultToDynamics,
  pushContactUpdatesToDynamics,
  getActiveDynamicsIntegration,
} from './sync';
