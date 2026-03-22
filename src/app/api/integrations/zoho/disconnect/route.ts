// app/api/integrations/zoho/disconnect/route.ts
// Disconnects the Zoho CRM integration (soft-delete only)

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';

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

    // Find the active integration to get its ID for mapping cleanup
    const { data: integration } = await supabaseAdmin
      .from('zoho_integrations')
      .select('id')
      .eq('company_id', userData.company_id)
      .eq('is_active', true)
      .maybeSingle();

    // Soft-delete by marking inactive
    // IMPORTANT: This does NOT delete any data from Zoho CRM.
    // Contacts synced to Callengo remain in Callengo, and all Zoho contacts remain untouched.
    const { error: updateError } = await supabaseAdmin
      .from('zoho_integrations')
      .update({ is_active: false })
      .eq('company_id', userData.company_id)
      .eq('is_active', true);

    if (updateError) {
      throw new Error(`Failed to disconnect: ${updateError.message}`);
    }

    // Clean up contact mappings for this integration
    if (integration?.id) {
      await supabaseAdmin
        .from('zoho_contact_mappings')
        .delete()
        .eq('integration_id', integration.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Zoho:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Zoho CRM' },
      { status: 500 }
    );
  }
}
