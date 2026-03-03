// app/api/integrations/simplybook/providers/route.ts
// Returns SimplyBook.me providers (staff/performers) with Callengo user cross-reference

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw } from '@/lib/supabase/service';
import { fetchSimplyBookProviders } from '@/lib/simplybook';
import type { SimplyBookIntegration, SimplyBookOrgMember } from '@/types/simplybook';

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

    const { data: integration } = await supabaseAdminRaw
      .from('simplybook_integrations')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!integration) {
      return NextResponse.json({ error: 'No active SimplyBook.me integration' }, { status: 404 });
    }

    // Fetch providers from SimplyBook
    const providersResponse = await fetchSimplyBookProviders(integration as SimplyBookIntegration);

    // Get Callengo company users for cross-reference
    const { data: callengoUsers } = await supabaseAdminRaw
      .from('users')
      .select('id, email')
      .eq('company_id', userData.company_id);

    const callengoEmailMap = new Map<string, string>(
      (callengoUsers || []).map((u: { id: string; email: string }) => [u.email?.toLowerCase(), u.id])
    );

    const members: SimplyBookOrgMember[] = providersResponse.data.map(provider => ({
      sb_provider_id: provider.id,
      name: provider.name,
      email: provider.email || '',
      phone: provider.phone || '',
      is_active: provider.is_active,
      is_visible: provider.is_visible,
      services: provider.services || [],
      already_in_callengo: provider.email ? callengoEmailMap.has(provider.email.toLowerCase()) : false,
      callengo_user_id: provider.email ? callengoEmailMap.get(provider.email.toLowerCase()) : undefined,
    }));

    return NextResponse.json({ providers: members });
  } catch (error) {
    console.error('Error fetching SimplyBook.me providers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch providers' },
      { status: 500 }
    );
  }
}
