/**
 * Script to synchronize subscription plans from Supabase to Stripe
 *
 * This script:
 * 1. Fetches all active subscription plans from Supabase
 * 2. Creates corresponding products in Stripe
 * 3. Creates prices for monthly and annual billing
 * 4. Updates Supabase with Stripe IDs
 *
 * Run with: npx tsx scripts/sync-stripe-plans.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { stripe, createProduct, createRecurringPrice } from '../src/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../src/types/supabase';

// Validate environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
}

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_annual: number;
  minutes_included: number;
  max_users: number;
  features: any;
  stripe_product_id?: string | null;
  stripe_price_id_monthly?: string | null;
  stripe_price_id_annual?: string | null;
}

async function syncPlansToStripe() {
  console.log('🚀 Starting Stripe plans synchronization...\n');

  // Fetch all active plans from Supabase
  const { data: plans, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (error) {
    console.error('❌ Error fetching plans from Supabase:', error);
    throw error;
  }

  if (!plans || plans.length === 0) {
    console.log('⚠️  No active plans found in Supabase');
    return;
  }

  console.log(`📋 Found ${plans.length} active plans to sync\n`);

  for (const plan of plans) {
    console.log(`\n📦 Processing plan: ${plan.name} (${plan.slug})`);

    try {
      let productId = plan.stripe_product_id;
      let priceIdMonthly = plan.stripe_price_id_monthly;
      let priceIdAnnual = plan.stripe_price_id_annual;

      // Create or update Stripe product
      if (!productId) {
        console.log('  → Creating new product in Stripe...');
        const product = await createProduct({
          name: plan.name,
          description: plan.description || `${plan.name} subscription plan`,
          metadata: {
            plan_id: plan.id,
            slug: plan.slug,
            minutes_included: plan.minutes_included.toString(),
            max_users: plan.max_users.toString(),
          },
        });
        productId = product.id;
        console.log(`  ✅ Product created: ${productId}`);
      } else {
        console.log(`  ℹ️  Using existing product: ${productId}`);
        // Update product metadata
        await stripe.products.update(productId, {
          name: plan.name,
          description: plan.description || `${plan.name} subscription plan`,
          metadata: {
            plan_id: plan.id,
            slug: plan.slug,
            minutes_included: plan.minutes_included.toString(),
            max_users: plan.max_users.toString(),
          },
        });
      }

      // Create monthly price if not exists
      if (!priceIdMonthly && plan.price_monthly > 0) {
        console.log('  → Creating monthly price...');
        const price = await createRecurringPrice({
          productId,
          unitAmount: Math.round(plan.price_monthly * 100), // Convert to cents
          interval: 'month',
          nickname: `${plan.name} - Monthly`,
        });
        priceIdMonthly = price.id;
        console.log(`  ✅ Monthly price created: ${priceIdMonthly} ($${plan.price_monthly}/mo)`);
      } else if (priceIdMonthly) {
        console.log(`  ℹ️  Monthly price exists: ${priceIdMonthly}`);
      } else {
        console.log('  ⏭️  Skipping monthly price (free plan)');
      }

      // Create annual price if not exists
      if (!priceIdAnnual && plan.price_annual > 0) {
        console.log('  → Creating annual price...');
        const price = await createRecurringPrice({
          productId,
          unitAmount: Math.round(plan.price_annual * 100), // Convert to cents
          interval: 'year',
          nickname: `${plan.name} - Annual`,
        });
        priceIdAnnual = price.id;
        console.log(`  ✅ Annual price created: ${priceIdAnnual} ($${plan.price_annual}/yr)`);
      } else if (priceIdAnnual) {
        console.log(`  ℹ️  Annual price exists: ${priceIdAnnual}`);
      } else {
        console.log('  ⏭️  Skipping annual price (free plan)');
      }

      // Update Supabase with Stripe IDs
      const { error: updateError } = await supabase
        .from('subscription_plans')
        .update({
          stripe_product_id: productId,
          stripe_price_id_monthly: priceIdMonthly,
          stripe_price_id_annual: priceIdAnnual,
        })
        .eq('id', plan.id);

      if (updateError) {
        console.error(`  ❌ Error updating plan in Supabase:`, updateError);
      } else {
        console.log(`  ✅ Supabase updated with Stripe IDs`);
      }

      console.log(`\n✅ Completed: ${plan.name}`);
    } catch (error) {
      console.error(`\n❌ Error processing plan ${plan.name}:`, error);
    }
  }

  console.log('\n\n🎉 Stripe plans synchronization completed!\n');
}

// Run the sync
syncPlansToStripe()
  .then(() => {
    console.log('✨ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
