/**
 * Plan Features Configuration
 * Coherent with Stripe sync script and product spec
 * Phone number tiers: Free = rotated only, Starter+ = all features
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
    'Purchase dedicated phone numbers ($15/mo each)',
    'Twilio BYOP integration',
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
    'Purchase dedicated phone numbers ($15/mo each)',
    'Twilio BYOP integration',
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
    'Purchase dedicated phone numbers ($15/mo each)',
    'Twilio BYOP integration',
    'Custom dialing pools',
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
    'Unlimited dedicated phone numbers',
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
  purchaseNumbers: boolean;
  twilioByop: boolean;
  customDialingPools: boolean;
  sipIntegration: boolean;
  maxPurchasedNumbers: number | null;
}> = {
  free: {
    autoRotation: true,
    purchaseNumbers: false,
    twilioByop: false,
    customDialingPools: false,
    sipIntegration: false,
    maxPurchasedNumbers: 0,
  },
  starter: {
    autoRotation: true,
    purchaseNumbers: true,
    twilioByop: true,
    customDialingPools: false,
    sipIntegration: false,
    maxPurchasedNumbers: 3,
  },
  business: {
    autoRotation: true,
    purchaseNumbers: true,
    twilioByop: true,
    customDialingPools: false,
    sipIntegration: false,
    maxPurchasedNumbers: 10,
  },
  teams: {
    autoRotation: true,
    purchaseNumbers: true,
    twilioByop: true,
    customDialingPools: true,
    sipIntegration: false,
    maxPurchasedNumbers: 25,
  },
  enterprise: {
    autoRotation: true,
    purchaseNumbers: true,
    twilioByop: true,
    customDialingPools: true,
    sipIntegration: true,
    maxPurchasedNumbers: null, // Unlimited
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
