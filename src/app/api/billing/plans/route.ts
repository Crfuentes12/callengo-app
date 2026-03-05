// app/api/billing/plans/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { convertAmount } from '@/lib/exchange-rates';

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

    // For non-USD currencies, fetch actual Stripe prices to display correct amounts.
    // If Stripe prices aren't available, convert USD prices using live exchange rates.
    if (currency !== 'USD') {
      for (const plan of plans) {
        let foundStripePrices = false;

        if (plan.stripe_product_id) {
          try {
            const prices = await stripe.prices.list({
              product: plan.stripe_product_id,
              currency: currency.toLowerCase(),
              active: true,
              limit: 100,
            } as any);

            const monthlyPrice = prices.data.find(
              (p) => p.recurring?.interval === 'month' && p.recurring?.usage_type !== 'metered'
            );
            const annualPrice = prices.data.find(
              (p) => p.recurring?.interval === 'year'
            );

            if (monthlyPrice?.unit_amount) {
              plan.price_monthly = monthlyPrice.unit_amount / 100;
              foundStripePrices = true;
            }
            if (annualPrice?.unit_amount) {
              // Store as per-month equivalent to match existing display logic
              plan.price_annual = annualPrice.unit_amount / 100 / 12;
              foundStripePrices = true;
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
          }
        }

        // Fall back to dynamic exchange rate conversion if no Stripe prices found
        if (!foundStripePrices) {
          try {
            if (plan.price_monthly != null) {
              plan.price_monthly = Math.round(
                (await convertAmount(plan.price_monthly, 'USD', currency)) * 100
              ) / 100;
            }
            if (plan.price_annual != null) {
              plan.price_annual = Math.round(
                (await convertAmount(plan.price_annual, 'USD', currency)) * 100
              ) / 100;
            }
            if (plan.price_per_extra_minute != null) {
              plan.price_per_extra_minute = Math.round(
                (await convertAmount(plan.price_per_extra_minute, 'USD', currency)) * 10000
              ) / 10000;
            }
          } catch (convErr) {
            console.error(`[Plans] Error converting prices for ${plan.slug} to ${currency}:`, convErr);
            // Leave prices as USD if conversion fails
          }
        }
      }
    }

    return NextResponse.json(plans);

  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json([]);
  }
}
