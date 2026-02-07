import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getOrCreateStripeCustomer, createCheckoutSession } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's company
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('company_id, role, full_name, email')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: 'User data not found' },
        { status: 404 }
      );
    }

    // Check permissions (only owner and admin can manage subscriptions)
    if (userData.role !== 'owner' && userData.role !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { planId, billingCycle = 'monthly', currency = 'USD' } = body;

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    if (!['monthly', 'annual'].includes(billingCycle)) {
      return NextResponse.json(
        { error: 'Invalid billing cycle' },
        { status: 400 }
      );
    }

    if (!['USD', 'EUR', 'GBP'].includes(currency)) {
      return NextResponse.json(
        { error: 'Invalid currency' },
        { status: 400 }
      );
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Get company details
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', userData.company_id)
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Get Stripe price ID based on billing cycle and currency
    // If USD, use the stored price IDs (backward compatibility)
    let stripePriceId: string | null = null;

    if (currency === 'USD') {
      stripePriceId =
        billingCycle === 'monthly'
          ? plan.stripe_price_id_monthly
          : plan.stripe_price_id_annual;
    } else {
      // For EUR/GBP, need to fetch from Stripe API
      try {
        const stripe = (await import('@/lib/stripe')).stripe;
        const prices = await stripe.prices.list({
          product: plan.stripe_product_id,
          currency: currency.toLowerCase() as 'usd' | 'eur' | 'gbp',
          active: true,
          limit: 100,
        } as any);

        // Find price matching the billing cycle
        const interval = billingCycle === 'monthly' ? 'month' : 'year';
        const matchingPrice = prices.data.find(
          (p) => p.recurring?.interval === interval
        );

        stripePriceId = matchingPrice?.id || null;
      } catch (error) {
        console.error('[Checkout] Error fetching prices:', error);
      }
    }

    if (!stripePriceId) {
      return NextResponse.json(
        { error: `Stripe price not configured for this plan in ${currency}` },
        { status: 500 }
      );
    }

    // Get or create Stripe customer
    const stripeCustomer = await getOrCreateStripeCustomer({
      companyId: company.id,
      email: userData.email,
      name: company.name || userData.full_name || undefined,
      metadata: {
        company_id: company.id,
        user_id: user.id,
      },
    });

    // Check if company already has a subscription
    const { data: existingSubscription } = await supabase
      .from('company_subscriptions')
      .select('*')
      .eq('company_id', company.id)
      .single();

    // Create checkout session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const session = await createCheckoutSession({
      customerId: stripeCustomer.id,
      priceId: stripePriceId,
      successUrl: `${appUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/settings?canceled=true`,
      metadata: {
        company_id: company.id,
        plan_id: planId,
        billing_cycle: billingCycle,
        user_id: user.id,
      },
      // If upgrading/downgrading, don't offer trial
      trialPeriodDays: existingSubscription ? undefined : 7, // 7-day trial for new customers
    });

    // Update company subscription with Stripe customer ID if not already set
    if (existingSubscription && !existingSubscription.stripe_customer_id) {
      await supabase
        .from('company_subscriptions')
        .update({ stripe_customer_id: stripeCustomer.id })
        .eq('company_id', company.id);
    }

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      {
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
