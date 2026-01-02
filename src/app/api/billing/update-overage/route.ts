// app/api/billing/update-overage/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { companyId, subscriptionId, enabled, budget } = body;

    if (!companyId || !subscriptionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

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
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Update subscription overage settings
    const { data: updatedSubscription, error } = await supabase
      .from('company_subscriptions')
      .update({
        overage_enabled: enabled,
        overage_budget: budget || 0,
        overage_spent: enabled ? undefined : 0, // Reset spent if disabling
        updated_at: new Date().toISOString()
      })
      .eq('id', subscriptionId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) throw error;

    // Log billing event
    await supabase.from('billing_events').insert({
      company_id: companyId,
      subscription_id: subscriptionId,
      event_type: enabled ? 'overage_enabled' : 'overage_disabled',
      event_data: { budget: budget || 0 }
    });

    return NextResponse.json({
      status: 'success',
      subscription: updatedSubscription
    });

  } catch (error) {
    console.error('Error updating overage:', error);
    return NextResponse.json(
      { error: 'Failed to update overage settings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
