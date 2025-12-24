// app/api/billing/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
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

    const companyId = userData.company_id;

    // Fetch billing history
    const { data: history, error } = await supabase
      .from('billing_history')
      .select('*')
      .eq('company_id', companyId)
      .order('billing_date', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json(history || []);

  } catch (error) {
    console.error('Error fetching billing history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing history', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
