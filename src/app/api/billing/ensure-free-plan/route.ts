import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { expensiveLimiter } from '@/lib/rate-limit';

/**
 * Ensures a company has a Free trial plan subscription.
 * Called during onboarding and as a fallback from the dashboard.
 *
 * Single master API key architecture — no sub-account creation needed.
 * The master API key is stored in company_settings for all companies.
 *
 * Free trial: 15 minutes included, no overage allowed.
 * Users must upgrade to a paid plan after trial minutes are exhausted.
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 requests per minute per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimitResult = await expensiveLimiter.check(5, `ensure-free-plan:${ip}`);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const supabase = await createServerClient();

    // Authenticate user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { company_id } = await req.json();

    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    // Verify user belongs to this company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData || userData.company_id !== company_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if company already has a subscription
    const { data: existingSub } = await supabaseAdmin
      .from('company_subscriptions')
      .select('id, plan_id')
      .eq('company_id', company_id)
      .limit(1)
      .single();

    if (existingSub) {
      // Ensure company has the master API key stored
      await ensureMasterKeyStored(company_id);
      return NextResponse.json({ status: 'already_exists', subscription_id: existingSub.id });
    }

    // Get the Free plan
    const { data: freePlan, error: planError } = await supabaseAdmin
      .from('subscription_plans')
      .select('id, minutes_included')
      .eq('slug', 'free')
      .single();

    if (planError || !freePlan) {
      console.error('[ensure-free-plan] Free plan not found:', planError);
      return NextResponse.json({ error: 'Free plan not found in database' }, { status: 500 });
    }

    // Create the subscription
    const now = new Date();
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 90); // 90-day free trial

    const { data: newSub, error: subError } = await supabaseAdmin
      .from('company_subscriptions')
      .insert({
        company_id,
        plan_id: freePlan.id,
        billing_cycle: 'monthly',
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        overage_enabled: false,
        overage_budget: 0,
        overage_spent: 0,
      })
      .select()
      .single();

    if (subError) {
      if (subError.code === '23505') {
        console.log(`[ensure-free-plan] Subscription already exists (race condition handled) for company ${company_id}`);
        const { data: raceSub } = await supabaseAdmin
          .from('company_subscriptions')
          .select('id')
          .eq('company_id', company_id)
          .single();
        return NextResponse.json({ status: 'already_exists', subscription_id: raceSub?.id });
      }
      console.error('[ensure-free-plan] Error creating subscription:', subError);
      return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
    }

    // Create usage tracking record
    const { error: usageError } = await supabaseAdmin.from('usage_tracking').insert({
      company_id,
      subscription_id: newSub.id,
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
      minutes_used: 0,
      minutes_included: freePlan.minutes_included,
    });

    if (usageError) {
      console.error('[ensure-free-plan] Failed to create usage tracking:', usageError);
    }

    // Store master API key for this company (single-key architecture)
    await ensureMasterKeyStored(company_id);

    console.log(`[ensure-free-plan] Free trial plan (${freePlan.minutes_included} min) assigned to company ${company_id}`);

    return NextResponse.json({ status: 'created', subscription_id: newSub.id });
  } catch (error) {
    console.error('[ensure-free-plan] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Ensure the company has the master Bland API key stored.
 * In single-key architecture, all companies share the same API key.
 */
async function ensureMasterKeyStored(companyId: string) {
  const masterKey = process.env.BLAND_API_KEY;
  if (!masterKey) return;

  const { data: settings } = await supabaseAdmin
    .from('company_settings')
    .select('bland_api_key')
    .eq('company_id', companyId)
    .single();

  if (!settings?.bland_api_key) {
    await supabaseAdmin
      .from('company_settings')
      .update({
        bland_api_key: masterKey,
        bland_subaccount_id: 'master',
      })
      .eq('company_id', companyId);
  }
}
