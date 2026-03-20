// app/api/company/onboarding-status/route.ts
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
      return NextResponse.json({ error: 'No company found' }, { status: 404 });
    }

    const { data: settings } = await supabase
      .from('company_settings')
      .select('settings')
      .eq('company_id', userData.company_id)
      .single();

    const settingsData = (settings?.settings as Record<string, unknown>) || {};
    const onboardingWizardCompleted = !!settingsData.onboarding_wizard_completed;
    const onboardingWizardSkippedAt = settingsData.onboarding_wizard_skipped_at || null;
    const onboardingWizardCompletedAt = settingsData.onboarding_wizard_completed_at || null;
    const selectedPain = settingsData.onboarding_selected_pain || null;

    return NextResponse.json({
      completed: onboardingWizardCompleted,
      skipped_at: onboardingWizardSkippedAt,
      completed_at: onboardingWizardCompletedAt,
      selected_pain: selectedPain,
    });

  } catch (error) {
    console.error('Error fetching onboarding status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
      return NextResponse.json({ error: 'No company found' }, { status: 404 });
    }

    const body = await request.json();
    const { action, selected_pain } = body;

    // Fetch current settings
    const { data: currentSettings } = await supabase
      .from('company_settings')
      .select('settings')
      .eq('company_id', userData.company_id)
      .single();

    const existingSettings = (currentSettings?.settings as Record<string, unknown>) || {};
    const now = new Date().toISOString();

    let updatedSettings: Record<string, unknown>;

    if (action === 'complete') {
      updatedSettings = {
        ...existingSettings,
        onboarding_wizard_completed: true,
        onboarding_wizard_completed_at: now,
        onboarding_selected_pain: selected_pain || existingSettings.onboarding_selected_pain,
      };
    } else if (action === 'skip') {
      updatedSettings = {
        ...existingSettings,
        onboarding_wizard_completed: true,
        onboarding_wizard_skipped_at: now,
      };
    } else if (action === 'select_pain') {
      updatedSettings = {
        ...existingSettings,
        onboarding_selected_pain: selected_pain,
      };
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { error } = await supabase
      .from('company_settings')
      .update({ settings: updatedSettings as unknown as Record<string, never> })
      .eq('company_id', userData.company_id);

    if (error) throw error;

    return NextResponse.json({ status: 'success' });

  } catch (error) {
    console.error('Error updating onboarding status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
