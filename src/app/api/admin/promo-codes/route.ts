// app/api/admin/promo-codes/route.ts
// Admin endpoint — fetches all promo codes, coupons, and redemption data directly from Stripe
import { NextResponse } from 'next/server';
import { expensiveLimiter } from '@/lib/rate-limit';
import { createServerClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || userData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const rateLimit = await expensiveLimiter.check(10, `admin_promo_${user.id}`);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Fetch all data from Stripe in parallel
    const [
      promotionCodesResult,
      couponsResult,
      subscriptionsWithDiscountResult,
    ] = await Promise.all([
      // 1. All promotion codes (the user-facing codes that wrap coupons)
      stripe.promotionCodes.list({ limit: 100, expand: ['data.coupon'] }),

      // 2. All coupons (the underlying discount objects)
      stripe.coupons.list({ limit: 100 }),

      // 3. All active subscriptions with discounts expanded
      stripe.subscriptions.list({
        limit: 100,
        status: 'all',
        expand: ['data.discounts', 'data.customer'],
      }),
    ]);

    // Build coupon usage map from subscriptions
    const couponUsageMap = new Map<string, {
      activeRedemptions: number;
      totalDiscountAmount: number;
      customers: {
        customerId: string;
        customerName: string;
        customerEmail: string;
        companyId: string | null;
        subscriptionId: string;
        subscriptionStatus: string;
        promotionCode: string | null;
        discountStart: number | null;
        discountEnd: number | null;
        monthlyDiscount: number;
        planAmount: number;
      }[];
    }>();

    let totalActiveDiscounts = 0;
    let totalMonthlyDiscountImpact = 0;

    for (const sub of subscriptionsWithDiscountResult.data) {
      const firstDiscount = (sub.discounts && sub.discounts.length > 0) ? sub.discounts[0] : null;
      if (!firstDiscount || typeof firstDiscount === 'string') continue;
      const coupon = typeof firstDiscount.coupon === 'string' ? null : firstDiscount.coupon;
      if (!coupon) continue;

      totalActiveDiscounts++;
      const couponId = coupon.id;
      const customer = sub.customer as { id: string; name?: string | null; email?: string | null; metadata?: Record<string, string> } | string;
      const customerId = typeof customer === 'string' ? customer : customer.id;
      const customerName = typeof customer === 'string' ? '' : (customer.name || '');
      const customerEmail = typeof customer === 'string' ? '' : (customer.email || '');
      const companyId = typeof customer === 'string' ? null : (customer.metadata?.company_id || null);

      // Calculate monthly discount amount
      const planAmount = sub.items.data.reduce((sum, item) => {
        const unitAmount = item.price?.unit_amount || 0;
        const interval = item.price?.recurring?.interval;
        // Normalize to monthly
        return sum + (interval === 'year' ? unitAmount / 12 : unitAmount);
      }, 0) / 100; // cents to dollars

      let monthlyDiscount = 0;
      if (coupon.percent_off) {
        monthlyDiscount = planAmount * (coupon.percent_off / 100);
      } else if (coupon.amount_off) {
        const amountOff = coupon.amount_off / 100;
        // If coupon duration is repeating with months, or forever
        monthlyDiscount = Math.min(amountOff, planAmount);
      }

      totalMonthlyDiscountImpact += monthlyDiscount;

      const promoCode = firstDiscount.promotion_code;
      const promoCodeStr = promoCode
        ? (typeof promoCode === 'string' ? promoCode : promoCode.code)
        : null;

      if (!couponUsageMap.has(couponId)) {
        couponUsageMap.set(couponId, {
          activeRedemptions: 0,
          totalDiscountAmount: 0,
          customers: [],
        });
      }

      const entry = couponUsageMap.get(couponId)!;
      entry.activeRedemptions++;
      entry.totalDiscountAmount += monthlyDiscount;
      entry.customers.push({
        customerId,
        customerName,
        customerEmail,
        companyId,
        subscriptionId: sub.id,
        subscriptionStatus: sub.status,
        promotionCode: promoCodeStr,
        discountStart: firstDiscount.start ?? null,
        discountEnd: firstDiscount.end ?? null,
        monthlyDiscount: Math.round(monthlyDiscount * 100) / 100,
        planAmount: Math.round(planAmount * 100) / 100,
      });
    }

    // Build promotion codes response
    const promotionCodes = promotionCodesResult.data.map(pc => {
      const coupon = pc.coupon;
      const usage = couponUsageMap.get(coupon.id);

      return {
        id: pc.id,
        code: pc.code,
        active: pc.active,
        timesRedeemed: pc.times_redeemed,
        maxRedemptions: pc.max_redemptions,
        expiresAt: pc.expires_at,
        createdAt: pc.created,
        // Coupon details
        coupon: {
          id: coupon.id,
          name: coupon.name,
          percentOff: coupon.percent_off,
          amountOff: coupon.amount_off ? coupon.amount_off / 100 : null,
          currency: coupon.currency,
          duration: coupon.duration,
          durationInMonths: coupon.duration_in_months,
          timesRedeemed: coupon.times_redeemed,
          maxRedemptions: coupon.max_redemptions,
          valid: coupon.valid,
          createdAt: coupon.created,
        },
        // Active usage
        activeRedemptions: usage?.activeRedemptions || 0,
        monthlyImpact: Math.round((usage?.totalDiscountAmount || 0) * 100) / 100,
        customers: usage?.customers || [],
      };
    });

    // Also include coupons that might not have promotion codes (e.g., retention coupons applied directly)
    const promoCodeCouponIds = new Set(promotionCodesResult.data.map(pc => pc.coupon.id));
    const standaloneCoupons = couponsResult.data
      .filter(c => !promoCodeCouponIds.has(c.id))
      .map(coupon => {
        const usage = couponUsageMap.get(coupon.id);
        return {
          id: null,
          code: null,
          active: coupon.valid,
          timesRedeemed: coupon.times_redeemed,
          maxRedemptions: coupon.max_redemptions,
          expiresAt: null,
          createdAt: coupon.created,
          coupon: {
            id: coupon.id,
            name: coupon.name,
            percentOff: coupon.percent_off,
            amountOff: coupon.amount_off ? coupon.amount_off / 100 : null,
            currency: coupon.currency,
            duration: coupon.duration,
            durationInMonths: coupon.duration_in_months,
            timesRedeemed: coupon.times_redeemed,
            maxRedemptions: coupon.max_redemptions,
            valid: coupon.valid,
            createdAt: coupon.created,
          },
          activeRedemptions: usage?.activeRedemptions || 0,
          monthlyImpact: Math.round((usage?.totalDiscountAmount || 0) * 100) / 100,
          customers: usage?.customers || [],
        };
      });

    // Summary stats
    const allCodes = [...promotionCodes, ...standaloneCoupons];
    const totalCoupons = couponsResult.data.length;
    const activeCoupons = couponsResult.data.filter(c => c.valid).length;
    const totalPromoCodes = promotionCodesResult.data.length;
    const activePromoCodes = promotionCodesResult.data.filter(pc => pc.active).length;
    const totalRedemptions = allCodes.reduce((sum, c) => sum + c.timesRedeemed, 0);

    return NextResponse.json({
      summary: {
        totalCoupons,
        activeCoupons,
        totalPromoCodes,
        activePromoCodes,
        totalRedemptions,
        totalActiveDiscounts,
        totalMonthlyDiscountImpact: Math.round(totalMonthlyDiscountImpact * 100) / 100,
      },
      promotionCodes,
      standaloneCoupons,
    });
  } catch (error) {
    console.error('Error fetching promo codes:', error);
    return NextResponse.json({ error: 'Failed to fetch promo codes from Stripe' }, { status: 500 });
  }
}
