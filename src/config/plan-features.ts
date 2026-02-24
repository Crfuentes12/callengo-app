/**
 * Plan Features Configuration
 * Coherent with Stripe sync script and product spec
 * Phone numbers: Free = rotated only, Starter+ = Twilio BYOP
 */

export const COMMON_FEATURES = [
  'CSV/Excel/Google Sheets import',
  'JSON import/export',
  'Phone normalization',
  'Contact deduplication',
  'Custom fields & tag segmentation',
  'AI agent creation & configuration',
  'Call analytics & tracking',
  'Transcription downloads',
  'Usage dashboard',
  'Billing alerts',
  'Auto-rotating phone numbers (spam protection)',
  'Google Calendar & Meet integration',
  'Zoom meeting links',
];

export const PLAN_SPECIFIC_FEATURES: Record<string, string[]> = {
  free: [
    '1 active agent',
    'Test AI calling workflows',
    'Auto-rotated numbers from Callengo pool',
  ],

  starter: [
    '1 active agent',
    '1 user (dashboard access)',
    'Basic async support',
    'Auto-rotated numbers from Callengo pool',
  ],

  business: [
    'Unlimited agents',
    '3 users (dashboard access)',
    'Automatic follow-ups',
    'Smart voicemail handling',
    'Call scheduling',
    'Simple campaigns',
    'Priority email support',
    'Auto-rotated numbers from Callengo pool',
    'Twilio BYOP integration',
    'Microsoft 365 Outlook & Teams',
    'Slack notifications',
  ],

  teams: [
    'Unlimited agents',
    '5 users ($79/extra)',
    'User permissions',
    'Governance & logs',
    'Agent/campaign analytics',
    'Advanced retry logic',
    'Priority support',
    'CRM integrations (Beta)',
    'Auto-rotated numbers from Callengo pool',
    'Twilio BYOP integration',
    'Custom dialing pools',
    'Microsoft 365 Outlook & Teams',
    'Slack notifications',
  ],

  enterprise: [
    'Unlimited agents & users',
    'Annual contract',
    'SLA guarantee',
    'Dedicated account manager',
    'Priority infrastructure',
    'Security & compliance',
    'Full audit logs',
    'Custom integrations',
    'Full CRM integration',
    'Roadmap influence',
    'Auto-rotated numbers from Callengo pool',
    'Twilio BYOP integration',
    'Custom dialing pools & geospatial dialing',
    'SIP integration',
  ],
};

/**
 * Phone number feature availability per plan
 */
export const PHONE_NUMBER_FEATURES: Record<string, {
  autoRotation: boolean;
  twilioByop: boolean;
  customDialingPools: boolean;
  sipIntegration: boolean;
}> = {
  free: {
    autoRotation: true,
    twilioByop: false,
    customDialingPools: false,
    sipIntegration: false,
  },
  starter: {
    autoRotation: true,
    twilioByop: false,
    customDialingPools: false,
    sipIntegration: false,
  },
  business: {
    autoRotation: true,
    twilioByop: true,
    customDialingPools: false,
    sipIntegration: false,
  },
  teams: {
    autoRotation: true,
    twilioByop: true,
    customDialingPools: true,
    sipIntegration: false,
  },
  enterprise: {
    autoRotation: true,
    twilioByop: true,
    customDialingPools: true,
    sipIntegration: true,
  },
};

export function getPlanFeatures(slug: string): string[] {
  return PLAN_SPECIFIC_FEATURES[slug] || [];
}

export function getAllPlanFeatures(slug: string): string[] {
  return [...PLAN_SPECIFIC_FEATURES[slug] || []];
}

export function getPhoneNumberFeatures(slug: string) {
  return PHONE_NUMBER_FEATURES[slug] || PHONE_NUMBER_FEATURES.free;
}
