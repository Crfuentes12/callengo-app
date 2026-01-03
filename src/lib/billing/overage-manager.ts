/**
 * Overage Manager Service
 * Manages metered billing and overage functionality with Stripe
 */

import { stripe, createMeteredPrice } from '../stripe';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Enable overage for a subscription
 * This adds a metered price item to the existing subscription
 */
export async function enableOverage(params: {
  companyId: string;
  budget?: number;
}): Promise<void> {
  const { companyId, budget } = params;

  try {
    // Get company subscription
    const { data: subscription, error: subError } = await supabase
      .from('company_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('company_id', companyId)
      .single();

    if (subError || !subscription) {
      throw new Error('Subscription not found');
    }

    if (!subscription.stripe_subscription_id) {
      throw new Error('No Stripe subscription found');
    }

    // Check if plan has metered price configured
    let meteredPriceId = subscription.subscription_plans?.stripe_metered_price_id;

    // If no metered price exists, create one
    if (!meteredPriceId && subscription.subscription_plans?.stripe_product_id) {
      const pricePerMinute = subscription.subscription_plans?.price_per_extra_minute || 0;

      const meteredPrice = await createMeteredPrice({
        productId: subscription.subscription_plans.stripe_product_id,
        unitAmount: Math.round(pricePerMinute * 100), // Convert to cents
        nickname: `${subscription.subscription_plans.name} - Overage`,
      });

      meteredPriceId = meteredPrice.id;

      // Save metered price ID to plan
      await supabase
        .from('subscription_plans')
        .update({ stripe_metered_price_id: meteredPriceId })
        .eq('id', subscription.plan_id);
    }

    if (!meteredPriceId) {
      throw new Error('Failed to create or find metered price');
    }

    // Add metered price to subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id
    );

    // Check if metered item already exists
    const existingMeteredItem = stripeSubscription.items.data.find(
      (item) => item.price.id === meteredPriceId
    );

    let subscriptionItemId: string;

    if (!existingMeteredItem) {
      // Add metered billing item to subscription
      const updatedSubscription = await stripe.subscriptions.update(
        subscription.stripe_subscription_id,
        {
          items: [
            ...stripeSubscription.items.data.map((item) => ({ id: item.id })),
            { price: meteredPriceId },
          ],
          proration_behavior: 'none', // Don't charge for enabling overage
        }
      );

      const meteredItem = updatedSubscription.items.data.find(
        (item) => item.price.id === meteredPriceId
      );

      if (!meteredItem) {
        throw new Error('Failed to add metered item to subscription');
      }

      subscriptionItemId = meteredItem.id;
    } else {
      subscriptionItemId = existingMeteredItem.id;
    }

    // Update database
    await supabase
      .from('company_subscriptions')
      .update({
        overage_enabled: true,
        overage_budget: budget,
        stripe_subscription_item_id: subscriptionItemId,
      })
      .eq('id', subscription.id);

    // Log event
    await supabase.from('billing_events').insert({
      company_id: companyId,
      subscription_id: subscription.id,
      event_type: 'overage_enabled',
      event_data: {
        budget,
        price_per_minute: subscription.subscription_plans?.price_per_extra_minute,
      },
      minutes_consumed: 0,
      cost_usd: 0,
    });

    console.log(`✅ Overage enabled for company ${companyId}`);
  } catch (error) {
    console.error('Error enabling overage:', error);
    throw error;
  }
}

/**
 * Disable overage for a subscription
 * Removes the metered price item from the subscription
 */
export async function disableOverage(companyId: string): Promise<void> {
  try {
    // Get company subscription
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (!subscription.stripe_subscription_id) {
      throw new Error('No Stripe subscription found');
    }

    // Remove metered item from Stripe subscription
    if (subscription.stripe_subscription_item_id) {
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripe_subscription_id
      );

      // Remove the metered item
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        items: stripeSubscription.items.data
          .filter((item) => item.id !== subscription.stripe_subscription_item_id)
          .map((item) => ({ id: item.id })),
        proration_behavior: 'none',
      });
    }

    // Update database
    await supabase
      .from('company_subscriptions')
      .update({
        overage_enabled: false,
        overage_budget: null,
        overage_spent: 0,
        stripe_subscription_item_id: null,
        last_overage_alert_at: null,
        overage_alert_level: 0,
      })
      .eq('id', subscription.id);

    // Log event
    await supabase.from('billing_events').insert({
      company_id: companyId,
      subscription_id: subscription.id,
      event_type: 'overage_disabled',
      event_data: {},
      minutes_consumed: 0,
      cost_usd: 0,
    });

    console.log(`✅ Overage disabled for company ${companyId}`);
  } catch (error) {
    console.error('Error disabling overage:', error);
    throw error;
  }
}

/**
 * Update overage budget
 */
export async function updateOverageBudget(params: {
  companyId: string;
  budget: number;
}): Promise<void> {
  const { companyId, budget } = params;

  try {
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Update budget
    await supabase
      .from('company_subscriptions')
      .update({ overage_budget: budget })
      .eq('id', subscription.id);

    // Log event
    await supabase.from('billing_events').insert({
      company_id: companyId,
      subscription_id: subscription.id,
      event_type: 'overage_budget_updated',
      event_data: {
        old_budget: subscription.overage_budget,
        new_budget: budget,
      },
      minutes_consumed: 0,
      cost_usd: 0,
    });

    console.log(`✅ Overage budget updated for company ${companyId}: $${budget}`);
  } catch (error) {
    console.error('Error updating overage budget:', error);
    throw error;
  }
}

/**
 * Sync metered usage to Stripe for all active subscriptions
 * This should be run periodically (e.g., daily) to ensure Stripe has up-to-date usage
 */
export async function syncAllMeteredUsage(): Promise<void> {
  try {
    // Get all subscriptions with overage enabled
    const { data: subscriptions, error } = await supabase
      .from('company_subscriptions')
      .select('*, subscription_plans(*), usage_tracking(*)')
      .eq('overage_enabled', true)
      .not('stripe_subscription_item_id', 'is', null);

    if (error || !subscriptions) {
      console.error('Error fetching subscriptions:', error);
      return;
    }

    console.log(`📊 Syncing metered usage for ${subscriptions.length} subscriptions`);

    for (const subscription of subscriptions) {
      try {
        // Get latest usage
        const { data: usage } = await supabase
          .from('usage_tracking')
          .select('*')
          .eq('subscription_id', subscription.id)
          .order('period_start', { ascending: false })
          .limit(1)
          .single();

        if (!usage) continue;

        const minutesIncluded = subscription.subscription_plans?.minutes_included || 0;
        const overageMinutes = Math.max(0, usage.minutes_used - minutesIncluded);

        if (overageMinutes > 0 && subscription.stripe_subscription_item_id) {
          // TODO: Update this to use new Stripe API v2025-12-15 metered billing
          // The createUsageRecord method has changed in Stripe API v20+
          console.log(
            `  ℹ️  Would sync ${overageMinutes} minutes for company ${subscription.company_id} (API update needed)`
          );
        }
      } catch (itemError) {
        console.error(
          `  ❌ Error syncing usage for subscription ${subscription.id}:`,
          itemError
        );
      }
    }

    console.log('✅ Metered usage sync completed');
  } catch (error) {
    console.error('Error syncing metered usage:', error);
  }
}
