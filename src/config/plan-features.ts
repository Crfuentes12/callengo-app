/**
 * Plan Features Configuration - V4 (March 2026)
 * Coherent with Stripe sync script, SQL migration, and business model document.
 *
 * Key changes from V3:
 * - Added Growth plan ($179/mo, 400 calls/600 min, 3 concurrent)
 * - Twilio BYOP completely removed (not feasible with sub-account architecture)
 * - Zoom available from Free tier
 * - Extra seat price unified at $49 for both Business and Teams
 * - Overage ladder: $0.29 → $0.26 → $0.23 → $0.20 → $0.17
 * - Calls/month as primary metric (using 1.5 min effective average per attempt)
 * - Max call durations: Free 3min, Starter 3min, Growth 4min, Business 5min, Teams 6min, Enterprise unlimited
 *
 * Free plan = Trial: 10 calls / 15 minutes included, no overage, no recharge.
 * After trial exhausted, users must upgrade to a paid plan.
 *
 * Sub-account architecture: Each company gets an isolated Bland AI sub-account
 * with its own API key and credit balance. No shared concurrency.
 */

export const COMMON_FEATURES = [
  'CSV/Excel/Google Sheets import',
  'JSON import/export',
  'Phone normalization',
  'Contact deduplication',
  'Custom fields & tag segmentation',
  'AI agent creation & configuration',
  'Full campaign wizard',
  'Call analytics & tracking',
  'Transcription downloads',
  'Usage dashboard',
  'Billing alerts',
  'Auto-rotating phone numbers (spam protection)',
  'Google Calendar & Meet integration',
  'Zoom integration',
];

export const PLAN_SPECIFIC_FEATURES: Record<string, string[]> = {
  free: [
    '10 calls included (trial)',
    '15 minutes total',
    '3 min max per call',
    '1 concurrent call',
    '1 active agent (locked after selection)',
    'Full campaign wizard experience',
    'Auto-rotated numbers from Callengo pool',
    'No overage — upgrade required after trial',
  ],

  starter: [
    '200 calls/month (~300 min)',
    '3 min max per call',
    '2 concurrent calls',
    '1 active agent (switchable)',
    'Voicemail detection',
    'Follow-ups (max 2 attempts)',
    'Slack notifications',
    'SimplyBook.me integration',
    'Webhooks (Zapier, Make, n8n compatible)',
    'Auto-rotated numbers from Callengo pool',
    '$0.29/min overage',
    'Async email support',
  ],

  growth: [
    '400 calls/month (~600 min)',
    '4 min max per call',
    '3 concurrent calls',
    'All agents simultaneously',
    'Voicemail detection & smart handling',
    'Smart follow-ups (max 5 attempts)',
    'Slack notifications',
    'SimplyBook.me integration',
    'Webhooks (Zapier, Make, n8n compatible)',
    'Auto-rotated numbers from Callengo pool',
    '$0.26/min overage',
    'Priority email support',
  ],

  business: [
    '800 calls/month (~1,200 min)',
    '5 min max per call',
    '5 concurrent calls',
    'All agents simultaneously',
    '3 users (dashboard access)',
    'Smart follow-ups (max 5 attempts)',
    'Voicemail detection & smart handling',
    'Microsoft Outlook & Teams',
    'HubSpot CRM integration',
    'Pipedrive CRM integration',
    'Zoho CRM integration',
    'Clio (legal practice management)',
    'Auto-rotated numbers from Callengo pool',
    '$0.23/min overage',
    'Priority email support',
  ],

  teams: [
    '1,500 calls/month (~2,250 min)',
    '6 min max per call',
    '10 concurrent calls',
    'All agents simultaneously',
    '5 users ($49/extra seat)',
    'User permissions (admin/member)',
    'Advanced follow-ups (max 10 attempts)',
    'Salesforce CRM integration',
    'Microsoft Dynamics 365 integration',
    'All Business integrations included',
    'Auto-rotated numbers from Callengo pool',
    '$0.20/min overage',
    'Priority support',
  ],

  enterprise: [
    '4,000+ calls/month (~6,000 min)',
    'Unlimited call duration',
    'Unlimited concurrent calls',
    'All agents simultaneously',
    'Unlimited users',
    'Unlimited follow-up attempts',
    'All integrations (current + future)',
    'Auto-rotated numbers from Callengo pool',
    '$0.17/min overage',
    'SLA guarantee',
    'Dedicated account manager',
    'Annual contract',
  ],
};

/**
 * Phone number feature availability per plan
 * All plans use auto-rotated numbers from the Callengo pool by default.
 * Dedicated numbers are available as a paid add-on ($25/mo per number, max 3) for Starter+.
 * Numbers are purchased on the master Bland account and assigned per company.
 */
export const PHONE_NUMBER_FEATURES: Record<string, {
  autoRotation: boolean;
  dedicatedNumberAddon: boolean;
}> = {
  free: {
    autoRotation: true,
    dedicatedNumberAddon: false,
  },
  starter: {
    autoRotation: true,
    dedicatedNumberAddon: true,
  },
  growth: {
    autoRotation: true,
    dedicatedNumberAddon: true,
  },
  business: {
    autoRotation: true,
    dedicatedNumberAddon: true,
  },
  teams: {
    autoRotation: true,
    dedicatedNumberAddon: true,
  },
  enterprise: {
    autoRotation: true,
    dedicatedNumberAddon: true,
  },
};

/**
 * Campaign feature access per plan
 * All plans can create campaigns, but sub-features are gated
 */
export const CAMPAIGN_FEATURE_ACCESS: Record<string, {
  maxActiveAgents: number; // -1 = unlimited
  maxConcurrentCalls: number; // -1 = unlimited
  maxCallDurationMinutes: number; // -1 = unlimited
  voicemailDetection: boolean;
  followUps: boolean;
  maxFollowUpAttempts: number; // -1 = unlimited
  smartFollowUp: boolean;
  slackNotifications: boolean;
  zoomMeetings: boolean;
  microsoftOutlook: boolean;
  microsoftTeams: boolean;
  noShowAutoRetry: boolean;
  rescheduling: boolean;
  dataExport: boolean;
  userPermissions: boolean;
  recordingVaultAddon: boolean;
  callsBoosterAddon: boolean;
}> = {
  free: {
    maxActiveAgents: 1,
    maxConcurrentCalls: 1,
    maxCallDurationMinutes: 3,
    voicemailDetection: false,
    followUps: false,
    maxFollowUpAttempts: 0,
    smartFollowUp: false,
    slackNotifications: false,
    zoomMeetings: true,
    microsoftOutlook: false,
    microsoftTeams: false,
    noShowAutoRetry: false,
    rescheduling: false,
    dataExport: false,
    userPermissions: false,
    recordingVaultAddon: false,
    callsBoosterAddon: false,
  },
  starter: {
    maxActiveAgents: 1,
    maxConcurrentCalls: 2,
    maxCallDurationMinutes: 3,
    voicemailDetection: true,
    followUps: true,
    maxFollowUpAttempts: 2,
    smartFollowUp: false,
    slackNotifications: true,
    zoomMeetings: true,
    microsoftOutlook: false,
    microsoftTeams: false,
    noShowAutoRetry: false,
    rescheduling: true,
    dataExport: true,
    userPermissions: false,
    recordingVaultAddon: true,
    callsBoosterAddon: true,
  },
  growth: {
    maxActiveAgents: -1,
    maxConcurrentCalls: 3,
    maxCallDurationMinutes: 4,
    voicemailDetection: true,
    followUps: true,
    maxFollowUpAttempts: 5,
    smartFollowUp: true,
    slackNotifications: true,
    zoomMeetings: true,
    microsoftOutlook: false,
    microsoftTeams: false,
    noShowAutoRetry: true,
    rescheduling: true,
    dataExport: true,
    userPermissions: false,
    recordingVaultAddon: true,
    callsBoosterAddon: true,
  },
  business: {
    maxActiveAgents: -1,
    maxConcurrentCalls: 5,
    maxCallDurationMinutes: 5,
    voicemailDetection: true,
    followUps: true,
    maxFollowUpAttempts: 5,
    smartFollowUp: true,
    slackNotifications: true,
    zoomMeetings: true,
    microsoftOutlook: true,
    microsoftTeams: true,
    noShowAutoRetry: true,
    rescheduling: true,
    dataExport: true,
    userPermissions: false,
    recordingVaultAddon: true,
    callsBoosterAddon: true,
  },
  teams: {
    maxActiveAgents: -1,
    maxConcurrentCalls: 10,
    maxCallDurationMinutes: 6,
    voicemailDetection: true,
    followUps: true,
    maxFollowUpAttempts: 10,
    smartFollowUp: true,
    slackNotifications: true,
    zoomMeetings: true,
    microsoftOutlook: true,
    microsoftTeams: true,
    noShowAutoRetry: true,
    rescheduling: true,
    dataExport: true,
    userPermissions: true,
    recordingVaultAddon: true,
    callsBoosterAddon: true,
  },
  enterprise: {
    maxActiveAgents: -1,
    maxConcurrentCalls: -1,
    maxCallDurationMinutes: -1,
    voicemailDetection: true,
    followUps: true,
    maxFollowUpAttempts: -1,
    smartFollowUp: true,
    slackNotifications: true,
    zoomMeetings: true,
    microsoftOutlook: true,
    microsoftTeams: true,
    noShowAutoRetry: true,
    rescheduling: true,
    dataExport: true,
    userPermissions: true,
    recordingVaultAddon: true,
    callsBoosterAddon: true,
  },
};

/**
 * Add-on availability per plan
 *
 * Dedicated Number: $25/mo to customer ($15/mo cost from Bland).
 * Up to 3 numbers per company for custom rotation.
 * Numbers purchased on master Bland account, assigned logically per company.
 */
export const ADDON_AVAILABILITY: Record<string, {
  dedicatedNumber: boolean; // $25/mo — own phone number(s) via Bland, max 3
  recordingVault: boolean;  // $12/mo — 12-month recording retention (default 30 days)
  callsBooster: boolean;    // $35/mo — +150 calls / +225 min
}> = {
  free: { dedicatedNumber: false, recordingVault: false, callsBooster: false },
  starter: { dedicatedNumber: true, recordingVault: true, callsBooster: true },
  growth: { dedicatedNumber: true, recordingVault: true, callsBooster: true },
  business: { dedicatedNumber: true, recordingVault: true, callsBooster: true },
  teams: { dedicatedNumber: true, recordingVault: true, callsBooster: true },
  enterprise: { dedicatedNumber: true, recordingVault: true, callsBooster: true },
};

/**
 * Get the minimum plan required to unlock a specific feature
 */
export function getRequiredPlanForFeature(feature: keyof typeof CAMPAIGN_FEATURE_ACCESS.free): string {
  const tiers = ['free', 'starter', 'growth', 'business', 'teams', 'enterprise'] as const;
  for (const tier of tiers) {
    const access = CAMPAIGN_FEATURE_ACCESS[tier];
    const value = access[feature];
    if (typeof value === 'boolean' && value) return tier;
    if (typeof value === 'number' && value !== 0) return tier;
  }
  return 'enterprise';
}

export function getPlanFeatures(slug: string): string[] {
  return PLAN_SPECIFIC_FEATURES[slug] || [];
}

export function getAllPlanFeatures(slug: string): string[] {
  return [...PLAN_SPECIFIC_FEATURES[slug] || []];
}

export function getPhoneNumberFeatures(slug: string) {
  return PHONE_NUMBER_FEATURES[slug] || PHONE_NUMBER_FEATURES.free;
}

export function getCampaignFeatureAccess(slug: string) {
  return CAMPAIGN_FEATURE_ACCESS[slug] || CAMPAIGN_FEATURE_ACCESS.free;
}

export function getAddonAvailability(slug: string) {
  return ADDON_AVAILABILITY[slug] || ADDON_AVAILABILITY.free;
}

/**
 * Convert minutes to estimated calls using 1.5 min effective average per call attempt.
 * Mix: ~45% no-answer (0.5 min), ~25% voicemail (1.5 min), ~30% connected (2.5 min)
 */
export function minutesToEstimatedCalls(minutes: number): number {
  return Math.round(minutes / 1.5);
}

/**
 * Convert calls to estimated minutes using 1.5 min effective average
 */
export function callsToEstimatedMinutes(calls: number): number {
  return Math.round(calls * 1.5);
}
