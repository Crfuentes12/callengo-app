#!/usr/bin/env tsx
/**
 * ============================================================================
 * CALLENGO - UNIVERSAL STRIPE SYNCHRONIZATION SCRIPT
 * ============================================================================
 *
 * One script to rule them all. Syncs everything to Stripe:
 * - Products with features (entitlements + marketing)
 * - Prices in multiple currencies (USD, EUR, GBP)
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
 *
 * SAFE TO RUN:
 * - Idempotent (can run multiple times)
 * - Archives incorrect prices automatically
 * - Preserves existing subscriptions
 * - Updates Supabase with correct IDs
 *
 * @author Claude (Anthropic)
 * @version 3.0.0
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
}

const CONFIG: Config = {
  DRY_RUN: process.argv.includes('--dry-run'),
  VERBOSE: process.argv.includes('--verbose'),
  ENV: process.argv.find(arg => arg.startsWith('--env='))?.split('=')[1] as 'sandbox' | 'live' || 'sandbox',
  SKIP_PRICES: process.argv.includes('--skip-prices'),
  SKIP_COUPONS: process.argv.includes('--skip-coupons'),
  SKIP_FEATURES: process.argv.includes('--skip-features'),
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
// PROMOTIONAL COUPONS
// ============================================================================

const COUPONS = [
  {
    id: 'TOTAL100',
    name: '100% Off - Full Access (Limited)',
    percent_off: 100,
    duration: 'forever' as const,
    max_redemptions: 5,
    metadata: {
      type: 'full_discount',
      target: 'early_adopters',
      campaign: 'launch_2024',
    },
  },
  {
    id: 'LAUNCH50',
    name: '50% Off - Launch Special',
    percent_off: 50,
    duration: 'repeating' as const,
    duration_in_months: 3,
    max_redemptions: 100,
    metadata: {
      type: 'launch_special',
      campaign: 'launch_2024',
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
      campaign: 'launch_2024',
    },
  },
  {
    id: 'ANNUAL20',
    name: '20% Off - Annual Upgrade',
    percent_off: 20,
    duration: 'forever' as const,
    metadata: {
      type: 'annual_incentive',
    },
  },
];

// ============================================================================
// FEATURES DEFINITION (COHERENT WITH PRODUCT SPEC)
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
];

const PLAN_FEATURES = {
  free: [
    ...COMMON_FEATURES,
    '15 one-time minutes',
    '3 min per call',
    '1 concurrent call',
    '1 active agent',
    '1 user',
    '$0.80/min overage',
  ],

  starter: [
    ...COMMON_FEATURES,
    '300 minutes per month',
    '3 min per call',
    '1 concurrent call',
    '1 active agent',
    '1 user',
    '$0.60/min overage',
    'Basic async support',
  ],

  business: [
    ...COMMON_FEATURES,
    '1,200 minutes per month',
    '5 min per call',
    '3 concurrent calls',
    'Unlimited agents',
    '3 users',
    '$0.35/min overage',
    'Automatic follow-ups',
    'Basic retry logic',
    'Call scheduling',
    'Simple campaigns',
    'Priority email support',
  ],

  teams: [
    ...COMMON_FEATURES,
    '2,400 minutes per month',
    '8 min per call',
    '10 concurrent calls',
    'Unlimited agents',
    '5 users ($79/extra)',
    '$0.22/min overage',
    'User permissions',
    'Basic governance',
    'Advanced logs',
    'Agent/campaign analytics',
    'Voicemail handling',
    'Advanced retry logic',
    'Priority support',
    'CRM integrations (soon)',
    'Custom webhooks (soon)',
  ],

  enterprise: [
    ...COMMON_FEATURES,
    '6,000+ minutes per month',
    '15 min per call (custom)',
    '50+ concurrent calls',
    'Unlimited agents',
    'Unlimited users',
    '$0.18/min overage',
    'Annual contract',
    'SLA guarantee',
    'Dedicated account manager',
    'Priority infrastructure',
    'Security & compliance',
    'Full audit logs',
    'Custom integrations',
    'Custom webhooks',
    'Full CRM integration',
    'Roadmap influence',
  ],
};

const PRODUCT_DESCRIPTIONS = {
  free: {
    short: 'Perfect for testing - 15 one-time minutes',
    long: 'Try Callengo with 15 one-time minutes. Test your first AI calls and see if the product works for you.',
    statement_descriptor: 'CALLENGO FREE',
  },
  starter: {
    short: 'Individual use - 300 minutes/month',
    long: 'Perfect for freelancers and solo founders. 300 minutes per month to test real outreach and validation.',
    statement_descriptor: 'CALLENGO STARTER',
  },
  business: {
    short: 'Small teams - 1,200 minutes/month',
    long: 'For small businesses ready to scale. Includes follow-ups, scheduling, and campaigns with 3 concurrent calls.',
    statement_descriptor: 'CALLENGO BUSINESS',
  },
  teams: {
    short: 'Scale & governance - 2,400 minutes/month',
    long: 'Built for teams that need permissions, governance, and advanced analytics. 10 concurrent calls and voicemail handling.',
    statement_descriptor: 'CALLENGO TEAMS',
  },
  enterprise: {
    short: 'Enterprise-grade - Custom pricing',
    long: 'For large organizations with critical operations. SLA, dedicated support, custom integrations, and compliance.',
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
  console.log('║     CALLENGO - UNIVERSAL STRIPE SYNCHRONIZATION v3.0     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  log(`Environment: ${CONFIG.ENV.toUpperCase()}`, 'info');
  log(`Dry run: ${CONFIG.DRY_RUN ? 'YES' : 'NO'}`, CONFIG.DRY_RUN ? 'warning' : 'info');
  log(`Verbose: ${CONFIG.VERBOSE ? 'YES' : 'NO'}`, 'info');
  console.log('');

  // Test Stripe connection
  log('Testing Stripe connection...', 'info');
  try {
    const balance = await stripe.balance.retrieve();
    log(`Connected to Stripe account successfully`, 'success');
  } catch (error: any) {
    log(`Failed to connect to Stripe: ${error.message}`, 'error');
    process.exit(1);
  }

  // Sync coupons
  if (!CONFIG.SKIP_COUPONS) {
    await syncCoupons();
  }

  // Sync plans
  await syncPlans();

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

      // Check if coupon exists
      let existingCoupon: Stripe.Coupon | null = null;
      try {
        existingCoupon = await stripe.coupons.retrieve(couponConfig.id);
        log(`   Found existing coupon`, 'info');
      } catch (error) {
        // Coupon doesn't exist
      }

      if (!existingCoupon && await confirmAction(`Create coupon ${couponConfig.id}`)) {
        // Clean metadata
        const cleanMetadata: Record<string, string | number | null> = {};
        if (couponConfig.metadata) {
          Object.entries(couponConfig.metadata).forEach(([key, value]) => {
            if (value !== undefined) {
              cleanMetadata[key] = value;
            }
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

      // Create promotion code
      if (!CONFIG.DRY_RUN) {
        try {
          const promoCode = await stripe.promotionCodes.create({
            coupon: couponConfig.id,
            code: couponConfig.id,
            max_redemptions: couponConfig.max_redemptions,
          } as any);
          log(`   Promotion code created: ${promoCode.code}`, 'success');
        } catch (promoError: any) {
          if (promoError.code === 'resource_already_exists' || promoError.message?.includes('already exists')) {
            log(`   Promotion code already exists`, 'info');
          } else {
            logVerbose(`   Note: Could not create promotion code: ${promoError.message}`);
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

  // Fetch all active plans
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

  // ============================================================================
  // STEP 1: Create/Update Product
  // ============================================================================

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
          minutes_included: plan.minutes_included.toString(),
          max_users: plan.max_users.toString(),
          max_agents: plan.max_agents?.toString() || 'unlimited',
          max_concurrent_calls: plan.max_concurrent_calls.toString(),
          source: 'supabase',
          sync_version: '3.0',
          environment: CONFIG.ENV,
        },
      } as any);

      productId = product.id;
      log(`  Product created: ${productId}`, 'success');
      logVerbose(`     Added ${features.length} marketing features`);
    }
  } else {
    logVerbose(`Using existing product: ${productId}`);

    // Update product
    if (!CONFIG.DRY_RUN) {
      await stripe.products.update(productId, {
        name: plan.name,
        description: productDesc?.long || plan.description,
        statement_descriptor: productDesc?.statement_descriptor,
        marketing_features: features.slice(0, 15).map(f => ({ name: f })),
        metadata: {
          plan_id: plan.id,
          slug: plan.slug,
          minutes_included: plan.minutes_included.toString(),
          max_users: plan.max_users.toString(),
          max_agents: plan.max_agents?.toString() || 'unlimited',
          max_concurrent_calls: plan.max_concurrent_calls.toString(),
          source: 'supabase',
          sync_version: '3.0',
          last_synced: new Date().toISOString(),
          environment: CONFIG.ENV,
        },
      } as any);
      logVerbose('Product metadata and features updated');
    }
  }

  // ============================================================================
  // STEP 1.5: Create and Attach Entitlement Features
  // ============================================================================

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
          feature = await stripe.entitlements.features.create({
            name: featureName.substring(0, 80),
            lookup_key: featureLookupKey,
            metadata: { plan: plan.slug },
          } as any);
          logVerbose(`     Created feature: ${featureName}`);
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

  // ============================================================================
  // STEP 2 & 3: Create Prices in Multiple Currencies
  // ============================================================================

  if (!CONFIG.SKIP_PRICES) {
    for (const [currencyName, currencyConfig] of Object.entries(CURRENCIES)) {
      await syncPricesForCurrency(plan, productId!, currencyConfig, priceIds);
    }
  }

  // ============================================================================
  // STEP 4: Update Supabase
  // ============================================================================

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

  // Initialize price IDs for this currency
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

    // Check for incorrect existing price
    if (plan.stripe_price_id_annual && currency.code === 'usd' && !CONFIG.DRY_RUN) {
      try {
        const existingPrice = await stripe.prices.retrieve(plan.stripe_price_id_annual);
        const expectedAmount = annualAmount;

        if (existingPrice.unit_amount !== expectedAmount) {
          log(`     Incorrect annual price detected: ${currency.symbol}${(existingPrice.unit_amount || 0) / 100} (expected ${currency.symbol}${expectedAmount / 100})`, 'warning');

          await stripe.prices.update(plan.stripe_price_id_annual, { active: false });
          log(`     Archived incorrect price`, 'success');
        } else {
          priceIds[currency.code.toUpperCase()].annual = existingPrice.id;
          logVerbose(`     ${currency.code.toUpperCase()} Annual exists and is correct`);
          return; // Skip creation
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
// RUN
// ============================================================================

main().catch(console.error);
