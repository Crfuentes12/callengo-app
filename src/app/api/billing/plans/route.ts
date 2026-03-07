// app/api/billing/plans/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const currency = request.nextUrl.searchParams.get('currency')?.toUpperCase() || 'USD';

    // Fetch all active subscription plans
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching plans:', error);
      return NextResponse.json([]);
    }

    if (!plans || plans.length === 0) {
      return NextResponse.json([]);
    }

    // For non-USD currencies, fetch actual Stripe prices to display correct amounts
    if (currency !== 'USD') {
      for (const plan of plans) {
        if (!plan.stripe_product_id) continue;

        try {
          const prices = await stripe.prices.list({
            product: plan.stripe_product_id,
            currency: currency.toLowerCase(),
            active: true,
            limit: 100,
          } as Record<string, unknown>);

          const monthlyPrice = prices.data.find(
            (p) => p.recurring?.interval === 'month' && p.recurring?.usage_type !== 'metered'
          );
          const annualPrice = prices.data.find(
            (p) => p.recurring?.interval === 'year'
          );

          if (monthlyPrice?.unit_amount) {
            plan.price_monthly = monthlyPrice.unit_amount / 100;
          }
          if (annualPrice?.unit_amount) {
            // Store as per-month equivalent to match existing display logic
            plan.price_annual = annualPrice.unit_amount / 100 / 12;
          }

          // Also adjust overage price if a metered price exists for this currency
          const meteredPrice = prices.data.find(
            (p) => p.recurring?.usage_type === 'metered'
          );
          if (meteredPrice?.unit_amount) {
            plan.price_per_extra_minute = meteredPrice.unit_amount / 100;
          }
        } catch (err) {
          console.error(`[Plans] Error fetching Stripe prices for ${plan.slug} in ${currency}:`, err);
          // Fall back to DB prices (USD) if Stripe fetch fails
        }
      }
    }

    return NextResponse.json(plans);

  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json([]);
  }
}
