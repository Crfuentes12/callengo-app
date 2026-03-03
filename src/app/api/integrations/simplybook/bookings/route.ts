// app/api/integrations/simplybook/bookings/route.ts
// Returns SimplyBook.me bookings

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw } from '@/lib/supabase/service';
import { fetchSimplyBookBookings } from '@/lib/simplybook';
import type { SimplyBookIntegration } from '@/types/simplybook';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 400 });
    }

    const { data: integration } = await supabaseAdminRaw
      .from('simplybook_integrations')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!integration) {
      return NextResponse.json({ error: 'No active SimplyBook.me integration' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const upcomingOnly = searchParams.get('upcoming') === '1';
    const status = searchParams.get('status') || undefined;
    const dateFrom = searchParams.get('date_from') || undefined;
    const dateTo = searchParams.get('date_to') || undefined;

    const bookingsResponse = await fetchSimplyBookBookings(
      integration as SimplyBookIntegration,
      { page, limit, upcomingOnly, status, dateFrom, dateTo }
    );

    return NextResponse.json({
      bookings: bookingsResponse.data,
      metadata: bookingsResponse.metadata,
    });
  } catch (error) {
    console.error('Error fetching SimplyBook.me bookings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}
