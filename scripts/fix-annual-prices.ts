#!/usr/bin/env tsx
/**
 * One-time migration script to fix incorrect annual prices in Stripe
 *
 * Problem: Annual prices show monthly amount instead of yearly total
 * Example: Starter shows $89/year instead of $1,068/year ($89/mo × 12)
 *
 * This script:
 * 1. Retrieves all subscription plans from Supabase
 * 2. For each plan with annual pricing:
 *    - Archives the incorrect price in Stripe
 *    - Creates a new price with correct yearly amount (monthly × 12)
 *    - Updates Supabase with new price ID
 *
 * Safe to run multiple times - checks for correct amounts before making changes
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

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

interface Plan {
  id: string;
  name: string;
  slug: string;
  price_monthly: string;
  price_annual: string;
  stripe_product_id: string | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_annual: string | null;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     FIX INCORRECT ANNUAL PRICES - MIGRATION SCRIPT      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Fetch all active plans
  const { data: plans, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (error) {
    console.error('❌ Error fetching plans:', error);
    process.exit(1);
  }

  if (!plans || plans.length === 0) {
    console.log('No plans found');
    return;
  }

  console.log(`Found ${plans.length} active plans\n`);

  let fixedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const plan of plans as Plan[]) {
    console.log(`\n📦 ${plan.name} (${plan.slug})`);
    console.log('─'.repeat(60));

    const priceAnnual = parseFloat(plan.price_annual);
    const priceMonthly = parseFloat(plan.price_monthly);

    // Skip if no annual price
    if (priceAnnual === 0) {
      console.log('   ℹ️  No annual pricing - skipped');
      skippedCount++;
      continue;
    }

    // Skip if no Stripe price ID
    if (!plan.stripe_price_id_annual) {
      console.log('   ℹ️  No Stripe annual price ID - skipped');
      skippedCount++;
      continue;
    }

    try {
      // Retrieve existing price from Stripe
      const existingPrice = await stripe.prices.retrieve(plan.stripe_price_id_annual);

      const currentAmount = existingPrice.unit_amount || 0;
      const expectedAmount = Math.round(priceAnnual * 12 * 100);
      const currentAmountDollars = currentAmount / 100;
      const expectedAmountDollars = expectedAmount / 100;

      console.log(`   Current:  $${currentAmountDollars}/year`);
      console.log(`   Expected: $${expectedAmountDollars}/year ($${priceAnnual}/mo × 12)`);

      // Check if price is correct
      if (currentAmount === expectedAmount) {
        console.log('   ✅ Price is correct - no action needed');
        skippedCount++;
        continue;
      }

      // Price is incorrect - archive and recreate
      console.log(`   ⚠️  Price is INCORRECT by $${Math.abs(currentAmountDollars - expectedAmountDollars)}`);

      // Archive old price
      console.log('   📦 Archiving incorrect price...');
      await stripe.prices.update(plan.stripe_price_id_annual, {
        active: false,
      });
      console.log('   ✅ Old price archived');

      // Create new price with correct amount
      console.log('   🆕 Creating new price...');
      const newPrice = await stripe.prices.create({
        product: plan.stripe_product_id!,
        currency: 'usd',
        unit_amount: expectedAmount,
        recurring: {
          interval: 'year',
        },
        nickname: `${plan.name} - Annual`,
        tax_behavior: 'exclusive',
        metadata: {
          plan_id: plan.id,
          billing_cycle: 'annual',
          plan_slug: plan.slug,
          monthly_equivalent: priceAnnual.toString(),
          savings: Math.round(((priceMonthly * 12 - priceAnnual * 12) / (priceMonthly * 12)) * 100) + '%',
          migrated_from: plan.stripe_price_id_annual,
          migration_date: new Date().toISOString(),
        },
      });

      console.log(`   ✅ New price created: ${newPrice.id}`);
      console.log(`      Amount: $${expectedAmountDollars}/year ($${priceAnnual}/mo)`);

      // Update Supabase with new price ID
      console.log('   💾 Updating database...');
      const { error: updateError } = await supabase
        .from('subscription_plans')
        .update({
          stripe_price_id_annual: newPrice.id,
        })
        .eq('id', plan.id);

      if (updateError) {
        console.error('   ❌ Error updating database:', updateError);
        errorCount++;
      } else {
        console.log('   ✅ Database updated');
        fixedCount++;
      }

    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      errorCount++;
    }
  }

  // Summary
  console.log('\n\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                    MIGRATION SUMMARY                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log(`✅ Fixed:   ${fixedCount} plans`);
  console.log(`⏭️  Skipped: ${skippedCount} plans`);
  console.log(`❌ Errors:  ${errorCount} plans`);
  console.log('');

  if (fixedCount > 0) {
    console.log('🎉 Annual prices have been corrected!');
    console.log('\nNext steps:');
    console.log('1. Go to Stripe Dashboard → Products');
    console.log('2. Verify the new annual prices show correct amounts');
    console.log('3. Old prices are archived but still work for existing subscriptions\n');
  }
}

main().catch(console.error);
