// app/api/calendar/availability/route.ts
// Check calendar availability and find open slots

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

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

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const startTime = searchParams.get('start_time');
    const endTime = searchParams.get('end_time');

    // Check if a specific slot is available
    if (startTime && endTime) {
      const { isSlotAvailable } = await import('@/lib/calendar/availability');
      const result = await isSlotAvailable(userData.company_id, startTime, endTime);
      return NextResponse.json(result);
    }

    // Get availability for a specific date
    if (date) {
      const { getAvailability } = await import('@/lib/calendar/availability');
      const slotDuration = parseInt(searchParams.get('slot_duration') || '30');
      const availability = await getAvailability(userData.company_id, date, {
        slotDurationMinutes: slotDuration,
      });
      return NextResponse.json(availability);
    }

    return NextResponse.json({ error: 'Missing date or start_time/end_time parameters' }, { status: 400 });
  } catch (error) {
    console.error('Error checking availability:', error);
    return NextResponse.json({ error: 'Failed to check availability' }, { status: 500 });
  }
}
