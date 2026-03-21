// app/api/billing/phone-numbers/release/route.ts
// Release a dedicated phone number from the company
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { releaseNumberFromCompany } from '@/lib/bland/phone-numbers';

const releaseSchema = z.object({
  addon_id: z.string().uuid('Invalid addon ID'),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 });
    }

    if (userData.role !== 'owner' && userData.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    const parseResult = releaseSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { addon_id } = parseResult.data;

    const result = await releaseNumberFromCompany(userData.company_id, addon_id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Log billing event
    await supabaseAdmin.from('billing_events').insert({
      company_id: userData.company_id,
      event_type: 'addon_canceled',
      event_data: {
        addon_type: 'dedicated_number',
        addon_id,
        note: 'Number released from company — stays on master Bland account for reassignment',
      },
      minutes_consumed: 0,
      cost_usd: 0,
    });

    return NextResponse.json({
      status: 'success',
      message: 'Dedicated number released. Your calls will now use auto-rotated numbers from the Callengo pool.',
    });
  } catch (error) {
    console.error('[phone-numbers/release] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
