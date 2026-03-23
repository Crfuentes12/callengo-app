import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase, supabaseAdminRaw } from '@/lib/supabase/service';
import { verifyWebhookSignature, stripe } from '@/lib/stripe';
import Stripe from 'stripe';
import { trackServerEvent } from '@/lib/analytics';
import { captureServerEvent } from '@/lib/posthog-server';
import {
  updateContactPlan,
  closeWonDeal,
  createTaskForContact,
  logProductEvent,
  hsEventName,
} from '@/lib/hubspot-user-sync';
import {
  createBlandSubAccount,
  allocateBlandCredits,
  handleCycleRenewalCredits,
  handlePlanUpgradeCredits,
  deactivateBlandSubAccount,
} from '@/lib/bland/subaccount-manager';
import { resetUsageForNewPeriod } from '@/lib/billing/usage-tracker';

// Disable body parsing, need raw body for signature verification
export const dynamic = 'force-dynamic';

/**
 * Stripe Webhook Handler
 * Handles all Stripe webhook events
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing stripe-signature header');
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Verify webhook signature
    const event = verifyWebhookSignature(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log(`📨 Received Stripe webhook: ${event.type} [${event.id}]`);

    // ALTA-001: Atomic idempotency check using INSERT + unique constraint
    // Instead of check-then-insert (race-prone), attempt insert first
    const { error: insertEventError } = await supabase.from('stripe_events').insert({
      id: event.id,
      type: event.type,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: event.data as any,
      processed: false,
    });

    // If unique constraint violation (code 23505), event was already processed
    if (insertEventError) {
      if (insertEventError.code === '23505') {
        console.log(`⏭️  Event ${event.id} already processed, skipping`);
        return NextResponse.json({ received: true, skipped: true });
      }
      console.error('Failed to record Stripe event:', insertEventError);
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;

      default:
        console.log(`ℹ️  Unhandled event type: ${event.type}`);
    }

    // Mark event as processed
    await supabase
      .from('stripe_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('id', event.id);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed
 * Creates or updates subscription when checkout is completed
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('✅ Checkout completed:', session.id);

  const companyId = session.metadata?.company_id;
  const planId = session.metadata?.plan_id;
  const billingCycle = session.metadata?.billing_cycle === 'annual' ? 'annual' : 'monthly';
  const isAddon = session.metadata?.is_addon === 'true';
  const productType = session.metadata?.product_type;

  // Handle add-on purchases (don't require plan_id)
  if (companyId && isAddon) {
    const addonType = session.metadata?.addon_type;
    const addonQuantity = Math.max(1, parseInt(session.metadata?.quantity || '1', 10));
    console.log(`📦 Add-on checkout completed: ${addonType} x${addonQuantity} for company ${companyId}`);

    try {
      await supabaseAdminRaw.from('company_addons').insert({
        company_id: companyId,
        addon_type: addonType,
        quantity: addonQuantity,
        status: 'active',
        stripe_subscription_id: session.subscription as string || null,
      });
    } catch (addonError) {
      console.error('Failed to record add-on purchase:', addonError);
      throw new Error(`Failed to record add-on purchase: ${addonError instanceof Error ? addonError.message : 'Unknown error'}`);
    }
    return;
  }

  // Handle extra seat purchases (don't require plan_id)
  if (companyId && productType === 'extra_seat') {
    const seatQuantity = Math.max(1, parseInt(session.metadata?.quantity || '1', 10));
    console.log(`💺 Seat checkout completed: ${seatQuantity} seats for company ${companyId}`);

    try {
      // Atomic seat increment with optimistic locking to prevent race conditions.
      // Two concurrent seat purchases won't overwrite each other.
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: currentSub } = await supabase
          .from('company_subscriptions')
          .select('id, extra_users')
          .eq('company_id', companyId)
          .single();

        if (!currentSub) break;

        const currentSeats = currentSub.extra_users || 0;
        const { data: updated } = await supabase
          .from('company_subscriptions')
          .update({ extra_users: currentSeats + seatQuantity })
          .eq('id', currentSub.id)
          .eq('extra_users', currentSeats) // Optimistic lock: only update if value hasn't changed
          .select('id')
          .maybeSingle();

        if (updated) {
          console.log(`Seat increment success: ${currentSeats} -> ${currentSeats + seatQuantity}`);
          break; // Success
        }
        // Another request changed extra_users — retry
        if (attempt < 2) await new Promise(r => setTimeout(r, 100));
      }
    } catch (seatError) {
      console.error('Failed to record seat purchase:', seatError);
    }
    return;
  }

  if (!companyId || !planId) {
    console.error('Missing metadata in checkout session');
    return;
  }

  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  // Get plan details
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (!plan) {
    console.error('Plan not found:', planId);
    return;
  }

  // Use Stripe's actual subscription period dates instead of calculating from Date.now()
  // This prevents drift between Callengo and Stripe billing periods.
  let currentPeriodStart: Date;
  let currentPeriodEnd: Date;

  if (subscriptionId) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['items.data'] });
      const item = stripeSub.items?.data?.[0];
      if (item) {
        currentPeriodStart = new Date(item.current_period_start * 1000);
        currentPeriodEnd = new Date(item.current_period_end * 1000);
      } else {
        throw new Error('No subscription items found');
      }
    } catch (stripeErr) {
      console.warn('Failed to fetch Stripe subscription period, using calculated dates:', stripeErr);
      currentPeriodStart = new Date();
      currentPeriodEnd = new Date();
      if (billingCycle === 'annual') {
        currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
      } else {
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
      }
    }
  } else {
    currentPeriodStart = new Date();
    currentPeriodEnd = new Date();
    if (billingCycle === 'annual') {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    } else {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    }
  }

  // Update existing subscription record (use .update().eq() instead of upsert
  // because company_id may not have a UNIQUE constraint)
  const { data: updatedSub, error: subError } = await supabase
    .from('company_subscriptions')
    .update({
      plan_id: planId,
      billing_cycle: billingCycle,
      status: 'active',
      current_period_start: currentPeriodStart.toISOString(),
      current_period_end: currentPeriodEnd.toISOString(),
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
    })
    .eq('company_id', companyId)
    .select()
    .single();

  if (subError) {
    console.error('Error updating subscription:', subError);
    // If no existing record, try insert as fallback
    if (subError.code === 'PGRST116') {
      const { error: insertError } = await supabase
        .from('company_subscriptions')
        .insert({
          company_id: companyId,
          plan_id: planId,
          billing_cycle: billingCycle,
          status: 'active',
          current_period_start: currentPeriodStart.toISOString(),
          current_period_end: currentPeriodEnd.toISOString(),
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: customerId,
        });
      if (insertError) {
        console.error('Error inserting subscription:', insertError);
      }
    }
  }

  // Update or create usage tracking (omit computed columns: overage_minutes, total_cost)
  // FIX: If updatedSub is null (update failed), re-fetch the subscription to get the correct UUID.
  // Using the Stripe subscription ID (string like "sub_xxx") would fail as it's not a valid UUID FK.
  let subId = updatedSub?.id;
  if (!subId) {
    const { data: fetchedSub } = await supabase
      .from('company_subscriptions')
      .select('id')
      .eq('company_id', companyId)
      .single();
    subId = fetchedSub?.id;
  }

  if (!subId) {
    console.error('Could not determine subscription ID for usage tracking');
    return;
  }

  // Update existing usage record, or insert if none exists
  const { data: updatedUsage } = await supabase
    .from('usage_tracking')
    .update({
      subscription_id: subId,
      period_start: currentPeriodStart.toISOString(),
      period_end: currentPeriodEnd.toISOString(),
      minutes_used: 0,
      minutes_included: plan.minutes_included,
    })
    .eq('company_id', companyId)
    .select('id');

  // If no rows were updated (no existing record), insert one
  if (!updatedUsage || updatedUsage.length === 0) {
    await supabase.from('usage_tracking').insert({
      company_id: companyId,
      subscription_id: subId,
      period_start: currentPeriodStart.toISOString(),
      period_end: currentPeriodEnd.toISOString(),
      minutes_used: 0,
      minutes_included: plan.minutes_included,
    });
  }

  // ================================================================
  // AUDIT FIX: Create Bland sub-account and allocate credits after payment
  // This is the correct moment — Stripe has confirmed payment.
  // ================================================================
  if (plan.slug !== 'free') {
    try {
      // Get company name for sub-account
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single();

      await createBlandSubAccount(companyId, company?.name || `Company ${companyId}`);
      // FIX: Pass idempotency key to prevent double credit allocation on webhook retry
      await allocateBlandCredits(companyId, plan.minutes_included || 0, `checkout_${session.id}`);
    } catch (blandError) {
      // Log but don't fail the webhook — subscription is already active
      // The credits can be allocated manually or on next renewal
      console.error('⚠️ Bland sub-account setup failed (non-fatal):', blandError);
    }
  }

  // Log billing event for subscription creation
  const planAmount = billingCycle === 'annual' ? Number(plan.price_annual) : Number(plan.price_monthly);
  await supabase.from('billing_events').insert({
    company_id: companyId,
    subscription_id: subId,
    event_type: 'subscription_created',
    event_data: {
      plan: plan.slug,
      billing_cycle: billingCycle,
      amount: planAmount,
    },
    minutes_consumed: 0,
    cost_usd: planAmount,
  });

  // Check for promo code / discount on this subscription and log it
  if (subscriptionId) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['discounts.source.coupon'],
      });
      const firstDiscount = stripeSub.discounts?.[0];
      if (firstDiscount && typeof firstDiscount !== 'string') {
        const couponRef = firstDiscount.source?.coupon;
        const coupon = couponRef && typeof couponRef !== 'string' ? couponRef : null;
        const promoRef = firstDiscount.promotion_code;
        // Resolve promo code name
        let promoCodeName: string | null = null;
        if (promoRef) {
          if (typeof promoRef === 'string') {
            try {
              const pc = await stripe.promotionCodes.retrieve(promoRef);
              promoCodeName = pc.code;
            } catch { /* ignore */ }
          } else {
            promoCodeName = promoRef.code;
          }
        }

        let discountAmount = 0;
        if (coupon?.percent_off) {
          discountAmount = planAmount * (coupon.percent_off / 100);
        } else if (coupon?.amount_off) {
          discountAmount = Math.min(coupon.amount_off / 100, planAmount);
        }

        await supabase.from('billing_events').insert({
          company_id: companyId,
          subscription_id: subId,
          event_type: 'promo_code_applied',
          event_data: {
            promo_code: promoCodeName,
            coupon_name: coupon?.name || null,
            percent_off: coupon?.percent_off || null,
            amount_off: coupon?.amount_off ? coupon.amount_off / 100 : null,
            duration: coupon?.duration || null,
            duration_in_months: coupon?.duration_in_months || null,
            plan: plan.slug,
            plan_amount: planAmount,
            discount_amount: Math.round(discountAmount * 100) / 100,
          },
          minutes_consumed: 0,
          cost_usd: -Math.round(discountAmount * 100) / 100,
        });
      }
    } catch (promoErr) {
      console.error('[checkout] Failed to log promo code event:', promoErr);
    }
  }

  // GA4 server-side: subscription started
  trackServerEvent(companyId, null, 'server_subscription_started', {
    plan: plan.slug,
    billing_cycle: billingCycle,
    value: billingCycle === 'annual' ? Number(plan.price_annual) : Number(plan.price_monthly),
    currency: 'USD',
  });
  await captureServerEvent(companyId, 'server_subscription_started', {
    plan: plan.slug,
    billing_cycle: billingCycle,
    value: billingCycle === 'annual' ? Number(plan.price_annual) : Number(plan.price_monthly),
    currency: 'USD',
  }, { company: companyId });

  console.log('✅ Subscription created/updated for company:', companyId);
}

/**
 * Handle customer.subscription.created
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionCreated(subscription: Stripe.Subscription & Record<string, any>) {
  console.log('📝 Subscription created:', subscription.id);

  const companyId = subscription.metadata?.company_id;
  if (!companyId) {
    console.error('Missing company_id in subscription metadata');
    return;
  }

  // Get the metered subscription item (if any)
  const meteredItem = subscription.items?.data?.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (item: any) => item.price?.recurring?.usage_type === 'metered'
  );

  // Extract period dates - may vary by Stripe API version
  const periodStart = subscription.current_period_start || subscription.billing?.current_period_start;
  const periodEnd = subscription.current_period_end || subscription.billing?.current_period_end;

  await supabase
    .from('company_subscriptions')
    .update({
      stripe_subscription_id: subscription.id,
      stripe_subscription_item_id: meteredItem?.id || null,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : new Date().toISOString(),
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : new Date().toISOString(),
    })
    .eq('company_id', companyId);

  // --- HubSpot sync ---
  try {
    const customerId = subscription.customer as string;
    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
    const email = customer.email;
    if (email) {
      // Resolve plan slug from subscription metadata or DB
      const planSlug = subscription.metadata?.plan_slug || await getPlanSlugForSubscription(companyId);
      const priceItem = subscription.items?.data?.[0];
      const unitAmount = priceItem?.price?.unit_amount || 0;
      const interval = priceItem?.price?.recurring?.interval;
      // MRR = monthly amount; if annual, divide by 12
      const mrr = interval === 'year'
        ? String(Math.round((unitAmount / 100) / 12))
        : String(Math.round(unitAmount / 100));

      await updateContactPlan(email, planSlug, mrr, customerId);
      await closeWonDeal(email, planSlug, mrr);

      // PostHog: subscription_created event for HubSpot destination
      await captureServerEvent(companyId, 'subscription_created', {
        plan_name: planSlug,
        mrr: Number(mrr),
        stripe_customer_id: customerId,
      }, { company: companyId });
    }
  } catch (e) {
    console.error('[Stripe Webhook] HubSpot sync failed in subscription.created:', e);
  }
}

/**
 * Handle customer.subscription.updated
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionUpdated(subscription: Stripe.Subscription & Record<string, any>) {
  console.log('🔄 Subscription updated:', subscription.id);

  // Find subscription by Stripe ID (join plan for slug comparison)
  const { data: existingSub } = await supabase
    .from('company_subscriptions')
    .select('*, subscription_plans(slug)')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!existingSub) {
    console.error('Subscription not found:', subscription.id);
    return;
  }

  // Get the metered subscription item (if any)
  const meteredItem = subscription.items?.data?.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (item: any) => item.price?.recurring?.usage_type === 'metered'
  );

  // Extract period dates - may vary by Stripe API version
  const periodStart = subscription.current_period_start || subscription.billing?.current_period_start;
  const periodEnd = subscription.current_period_end || subscription.billing?.current_period_end;

  // Detect plan change by comparing plan_id from Stripe metadata
  const newPlanSlug = subscription.metadata?.plan_slug;
  const previousPlanSlug = subscription.metadata?.previous_plan_slug
    || (existingSub.subscription_plans as Record<string, unknown>)?.slug;
  const isPlanChange = newPlanSlug && previousPlanSlug && newPlanSlug !== previousPlanSlug;

  // Update subscription status
  const updateData: Record<string, unknown> = {
    status: subscription.status,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : new Date().toISOString(),
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : new Date().toISOString(),
    stripe_subscription_item_id: meteredItem?.id || null,
  };

  // AUDIT FIX: Reset overage tracking when plan changes (upgrade/downgrade)
  // to prevent old overage charges from persisting into the new plan period
  if (isPlanChange) {
    updateData.overage_spent = 0;
    updateData.last_overage_alert_at = null;
    updateData.overage_alert_level = 0;
    console.log(`✅ Overage reset on plan change: ${previousPlanSlug} → ${newPlanSlug} (company ${existingSub.company_id})`);
  }

  await supabase
    .from('company_subscriptions')
    .update(updateData)
    .eq('stripe_subscription_id', subscription.id);

  // Log billing event
  await supabase.from('billing_events').insert({
    company_id: existingSub.company_id,
    subscription_id: existingSub.id,
    event_type: 'subscription_updated',
    event_data: JSON.parse(JSON.stringify({
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
      plan_changed: isPlanChange || false,
      new_plan: newPlanSlug || null,
      previous_plan: previousPlanSlug || null,
    })),
    minutes_consumed: 0,
    cost_usd: 0,
  });

  // ================================================================
  // Bland credit reallocation on plan upgrade
  // Credits are redistributed WITHIN Bland (master → sub-account).
  // Stripe only handles customer payments — no money flows to Bland.
  // ================================================================
  try {
    const newPlanSlug = subscription.metadata?.plan_slug;
    const previousPlanSlug = subscription.metadata?.previous_plan_slug
      || existingSub.subscription_plans?.slug;

    if (newPlanSlug && previousPlanSlug && newPlanSlug !== previousPlanSlug) {
      // Fetch both plans to compare minutes
      const { data: oldPlan } = await supabase
        .from('subscription_plans')
        .select('minutes_included, slug')
        .eq('slug', previousPlanSlug)
        .single();

      const { data: newPlan } = await supabase
        .from('subscription_plans')
        .select('minutes_included, slug')
        .eq('slug', newPlanSlug)
        .single();

      if (oldPlan && newPlan && newPlan.slug !== 'free') {
        const oldMinutes = oldPlan.minutes_included || 0;
        const newMinutes = newPlan.minutes_included || 0;

        if (newMinutes > oldMinutes && periodStart && periodEnd) {
          // Upgrade: allocate pro-rated differential credits for remaining period
          const now = Date.now();
          const periodEndMs = periodEnd * 1000;
          const periodStartMs = periodStart * 1000;
          const totalDays = Math.ceil((periodEndMs - periodStartMs) / (1000 * 60 * 60 * 24));
          const remainingDays = Math.ceil((periodEndMs - now) / (1000 * 60 * 60 * 24));

          if (remainingDays > 0 && totalDays > 0) {
            await handlePlanUpgradeCredits(
              existingSub.company_id,
              oldMinutes,
              newMinutes,
              remainingDays,
              totalDays
            );
          }
        }
        // Downgrade: credits stay as-is until next renewal cycle
        // (reclaim + fresh allocation happens at invoice.payment_succeeded)

        // BIL-04: Flag if current minutes_used exceeds the new (lower) plan limit
        if (newMinutes < oldMinutes) {
          try {
            const now = new Date().toISOString();
            const { data: currentUsage } = await supabase
              .from('usage_tracking')
              .select('minutes_used')
              .eq('company_id', existingSub.company_id)
              .lte('period_start', now)
              .gte('period_end', now)
              .order('period_start', { ascending: false })
              .limit(1)
              .maybeSingle();

            const minutesUsed = currentUsage?.minutes_used || 0;
            if (minutesUsed > newMinutes) {
              console.warn(`[subscription.updated] DOWNGRADE: company ${existingSub.company_id} has used ${minutesUsed} minutes but new plan "${newPlan.slug}" only includes ${newMinutes}. Excess: ${minutesUsed - newMinutes} minutes.`);
              await supabase.from('billing_events').insert({
                company_id: existingSub.company_id,
                subscription_id: existingSub.id,
                event_type: 'downgrade_minutes_exceeded',
                event_data: {
                  previous_plan: oldPlan.slug,
                  new_plan: newPlan.slug,
                  minutes_used: minutesUsed,
                  new_minutes_included: newMinutes,
                  excess_minutes: minutesUsed - newMinutes,
                },
                minutes_consumed: 0,
                cost_usd: 0,
              });
            }
          } catch (downgradeCheckError) {
            console.error('⚠️ Downgrade minutes check failed (non-fatal):', downgradeCheckError);
          }
        }
      }
    }
  } catch (blandError) {
    console.error('⚠️ Bland credit reallocation on plan change failed (non-fatal):', blandError);
  }

  // --- HubSpot sync ---
  try {
    const customerId = subscription.customer as string;
    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
    const email = customer.email;
    if (email) {
      const planSlug = subscription.metadata?.plan_slug || await getPlanSlugForSubscription(existingSub.company_id);
      const priceItem = subscription.items?.data?.[0];
      const unitAmount = priceItem?.price?.unit_amount || 0;
      const interval = priceItem?.price?.recurring?.interval;
      const mrr = interval === 'year'
        ? String(Math.round((unitAmount / 100) / 12))
        : String(Math.round(unitAmount / 100));

      await updateContactPlan(email, planSlug, mrr, customerId);
      await closeWonDeal(email, planSlug, mrr);

      // Detect plan change → emit plan_upgraded PostHog + HubSpot behavioral events
      const previousPlanSlug = subscription.metadata?.previous_plan_slug
        || existingSub.subscription_plans?.slug;
      if (previousPlanSlug && previousPlanSlug !== planSlug) {
        await captureServerEvent(existingSub.company_id, 'plan_upgraded', {
          previous_plan: previousPlanSlug as string,
          new_plan: planSlug,
          new_mrr: Number(mrr),
        }, { company: existingSub.company_id });

        // HubSpot Custom Behavioral Event
        await logProductEvent(email, hsEventName('callengo_plan_upgraded'), {
          previous_plan: previousPlanSlug as string,
          new_plan: planSlug,
          new_mrr: Number(mrr),
        });
      }
    }
  } catch (e) {
    console.error('[Stripe Webhook] HubSpot sync failed in subscription.updated:', e);
  }
}

/**
 * Handle customer.subscription.deleted
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('🗑️  Subscription deleted:', subscription.id);

  const { data: existingSub } = await supabase
    .from('company_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!existingSub) {
    console.error('Subscription not found:', subscription.id);
    return;
  }

  // Downgrade to free plan instead of just marking canceled
  // This ensures feature-gating by plan_id works correctly
  const { data: freePlan } = await supabase
    .from('subscription_plans')
    .select('id, minutes_included')
    .eq('slug', 'free')
    .single();

  const now = new Date();
  const freeExpiry = new Date();
  freeExpiry.setDate(freeExpiry.getDate() + 90);

  await supabase
    .from('company_subscriptions')
    .update({
      status: 'canceled',
      ...(freePlan ? {
        plan_id: freePlan.id,
        overage_enabled: false,
        overage_budget: 0,
        overage_spent: 0,
        current_period_start: now.toISOString(),
        current_period_end: freeExpiry.toISOString(),
        stripe_subscription_id: null,
        stripe_subscription_item_id: null,
      } : {}),
    })
    .eq('stripe_subscription_id', subscription.id);

  // Log event
  const canceledAt = subscription.canceled_at
    ? new Date(subscription.canceled_at * 1000).toISOString()
    : new Date().toISOString();

  await supabase.from('billing_events').insert({
    company_id: existingSub.company_id,
    subscription_id: existingSub.id,
    event_type: 'subscription_canceled',
    event_data: {
      canceled_at: canceledAt,
      downgraded_to: 'free',
    },
    minutes_consumed: 0,
    cost_usd: 0,
  });

  // ================================================================
  // Deactivate Bland + cancel active addons on subscription cancellation
  // ================================================================
  try {
    await deactivateBlandSubAccount(existingSub.company_id);
  } catch (blandError) {
    console.error('⚠️ Bland sub-account deactivation failed (non-fatal):', blandError);
  }

  // Cancel all active addons (dedicated numbers, recording vault, etc.)
  try {
    await supabaseAdminRaw
      .from('company_addons')
      .update({ status: 'canceled' })
      .eq('company_id', existingSub.company_id)
      .eq('status', 'active');
  } catch (addonError) {
    console.error('⚠️ Addon deactivation failed (non-fatal):', addonError);
  }

  // GA4 server-side: subscription cancelled
  trackServerEvent(existingSub.company_id, null, 'server_subscription_cancelled', {
    stripe_subscription_id: subscription.id,
  });
  await captureServerEvent(existingSub.company_id, 'server_subscription_cancelled', {
    stripe_subscription_id: subscription.id,
  }, { company: existingSub.company_id });

  // --- HubSpot sync: churn → reset to free/lead ---
  try {
    const customerId = subscription.customer as string;
    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
    const email = customer.email;
    if (email) {
      await updateContactPlan(email, 'free', '0', customerId);
    }
  } catch (e) {
    console.error('[Stripe Webhook] HubSpot sync failed in subscription.deleted:', e);
  }
}

/**
 * Handle invoice.payment_succeeded
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice & Record<string, any>) {
  console.log('💳 Payment succeeded:', invoice.id);

  const subscriptionId = invoice.subscription;
  if (!subscriptionId) {
    console.log('No subscription ID in invoice, skipping');
    return;
  }

  // Find subscription
  const { data: subscription } = await supabase
    .from('company_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!subscription) {
    console.error('Subscription not found for invoice:', invoice.id);
    return;
  }

  // Create billing history entry (idempotent — skip if invoice already recorded)
  const { data: existingBilling } = await supabase
    .from('billing_history')
    .select('id')
    .eq('stripe_invoice_id', invoice.id)
    .maybeSingle();

  if (!existingBilling) {
    await supabase.from('billing_history').insert({
      company_id: subscription.company_id,
      subscription_id: subscription.id,
      amount: (invoice.amount_paid || 0) / 100, // Convert from cents
      currency: (invoice.currency || 'usd').toUpperCase(),
      status: 'paid',
      stripe_invoice_id: invoice.id,
      stripe_payment_intent_id: invoice.payment_intent || null,
      payment_method: invoice.charge ? 'card' : 'other',
      billing_date: new Date((invoice.created || Date.now() / 1000) * 1000).toISOString(),
    });
  }

  // Log event
  await supabase.from('billing_events').insert({
    company_id: subscription.company_id,
    subscription_id: subscription.id,
    event_type: 'payment_succeeded',
    event_data: {
      invoice_id: invoice.id,
      amount: invoice.amount_paid / 100,
    },
    minutes_consumed: 0,
    cost_usd: invoice.amount_paid / 100,
  });

  // ALTA-002: Only reset overage tracking on subscription cycle renewal, not on any payment
  if (invoice.billing_reason === 'subscription_cycle' || invoice.billing_reason === 'subscription_create') {
    await supabase
      .from('company_subscriptions')
      .update({
        overage_spent: 0,
        last_overage_alert_at: null,
        overage_alert_level: 0,
      })
      .eq('id', subscription.id);

    // ================================================================
    // AUDIT FIX: Reset usage tracking for the new billing period
    // Creates a fresh usage_tracking record with minutes_used=0
    // ================================================================
    if (invoice.billing_reason === 'subscription_cycle') {
      try {
        await resetUsageForNewPeriod(subscription.company_id);
        console.log(`✅ Usage reset for new billing cycle: company ${subscription.company_id}`);
      } catch (resetError) {
        console.error('⚠️ Usage reset failed (non-fatal):', resetError);
      }

      // Reclaim old Bland credits and allocate fresh for new cycle
      try {
        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('minutes_included, slug')
          .eq('id', subscription.plan_id)
          .single();

        if (plan && plan.slug !== 'free') {
          // FIX: Pass idempotency key to prevent double credits on webhook retry
          await handleCycleRenewalCredits(subscription.company_id, plan.minutes_included || 0, `renewal_${invoice.id}`);
        }
      } catch (blandError) {
        console.error('⚠️ Bland credit renewal failed (non-fatal):', blandError);
      }
    }
  }
}

/**
 * Handle invoice.payment_failed
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice & Record<string, any>) {
  console.log('❌ Payment failed:', invoice.id);

  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  const { data: subscription } = await supabase
    .from('company_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (!subscription) return;

  // Create billing history entry (idempotent — skip if invoice already recorded)
  const { data: existingFailedBilling } = await supabase
    .from('billing_history')
    .select('id')
    .eq('stripe_invoice_id', invoice.id)
    .maybeSingle();

  if (!existingFailedBilling) {
    await supabase.from('billing_history').insert({
      company_id: subscription.company_id,
      subscription_id: subscription.id,
      amount: (invoice.amount_due || 0) / 100,
      currency: (invoice.currency || 'usd').toUpperCase(),
      status: 'failed',
      stripe_invoice_id: invoice.id,
      failure_reason: 'Payment failed',
      billing_date: new Date((invoice.created || Date.now() / 1000) * 1000).toISOString(),
    });
  }

  // Update subscription status to past_due
  await supabase
    .from('company_subscriptions')
    .update({ status: 'past_due' })
    .eq('id', subscription.id);

  // Log event
  await supabase.from('billing_events').insert({
    company_id: subscription.company_id,
    subscription_id: subscription.id,
    event_type: 'payment_failed',
    event_data: {
      invoice_id: invoice.id,
      amount: invoice.amount_due / 100,
    },
    minutes_consumed: 0,
    cost_usd: 0,
  });

  // --- HubSpot: create task for payment failure ---
  try {
    const customerId = invoice.customer as string;
    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
    const email = customer.email;
    if (email) {
      await createTaskForContact(
        email,
        `Payment failed — ${email}`,
        'HIGH'
      );
    }
  } catch (e) {
    console.error('[Stripe Webhook] HubSpot task creation failed in payment_failed:', e);
  }
}

/**
 * Handle customer.subscription.trial_will_end
 */
async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  console.log('⏰ Trial will end soon:', subscription.id);

  const { data: existingSub } = await supabase
    .from('company_subscriptions')
    .select('id, company_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!existingSub) return;

  // Log event for notification system
  await supabase.from('billing_events').insert({
    company_id: existingSub.company_id,
    subscription_id: existingSub.id,
    event_type: 'trial_ending',
    event_data: {
      trial_end: new Date(subscription.trial_end! * 1000).toISOString(),
    },
    minutes_consumed: 0,
    cost_usd: 0,
  });
}

/**
 * Resolve the plan slug for a company from the DB.
 * Falls back to 'free' if not found.
 */
async function getPlanSlugForSubscription(companyId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from('company_subscriptions')
      .select('subscription_plans(slug)')
      .eq('company_id', companyId)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plans = (data as any)?.subscription_plans;
    return plans?.slug || 'free';
  } catch {
    return 'free';
  }
}
