import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';

/**
 * Ensures a company has a Free trial plan subscription.
 * Called during onboarding and as a fallback from the dashboard.
 * Uses supabaseAdmin (service role) to bypass RLS for INSERT operations.
 *
 * Free trial: 15 minutes included, no overage allowed.
 * Users must upgrade to a paid plan after trial minutes are exhausted.
 */
export async function POST(req: NextRequest) {
  try {
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

    // Verify user belongs to this company (using authenticated client for auth check)
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData || userData.company_id !== company_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if company already has a subscription (using admin to bypass RLS)
    const { data: existingSub } = await supabaseAdmin
      .from('company_subscriptions')
      .select('id, plan_id')
      .eq('company_id', company_id)
      .limit(1)
      .single();

    if (existingSub) {
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

    // Create the subscription using admin client (bypasses RLS)
    const now = new Date();
    const periodEnd = new Date();
    periodEnd.setFullYear(periodEnd.getFullYear() + 10);

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
      console.error('[ensure-free-plan] Error creating subscription:', subError);
      return NextResponse.json({ error: 'Failed to create subscription', details: subError.message }, { status: 500 });
    }

    // Create usage tracking record using admin client
    await supabaseAdmin.from('usage_tracking').insert({
      company_id,
      subscription_id: newSub.id,
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
      minutes_used: 0,
      minutes_included: freePlan.minutes_included,
    });

    console.log(`[ensure-free-plan] Free trial plan (15 min) assigned to company ${company_id}`);

    return NextResponse.json({ status: 'created', subscription_id: newSub.id });
  } catch (error) {
    console.error('[ensure-free-plan] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
