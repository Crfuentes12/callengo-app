// app/api/company/update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const { name, website, description, industry } = body;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name) updates.name = name;
    if (website !== undefined) updates.website = website;
    if (description !== undefined) updates.description = description;
    if (industry !== undefined) updates.industry = industry;

    const { data, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', userData.company_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ status: 'success', company: data });

  } catch (error) {
    console.error('Error updating company:', error);
    return NextResponse.json(
      { error: 'Failed to update company', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}