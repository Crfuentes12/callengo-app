import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin, supabaseAdminRaw } from '@/lib/supabase/service';
import { stripe } from '@/lib/stripe';

/**
 * Retention tier logic:
 * - First time: need 3+ months paid
 * - After first redemption: need 6+ months paid since last redemption
 * - After second redemption: need 12+ months paid since last redemption
 * - Third and beyond: need 12+ months (yearly cycle)
 */
function getMonthsRequired(timesRedeemed: number): number {
  if (timesRedeemed === 0) return 3;
  if (timesRedeemed === 1) return 6;
  return 12;
}

/**
 * GET /api/billing/check-retention
 * Checks if the current user's company is eligible for a retention offer.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const companyId = userData.company_id;

    // Get subscription with Stripe customer ID
    const { data: subscription } = await supabaseAdmin
      .from('company_subscriptions')
      .select('id, stripe_customer_id, stripe_subscription_id, plan_id, subscription_plans(name, slug, price_monthly)')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .single();

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({ eligible: false, reason: 'no_stripe_subscription' });
    }

    // Get or create retention record (using untyped admin for new tables)
    let { data: retentionRecord } = await supabaseAdminRaw
      .from('retention_offers')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (!retentionRecord) {
      const { data: newRecord } = await supabaseAdminRaw
        .from('retention_offers')
        .insert({
          company_id: companyId,
          times_redeemed: 0,
          next_eligible_after_months: 3,
        })
        .select()
        .single();
      retentionRecord = newRecord;
    }

    if (!retentionRecord) {
      return NextResponse.json({ eligible: false, reason: 'record_error' });
    }

    const rec = retentionRecord as any;
    const monthsRequired = getMonthsRequired(rec.times_redeemed);

    // Count paid invoices from Stripe
    let totalPaidMonths = 0;
    let paidMonthsSinceLastRedemption = 0;

    try {
      const invoices = await stripe.invoices.list({
        customer: subscription.stripe_customer_id,
        status: 'paid',
        limit: 100,
      });

      const paidInvoices = invoices.data.filter(inv => inv.amount_paid > 0);
      totalPaidMonths = paidInvoices.length;

      if (rec.last_redeemed_at) {
        const lastRedeemed = new Date(rec.last_redeemed_at).getTime() / 1000;
        paidMonthsSinceLastRedemption = paidInvoices.filter(
          inv => inv.created > lastRedeemed
        ).length;
      } else {
        paidMonthsSinceLastRedemption = totalPaidMonths;
      }
    } catch (e) {
      console.error('[check-retention] Error fetching invoices:', e);
      return NextResponse.json({ eligible: false, reason: 'stripe_error' });
    }

    const eligible = paidMonthsSinceLastRedemption >= monthsRequired;

    // Log the check
    await supabaseAdminRaw.from('retention_offer_log').insert({
      company_id: companyId,
      user_id: user.id,
      subscription_id: subscription.id,
      action: 'eligibility_check',
      months_paid_at_time: paidMonthsSinceLastRedemption,
      months_required: monthsRequired,
      was_eligible: eligible,
      plan_name: (subscription.subscription_plans as any)?.name || null,
      plan_slug: (subscription.subscription_plans as any)?.slug || null,
      details: {
        total_paid_months: totalPaidMonths,
        times_redeemed: rec.times_redeemed,
        last_redeemed_at: rec.last_redeemed_at,
      },
    });

    return NextResponse.json({
      eligible,
      total_paid_months: totalPaidMonths,
      months_since_last_redemption: paidMonthsSinceLastRedemption,
      months_required: monthsRequired,
      times_redeemed: rec.times_redeemed,
    });
  } catch (error) {
    console.error('[check-retention] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/billing/check-retention
 * Applies the retention offer (1 free month via Stripe coupon).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { feedback_id } = await req.json();

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const companyId = userData.company_id;

    // Get subscription
    const { data: subscription } = await supabaseAdmin
      .from('company_subscriptions')
      .select('id, stripe_customer_id, stripe_subscription_id, plan_id, subscription_plans(name, slug, price_monthly)')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .single();

    if (!subscription?.stripe_subscription_id || !subscription?.stripe_customer_id) {
      return NextResponse.json({ error: 'No active Stripe subscription' }, { status: 400 });
    }

    // Extract as non-null after guard
    const stripeSubId = subscription.stripe_subscription_id;
    const stripeCustomerId = subscription.stripe_customer_id;

    // Get retention record
    const { data: retentionData } = await supabaseAdminRaw
      .from('retention_offers')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (!retentionData) {
      return NextResponse.json({ error: 'Retention record not found' }, { status: 400 });
    }

    const rec = retentionData as any;
    const monthsRequired = getMonthsRequired(rec.times_redeemed);

    // Re-verify eligibility
    let paidMonthsSinceLastRedemption = 0;
    try {
      const invoices = await stripe.invoices.list({
        customer: stripeCustomerId,
        status: 'paid',
        limit: 100,
      });
      const paidInvoices = invoices.data.filter(inv => inv.amount_paid > 0);

      if (rec.last_redeemed_at) {
        const lastRedeemed = new Date(rec.last_redeemed_at).getTime() / 1000;
        paidMonthsSinceLastRedemption = paidInvoices.filter(
          inv => inv.created > lastRedeemed
        ).length;
      } else {
        paidMonthsSinceLastRedemption = paidInvoices.length;
      }
    } catch (e) {
      console.error('[apply-retention] Error verifying eligibility:', e);
      return NextResponse.json({ error: 'Failed to verify eligibility' }, { status: 500 });
    }

    if (paidMonthsSinceLastRedemption < monthsRequired) {
      return NextResponse.json({ error: 'Not eligible for retention offer' }, { status: 403 });
    }

    // Create a 100% off coupon for 1 month and apply to subscription
    let couponId: string;
    try {
      const coupon = await stripe.coupons.create({
        percent_off: 100,
        duration: 'once',
        name: `Retention offer - ${companyId} - ${new Date().toISOString().split('T')[0]}`,
        metadata: {
          type: 'retention_offer',
          company_id: companyId,
          times_redeemed: String(rec.times_redeemed + 1),
        },
      });
      couponId = coupon.id;

      // Apply coupon to the subscription via discounts array
      await stripe.subscriptions.update(stripeSubId, {
        discounts: [{ coupon: coupon.id }],
      });
    } catch (e) {
      console.error('[apply-retention] Stripe coupon error:', e);
      return NextResponse.json({ error: 'Failed to apply Stripe coupon' }, { status: 500 });
    }

    const newTimesRedeemed = rec.times_redeemed + 1;
    const nextMonthsRequired = getMonthsRequired(newTimesRedeemed);

    // Update retention record
    await supabaseAdminRaw
      .from('retention_offers')
      .update({
        times_redeemed: newTimesRedeemed,
        last_redeemed_at: new Date().toISOString(),
        next_eligible_after_months: nextMonthsRequired,
        stripe_coupon_id: couponId,
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', companyId);

    // Log the redemption
    await supabaseAdminRaw.from('retention_offer_log').insert({
      company_id: companyId,
      user_id: user.id,
      subscription_id: subscription.id,
      action: 'offer_redeemed',
      months_paid_at_time: paidMonthsSinceLastRedemption,
      months_required: monthsRequired,
      was_eligible: true,
      stripe_coupon_id: couponId,
      plan_name: (subscription.subscription_plans as any)?.name || null,
      plan_slug: (subscription.subscription_plans as any)?.slug || null,
      details: {
        new_times_redeemed: newTimesRedeemed,
        next_months_required: nextMonthsRequired,
      },
    });

    // Update cancellation feedback if provided
    if (feedback_id) {
      await supabaseAdminRaw
        .from('cancellation_feedback')
        .update({
          was_offered_retention: true,
          accepted_retention: true,
          outcome: 'retained_with_offer',
        })
        .eq('id', feedback_id);
    }

    return NextResponse.json({
      status: 'applied',
      coupon_id: couponId,
      times_redeemed: newTimesRedeemed,
      next_months_required: nextMonthsRequired,
    });
  } catch (error) {
    console.error('[apply-retention] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
