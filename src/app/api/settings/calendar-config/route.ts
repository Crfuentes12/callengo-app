// app/api/settings/calendar-config/route.ts
// Save/load calendar configuration (timezone, working hours, working days, holidays)

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

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

    const { data: companySettings } = await supabase
      .from('company_settings')
      .select('settings')
      .eq('company_id', userData.company_id)
      .single();

    const settings = (companySettings?.settings ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      timezone: settings.timezone || 'America/New_York',
      working_hours_start: settings.working_hours_start || '09:00',
      working_hours_end: settings.working_hours_end || '18:00',
      working_days: settings.working_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      exclude_holidays: settings.exclude_holidays ?? false,
    });
  } catch (error) {
    console.error('Error fetching calendar config:', error);
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { timezone, working_hours_start, working_hours_end, working_days, exclude_holidays } = body;

    // Get current settings
    const { data: currentSettings } = await supabase
      .from('company_settings')
      .select('settings')
      .eq('company_id', userData.company_id)
      .single();

    const existingSettings = (currentSettings?.settings as Record<string, unknown>) || {};

    // Merge new calendar config into existing settings
    const updatedSettings = {
      ...existingSettings,
      ...(timezone !== undefined && { timezone }),
      ...(working_hours_start !== undefined && { working_hours_start }),
      ...(working_hours_end !== undefined && { working_hours_end }),
      ...(working_days !== undefined && { working_days }),
      ...(exclude_holidays !== undefined && { exclude_holidays }),
    };

    const { error } = await supabase
      .from('company_settings')
      .update({ settings: updatedSettings })
      .eq('company_id', userData.company_id);

    if (error) {
      console.error('Error saving calendar config:', error);
      return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      config: {
        timezone: updatedSettings.timezone,
        working_hours_start: updatedSettings.working_hours_start,
        working_hours_end: updatedSettings.working_hours_end,
        working_days: updatedSettings.working_days,
        exclude_holidays: updatedSettings.exclude_holidays,
      },
    });
  } catch (error) {
    console.error('Error saving calendar config:', error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}
