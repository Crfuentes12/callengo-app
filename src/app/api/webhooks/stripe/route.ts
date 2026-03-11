import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/service';
import { verifyWebhookSignature } from '@/lib/stripe';
import Stripe from 'stripe';
import { trackServerEvent } from '@/lib/analytics';
import { captureServerEvent } from '@/lib/posthog';

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
  const billingCycle = session.metadata?.billing_cycle || 'monthly';

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

  // Calculate period
  const currentPeriodStart = new Date();
  const currentPeriodEnd = new Date();
  if (billingCycle === 'annual') {
    currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
  } else {
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
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

  const { error: usageUpdateError } = await supabase
    .from('usage_tracking')
    .update({
      subscription_id: subId,
      period_start: currentPeriodStart.toISOString(),
      period_end: currentPeriodEnd.toISOString(),
      minutes_used: 0,
      minutes_included: plan.minutes_included,
    })
    .eq('company_id', companyId);

  // If no existing usage record, insert one
  if (usageUpdateError && usageUpdateError.code === 'PGRST116') {
    await supabase.from('usage_tracking').insert({
      company_id: companyId,
      subscription_id: subId,
      period_start: currentPeriodStart.toISOString(),
      period_end: currentPeriodEnd.toISOString(),
      minutes_used: 0,
      minutes_included: plan.minutes_included,
    });
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
}

/**
 * Handle customer.subscription.updated
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionUpdated(subscription: Stripe.Subscription & Record<string, any>) {
  console.log('🔄 Subscription updated:', subscription.id);

  // Find subscription by Stripe ID
  const { data: existingSub } = await supabase
    .from('company_subscriptions')
    .select('*')
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

  // Update subscription status
  await supabase
    .from('company_subscriptions')
    .update({
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : new Date().toISOString(),
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : new Date().toISOString(),
      stripe_subscription_item_id: meteredItem?.id || null,
    })
    .eq('stripe_subscription_id', subscription.id);

  // Log billing event
  await supabase.from('billing_events').insert({
    company_id: existingSub.company_id,
    subscription_id: existingSub.id,
    event_type: 'subscription_updated',
    event_data: {
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
    },
    minutes_consumed: 0,
    cost_usd: 0,
  });
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

  // Update to canceled status
  await supabase
    .from('company_subscriptions')
    .update({
      status: 'canceled',
    })
    .eq('stripe_subscription_id', subscription.id);

  // Log event
  await supabase.from('billing_events').insert({
    company_id: existingSub.company_id,
    subscription_id: existingSub.id,
    event_type: 'subscription_canceled',
    event_data: {
      canceled_at: new Date(subscription.canceled_at! * 1000).toISOString(),
    },
    minutes_consumed: 0,
    cost_usd: 0,
  });

  // GA4 server-side: subscription cancelled
  trackServerEvent(existingSub.company_id, null, 'server_subscription_cancelled', {
    stripe_subscription_id: subscription.id,
  });
  await captureServerEvent(existingSub.company_id, 'server_subscription_cancelled', {
    stripe_subscription_id: subscription.id,
  }, { company: existingSub.company_id });
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

  // Create billing history entry
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

  // Create billing history entry
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
}

/**
 * Handle customer.subscription.trial_will_end
 */
async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  console.log('⏰ Trial will end soon:', subscription.id);

  const { data: existingSub } = await supabase
    .from('company_subscriptions')
    .select('company_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!existingSub) return;

  // Log event for notification system
  await supabase.from('billing_events').insert({
    company_id: existingSub.company_id,
    subscription_id: subscription.id,
    event_type: 'trial_ending',
    event_data: {
      trial_end: new Date(subscription.trial_end! * 1000).toISOString(),
    },
    minutes_consumed: 0,
    cost_usd: 0,
  });
}
