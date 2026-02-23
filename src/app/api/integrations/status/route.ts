// app/api/integrations/status/route.ts
// Returns the connection status of all calendar integrations for a company

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getIntegrationStatuses } from '@/lib/calendar/sync';

export async function GET() {
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

    const statuses = await getIntegrationStatuses(userData.company_id);

    return NextResponse.json({ integrations: statuses });
  } catch (error) {
    console.error('Error fetching integration status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}
