// app/api/billing/verify-session/route.ts
// Fallback endpoint to verify a Stripe checkout session and update the subscription
// directly in the database. This bypasses the webhook in case it fails.
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Authenticate user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 });
    }

    const { session_id } = await req.json();

    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      );
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription'],
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Checkout session not found' },
        { status: 404 }
      );
    }

    // Verify the session belongs to this company
    if (session.metadata?.company_id !== userData.company_id) {
      return NextResponse.json(
        { error: 'Session does not belong to this company' },
        { status: 403 }
      );
    }

    // Check if payment was successful
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return NextResponse.json({
        updated: false,
        reason: 'Payment not yet completed',
        payment_status: session.payment_status,
        session_status: session.status,
      });
    }

    const companyId = session.metadata?.company_id;
    const planId = session.metadata?.plan_id;
    const billingCycle = session.metadata?.billing_cycle || 'monthly';
    const subscriptionId = session.subscription;
    const customerId = session.customer as string;

    if (!companyId || !planId) {
      return NextResponse.json(
        { error: 'Missing metadata in checkout session' },
        { status: 400 }
      );
    }

    // Get plan details
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Calculate period
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    if (billingCycle === 'annual') {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    } else {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    }

    // Get the Stripe subscription ID as string
    const stripeSubId =
      typeof subscriptionId === 'string'
        ? subscriptionId
        : (subscriptionId as any)?.id || null;

    // Update the existing subscription record using .update().eq()
    // This avoids the upsert/onConflict issue that requires a UNIQUE constraint
    const { data: updated, error: updateError } = await supabase
      .from('company_subscriptions')
      .update({
        plan_id: planId,
        billing_cycle: billingCycle,
        status: 'active',
        current_period_start: currentPeriodStart.toISOString(),
        current_period_end: currentPeriodEnd.toISOString(),
        stripe_subscription_id: stripeSubId,
        stripe_customer_id: customerId,
      })
      .eq('company_id', companyId)
      .select()
      .single();

    if (updateError) {
      console.error('[verify-session] Error updating subscription:', updateError);
      return NextResponse.json(
        { error: 'Failed to update subscription', details: updateError.message },
        { status: 500 }
      );
    }

    // Also update/create usage tracking for the new period
    if (updated) {
      // Try to update existing usage tracking first
      const { data: existingUsage } = await supabase
        .from('usage_tracking')
        .select('id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingUsage) {
        await supabase
          .from('usage_tracking')
          .update({
            subscription_id: updated.id,
            period_start: currentPeriodStart.toISOString(),
            period_end: currentPeriodEnd.toISOString(),
            minutes_used: 0,
            minutes_included: plan.minutes_included,
          })
          .eq('id', existingUsage.id);
      } else {
        await supabase.from('usage_tracking').insert({
          company_id: companyId,
          subscription_id: updated.id,
          period_start: currentPeriodStart.toISOString(),
          period_end: currentPeriodEnd.toISOString(),
          minutes_used: 0,
          minutes_included: plan.minutes_included,
        });
      }
    }

    console.log(`[verify-session] Subscription updated for company ${companyId} to plan ${plan.name}`);

    return NextResponse.json({
      updated: true,
      subscription: updated,
      plan: plan.name,
    });
  } catch (error) {
    console.error('[verify-session] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to verify session',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
