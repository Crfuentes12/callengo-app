import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';

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
    const { task_id } = body;

    if (!task_id) {
      return NextResponse.json({ error: 'task_id is required' }, { status: 400 });
    }

    // Try to upsert progress - table may not exist yet
    try {
      const { data: existing } = await supabaseAdmin
        .from('get_started_progress')
        .select('*')
        .eq('company_id', userData.company_id)
        .single();

      if (existing) {
        await supabaseAdmin
          .from('get_started_progress')
          .update({ [task_id]: true, updated_at: new Date().toISOString() })
          .eq('company_id', userData.company_id);
      } else {
        await supabaseAdmin
          .from('get_started_progress')
          .insert({
            company_id: userData.company_id,
            [task_id]: true,
          });
      }
    } catch {
      // Table might not exist yet - store in company_settings JSONB instead
      const { data: settings } = await supabase
        .from('company_settings')
        .select('settings')
        .eq('company_id', userData.company_id)
        .single();

      const existingSettings = (settings?.settings as Record<string, unknown>) || {};
      const getStartedProgress = (existingSettings.get_started_progress as Record<string, boolean>) || {};
      getStartedProgress[task_id] = true;

      await supabase
        .from('company_settings')
        .update({
          settings: { ...existingSettings, get_started_progress: getStartedProgress },
        })
        .eq('company_id', userData.company_id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Get-started progress error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

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

    // Try dedicated table first, fall back to company_settings
    let progress: Record<string, boolean> = {};
    try {
      const { data } = await supabase
        .from('get_started_progress')
        .select('*')
        .eq('company_id', userData.company_id)
        .single();
      if (data) {
        progress = data as unknown as Record<string, boolean>;
      }
    } catch {
      const { data: settings } = await supabase
        .from('company_settings')
        .select('settings')
        .eq('company_id', userData.company_id)
        .single();
      const existingSettings = (settings?.settings as Record<string, unknown>) || {};
      progress = (existingSettings.get_started_progress as Record<string, boolean>) || {};
    }

    return NextResponse.json({ progress });
  } catch (error) {
    console.error('Get-started progress error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
