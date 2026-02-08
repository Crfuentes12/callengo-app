import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin, supabaseAdminRaw } from '@/lib/supabase/service';

/**
 * POST /api/billing/cancellation-feedback
 * Records cancellation feedback from users going through the cancellation flow.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { reason, reason_details, outcome } = body;

    if (!reason) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 });
    }

    // Get user's company and subscription info
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: subscription } = await supabaseAdmin
      .from('company_subscriptions')
      .select('id, plan_id, stripe_customer_id, current_period_start, subscription_plans(name, slug, price_monthly)')
      .eq('company_id', userData.company_id)
      .eq('status', 'active')
      .single();

    // Calculate months subscribed from Stripe invoices if possible
    let monthsSubscribed = 0;
    if (subscription?.stripe_customer_id) {
      try {
        const { stripe } = await import('@/lib/stripe');
        const invoices = await stripe.invoices.list({
          customer: subscription.stripe_customer_id,
          status: 'paid',
          limit: 100,
        });
        monthsSubscribed = invoices.data.filter(inv => inv.amount_paid > 0).length;
      } catch (e) {
        console.error('[cancellation-feedback] Error fetching Stripe invoices:', e);
      }
    }

    const planData = subscription?.subscription_plans as any;

    // Insert feedback using untyped admin client (new table not in DB types yet)
    const { data: feedback, error: insertError } = await supabaseAdminRaw
      .from('cancellation_feedback')
      .insert({
        company_id: userData.company_id,
        user_id: user.id,
        subscription_id: subscription?.id || null,
        reason,
        reason_details: reason_details || null,
        plan_name: planData?.name || null,
        plan_slug: planData?.slug || null,
        months_subscribed: monthsSubscribed,
        monthly_price: planData?.price_monthly || 0,
        was_offered_retention: false,
        accepted_retention: false,
        outcome: outcome || 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[cancellation-feedback] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
    }

    return NextResponse.json({
      status: 'saved',
      feedback_id: (feedback as any)?.id,
      months_subscribed: monthsSubscribed,
    });
  } catch (error) {
    console.error('[cancellation-feedback] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
