/**
 * Plan Features Configuration
 * Coherent with Stripe sync script and product spec
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
];

export const PLAN_SPECIFIC_FEATURES: Record<string, string[]> = {
  free: [
    '1 active agent',
    'Test AI calling workflows',
  ],

  starter: [
    '1 active agent',
    '1 user (dashboard access)',
    'Basic async support',
  ],

  business: [
    'Unlimited agents',
    '3 users (dashboard access)',
    'Automatic follow-ups',
    'Smart voicemail handling',
    'Call scheduling',
    'Simple campaigns',
    'Priority email support',
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
  ],
};

export function getPlanFeatures(slug: string): string[] {
  return PLAN_SPECIFIC_FEATURES[slug] || [];
}

export function getAllPlanFeatures(slug: string): string[] {
  return [...PLAN_SPECIFIC_FEATURES[slug] || []];
}
