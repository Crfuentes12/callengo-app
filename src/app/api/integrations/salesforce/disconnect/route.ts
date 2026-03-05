// app/api/integrations/salesforce/disconnect/route.ts
// Disconnects the Salesforce integration

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
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
    const { error: updateError } = await supabaseAdmin
      .from('salesforce_integrations')
      .update({ is_active: false })
      .eq('company_id', userData.company_id)
      .eq('is_active', true);

    if (updateError) {
      throw new Error(`Failed to disconnect: ${updateError.message}`);
    }

    await logAuditEvent({
      company_id: userData.company_id,
      user_id: user.id,
      action: 'integration.disconnect',
      entity_type: 'integration',
      entity_id: 'salesforce',
      changes: { provider: 'salesforce' },
      request: req,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Salesforce:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Salesforce' },
      { status: 500 }
    );
  }
}
