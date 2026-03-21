import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { createBlandSubAccount, allocateBlandCredits } from '@/lib/bland/subaccount-manager';
import { expensiveLimiter } from '@/lib/rate-limit';

/**
 * Ensures a company has a Free trial plan subscription.
 * Called during onboarding and as a fallback from the dashboard.
 * Uses supabaseAdmin (service role) to bypass RLS for INSERT operations.
 *
 * Free trial: 15 minutes included, no overage allowed.
 * Users must upgrade to a paid plan after trial minutes are exhausted.
 *
 * Security: Rate-limited (5 req/min per IP) + requires verified email
 * to prevent spam signups from draining Bland master balance.
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 requests per minute per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimitResult = expensiveLimiter.check(5, `ensure-free-plan:${ip}`);
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
      // Subscription exists, but Bland sub-account might be missing
      // (e.g., email wasn't verified at signup, or Bland setup failed)
      const { data: settings } = await supabaseAdmin
        .from('company_settings')
        .select('bland_subaccount_id')
        .eq('company_id', company_id)
        .single();

      const emailVerified = !!user.email_confirmed_at || user.app_metadata?.provider !== 'email';

      if (!settings?.bland_subaccount_id && emailVerified) {
        // Get the free plan minutes to allocate
        const { data: plan } = await supabaseAdmin
          .from('subscription_plans')
          .select('minutes_included')
          .eq('id', existingSub.plan_id)
          .single();

        try {
          const { data: company } = await supabaseAdmin
            .from('companies')
            .select('name')
            .eq('id', company_id)
            .single();

          await createBlandSubAccount(company_id, company?.name || `Company ${company_id}`);
          await allocateBlandCredits(company_id, plan?.minutes_included || 15);
          console.log(`[ensure-free-plan] Deferred Bland sub-account created for company ${company_id} (email now verified)`);
        } catch (blandError) {
          console.error('[ensure-free-plan] Deferred Bland setup failed (non-fatal):', blandError);
        }
      }

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
      return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
    }

    // Create usage tracking record using admin client
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

    // Create Bland sub-account and allocate credits ONLY if email is verified.
    // This prevents spam signups from draining the Bland master balance.
    // OAuth users (Google, GitHub) are always verified. Email/password users
    // must confirm their email first — Bland setup happens on next dashboard load.
    const emailVerified = !!user.email_confirmed_at || user.app_metadata?.provider !== 'email';

    if (emailVerified) {
      try {
        const { data: company } = await supabaseAdmin
          .from('companies')
          .select('name')
          .eq('id', company_id)
          .single();

        await createBlandSubAccount(company_id, company?.name || `Company ${company_id}`);
        await allocateBlandCredits(company_id, freePlan.minutes_included);
        console.log(`[ensure-free-plan] Bland sub-account + $${(freePlan.minutes_included * 0.11 * 1.05).toFixed(2)} credits allocated for free trial`);
      } catch (blandError) {
        // Non-fatal: subscription is created, Bland setup can be retried
        console.error('[ensure-free-plan] Bland sub-account setup failed (non-fatal):', blandError);
      }
    } else {
      console.log(`[ensure-free-plan] Email not verified yet — Bland sub-account deferred for company ${company_id}`);
    }

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
