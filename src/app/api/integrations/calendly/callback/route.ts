// app/api/integrations/calendly/callback/route.ts
// Handles the Calendly OAuth callback after user grants permission

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import {
  exchangeCalendlyCode,
  getCalendlyCurrentUser,
  createCalendlyWebhook,
} from '@/lib/calendar/calendly';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      console.error('Calendly OAuth error:', error);
      return NextResponse.redirect(
        new URL('/integrations?error=calendly_auth_denied', request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/integrations?error=calendly_auth_missing_params', request.url)
      );
    }

    // Decode state parameter
    let stateData: { user_id: string; company_id: string; return_to?: string };
    try {
      stateData = JSON.parse(
        Buffer.from(state, 'base64url').toString('utf-8')
      );
    } catch {
      return NextResponse.redirect(
        new URL('/integrations?error=calendly_auth_invalid_state', request.url)
      );
    }

    const { user_id, company_id, return_to } = stateData;
    const redirectBase = return_to || '/integrations';

    // Exchange code for tokens
    const tokens = await exchangeCalendlyCode(code);

    // Get user profile info
    const userInfo = await getCalendlyCurrentUser(tokens.access_token);

    // Check if integration already exists (reconnecting)
    const { data: existing } = await supabaseAdmin
      .from('calendar_integrations')
      .select('id')
      .eq('company_id', company_id)
      .eq('user_id', user_id)
      .eq('provider', 'calendly')
      .maybeSingle();

    const integrationData = {
      company_id,
      user_id,
      provider: 'calendly',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(
        Date.now() + tokens.expires_in * 1000
      ).toISOString(),
      provider_email: userInfo.email,
      provider_user_id: userInfo.uri,
      provider_user_name: userInfo.name,
      is_active: true,
      scopes: ['default'],
      raw_profile: userInfo as unknown as Record<string, unknown>,
    };

    let integrationId: string;

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from('calendar_integrations')
        .update(integrationData)
        .eq('id', existing.id);
      if (updateError) {
        console.error('Failed to update Calendly integration:', updateError);
        throw new Error(`Failed to update integration: ${updateError.message}`);
      }
      integrationId = existing.id;
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('calendar_integrations')
        .insert(integrationData)
        .select('id')
        .single();
      if (insertError || !inserted) {
        console.error('Failed to insert Calendly integration:', insertError);
        throw new Error(`Failed to save integration: ${insertError?.message || 'No data returned'}`);
      }
      integrationId = inserted.id;
    }

    // Create webhook subscription for real-time event updates
    try {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
      const webhookUrl = `${appUrl}/api/integrations/calendly/webhook`;

      // Get the full integration object for the API call
      const { data: integration } = await supabaseAdmin
        .from('calendar_integrations')
        .select('*')
        .eq('id', integrationId)
        .single();

      if (integration) {
        await createCalendlyWebhook(
          integration as unknown as import('@/types/calendar').CalendarIntegration,
          webhookUrl
        );
      }
    } catch (webhookError) {
      // Don't fail the connection if webhook creation fails
      console.error('Failed to create Calendly webhook (non-fatal):', webhookError);
    }

    // Redirect back to origin page with success message
    return NextResponse.redirect(
      new URL(`${redirectBase}?integration=calendly&status=connected`, request.url)
    );
  } catch (error) {
    console.error('Error processing Calendly callback:', error);
    return NextResponse.redirect(
      new URL('/integrations?error=calendly_auth_failed', request.url)
    );
  }
}
