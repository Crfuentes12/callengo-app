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
    '15 one-time minutes',
    '3 min max per call',
    '1 concurrent call',
    '1 active agent',
    '1 user',
    '$0.80/min overage',
    'Perfect for testing',
  ],

  starter: [
    '300 minutes/month',
    '3 min max per call',
    '1 concurrent call',
    '1 active agent',
    '1 user',
    '$0.60/min overage',
    'Basic async support',
  ],

  business: [
    '1,200 minutes/month',
    '5 min max per call',
    '3 concurrent calls',
    'Unlimited agents',
    '3 users',
    '$0.35/min overage',
    'Automatic follow-ups',
    'Call scheduling',
    'Simple campaigns',
    'Priority email support',
  ],

  teams: [
    '2,400 minutes/month',
    '8 min max per call',
    '10 concurrent calls',
    'Unlimited agents',
    '5 users ($79/extra)',
    '$0.22/min overage',
    'User permissions',
    'Governance & logs',
    'Agent/campaign analytics',
    'Voicemail handling',
    'Advanced retry logic',
    'Priority support',
    'CRM integrations (soon)',
  ],

  enterprise: [
    '6,000+ minutes/month',
    '15 min max per call (custom)',
    '50+ concurrent calls',
    'Unlimited agents & users',
    '$0.18/min overage',
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
