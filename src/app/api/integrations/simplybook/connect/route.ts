// app/api/integrations/simplybook/connect/route.ts
// Connects to SimplyBook.me using company login + user credentials (NOT OAuth)

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw } from '@/lib/supabase/service';
import { authenticateSimplyBook, getSimplyBookUserInfo } from '@/lib/simplybook';

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

    // Check plan access (starter+ required for SimplyBook)
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('subscription_plans ( slug )')
      .eq('company_id', userData.company_id)
      .eq('status', 'active')
      .single();

    const planSlug = (subscription?.subscription_plans as unknown as { slug: string })?.slug || 'free';
    if (!['starter', 'growth', 'business', 'teams', 'enterprise'].includes(planSlug)) {
      return NextResponse.json(
        { error: 'SimplyBook.me integration requires Starter plan or higher' },
        { status: 403 }
      );
    }

    // Parse credentials from request body
    const body = await request.json();
    const { company_login, user_login, user_password } = body;

    if (!company_login || !user_login || !user_password) {
      return NextResponse.json(
        { error: 'Missing required fields: company_login, user_login, user_password' },
        { status: 400 }
      );
    }

    // Deactivate any existing SimplyBook integration for this company
    await supabaseAdminRaw
      .from('simplybook_integrations')
      .update({ is_active: false })
      .eq('company_id', userData.company_id)
      .eq('is_active', true);

    // Authenticate with SimplyBook.me
    const tokenData = await authenticateSimplyBook(company_login, user_login, user_password);

    // Fetch user info
    const userInfo = await getSimplyBookUserInfo(tokenData.token, company_login);

    // Token expires in ~24h; set conservative 20h window
    const expiresAt = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString();

    // Store the integration
    const { data: integration, error: insertErr } = await supabaseAdminRaw
      .from('simplybook_integrations')
      .insert({
        company_id: userData.company_id,
        user_id: user.id,
        sb_company_login: company_login,
        sb_user_login: user_login,
        sb_token: tokenData.token,
        sb_refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt,
        sb_user_id: userInfo.id ? String(userInfo.id) : null,
        sb_user_name: [userInfo.firstname, userInfo.lastname].filter(Boolean).join(' ') || tokenData.login || null,
        sb_user_email: userInfo.email || null,
        sb_company_name: userInfo.company?.name || company_login,
        sb_domain: tokenData.domain || `${company_login}.simplybook.me`,
        token_issued_at: new Date().toISOString(),
        is_active: true,
        raw_profile: userInfo as unknown as Record<string, unknown>,
      })
      .select('id')
      .single();

    if (insertErr) {
      throw new Error(`Failed to store integration: ${insertErr.message}`);
    }

    return NextResponse.json({
      success: true,
      integration_id: integration.id,
      company_name: userInfo.company?.name || company_login,
      user_name: [userInfo.firstname, userInfo.lastname].filter(Boolean).join(' '),
      user_email: userInfo.email,
    });
  } catch (error) {
    console.error('Error connecting SimplyBook.me:', error);
    const message = error instanceof Error ? error.message : 'Failed to connect';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
