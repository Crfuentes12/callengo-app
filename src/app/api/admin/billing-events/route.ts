// app/api/admin/billing-events/route.ts
// Admin Billing Events Feed — filterable, paginated
// Falls back to billing_history when billing_events table is empty
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || userData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const companyId = searchParams.get('company_id');
    const eventType = searchParams.get('event_type');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    let query = supabaseAdmin
      .from('billing_events')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    if (eventType) {
      query = query.eq('event_type', eventType);
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data: events, count, error } = await query;

    if (error) throw error;

    // If billing_events has data, use it directly
    if (events && events.length > 0) {
      const companyIds = [...new Set(events.map(e => e.company_id))];
      const { data: companies } = await supabaseAdmin
        .from('companies')
        .select('id, name')
        .in('id', companyIds);

      const companyNames = new Map<string, string>();
      (companies || []).forEach(c => companyNames.set(c.id, c.name));

      const enrichedEvents = events.map(e => ({
        ...e,
        company_name: companyNames.get(e.company_id) || 'Unknown',
      }));

      return NextResponse.json({
        events: enrichedEvents,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      });
    }

    // Fallback: billing_events is empty — synthesize events from billing_history + company_subscriptions
    // This ensures the admin can see subscription activity even if billing_events wasn't populated
    if (!eventType || ['payment_succeeded', 'subscription_created', 'payment_failed'].includes(eventType)) {
      const synthesized: {
        id: string;
        company_id: string;
        event_type: string;
        event_data: Record<string, unknown>;
        minutes_consumed: number;
        cost_usd: number;
        created_at: string;
        company_name: string;
      }[] = [];

      // Pull from billing_history (Stripe payments)
      let bhQuery = supabaseAdmin
        .from('billing_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (companyId) bhQuery = bhQuery.eq('company_id', companyId);
      if (dateFrom) bhQuery = bhQuery.gte('created_at', dateFrom);
      if (dateTo) bhQuery = bhQuery.lte('created_at', dateTo);

      const { data: billingHistory } = await bhQuery;

      // Also pull subscription creation events from company_subscriptions
      let subQuery = supabaseAdmin
        .from('company_subscriptions')
        .select('*, subscription_plans(slug, name, price_monthly)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (companyId) subQuery = subQuery.eq('company_id', companyId);

      const { data: subscriptions } = await subQuery;

      // Collect company IDs for name resolution
      const allCompanyIds = new Set<string>();
      (billingHistory || []).forEach(bh => allCompanyIds.add(bh.company_id));
      (subscriptions || []).forEach(s => allCompanyIds.add(s.company_id));

      const { data: companies } = await supabaseAdmin
        .from('companies')
        .select('id, name')
        .in('id', [...allCompanyIds]);

      const companyNames = new Map<string, string>();
      (companies || []).forEach(c => companyNames.set(c.id, c.name));

      // Add payment events from billing_history
      if (!eventType || eventType === 'payment_succeeded' || eventType === 'payment_failed') {
        for (const bh of (billingHistory || [])) {
          const evType = bh.status === 'paid' ? 'payment_succeeded' : 'payment_failed';
          if (eventType && eventType !== evType) continue;
          synthesized.push({
            id: `bh_${bh.id}`,
            company_id: bh.company_id,
            event_type: evType,
            event_data: {
              invoice_id: bh.stripe_invoice_id,
              amount: bh.amount,
              currency: bh.currency,
              payment_method: bh.payment_method,
            },
            minutes_consumed: 0,
            cost_usd: bh.amount || 0,
            created_at: bh.billing_date || bh.created_at,
            company_name: companyNames.get(bh.company_id) || 'Unknown',
          });
        }
      }

      // Add subscription creation events
      if (!eventType || eventType === 'subscription_created') {
        for (const sub of (subscriptions || [])) {
          const plan = sub.subscription_plans as { slug?: string; name?: string; price_monthly?: number } | null;
          synthesized.push({
            id: `sub_${sub.id}`,
            company_id: sub.company_id,
            event_type: 'subscription_created',
            event_data: {
              plan: plan?.slug || 'unknown',
              plan_name: plan?.name || 'Unknown',
              status: sub.status,
              billing_cycle: sub.billing_cycle,
            },
            minutes_consumed: 0,
            cost_usd: plan?.price_monthly || 0,
            created_at: sub.created_at,
            company_name: companyNames.get(sub.company_id) || 'Unknown',
          });
        }
      }

      // Sort by date descending and paginate
      synthesized.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const total = synthesized.length;
      const paged = synthesized.slice((page - 1) * limit, page * limit);

      return NextResponse.json({
        events: paged,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    // No events and no fallback match
    return NextResponse.json({
      events: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
    });
  } catch (error) {
    console.error('Error fetching billing events:', error);
    return NextResponse.json({ error: 'Failed to fetch billing events' }, { status: 500 });
  }
}
