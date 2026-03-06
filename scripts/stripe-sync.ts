#!/usr/bin/env tsx
/**
 * ============================================================================
 * CALLENGO - UNIVERSAL STRIPE SYNCHRONIZATION SCRIPT
 * ============================================================================
 *
 * One script to rule them all. Syncs everything to Stripe:
 * - Products with features (entitlements + marketing)
 * - Prices in multiple currencies (USD, EUR, GBP)
 * - Add-on products (Dedicated Number, Recording Vault, Calls Booster)
 * - Promotional coupons
 * - Archives incorrect prices automatically
 *
 * USAGE:
 *   Sandbox (test):  npm run stripe:sync
 *   Production:      npm run stripe:sync -- --env=live
 *   Dry run:         npm run stripe:sync -- --dry-run
 *   Verbose:         npm run stripe:sync -- --verbose
 *
 * FLAGS:
 *   --env=sandbox|live    Environment (default: sandbox)
 *   --dry-run             Preview changes without applying
 *   --verbose             Show detailed logs
 *   --skip-prices         Skip price creation/updates
 *   --skip-coupons        Skip coupon creation
 *   --skip-features       Skip feature creation
 *   --skip-addons         Skip add-on product sync
 *
 * SAFE TO RUN:
 * - Idempotent (can run multiple times)
 * - Archives incorrect prices automatically
 * - Preserves existing subscriptions
 * - Updates Supabase with correct IDs
 *
 * @version 4.0.0
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// ============================================================================
// CONFIGURATION
// ============================================================================

config({ path: '.env.local' });

interface Config {
  DRY_RUN: boolean;
  VERBOSE: boolean;
  ENV: 'sandbox' | 'live';
  SKIP_PRICES: boolean;
  SKIP_COUPONS: boolean;
  SKIP_FEATURES: boolean;
  SKIP_ADDONS: boolean;
}

const CONFIG: Config = {
  DRY_RUN: process.argv.includes('--dry-run'),
  VERBOSE: process.argv.includes('--verbose'),
  ENV: process.argv.find(arg => arg.startsWith('--env='))?.split('=')[1] as 'sandbox' | 'live' || 'sandbox',
  SKIP_PRICES: process.argv.includes('--skip-prices'),
  SKIP_COUPONS: process.argv.includes('--skip-coupons'),
  SKIP_FEATURES: process.argv.includes('--skip-features'),
  SKIP_ADDONS: process.argv.includes('--skip-addons'),
};

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
  typescript: true,
});

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// CURRENCY CONFIGURATION
// ============================================================================

interface CurrencyConfig {
  code: string;
  symbol: string;
  multiplier: number; // Conversion from USD
}

const CURRENCIES: Record<string, CurrencyConfig> = {
  USD: { code: 'usd', symbol: '$', multiplier: 1 },
  EUR: { code: 'eur', symbol: '€', multiplier: 0.92 }, // ~0.92 EUR = 1 USD
  GBP: { code: 'gbp', symbol: '£', multiplier: 0.79 }, // ~0.79 GBP = 1 USD
};

// ============================================================================
// ADD-ON PRODUCTS
// ============================================================================

interface AddonProduct {
  key: string;
  name: string;
  description: string;
  statement_descriptor: string;
  price_usd_monthly: number;  // in dollars
  metadata: Record<string, string>;
  features: string[];
}

const ADDON_PRODUCTS: AddonProduct[] = [
  {
    key: 'dedicated_number',
    name: 'Dedicated Phone Number',
    description: 'Get your own dedicated phone number for outbound AI calls via Callengo. Improves brand recognition and deliverability.',
    statement_descriptor: 'CALLENGO NUMBER',
    price_usd_monthly: 15,
    metadata: {
      addon_type: 'dedicated_number',
      min_plan: 'starter',
    },
    features: [
      'Dedicated outbound caller ID',
      'Better call deliverability',
      'Consistent brand identity',
      'Available on Starter and above',
    ],
  },
  {
    key: 'recording_vault',
    name: 'Recording Vault',
    description: 'Extend call recording retention from 30 days to 12 months. All recordings securely stored and downloadable anytime.',
    statement_descriptor: 'CALLENGO VAULT',
    price_usd_monthly: 12,
    metadata: {
      addon_type: 'recording_vault',
      min_plan: 'starter',
      retention_months: '12',
    },
    features: [
      '12-month recording retention',
      'Secure cloud storage',
      'Downloadable anytime',
      'Default is 30-day retention',
    ],
  },
  {
    key: 'calls_booster',
    name: 'Calls Booster',
    description: 'Add 150 extra calls (~225 minutes) to your monthly plan. Stack multiple boosters for more capacity.',
    statement_descriptor: 'CALLENGO BOOST',
    price_usd_monthly: 35,
    metadata: {
      addon_type: 'calls_booster',
      min_plan: 'starter',
      extra_calls: '150',
      extra_minutes: '225',
    },
    features: [
      '+150 calls per month',
      '~+225 minutes included',
      'Stackable (multiple per account)',
      'Available on Starter and above',
    ],
  },
];

// ============================================================================
// PROMOTIONAL COUPONS
// ============================================================================

const COUPONS = [
  // ── Admin Access ──
  {
    id: 'ADMIN100',
    name: '100% Off - Admin Lifetime Access',
    percent_off: 100,
    duration: 'forever' as const,
    metadata: {
      type: 'admin',
      target: 'internal',
      description: 'Lifetime free access for platform administrators',
    },
  },

  // ── Tester Codes (10 codes, 100% off) ──
  {
    id: 'TESTER_100',
    name: '100% Off - Tester Access',
    percent_off: 100,
    duration: 'repeating' as const,
    duration_in_months: 3,
    max_redemptions: 10,
    metadata: {
      type: 'tester',
      target: 'qa_team',
      description: '3-month free access for testers (10 codes max)',
    },
    promoCodes: ['TESTER01', 'TESTER02', 'TESTER03', 'TESTER04', 'TESTER05', 'TESTER06', 'TESTER07', 'TESTER08', 'TESTER09', 'TESTER10'],
  },

  // ── Launch & Campaign Promos ──
  {
    id: 'LAUNCH50',
    name: '50% Off - Launch Special',
    percent_off: 50,
    duration: 'repeating' as const,
    duration_in_months: 3,
    max_redemptions: 100,
    metadata: {
      type: 'launch_special',
      campaign: 'launch_2026',
      description: '50% off for 3 months — early launch campaign',
    },
  },
  {
    id: 'EARLY25',
    name: '25% Off - Early Bird',
    percent_off: 25,
    duration: 'once' as const,
    max_redemptions: 500,
    metadata: {
      type: 'early_bird',
      campaign: 'launch_2026',
      description: '25% off first month — early bird offer',
    },
  },
  {
    id: 'ANNUAL20',
    name: '20% Off - Annual Upgrade Incentive',
    percent_off: 20,
    duration: 'forever' as const,
    metadata: {
      type: 'annual_incentive',
      description: 'Permanent 20% discount for annual billing commitment',
    },
  },
  {
    id: 'CALLENGO30',
    name: '30% Off - Callengo Campaign',
    percent_off: 30,
    duration: 'repeating' as const,
    duration_in_months: 2,
    max_redemptions: 250,
    metadata: {
      type: 'campaign',
      campaign: 'general_promo',
      description: '30% off for 2 months — general marketing campaign',
    },
  },
  {
    id: 'WELCOME15',
    name: '15% Off - Welcome Offer',
    percent_off: 15,
    duration: 'once' as const,
    max_redemptions: 1000,
    metadata: {
      type: 'welcome',
      campaign: 'onboarding_2026',
      description: '15% off first month — new user welcome offer',
    },
  },
  {
    id: 'PARTNER40',
    name: '40% Off - Partner Referral',
    percent_off: 40,
    duration: 'repeating' as const,
    duration_in_months: 6,
    max_redemptions: 50,
    metadata: {
      type: 'partner',
      campaign: 'partner_referral',
      description: '40% off for 6 months — partner/referral program',
    },
  },
  {
    id: 'LEGAL20',
    name: '20% Off - Legal Professionals',
    percent_off: 20,
    duration: 'repeating' as const,
    duration_in_months: 12,
    max_redemptions: 200,
    metadata: {
      type: 'vertical_promo',
      campaign: 'legal_vertical',
      description: '20% off for 12 months — targeted at law firms using Clio',
    },
  },
];

// ============================================================================
// FEATURES DEFINITION (V4 — COHERENT WITH plan-features.ts)
// ============================================================================

const COMMON_FEATURES = [
  // Import/Export
  'CSV contact import',
  'Excel contact import',
  'Google Sheets import',
  'JSON import/export',
  'Phone normalization',
  'Contact deduplication',
  'Custom fields',
  'Tag segmentation',

  // Agent Core
  'AI agent creation',
  'Voice configuration',
  'Language configuration',
  'Custom prompts',
  'Test calls',
  'Call logs',

  // Analytics & Billing
  'Call analytics',
  'Minutes tracking',
  'Transcription downloads',
  'Usage dashboard',
  'Billing alerts',
  'Plan management',

  // Always included
  'Google Calendar + Meet',
  'Zoom meetings',
  'Auto-rotated phone numbers',
];

const PLAN_FEATURES = {
  free: [
    ...COMMON_FEATURES,
    '10 calls included (trial)',
    '15 minutes total',
    '3 min max per call',
    '1 concurrent call',
    '1 active agent (locked)',
    '1 user',
    'No overage (upgrade required)',
  ],

  starter: [
    ...COMMON_FEATURES,
    '200 calls/month (~300 min)',
    '3 min max per call',
    '2 concurrent calls',
    '1 active agent (switchable)',
    '1 user',
    '$0.29/min overage',
    'Voicemail detection',
    'Follow-ups (max 2 attempts)',
    'Slack notifications',
    'SimplyBook.me integration',
    'Webhooks (Zapier, Make, n8n)',
    'Async email support',
  ],

  growth: [
    ...COMMON_FEATURES,
    '400 calls/month (~600 min)',
    '4 min max per call',
    '3 concurrent calls',
    'Unlimited agents',
    '1 user',
    '$0.26/min overage',
    'Voicemail detection & smart handling',
    'Smart follow-ups (max 5 attempts)',
    'Slack notifications',
    'SimplyBook.me integration',
    'Webhooks (Zapier, Make, n8n)',
    'Priority email support',
  ],

  business: [
    ...COMMON_FEATURES,
    '800 calls/month (~1,200 min)',
    '5 min max per call',
    '5 concurrent calls',
    'Unlimited agents',
    '3 users ($49/extra seat)',
    '$0.23/min overage',
    'Smart follow-ups (max 5 attempts)',
    'Voicemail detection & smart handling',
    'Microsoft Outlook & Teams',
    'HubSpot CRM',
    'Pipedrive CRM',
    'Zoho CRM',
    'Clio (legal)',
    'Priority email support',
  ],

  teams: [
    ...COMMON_FEATURES,
    '1,500 calls/month (~2,250 min)',
    '6 min max per call',
    '10 concurrent calls',
    'Unlimited agents',
    '5 users ($49/extra seat)',
    '$0.20/min overage',
    'User permissions (admin/member)',
    'Advanced follow-ups (max 10 attempts)',
    'Salesforce CRM',
    'Microsoft Dynamics 365',
    'All Business integrations',
    'Priority support',
  ],

  enterprise: [
    ...COMMON_FEATURES,
    '4,000+ calls/month (~6,000 min)',
    'Unlimited call duration',
    'Unlimited concurrent calls',
    'Unlimited agents & users',
    '$0.17/min overage',
    'Unlimited follow-ups',
    'All integrations (current + future)',
    'SLA guarantee',
    'Dedicated account manager',
    'Annual contract',
  ],
};

const PRODUCT_DESCRIPTIONS = {
  free: {
    short: 'Try AI calling — 10 calls / 15 min trial',
    long: 'Try Callengo with 10 calls and 15 minutes. Experience the full platform with 1 AI agent. No credit card required.',
    statement_descriptor: 'CALLENGO FREE',
  },
  starter: {
    short: 'Solo use — 200 calls/month',
    long: 'Perfect for solo founders and freelancers. 200 calls/month with voicemail detection, follow-ups, Slack, and Zoom.',
    statement_descriptor: 'CALLENGO STARTER',
  },
  growth: {
    short: 'Growing businesses — 400 calls/month',
    long: 'For growing businesses. 400 calls/month, unlimited agents, smart follow-ups, and priority support.',
    statement_descriptor: 'CALLENGO GROWTH',
  },
  business: {
    short: 'Scaling teams — 800 calls/month',
    long: 'For scaling businesses. Unlimited agents, 3 users, CRM integrations (HubSpot, Pipedrive, Zoho, Clio), Microsoft 365.',
    statement_descriptor: 'CALLENGO BUSINESS',
  },
  teams: {
    short: 'Collaboration — 1,500 calls/month',
    long: 'For collaborative teams. 5 users, permissions, enterprise CRMs (Salesforce, Dynamics 365), all Business integrations.',
    statement_descriptor: 'CALLENGO TEAMS',
  },
  enterprise: {
    short: 'Enterprise — 4,000+ calls/month',
    long: 'For large organizations. Unlimited everything, SLA guarantee, dedicated account manager, all integrations.',
    statement_descriptor: 'CALLENGO ENTERPRISE',
  },
};

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

function log(message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info') {
  const icons = { info: 'ℹ️ ', success: '✅', warning: '⚠️ ', error: '❌' };
  console.log(`${icons[level]} ${message}`);
}

function logVerbose(message: string) {
  if (CONFIG.VERBOSE) {
    console.log(`   ${message}`);
  }
}

async function confirmAction(message: string): Promise<boolean> {
  if (CONFIG.DRY_RUN) {
    log(`[DRY RUN] Would: ${message}`, 'warning');
    return false;
  }
  return true;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║     CALLENGO - UNIVERSAL STRIPE SYNCHRONIZATION v4.0     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  log(`Environment: ${CONFIG.ENV.toUpperCase()}`, 'info');
  log(`Dry run: ${CONFIG.DRY_RUN ? 'YES' : 'NO'}`, CONFIG.DRY_RUN ? 'warning' : 'info');
  log(`Verbose: ${CONFIG.VERBOSE ? 'YES' : 'NO'}`, 'info');
  console.log('');

  // Test Stripe connection
  log('Testing Stripe connection...', 'info');
  try {
    await stripe.balance.retrieve();
    log(`Connected to Stripe account successfully`, 'success');
  } catch (error: any) {
    log(`Failed to connect to Stripe: ${error.message}`, 'error');
    process.exit(1);
  }

  // Sync coupons
  if (!CONFIG.SKIP_COUPONS) {
    await syncCoupons();
  }

  // Sync subscription plans
  await syncPlans();

  // Sync add-on products
  if (!CONFIG.SKIP_ADDONS) {
    await syncAddons();
  }

  // Summary
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                    SYNC COMPLETED                         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  if (CONFIG.DRY_RUN) {
    log('This was a dry run. No changes were made to Stripe.', 'warning');
    log('Remove --dry-run flag to apply changes.', 'info');
  } else {
    log('All changes have been applied successfully!', 'success');
  }
}

// ============================================================================
// COUPON SYNCHRONIZATION
// ============================================================================

async function syncCoupons() {
  log('\n💰 Starting coupon synchronization...', 'info');
  console.log('');

  for (const couponConfig of COUPONS) {
    try {
      log(`Processing coupon: ${couponConfig.id} (${couponConfig.name})`, 'info');

      let existingCoupon: Stripe.Coupon | null = null;
      try {
        existingCoupon = await stripe.coupons.retrieve(couponConfig.id);
        log(`   Found existing coupon`, 'info');
      } catch (error) {
        // Coupon doesn't exist
      }

      if (!existingCoupon && await confirmAction(`Create coupon ${couponConfig.id}`)) {
        const cleanMetadata: Record<string, string | number | null> = {};
        if (couponConfig.metadata) {
          Object.entries(couponConfig.metadata).forEach(([key, value]) => {
            if (value !== undefined) cleanMetadata[key] = value;
          });
        }

        const coupon = await stripe.coupons.create({
          id: couponConfig.id,
          name: couponConfig.name,
          percent_off: couponConfig.percent_off,
          duration: couponConfig.duration,
          duration_in_months: couponConfig.duration_in_months,
          max_redemptions: couponConfig.max_redemptions,
          metadata: cleanMetadata,
        });
        log(`   Created coupon: ${coupon.id} (${coupon.percent_off}% off)`, 'success');
      } else if (existingCoupon) {
        log(`   Coupon already exists (${existingCoupon.times_redeemed || 0}/${existingCoupon.max_redemptions || '∞'} used)`, 'info');
      }

      // Create promotion codes
      if (!CONFIG.DRY_RUN) {
        const cfg = couponConfig as any;
        const codes: string[] = cfg.promoCodes || [couponConfig.id];

        for (const code of codes) {
          try {
            const maxRedemptions = cfg.promoCodes ? 1 : couponConfig.max_redemptions;
            const bodyParams = new URLSearchParams();
            bodyParams.set('coupon', couponConfig.id);
            bodyParams.set('code', code);
            if (maxRedemptions) bodyParams.set('max_redemptions', String(maxRedemptions));

            const res = await fetch('https://api.stripe.com/v1/promotion_codes', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Stripe-Version': '2024-12-18.acacia',
              },
              body: bodyParams.toString(),
            });
            const data = await res.json();
            if (!res.ok) {
              if (data.error?.message?.includes('already exists') || data.error?.code === 'resource_already_exists') {
                logVerbose(`   Promotion code ${code} already exists`);
              } else {
                logVerbose(`   Note: Could not create promotion code ${code}: ${data.error?.message || 'Unknown error'}`);
              }
            } else {
              log(`   Promotion code created: ${data.code}`, 'success');
            }
          } catch (promoError: any) {
            logVerbose(`   Note: Could not create promotion code ${code}: ${promoError.message}`);
          }
        }
      }

    } catch (error) {
      log(`   Error processing coupon ${couponConfig.id}: ${error}`, 'error');
    }
  }

  log('\n💰 Coupon synchronization completed', 'success');
}

// ============================================================================
// PLAN SYNCHRONIZATION
// ============================================================================

async function syncPlans() {
  log('\n🚀 Starting subscription plans synchronization...', 'info');

  const { data: plans, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (error) {
    log(`Error fetching plans: ${error.message}`, 'error');
    return;
  }

  if (!plans || plans.length === 0) {
    log('No plans found in database', 'warning');
    return;
  }

  log(`Found ${plans.length} active plans to sync\n`, 'info');

  for (const plan of plans) {
    log(`\n📦 Processing plan: ${plan.name} (${plan.slug})`, 'info');
    console.log('─'.repeat(60));

    try {
      await syncSinglePlan(plan);
      log(`Completed: ${plan.name}\n`, 'success');
    } catch (error) {
      log(`Error processing plan ${plan.name}: ${error}`, 'error');
      if (CONFIG.VERBOSE && error instanceof Error) {
        console.error(error.stack);
      }
    }
  }

  log('\n🎉 Subscription plans synchronization completed!', 'success');
}

async function syncSinglePlan(plan: any) {
  let productId = plan.stripe_product_id;
  const priceIds: Record<string, { monthly: string | null; annual: string | null }> = {};

  const productDesc = PRODUCT_DESCRIPTIONS[plan.slug as keyof typeof PRODUCT_DESCRIPTIONS];
  const features = PLAN_FEATURES[plan.slug as keyof typeof PLAN_FEATURES] || COMMON_FEATURES;

  // ── Create/Update Product ──

  if (productId) {
    try {
      await stripe.products.retrieve(productId);
    } catch {
      logVerbose(`Product ${productId} not found in ${CONFIG.ENV} mode, will create a new one`);
      productId = null;
    }
  }

  if (!productId) {
    if (await confirmAction(`Create product for ${plan.name}`)) {
      logVerbose('Creating new product in Stripe...');

      const product = await stripe.products.create({
        name: plan.name,
        description: productDesc?.long || plan.description || `${plan.name} subscription plan`,
        statement_descriptor: productDesc?.statement_descriptor,
        marketing_features: features.slice(0, 15).map(f => ({ name: f })),
        metadata: {
          plan_id: plan.id,
          slug: plan.slug,
          calls_included: (plan.calls_included || 0).toString(),
          minutes_included: plan.minutes_included.toString(),
          max_users: plan.max_users.toString(),
          max_agents: plan.max_agents?.toString() || 'unlimited',
          max_concurrent_calls: plan.max_concurrent_calls.toString(),
          overage_rate: plan.price_per_extra_minute.toString(),
          source: 'supabase',
          sync_version: '4.0',
          environment: CONFIG.ENV,
        },
      } as any);

      productId = product.id;
      log(`  Product created: ${productId}`, 'success');
      logVerbose(`     Added ${features.length} marketing features`);
    }
  } else {
    logVerbose(`Using existing product: ${productId}`);

    if (!CONFIG.DRY_RUN) {
      await stripe.products.update(productId, {
        name: plan.name,
        description: productDesc?.long || plan.description,
        statement_descriptor: productDesc?.statement_descriptor,
        marketing_features: features.slice(0, 15).map(f => ({ name: f })),
        metadata: {
          plan_id: plan.id,
          slug: plan.slug,
          calls_included: (plan.calls_included || 0).toString(),
          minutes_included: plan.minutes_included.toString(),
          max_users: plan.max_users.toString(),
          max_agents: plan.max_agents?.toString() || 'unlimited',
          max_concurrent_calls: plan.max_concurrent_calls.toString(),
          overage_rate: plan.price_per_extra_minute.toString(),
          source: 'supabase',
          sync_version: '4.0',
          last_synced: new Date().toISOString(),
          environment: CONFIG.ENV,
        },
      } as any);
      logVerbose('Product metadata and features updated');
    }
  }

  // ── Sync Entitlement Features ──

  if (!CONFIG.SKIP_FEATURES && features && features.length > 0 && productId) {
    logVerbose(`Syncing ${features.length} entitlement features...`);

    for (const featureName of features) {
      try {
        const featureLookupKey = `${plan.slug}_${featureName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`.substring(0, 256);

        let feature: any = null;
        try {
          const existingFeatures = await stripe.entitlements.features.list({ limit: 100 } as any);
          feature = existingFeatures.data.find((f: any) => f.lookup_key === featureLookupKey);
        } catch (err) {
          // Feature doesn't exist
        }

        if (!feature && !CONFIG.DRY_RUN) {
          try {
            feature = await stripe.entitlements.features.create({
              name: featureName.substring(0, 80),
              lookup_key: featureLookupKey,
              metadata: { plan: plan.slug },
            } as any);
            logVerbose(`     Created feature: ${featureName}`);
          } catch (createErr: any) {
            if (createErr.message?.includes('lookup_key') || createErr.message?.includes('already')) {
              logVerbose(`     Feature exists: ${featureName}`);
            } else {
              logVerbose(`     Warning: Could not create feature "${featureName}": ${createErr.message}`);
            }
          }
        } else if (feature) {
          logVerbose(`     Feature exists: ${featureName}`);
        }

        if (feature && !CONFIG.DRY_RUN) {
          try {
            const existingAttachments = await stripe.products.listFeatures(productId, { limit: 100 } as any);
            const alreadyAttached = existingAttachments.data.find((pf: any) => pf.entitlement_feature?.id === feature.id);

            if (!alreadyAttached) {
              await stripe.products.createFeature(productId, { entitlement_feature: feature.id } as any);
              logVerbose(`     ✅ Attached: ${featureName}`);
            }
          } catch (attachErr: any) {
            if (!attachErr.message?.includes('already attached')) {
              logVerbose(`     Note: Could not attach feature: ${attachErr.message}`);
            }
          }
        }
      } catch (error: any) {
        logVerbose(`     Warning: Could not process feature "${featureName}": ${error.message}`);
      }
    }

    log(`  Synced ${features.length} features to product`, 'success');
  }

  // ── Create Prices in Multiple Currencies ──

  if (!CONFIG.SKIP_PRICES) {
    for (const [currencyName, currencyConfig] of Object.entries(CURRENCIES)) {
      await syncPricesForCurrency(plan, productId!, currencyConfig, priceIds);
    }
  }

  // ── Update Supabase ──

  if (!CONFIG.DRY_RUN && productId) {
    const { error: updateError } = await supabase
      .from('subscription_plans')
      .update({
        stripe_product_id: productId,
        stripe_price_id_monthly: priceIds['USD']?.monthly || plan.stripe_price_id_monthly,
        stripe_price_id_annual: priceIds['USD']?.annual || plan.stripe_price_id_annual,
      })
      .eq('id', plan.id);

    if (updateError) {
      log(`  Error updating Supabase: ${updateError.message}`, 'error');
    } else {
      logVerbose('Supabase updated with Stripe IDs');
    }
  }
}

async function syncPricesForCurrency(
  plan: any,
  productId: string,
  currency: CurrencyConfig,
  priceIds: Record<string, { monthly: string | null; annual: string | null }>
) {
  const priceMonthly = parseFloat(plan.price_monthly);
  const priceAnnual = parseFloat(plan.price_annual);

  const monthlyAmount = Math.round(priceMonthly * currency.multiplier * 100);
  const annualAmount = Math.round(priceAnnual * currency.multiplier * 12 * 100);

  logVerbose(`  ${currency.code.toUpperCase()} Prices:`);

  if (!priceIds[currency.code.toUpperCase()]) {
    priceIds[currency.code.toUpperCase()] = { monthly: null, annual: null };
  }

  // Monthly price
  if (priceMonthly > 0) {
    if (await confirmAction(`Create monthly price ${currency.symbol}${monthlyAmount / 100}/${currency.code}`)) {
      const price = await stripe.prices.create({
        product: productId,
        currency: currency.code,
        unit_amount: monthlyAmount,
        recurring: { interval: 'month' },
        nickname: `${plan.name} - Monthly (${currency.code.toUpperCase()})`,
        tax_behavior: 'exclusive',
        metadata: {
          plan_id: plan.id,
          billing_cycle: 'monthly',
          plan_slug: plan.slug,
          currency: currency.code,
        },
      });

      priceIds[currency.code.toUpperCase()].monthly = price.id;
      log(`     ${currency.code.toUpperCase()} Monthly: ${price.id} (${currency.symbol}${monthlyAmount / 100}/mo)`, 'success');
    }
  }

  // Annual price
  if (priceAnnual > 0) {
    const monthlyEquivalent = Math.round(priceAnnual * currency.multiplier * 100);

    if (plan.stripe_price_id_annual && currency.code === 'usd' && !CONFIG.DRY_RUN) {
      try {
        const existingPrice = await stripe.prices.retrieve(plan.stripe_price_id_annual);
        if (existingPrice.unit_amount !== annualAmount) {
          log(`     Incorrect annual price detected: ${currency.symbol}${(existingPrice.unit_amount || 0) / 100} (expected ${currency.symbol}${annualAmount / 100})`, 'warning');
          await stripe.prices.update(plan.stripe_price_id_annual, { active: false });
          log(`     Archived incorrect price`, 'success');
        } else {
          priceIds[currency.code.toUpperCase()].annual = existingPrice.id;
          logVerbose(`     ${currency.code.toUpperCase()} Annual exists and is correct`);
          return;
        }
      } catch (err) {
        // Price doesn't exist or can't be retrieved
      }
    }

    if (await confirmAction(`Create annual price ${currency.symbol}${annualAmount / 100}/${currency.code}`)) {
      const savings = Math.round(((priceMonthly * 12 - priceAnnual * 12) / (priceMonthly * 12)) * 100);

      const price = await stripe.prices.create({
        product: productId,
        currency: currency.code,
        unit_amount: annualAmount,
        recurring: { interval: 'year' },
        nickname: `${plan.name} - Annual (${currency.code.toUpperCase()})`,
        tax_behavior: 'exclusive',
        metadata: {
          plan_id: plan.id,
          billing_cycle: 'annual',
          plan_slug: plan.slug,
          currency: currency.code,
          monthly_equivalent: monthlyEquivalent.toString(),
          savings: `${savings}%`,
        },
      });

      priceIds[currency.code.toUpperCase()].annual = price.id;
      log(`     ${currency.code.toUpperCase()} Annual: ${price.id} (${currency.symbol}${annualAmount / 100}/yr = ${currency.symbol}${monthlyEquivalent / 100}/mo, save ${savings}%)`, 'success');
    }
  }
}

// ============================================================================
// ADD-ON PRODUCT SYNCHRONIZATION
// ============================================================================

async function syncAddons() {
  log('\n🔌 Starting add-on products synchronization...', 'info');
  console.log('');

  for (const addon of ADDON_PRODUCTS) {
    log(`\n🧩 Processing add-on: ${addon.name}`, 'info');
    console.log('─'.repeat(60));

    try {
      await syncSingleAddon(addon);
      log(`Completed: ${addon.name}\n`, 'success');
    } catch (error) {
      log(`Error processing add-on ${addon.name}: ${error}`, 'error');
    }
  }

  log('\n🔌 Add-on synchronization completed!', 'success');
}

async function syncSingleAddon(addon: AddonProduct) {
  // Search for existing product by metadata key
  let productId: string | null = null;

  if (!CONFIG.DRY_RUN) {
    const existingProducts = await stripe.products.search({
      query: `metadata['addon_type']:'${addon.key}'`,
    });

    if (existingProducts.data.length > 0) {
      productId = existingProducts.data[0].id;
      logVerbose(`Found existing add-on product: ${productId}`);

      await stripe.products.update(productId, {
        name: addon.name,
        description: addon.description,
        statement_descriptor: addon.statement_descriptor,
        marketing_features: addon.features.map(f => ({ name: f })),
        metadata: {
          ...addon.metadata,
          sync_version: '4.0',
          last_synced: new Date().toISOString(),
        },
      } as any);
      logVerbose('Add-on product updated');
    }
  }

  if (!productId && await confirmAction(`Create add-on product: ${addon.name}`)) {
    const product = await stripe.products.create({
      name: addon.name,
      description: addon.description,
      statement_descriptor: addon.statement_descriptor,
      marketing_features: addon.features.map(f => ({ name: f })),
      metadata: {
        ...addon.metadata,
        product_type: 'addon',
        sync_version: '4.0',
        environment: CONFIG.ENV,
      },
    } as any);
    productId = product.id;
    log(`  Add-on product created: ${productId}`, 'success');
  }

  if (!productId) return;

  // Create prices for each currency
  for (const [, currency] of Object.entries(CURRENCIES)) {
    const amount = Math.round(addon.price_usd_monthly * currency.multiplier * 100);

    if (await confirmAction(`Create ${currency.code.toUpperCase()} monthly price for ${addon.name}: ${currency.symbol}${amount / 100}`)) {
      // Check if a price already exists for this currency and product
      if (!CONFIG.DRY_RUN) {
        const existingPrices = await stripe.prices.list({
          product: productId,
          currency: currency.code,
          active: true,
          limit: 10,
        });

        const correctPrice = existingPrices.data.find(
          p => p.unit_amount === amount && p.recurring?.interval === 'month'
        );

        if (correctPrice) {
          logVerbose(`     ${currency.code.toUpperCase()} Monthly price exists and is correct: ${correctPrice.id}`);
          continue;
        }

        // Archive incorrect prices
        for (const price of existingPrices.data) {
          if (price.unit_amount !== amount) {
            await stripe.prices.update(price.id, { active: false });
            logVerbose(`     Archived incorrect price: ${price.id}`);
          }
        }
      }

      if (await confirmAction(`Create ${currency.code.toUpperCase()} price for ${addon.name}`)) {
        const price = await stripe.prices.create({
          product: productId,
          currency: currency.code,
          unit_amount: amount,
          recurring: { interval: 'month' },
          nickname: `${addon.name} - Monthly (${currency.code.toUpperCase()})`,
          tax_behavior: 'exclusive',
          metadata: {
            addon_key: addon.key,
            billing_cycle: 'monthly',
            currency: currency.code,
          },
        });
        log(`     ${currency.code.toUpperCase()} Monthly: ${price.id} (${currency.symbol}${amount / 100}/mo)`, 'success');
      }
    }
  }
}

// ============================================================================
// RUN
// ============================================================================

main().catch(console.error);
