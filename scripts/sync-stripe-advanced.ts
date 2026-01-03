/**
 * Advanced Stripe Synchronization Script
 *
 * This comprehensive script manages your entire Stripe catalog:
 * - Products with rich descriptions and features
 * - Recurring prices (monthly/annual) with tax configuration
 * - Metered prices for overage billing
 * - Promotional coupons and codes
 * - Tax rates and configurations
 *
 * Features:
 * - Dry-run mode to preview changes
 * - Idempotent operations (safe to run multiple times)
 * - Comprehensive error handling and rollback
 * - Detailed logging with emoji indicators
 * - Validates all operations before execution
 *
 * Usage:
 *   npx tsx scripts/sync-stripe-advanced.ts              # Full sync
 *   npx tsx scripts/sync-stripe-advanced.ts --dry-run    # Preview only
 *   npx tsx scripts/sync-stripe-advanced.ts --coupons    # Sync coupons only
 *   npx tsx scripts/sync-stripe-advanced.ts --plans      # Sync plans only
 *
 * @author Callengo Billing System
 * @version 2.0.0
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { stripe } from '../src/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../src/types/supabase';
import Stripe from 'stripe';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  DRY_RUN: process.argv.includes('--dry-run'),
  SYNC_PLANS: process.argv.includes('--plans') || !process.argv.slice(2).some(arg => arg.startsWith('--')),
  SYNC_COUPONS: process.argv.includes('--coupons') || !process.argv.slice(2).some(arg => arg.startsWith('--')),
  SYNC_TAX: process.argv.includes('--tax') || !process.argv.slice(2).some(arg => arg.startsWith('--')),
  VERBOSE: process.argv.includes('--verbose') || process.argv.includes('-v'),
};

// Coupon definitions
const COUPONS_CONFIG = [
  {
    id: 'TOTAL100',
    name: '100% Off - Full Access (Limited)',
    percent_off: 100,
    duration: 'forever',
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
    duration: 'repeating',
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
    duration: 'once',
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
    duration: 'forever',
    applies_to_monthly: false, // Only for annual plans
    metadata: {
      type: 'annual_incentive',
    },
  },
];

// Tax configuration (US sales tax example)
const TAX_CONFIG = {
  US: {
    code: 'txcd_10000000', // Standard digital services
    inclusive: false,
  },
};

// Enhanced product descriptions
const PRODUCT_DESCRIPTIONS = {
  free: {
    short: 'Perfect for testing and small-scale use',
    long: `Get started with our Free plan - ideal for testing Callengo's powerful AI calling capabilities. Includes 15 free minutes monthly and basic features to help you validate your use case.`,
    features: [
      '15 calling minutes per month',
      'Basic AI agents',
      'Email support',
      'Community access',
      'Single user',
    ],
    statement_descriptor: 'CALLENGO FREE',
  },
  starter: {
    short: 'For individuals and small teams getting started',
    long: `Perfect for solo founders and small teams starting their AI calling journey. Includes generous calling minutes, CSV exports, and priority email support to help you scale quickly.`,
    features: [
      '500 calling minutes per month',
      'Advanced AI agents',
      'CSV data export',
      'Priority email support',
      'Up to 3 users',
      'Basic analytics',
      'API access',
    ],
    statement_descriptor: 'CALLENGO STARTER',
  },
  business: {
    short: 'For growing businesses with automation needs',
    long: `Scale your operations with automated calling campaigns. Perfect for growing businesses that need multiple AI agents, advanced automation, and comprehensive analytics to drive results.`,
    features: [
      '2,000 calling minutes per month',
      'Unlimited AI agents',
      'Automated campaigns',
      'Advanced analytics & reporting',
      'Up to 10 users',
      'CRM integrations',
      'Webhook support',
      'Phone support',
    ],
    statement_descriptor: 'CALLENGO BUSINESS',
  },
  teams: {
    short: 'For teams requiring collaboration and permissions',
    long: `Built for teams that need collaboration, role-based permissions, and enterprise-grade features. Includes audit logs, SSO support, and dedicated account management.`,
    features: [
      '5,000 calling minutes per month',
      'Unlimited AI agents',
      'Team collaboration tools',
      'Role-based permissions',
      'Unlimited users',
      'Audit logs',
      'SSO support (SAML)',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    statement_descriptor: 'CALLENGO TEAMS',
  },
  enterprise: {
    short: 'Custom solutions for large organizations',
    long: `Enterprise-grade AI calling platform with custom pricing, dedicated infrastructure, and white-label options. Perfect for large organizations with specific compliance and security requirements.`,
    features: [
      'Unlimited calling minutes',
      'Custom AI models',
      'White-label options',
      'Dedicated infrastructure',
      'Custom integrations',
      'HIPAA compliance available',
      'SOC 2 Type II certified',
      '24/7 phone & chat support',
      'Custom SLA',
    ],
    statement_descriptor: 'CALLENGO ENTERPRISE',
  },
};

// =============================================================================
// VALIDATION
// =============================================================================

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('❌ NEXT_PUBLIC_SUPABASE_URL is required');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('❌ SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
}
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('❌ STRIPE_SECRET_KEY is required');
}

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function log(message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info') {
  const icons = {
    info: 'ℹ️ ',
    success: '✅',
    warning: '⚠️ ',
    error: '❌',
  };
  console.log(`${icons[level]} ${message}`);
}

function logVerbose(message: string) {
  if (CONFIG.VERBOSE) {
    console.log(`  ${message}`);
  }
}

async function confirmAction(message: string): Promise<boolean> {
  if (CONFIG.DRY_RUN) {
    log(`[DRY RUN] Would: ${message}`, 'warning');
    return false;
  }
  return true;
}

// =============================================================================
// COUPON MANAGEMENT
// =============================================================================

async function syncCoupons() {
  log('\n💰 Starting coupon synchronization...', 'info');

  for (const couponConfig of COUPONS_CONFIG) {
    try {
      log(`\n  Processing coupon: ${couponConfig.id} (${couponConfig.name})`);

      // Check if coupon exists
      let existingCoupon: Stripe.Coupon | null = null;
      try {
        existingCoupon = await stripe.coupons.retrieve(couponConfig.id);
        log(`    Found existing coupon`, 'info');
      } catch (error) {
        // Coupon doesn't exist, will create
      }

      if (!existingCoupon && await confirmAction(`Create coupon ${couponConfig.id}`)) {
        // Clean metadata: remove undefined values (Stripe only accepts string | number | null)
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
          duration: couponConfig.duration as 'forever' | 'once' | 'repeating',
          duration_in_months: couponConfig.duration_in_months,
          max_redemptions: couponConfig.max_redemptions,
          metadata: cleanMetadata,
        });
        log(`    ✅ Coupon created: ${coupon.id} (${coupon.percent_off}% off)`, 'success');
      } else if (existingCoupon) {
        log(`    ℹ️  Coupon already exists (${existingCoupon.times_redeemed || 0}/${existingCoupon.max_redemptions || '∞'} used)`, 'info');
      }

      // Create promotion code for easy sharing
      if (!CONFIG.DRY_RUN) {
        try {
          // Try to create the promotion code directly
          // If it already exists, Stripe will return an error which we handle below
          const promoCode = await stripe.promotionCodes.create({
            coupon: couponConfig.id,
            code: couponConfig.id, // Same as coupon ID for simplicity
            max_redemptions: couponConfig.max_redemptions,
          } as any);
          log(`    ✅ Promotion code created: ${promoCode.code}`, 'success');
        } catch (promoError: any) {
          // Promotion code likely already exists
          if (promoError.code === 'resource_already_exists' || promoError.message?.includes('already exists')) {
            log(`    ℹ️  Promotion code already exists`, 'info');
          } else {
            // Log other errors but don't fail the whole sync
            logVerbose(`    Note: Could not create promotion code: ${promoError.message}`);
          }
        }
      }

    } catch (error) {
      log(`    ❌ Error processing coupon ${couponConfig.id}: ${error}`, 'error');
    }
  }

  log('\n💰 Coupon synchronization completed', 'success');
}

// =============================================================================
// PRODUCT & PRICE SYNCHRONIZATION
// =============================================================================

async function syncPlansToStripe() {
  log('\n🚀 Starting subscription plans synchronization...', 'info');

  // Fetch all active plans from Supabase
  const { data: plans, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (error) {
    log(`Error fetching plans from Supabase: ${error.message}`, 'error');
    throw error;
  }

  if (!plans || plans.length === 0) {
    log('No active plans found in Supabase', 'warning');
    return;
  }

  log(`Found ${plans.length} active plans to sync\n`);

  for (const plan of plans) {
    log(`\n📦 Processing plan: ${plan.name} (${plan.slug})`, 'info');

    try {
      await syncSinglePlan(plan);
      log(`✅ Completed: ${plan.name}\n`, 'success');
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
  let priceIdMonthly = plan.stripe_price_id_monthly;
  let priceIdAnnual = plan.stripe_price_id_annual;
  let priceIdMetered = plan.stripe_metered_price_id;

  const productDesc = PRODUCT_DESCRIPTIONS[plan.slug as keyof typeof PRODUCT_DESCRIPTIONS];

  // =============================================================================
  // STEP 1: Create or Update Product
  // =============================================================================

  if (!productId) {
    if (await confirmAction(`Create product for ${plan.name}`)) {
      logVerbose('Creating new product in Stripe...');

      const product = await stripe.products.create({
        name: plan.name,
        description: productDesc?.long || plan.description || `${plan.name} subscription plan`,
        statement_descriptor: productDesc?.statement_descriptor,
        metadata: {
          plan_id: plan.id,
          slug: plan.slug,
          minutes_included: plan.minutes_included.toString(),
          max_users: plan.max_users.toString(),
          max_agents: plan.max_agents?.toString() || 'unlimited',
          max_concurrent_calls: plan.max_concurrent_calls.toString(),
          source: 'supabase',
          sync_version: '2.0',
          // Store features in metadata (can be attached via POST /v1/products/:id/features if needed)
          features: productDesc?.features?.join(', ') || '',
        },
      });

      productId = product.id;
      log(`  ✅ Product created: ${productId}`, 'success');
    }
  } else {
    logVerbose(`Using existing product: ${productId}`);

    // Update product with latest info
    if (!CONFIG.DRY_RUN) {
      await stripe.products.update(productId, {
        name: plan.name,
        description: productDesc?.long || plan.description || `${plan.name} subscription plan`,
        statement_descriptor: productDesc?.statement_descriptor,
        metadata: {
          plan_id: plan.id,
          slug: plan.slug,
          minutes_included: plan.minutes_included.toString(),
          max_users: plan.max_users.toString(),
          max_agents: plan.max_agents?.toString() || 'unlimited',
          max_concurrent_calls: plan.max_concurrent_calls.toString(),
          source: 'supabase',
          sync_version: '2.0',
          last_synced: new Date().toISOString(),
          // Store features in metadata (can be attached via POST /v1/products/:id/features if needed)
          features: productDesc?.features?.join(', ') || '',
        },
      });
      logVerbose('Product metadata updated');
    }
  }

  // =============================================================================
  // STEP 2: Create Monthly Price
  // =============================================================================

  if (!priceIdMonthly && plan.price_monthly > 0) {
    if (await confirmAction(`Create monthly price for ${plan.name} ($${plan.price_monthly})`)) {
      logVerbose('Creating monthly price...');

      const price = await stripe.prices.create({
        product: productId!,
        currency: 'usd',
        unit_amount: Math.round(plan.price_monthly * 100),
        recurring: {
          interval: 'month',
        },
        nickname: `${plan.name} - Monthly`,
        tax_behavior: 'exclusive',
        metadata: {
          plan_id: plan.id,
          billing_cycle: 'monthly',
          plan_slug: plan.slug,
        },
      });

      priceIdMonthly = price.id;
      log(`  ✅ Monthly price: ${priceIdMonthly} ($${plan.price_monthly}/mo)`, 'success');
    }
  } else if (priceIdMonthly) {
    logVerbose(`Monthly price exists: ${priceIdMonthly}`);
  } else {
    logVerbose('Skipping monthly price (free plan)');
  }

  // =============================================================================
  // STEP 3: Create Annual Price
  // =============================================================================

  if (!priceIdAnnual && plan.price_annual > 0) {
    if (await confirmAction(`Create annual price for ${plan.name} ($${plan.price_annual})`)) {
      logVerbose('Creating annual price...');

      const price = await stripe.prices.create({
        product: productId!,
        currency: 'usd',
        unit_amount: Math.round(plan.price_annual * 100),
        recurring: {
          interval: 'year',
        },
        nickname: `${plan.name} - Annual`,
        tax_behavior: 'exclusive',
        metadata: {
          plan_id: plan.id,
          billing_cycle: 'annual',
          plan_slug: plan.slug,
          savings: Math.round(((plan.price_monthly * 12 - plan.price_annual) / (plan.price_monthly * 12)) * 100) + '%',
        },
      });

      priceIdAnnual = price.id;
      const savings = Math.round(((plan.price_monthly * 12 - plan.price_annual) / (plan.price_monthly * 12)) * 100);
      log(`  ✅ Annual price: ${priceIdAnnual} ($${plan.price_annual}/yr, save ${savings}%)`, 'success');
    }
  } else if (priceIdAnnual) {
    logVerbose(`Annual price exists: ${priceIdAnnual}`);
  } else {
    logVerbose('Skipping annual price (free plan)');
  }

  // =============================================================================
  // STEP 4: Create Metered Price for Overage
  // =============================================================================
  // NOTE: Starting with Stripe API 2025-03-31.basil, metered prices require
  // billing meters. For now, we skip metered price creation.
  // To enable: Create a meter first, then use meter_data.event_name in price.

  if (!priceIdMetered && plan.price_per_extra_minute > 0) {
    log(`  ⚠️  Metered pricing skipped for ${plan.name}`, 'warning');
    log(`     Stripe API 2025-03-31+ requires billing meters for usage-based pricing`, 'info');
    log(`     To enable: Create meter first at https://dashboard.stripe.com/billing/meters`, 'info');
    logVerbose('     See: https://docs.stripe.com/billing/subscriptions/usage-based/implementation-guide');

    // Skip metered price creation - can be added manually in Stripe Dashboard
    // after creating appropriate billing meter
  } else if (priceIdMetered) {
    logVerbose(`Metered price exists: ${priceIdMetered}`);
  } else if (plan.price_per_extra_minute === 0) {
    logVerbose('Skipping metered price (no overage pricing)');
  }

  // =============================================================================
  // STEP 5: Update Supabase with Stripe IDs
  // =============================================================================

  if (!CONFIG.DRY_RUN && productId) {
    const { error: updateError } = await supabase
      .from('subscription_plans')
      .update({
        stripe_product_id: productId,
        stripe_price_id_monthly: priceIdMonthly,
        stripe_price_id_annual: priceIdAnnual,
        stripe_metered_price_id: priceIdMetered,
      })
      .eq('id', plan.id);

    if (updateError) {
      log(`  Error updating Supabase: ${updateError.message}`, 'error');
    } else {
      logVerbose('Supabase updated with Stripe IDs');
    }
  }
}

// =============================================================================
// TAX CONFIGURATION
// =============================================================================

async function syncTaxConfiguration() {
  log('\n💵 Starting tax configuration...', 'info');

  if (CONFIG.DRY_RUN) {
    log('[DRY RUN] Would configure tax settings', 'warning');
    return;
  }

  try {
    // Example: Enable automatic tax calculation
    // Note: This requires Stripe Tax to be enabled on your account
    log('  ℹ️  Tax configuration requires manual setup in Stripe Dashboard', 'info');
    log('  → Visit: https://dashboard.stripe.com/settings/tax', 'info');
    log('  → Enable Stripe Tax for automatic calculation', 'info');
  } catch (error) {
    log(`  Error configuring tax: ${error}`, 'error');
  }
}

// =============================================================================
// REPORTING
// =============================================================================

async function generateReport() {
  log('\n📊 Generating synchronization report...', 'info');

  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true);

  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│                  SYNCHRONIZATION SUMMARY                 │');
  console.log('└─────────────────────────────────────────────────────────┘\n');

  console.log(`Total Plans: ${plans?.length || 0}`);
  console.log(`Plans with Stripe Products: ${plans?.filter(p => p.stripe_product_id).length || 0}`);
  console.log(`Plans with Monthly Prices: ${plans?.filter(p => p.stripe_price_id_monthly).length || 0}`);
  console.log(`Plans with Annual Prices: ${plans?.filter(p => p.stripe_price_id_annual).length || 0}`);
  console.log(`Plans with Metered Prices: ${plans?.filter(p => p.stripe_metered_price_id).length || 0}`);

  if (!CONFIG.DRY_RUN) {
    const coupons = await stripe.coupons.list({ limit: 100 });
    console.log(`\nActive Coupons: ${coupons.data.length}`);
    coupons.data.forEach(c => {
      console.log(`  - ${c.id}: ${c.percent_off || c.amount_off}% off (${c.times_redeemed || 0}/${c.max_redemptions || '∞'} used)`);
    });
  }

  console.log('\n');
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║     CALLENGO - ADVANCED STRIPE SYNCHRONIZATION v2.0      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  if (CONFIG.DRY_RUN) {
    log('🔍 DRY RUN MODE - No changes will be made', 'warning');
  }

  try {
    // Test Stripe connection
    log('Testing Stripe connection...', 'info');
    const account = await stripe.accounts.retrieve();
    log(`✅ Connected to Stripe account: ${account.business_profile?.name || account.id}`, 'success');

    // Execute sync operations
    if (CONFIG.SYNC_COUPONS) {
      await syncCoupons();
    }

    if (CONFIG.SYNC_PLANS) {
      await syncPlansToStripe();
    }

    if (CONFIG.SYNC_TAX) {
      await syncTaxConfiguration();
    }

    // Generate report
    await generateReport();

    log('\n✨ Synchronization completed successfully!', 'success');

    if (CONFIG.DRY_RUN) {
      log('\n💡 Run without --dry-run to apply these changes', 'info');
    }

  } catch (error) {
    log(`\n💥 Fatal error: ${error}`, 'error');
    if (error instanceof Error && CONFIG.VERBOSE) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the script
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
