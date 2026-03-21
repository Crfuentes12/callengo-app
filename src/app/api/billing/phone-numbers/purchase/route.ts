// app/api/billing/phone-numbers/purchase/route.ts
// Purchase a dedicated phone number for the company
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { expensiveLimiter } from '@/lib/rate-limit';
import {
  purchaseNumber,
  assignNumberToCompany,
  getCompanyNumberCount,
  MAX_DEDICATED_NUMBERS,
  DEDICATED_NUMBER_PRICE,
} from '@/lib/bland/phone-numbers';

const purchaseSchema = z.object({
  area_code: z.string().regex(/^\d{3}$/, 'Area code must be 3 digits'),
  country_code: z.enum(['US', 'CA']).default('US'),
  exact_number: z.string().optional(),
  label: z.string().max(50).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit
    const rateLimit = await expensiveLimiter.check(3, `phone_purchase_${user.id}`);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 });
    }

    // Only owner/admin can purchase numbers
    if (userData.role !== 'owner' && userData.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Must have active paid subscription
    const { data: subscription } = await supabaseAdmin
      .from('company_subscriptions')
      .select('id, status, subscription_plans(slug)')
      .eq('company_id', userData.company_id)
      .eq('status', 'active')
      .single();

    const planSlug = (subscription?.subscription_plans as Record<string, unknown>)?.slug as string;
    if (!subscription || planSlug === 'free') {
      return NextResponse.json(
        { error: 'Dedicated numbers require an active paid plan (Starter or above)' },
        { status: 403 }
      );
    }

    // Check number limit
    const currentCount = await getCompanyNumberCount(userData.company_id);
    if (currentCount >= MAX_DEDICATED_NUMBERS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_DEDICATED_NUMBERS} dedicated numbers per company. Release an existing number first.` },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parseResult = purchaseSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { area_code, country_code, exact_number, label } = parseResult.data;

    // Purchase from Bland
    const purchaseResult = await purchaseNumber(area_code, country_code, exact_number);

    if (!purchaseResult.success) {
      return NextResponse.json(
        { error: purchaseResult.error || 'Failed to purchase number from Bland' },
        { status: 502 }
      );
    }

    // Assign to company in Supabase
    const assignResult = await assignNumberToCompany(
      userData.company_id,
      purchaseResult.phoneNumber!,
      purchaseResult.blandNumberId!,
      undefined, // stripeSubscriptionId — handled by addon-checkout flow
      label
    );

    if (!assignResult.success) {
      return NextResponse.json(
        { error: assignResult.error || 'Failed to assign number' },
        { status: 500 }
      );
    }

    // Log billing event
    await supabaseAdmin.from('billing_events').insert({
      company_id: userData.company_id,
      event_type: 'addon_purchased',
      event_data: {
        addon_type: 'dedicated_number',
        phone_number: purchaseResult.phoneNumber,
        area_code,
        country_code,
        bland_number_id: purchaseResult.blandNumberId,
        price_per_month: DEDICATED_NUMBER_PRICE,
        label: label || null,
      },
      minutes_consumed: 0,
      cost_usd: DEDICATED_NUMBER_PRICE,
    });

    return NextResponse.json({
      status: 'success',
      phoneNumber: purchaseResult.phoneNumber,
      addonId: assignResult.addonId,
      message: `Number ${purchaseResult.phoneNumber} purchased and assigned. Your calls will now use this number as caller ID.`,
      pricePerMonth: DEDICATED_NUMBER_PRICE,
      totalNumbers: currentCount + 1,
      maxNumbers: MAX_DEDICATED_NUMBERS,
    });
  } catch (error) {
    console.error('[phone-numbers/purchase] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
