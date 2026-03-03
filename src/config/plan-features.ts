/**
 * Plan Features Configuration - V3 (March 2026)
 * Coherent with Stripe sync script, SQL migration, and business model document.
 *
 * Key changes from V2:
 * - Removed fake features (governance, compliance, custom dialing pools, SIP, etc.)
 * - All tiers can create campaigns (sub-features locked per tier)
 * - Free/Starter: 1 active agent at a time
 * - Business+: Unlimited simultaneous agents
 * - Overage rates updated (Starter $0.55, Business $0.39, Teams $0.29, Enterprise $0.25)
 * - Teams: $649/mo, 2500 min, $69/extra seat
 * - Business: $299/mo
 * - Enterprise: $1,499/mo
 *
 * Free plan = Trial: 15 minutes included, no overage, no recharge.
 * After 15 minutes are consumed, users must upgrade to a paid plan.
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
];

export const PLAN_SPECIFIC_FEATURES: Record<string, string[]> = {
  free: [
    '15 minutes of AI calling (trial)',
    '1 active agent (locked after selection)',
    'Full campaign wizard experience',
    'Auto-rotated numbers from Callengo pool',
    'No overage — upgrade required after trial',
  ],

  starter: [
    '300 minutes per month',
    '1 active agent (switchable)',
    'Voicemail detection',
    'Follow-ups (max 2 attempts)',
    'Slack notifications',
    'Zoom meetings',
    'SimplyBook.me integration',
    'Webhooks (Zapier, Make, n8n compatible)',
    'Auto-rotated numbers from Callengo pool',
    '$0.55/min overage',
    'Async email support',
  ],

  business: [
    '1,200 minutes per month',
    'All agents simultaneously',
    '3 users (dashboard access)',
    'Smart follow-ups (max 5 attempts)',
    'Voicemail detection & smart handling',
    'Microsoft Outlook & Teams',
    'Twilio BYOP (own phone number)',
    'HubSpot CRM integration',
    'Pipedrive CRM integration',
    'Zoho CRM integration',
    'Clio (legal practice management)',
    'Auto-rotated numbers from Callengo pool',
    '$0.39/min overage',
    'Priority email support',
  ],

  teams: [
    '2,500 minutes per month',
    'All agents simultaneously',
    '5 users ($69/extra seat)',
    'User permissions (admin/member)',
    'Advanced follow-ups (max 10 attempts)',
    'Salesforce CRM integration',
    'Microsoft Dynamics 365 integration',
    'All Business integrations included',
    'Auto-rotated numbers from Callengo pool',
    'Twilio BYOP (own phone number)',
    '$0.29/min overage',
    'Priority support',
  ],

  enterprise: [
    '6,000 minutes per month',
    'All agents simultaneously',
    'Unlimited users',
    'Unlimited follow-up attempts',
    'All integrations (current + future)',
    'Auto-rotated numbers from Callengo pool',
    'Twilio BYOP (own phone number)',
    '$0.25/min overage',
    'SLA guarantee',
    'Dedicated account manager',
    'Annual contract',
  ],
};

/**
 * Phone number feature availability per plan
 * Note: Custom dialing pools and SIP were removed (not implemented in codebase)
 */
export const PHONE_NUMBER_FEATURES: Record<string, {
  autoRotation: boolean;
  twilioByop: boolean;
}> = {
  free: {
    autoRotation: true,
    twilioByop: false,
  },
  starter: {
    autoRotation: true,
    twilioByop: false,
  },
  business: {
    autoRotation: true,
    twilioByop: true,
  },
  teams: {
    autoRotation: true,
    twilioByop: true,
  },
  enterprise: {
    autoRotation: true,
    twilioByop: true,
  },
};

/**
 * Campaign feature access per plan
 * All plans can create campaigns, but sub-features are gated
 */
export const CAMPAIGN_FEATURE_ACCESS: Record<string, {
  maxActiveAgents: number; // -1 = unlimited
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
}> = {
  free: {
    maxActiveAgents: 1,
    voicemailDetection: false,
    followUps: false,
    maxFollowUpAttempts: 0,
    smartFollowUp: false,
    slackNotifications: false,
    zoomMeetings: false,
    microsoftOutlook: false,
    microsoftTeams: false,
    noShowAutoRetry: false,
    rescheduling: false,
    dataExport: false,
  },
  starter: {
    maxActiveAgents: 1,
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
  },
  business: {
    maxActiveAgents: -1,
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
  },
  teams: {
    maxActiveAgents: -1,
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
  },
  enterprise: {
    maxActiveAgents: -1,
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
  },
};

/**
 * Get the minimum plan required to unlock a specific feature
 */
export function getRequiredPlanForFeature(feature: keyof typeof CAMPAIGN_FEATURE_ACCESS.free): string {
  const tiers = ['free', 'starter', 'business', 'teams', 'enterprise'] as const;
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
