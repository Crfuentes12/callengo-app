// app/api/contacts/route.ts
// Paginated contacts API with sorting, filtering, search, and stats
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();
    if (!userData?.company_id) return NextResponse.json({ error: 'No company found' }, { status: 404 });

    const params = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(params.get('page') || '1'));
    const pageSize = Math.min(200, Math.max(10, parseInt(params.get('pageSize') || '50')));
    const sortBy = params.get('sortBy') || 'created_at';
    const sortOrder = params.get('sortOrder') === 'asc' ? true : false;
    const search = params.get('search') || '';
    const status = params.get('status') || '';
    const listId = params.get('listId') || '';
    const source = params.get('source') || '';
    const tags = params.get('tags') || '';
    const hasEmail = params.get('hasEmail');
    const hasPhone = params.get('hasPhone');
    const dateFrom = params.get('dateFrom') || '';
    const dateTo = params.get('dateTo') || '';

    // Allowed sort columns to prevent injection
    const allowedSortColumns = [
      'created_at', 'updated_at', 'company_name', 'contact_name', 'email',
      'phone_number', 'status', 'city', 'state', 'call_attempts',
      'last_call_date', 'call_duration', 'source',
    ];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';

    // Build query with exact count
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('company_id', userData.company_id);

    // Apply filters
    if (search) {
      query = query.or(
        `company_name.ilike.%${search}%,phone_number.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%,city.ilike.%${search}%`
      );
    }
    if (status) query = query.eq('status', status);
    if (listId === 'none') {
      query = query.is('list_id', null);
    } else if (listId) {
      query = query.eq('list_id', listId);
    }
    if (source) query = query.eq('source', source);
    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
      query = query.overlaps('tags', tagArray);
    }
    if (hasEmail === 'true') query = query.not('email', 'is', null);
    if (hasPhone === 'true') query = query.not('phone_number', 'is', null);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    // Sort and paginate
    query = query.order(safeSortBy, { ascending: sortOrder });
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: contacts, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      contacts: contacts || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    });
  } catch (error) {
    console.error('Contacts API error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch contacts';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
