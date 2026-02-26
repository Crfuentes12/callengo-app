// app/api/admin/finances/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || (userData.role !== 'admin' && userData.role !== 'owner')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get period from query
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'current';

    let periodStart: Date;
    let periodEnd: Date = new Date();

    switch (period) {
      case 'last_30':
        periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - 30);
        break;
      case 'last_90':
        periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - 90);
        break;
      case 'current':
      default:
        periodStart = new Date();
        periodStart.setDate(1); // First day of current month
        break;
    }

    // Fetch finances
    const { data: finances, error } = await supabase
      .from('admin_finances')
      .select('*')
      .gte('period_start', periodStart.toISOString())
      .lte('period_end', periodEnd.toISOString())
      .order('period_start', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      finances: finances || []
    });

  } catch (error) {
    console.error('Error fetching admin finances:', error);
    return NextResponse.json(
      { error: 'Failed to fetch finances', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
