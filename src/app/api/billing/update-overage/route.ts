// app/api/billing/update-overage/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import {
  enableOverage,
  disableOverage,
  updateOverageBudget,
} from '@/lib/billing/overage-manager';
import { apiLimiter, applyRateLimit } from '@/lib/rate-limit';
import { validateBody } from '@/lib/validation';
import { logAuditEvent } from '@/lib/audit';

const updateOverageSchema = z.object({
  companyId: z.string().uuid('Invalid company ID'),
  subscriptionId: z.string().uuid('Invalid subscription ID'),
  enabled: z.boolean(),
  budget: z.number().min(0).optional(),
});

export async function POST(request: NextRequest) {
  const rateLimitResult = applyRateLimit(request, apiLimiter, 30);
  if (rateLimitResult) return rateLimitResult;

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = validateBody(updateOverageSchema, body);
    if (!validation.success) return validation.response;
    const { companyId, subscriptionId, enabled, budget } = validation.data;

    // Verify user owns this company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!userData || userData.company_id !== companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Only owners and admins can modify overage settings
    if (userData.role !== 'owner' && userData.role !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get subscription with plan info to check if it's a free plan
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('*, plan:subscription_plans(*)')
      .eq('id', subscriptionId)
      .eq('company_id', companyId)
      .single();

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Free/trial plan users cannot enable or modify overage — must upgrade
    if (subscription?.plan?.slug === 'free') {
      return NextResponse.json(
        { error: 'Overage is not available on the free trial plan. Please upgrade to a paid plan to continue making calls.' },
        { status: 403 }
      );
    }

    // Apply budget for paid plans
    let finalBudget = budget || 0;

    // Use Stripe integration to enable/disable overage
    if (enabled && !subscription.overage_enabled) {
      // Enabling overage - add metered billing to Stripe
      await enableOverage({
        companyId,
        budget: finalBudget,
      });
    } else if (!enabled && subscription.overage_enabled) {
      // Disabling overage - remove metered billing from Stripe
      await disableOverage(companyId);
    } else if (enabled && subscription.overage_enabled && budget !== subscription.overage_budget) {
      // Just updating budget - no Stripe changes needed
      await updateOverageBudget({
        companyId,
        budget: finalBudget,
      });
    }

    // Get updated subscription
    const { data: updatedSubscription } = await supabase
      .from('company_subscriptions')
      .select('*, plan:subscription_plans(*)')
      .eq('id', subscriptionId)
      .eq('company_id', companyId)
      .single();

    await logAuditEvent({
      company_id: companyId,
      user_id: user.id,
      action: enabled ? 'billing.overage_enable' : 'billing.overage_disable',
      entity_type: 'subscription',
      entity_id: subscriptionId,
      changes: { enabled, budget: finalBudget, previous_enabled: subscription.overage_enabled, previous_budget: subscription.overage_budget },
      request,
    });

    return NextResponse.json({
      status: 'success',
      subscription: updatedSubscription,
    });
  } catch (error) {
    console.error('Error updating overage:', error);
    return NextResponse.json(
      {
        error: 'Failed to update overage settings',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
