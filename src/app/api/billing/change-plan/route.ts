// app/api/billing/change-plan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 });
    }

    // Only owners and admins can change plans
    if (userData.role !== 'owner' && userData.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { planId, billingCycle } = body;

    if (!planId || !billingCycle) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (billingCycle !== 'monthly' && billingCycle !== 'annual') {
      return NextResponse.json({ error: 'Invalid billing cycle' }, { status: 400 });
    }

    const companyId = userData.company_id;

    // Fetch the new plan details
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Check if company already has a subscription
    const { data: existingSubscription } = await supabase
      .from('company_subscriptions')
      .select('*')
      .eq('company_id', companyId)
      .single();

    const currentDate = new Date();
    const periodEnd = new Date(currentDate);

    // Calculate period end based on billing cycle
    if (billingCycle === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    if (existingSubscription) {
      // Update existing subscription
      const { data: updatedSubscription, error: updateError } = await supabase
        .from('company_subscriptions')
        .update({
          plan_id: planId,
          billing_cycle: billingCycle,
          current_period_start: currentDate.toISOString(),
          current_period_end: periodEnd.toISOString(),
          status: 'active',
          cancel_at_period_end: false,
          trial_end: null,
          updated_at: currentDate.toISOString()
        })
        .eq('company_id', companyId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Create or update usage tracking for the new period
      const { error: usageError } = await supabase
        .from('usage_tracking')
        .upsert({
          company_id: companyId,
          subscription_id: updatedSubscription.id,
          period_start: currentDate.toISOString(),
          period_end: periodEnd.toISOString(),
          calls_made: 0,
          calls_included: plan.calls_included,
          total_cost: 0
        });

      if (usageError) console.error('Error creating usage tracking:', usageError);

      // Create billing history entry
      const amount = billingCycle === 'monthly' ? plan.price_monthly : plan.price_annual;
      const { error: historyError } = await supabase
        .from('billing_history')
        .insert({
          company_id: companyId,
          subscription_id: updatedSubscription.id,
          amount,
          currency: 'USD',
          description: `${plan.name} - ${billingCycle === 'monthly' ? 'Mensual' : 'Anual'}`,
          status: 'paid',
          billing_date: currentDate.toISOString()
        });

      if (historyError) console.error('Error creating billing history:', historyError);

      return NextResponse.json({
        status: 'success',
        message: 'Subscription updated successfully',
        subscription: updatedSubscription
      });

    } else {
      // Create new subscription
      const { data: newSubscription, error: createError } = await supabase
        .from('company_subscriptions')
        .insert({
          company_id: companyId,
          plan_id: planId,
          billing_cycle: billingCycle,
          current_period_start: currentDate.toISOString(),
          current_period_end: periodEnd.toISOString(),
          status: 'active',
          extra_users: 0
        })
        .select()
        .single();

      if (createError) throw createError;

      // Create usage tracking
      const { error: usageError } = await supabase
        .from('usage_tracking')
        .insert({
          company_id: companyId,
          subscription_id: newSubscription.id,
          period_start: currentDate.toISOString(),
          period_end: periodEnd.toISOString(),
          calls_made: 0,
          calls_included: plan.calls_included,
          total_cost: 0
        });

      if (usageError) console.error('Error creating usage tracking:', usageError);

      // Create billing history entry
      const amount = billingCycle === 'monthly' ? plan.price_monthly : plan.price_annual;
      const { error: historyError } = await supabase
        .from('billing_history')
        .insert({
          company_id: companyId,
          subscription_id: newSubscription.id,
          amount,
          currency: 'USD',
          description: `${plan.name} - ${billingCycle === 'monthly' ? 'Mensual' : 'Anual'}`,
          status: 'paid',
          billing_date: currentDate.toISOString()
        });

      if (historyError) console.error('Error creating billing history:', historyError);

      return NextResponse.json({
        status: 'success',
        message: 'Subscription created successfully',
        subscription: newSubscription
      });
    }

  } catch (error) {
    console.error('Error changing plan:', error);
    return NextResponse.json(
      { error: 'Failed to change plan', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
