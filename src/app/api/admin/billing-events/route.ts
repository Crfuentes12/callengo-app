// app/api/admin/billing-events/route.ts
// Admin Billing Events Feed — filterable, paginated
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

    // Enrich with company names
    const companyIds = [...new Set((events || []).map(e => e.company_id))];
    const { data: companies } = await supabaseAdmin
      .from('companies')
      .select('id, name')
      .in('id', companyIds);

    const companyNames = new Map<string, string>();
    (companies || []).forEach(c => companyNames.set(c.id, c.name));

    const enrichedEvents = (events || []).map(e => ({
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
  } catch (error) {
    console.error('Error fetching billing events:', error);
    return NextResponse.json({ error: 'Failed to fetch billing events' }, { status: 500 });
  }
}
