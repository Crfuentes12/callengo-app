// app/api/contacts/stats/route.ts
// Aggregated contact statistics for dashboard cards
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();
    if (!userData?.company_id) return NextResponse.json({ error: 'No company found' }, { status: 404 });

    const companyId = userData.company_id;

    // Fetch total count
    const { count: total } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId);

    // Fetch status distribution
    const { data: allStatuses } = await supabase
      .from('contacts')
      .select('status')
      .eq('company_id', companyId);

    const statusCounts: Record<string, number> = {};
    for (const row of allStatuses || []) {
      statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
    }

    // Fetch source distribution
    const { data: allSources } = await supabase
      .from('contacts')
      .select('source')
      .eq('company_id', companyId);

    const sourceCounts: Record<string, number> = {};
    for (const row of allSources || []) {
      const src = row.source || 'unknown';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    }

    // Contacts with email
    const { count: withEmail } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .not('email', 'is', null)
      .neq('email', '');

    // Contacts called (at least 1 attempt)
    const { count: called } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gt('call_attempts', 0);

    // Contacts added in last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentlyAdded } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('created_at', weekAgo);

    // Contacts with no list
    const { count: noList } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .is('list_id', null);

    return NextResponse.json({
      total: total || 0,
      statusCounts,
      sourceCounts,
      withEmail: withEmail || 0,
      called: called || 0,
      recentlyAdded: recentlyAdded || 0,
      noList: noList || 0,
    });
  } catch (error) {
    console.error('Contact stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
