import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getOrCreateStripeCustomer } from '@/lib/stripe';
import { getAppUrl } from '@/lib/config';
import { expensiveLimiter } from '@/lib/rate-limit';

// Price per extra seat per plan slug (in USD cents)
const SEAT_PRICE_USD: Record<string, number> = {
  business: 4900,  // $49/mo
  teams: 4900,     // $49/mo
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = expensiveLimiter.check(5, `seat_checkout_${user.id}`);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests. Please try again.' }, { status: 429 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role, full_name, email')
      .eq('id', user.id)
      .single();

    if (!userData) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (userData.role !== 'owner' && userData.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    const { quantity = 1, currency = 'USD' } = body;

    if (!['USD', 'EUR', 'GBP'].includes(currency)) {
      return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
    }

    if (typeof quantity !== 'number' || quantity < 1 || quantity > 20) {
      return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
    }

    // Check the company has a plan that supports extra seats
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('id, stripe_customer_id, plan:subscription_plans(slug, name)')
      .eq('company_id', userData.company_id)
      .eq('status', 'active')
      .single();

    const planSlug = (subscription?.plan as Record<string, unknown>)?.slug as string | undefined;
    if (!subscription || !planSlug || !SEAT_PRICE_USD[planSlug]) {
      return NextResponse.json(
        { error: 'Extra seats are available on Business and Teams plans.' },
        { status: 403 }
      );
    }

    const { data: company } = await supabase
      .from('companies')
      .select('id, name, website')
      .eq('id', userData.company_id)
      .single();

    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

    // Look up the extra-seat product in Stripe by metadata
    const stripe = (await import('@/lib/stripe')).stripe;
    const products = await stripe.products.list({ active: true, limit: 100 });
    const seatProduct = products.data.find(
      (p) => p.metadata?.product_type === 'extra_seat'
    );

    let seatPriceId: string | undefined;

    if (seatProduct) {
      // Find monthly price in requested currency
      const prices = await stripe.prices.list({
        product: seatProduct.id,
        currency: currency.toLowerCase() as 'usd' | 'eur' | 'gbp',
        active: true,
        limit: 10,
      } as Record<string, unknown>);
      const monthlyPrice = prices.data.find((p) => p.recurring?.interval === 'month');
      seatPriceId = monthlyPrice?.id;
    }

    // Fallback: create a price on-the-fly if product doesn't exist yet
    if (!seatPriceId) {
      const unitAmount = SEAT_PRICE_USD[planSlug!];
      // Create or reuse a simple product
      let product = products.data.find((p) => p.metadata?.product_type === 'extra_seat');
      if (!product) {
        product = await stripe.products.create({
          name: 'Extra Team Seat',
          description: 'Additional team seat for Callengo',
          metadata: { product_type: 'extra_seat' },
        });
      }
      const newPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: unitAmount,
        currency: currency.toLowerCase(),
        recurring: { interval: 'month' },
        metadata: { product_type: 'extra_seat' },
      });
      seatPriceId = newPrice.id;
    }

    // Get/create Stripe customer
    const stripeCustomer = await getOrCreateStripeCustomer({
      companyId: company.id,
      email: userData.email,
      userName: userData.full_name || undefined,
      companyName: company.name || undefined,
      companyWebsite: company.website || undefined,
      userId: user.id,
    });

    const appUrl = getAppUrl();
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomer.id,
      mode: 'subscription',
      line_items: [{ price: seatPriceId, quantity }],
      success_url: `${appUrl}/settings?tab=billing&seat_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/settings?tab=billing&seat_canceled=true`,
      metadata: {
        company_id: userData.company_id,
        product_type: 'extra_seat',
        quantity: String(quantity),
      },
      subscription_data: {
        metadata: {
          company_id: userData.company_id,
          product_type: 'extra_seat',
        },
      },
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err: unknown) {
    console.error('Seat checkout error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
