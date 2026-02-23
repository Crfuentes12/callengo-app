// app/api/integrations/calendly/disconnect/route.ts
// Disconnects a Calendly integration

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { deleteCalendlyWebhook } from '@/lib/calendar/calendly';
import type { CalendarIntegration } from '@/types/calendar';

export async function POST() {
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

    // Get the integration to clean up webhook
    const { data: integration } = await supabaseAdmin
      .from('calendar_integrations')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('user_id', user.id)
      .eq('provider', 'calendly')
      .eq('is_active', true)
      .maybeSingle();

    if (integration) {
      const typedIntegration = integration as unknown as CalendarIntegration;

      // Try to delete the webhook subscription
      if (typedIntegration.calendly_webhook_uri) {
        try {
          await deleteCalendlyWebhook(
            typedIntegration,
            typedIntegration.calendly_webhook_uri
          );
        } catch (webhookError) {
          console.error('Failed to delete Calendly webhook (non-fatal):', webhookError);
        }
      }
    }

    // Deactivate the integration
    const { error } = await supabaseAdmin
      .from('calendar_integrations')
      .update({
        is_active: false,
        access_token: 'revoked',
        refresh_token: null,
        calendly_webhook_uri: null,
      })
      .eq('company_id', userData.company_id)
      .eq('user_id', user.id)
      .eq('provider', 'calendly');

    if (error) {
      console.error('Error disconnecting Calendly:', error);
      return NextResponse.json(
        { error: 'Failed to disconnect' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Calendly disconnected',
    });
  } catch (error) {
    console.error('Error disconnecting Calendly:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
