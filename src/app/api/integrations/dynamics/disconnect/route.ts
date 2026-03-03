// app/api/integrations/dynamics/disconnect/route.ts
// Disconnects the Microsoft Dynamics integration (soft-delete only)

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

    // Soft-delete by marking inactive
    // IMPORTANT: This does NOT delete any data from Microsoft Dynamics.
    // Contacts synced to Callengo remain in Callengo, and all Dynamics contacts remain untouched.
    const { error: updateError } = await supabaseAdmin
      .from('dynamics_integrations')
      .update({ is_active: false })
      .eq('company_id', userData.company_id)
      .eq('is_active', true);

    if (updateError) {
      throw new Error(`Failed to disconnect: ${updateError.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Dynamics:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Microsoft Dynamics' },
      { status: 500 }
    );
  }
}
