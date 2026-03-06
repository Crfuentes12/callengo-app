import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getOrCreateStripeCustomer } from '@/lib/stripe';
import { getAppUrl } from '@/lib/config';
import { expensiveLimiter } from '@/lib/rate-limit';

const ADDON_TYPE_LABELS: Record<string, string> = {
  dedicated_number: 'Dedicated Phone Number',
  recording_vault: 'Recording Vault',
  calls_booster: 'Calls Booster',
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = expensiveLimiter.check(5, `addon_checkout_${user.id}`);
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
    const { addonType, currency = 'USD' } = body;

    if (!addonType || !ADDON_TYPE_LABELS[addonType]) {
      return NextResponse.json({ error: 'Invalid addon type' }, { status: 400 });
    }

    if (!['USD', 'EUR', 'GBP'].includes(currency)) {
      return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
    }

    // Check company has an active paid subscription (addon requires Starter+)
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('id, stripe_customer_id, plan:subscription_plans(slug)')
      .eq('company_id', userData.company_id)
      .eq('status', 'active')
      .single();

    const planSlug = (subscription?.plan as any)?.slug;
    if (!subscription || planSlug === 'free') {
      return NextResponse.json(
        { error: 'Add-ons require an active paid plan (Starter or above)' },
        { status: 403 }
      );
    }

    const { data: company } = await supabase
      .from('companies')
      .select('id, name, website')
      .eq('id', userData.company_id)
      .single();

    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

    // Look up the addon price from Stripe by product metadata
    const stripe = (await import('@/lib/stripe')).stripe;
    const products = await stripe.products.list({ active: true, limit: 100 });
    const addonProduct = products.data.find(
      (p) => p.metadata?.addon_type === addonType
    );

    if (!addonProduct) {
      return NextResponse.json(
        { error: `Addon product not found in Stripe. Please run stripe:sync first.` },
        { status: 500 }
      );
    }

    // Find the monthly price in the requested currency
    const prices = await stripe.prices.list({
      product: addonProduct.id,
      currency: currency.toLowerCase() as 'usd' | 'eur' | 'gbp',
      active: true,
      limit: 10,
    } as any);

    const addonPrice = prices.data.find((p) => p.recurring?.interval === 'month');
    if (!addonPrice) {
      return NextResponse.json(
        { error: `No monthly price found for ${addonType} in ${currency}` },
        { status: 500 }
      );
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
      line_items: [{ price: addonPrice.id, quantity: 1 }],
      success_url: `${appUrl}/settings?tab=billing&addon_success=${addonType}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/settings?tab=billing&addon_canceled=true`,
      metadata: {
        company_id: company.id,
        addon_type: addonType,
        user_id: user.id,
        is_addon: 'true',
      },
      subscription_data: {
        metadata: {
          company_id: company.id,
          addon_type: addonType,
          is_addon: 'true',
        },
      },
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('[Addon Checkout] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create addon checkout', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
