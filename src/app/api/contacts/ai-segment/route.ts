// app/api/contacts/ai-segment/route.ts
// Creates a contact list from AI suggestion and assigns matching contacts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { validateBody } from '@/lib/validation';
import { apiLimiter, applyRateLimit } from '@/lib/rate-limit';

const listFiltersSchema = z.object({
  status: z.array(z.string()).optional(),
  city: z.array(z.string()).optional(),
  state: z.array(z.string()).optional(),
  source: z.array(z.string()).optional(),
  has_email: z.boolean().optional(),
  has_phone: z.boolean().optional(),
  call_attempts_gte: z.number().int().min(0).optional(),
  call_attempts_eq: z.number().int().min(0).optional(),
});

const aiSegmentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().default(''),
  color: z.string().optional().default('#3b82f6'),
  filters: listFiltersSchema.optional().default({}),
  criteria: z.string().optional().default(''),
});

interface ListFilters {
  status?: string[];
  city?: string[];
  state?: string[];
  source?: string[];
  has_email?: boolean;
  has_phone?: boolean;
  call_attempts_gte?: number;
  call_attempts_eq?: number;
}

export async function POST(request: NextRequest) {
  const rateLimitResult = applyRateLimit(request, apiLimiter, 60);
  if (rateLimitResult) return rateLimitResult;

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

    const body = await request.json();
    const validation = validateBody(aiSegmentSchema, body);
    if (!validation.success) return validation.response;
    const { name, description, color, filters, criteria } = validation.data;

    // Step 1: Create the contact list
    const { data: newList, error: listError } = await supabase
      .from('contact_lists')
      .insert({
        company_id: userData.company_id,
        name,
        description: `${description}${criteria ? ` | Criteria: ${criteria}` : ''}`,
        color: color || '#3b82f6',
      })
      .select('id')
      .single();

    if (listError) throw listError;
    const listId = newList.id;

    // Step 2: Build and execute paginated query to find ALL matching contacts
    const buildFilteredQuery = (pg: number, pgSize: number) => {
      let q = supabase
        .from('contacts')
        .select('id')
        .eq('company_id', userData.company_id);

      if (filters) {
        if (filters.status && filters.status.length > 0) {
          q = q.in('status', filters.status);
        }
        if (filters.city && filters.city.length > 0) {
          q = q.in('city', filters.city);
        }
        if (filters.state && filters.state.length > 0) {
          q = q.in('state', filters.state);
        }
        if (filters.source && filters.source.length > 0) {
          q = q.in('source', filters.source);
        }
        if (filters.has_email === true) {
          q = q.not('email', 'is', null);
        } else if (filters.has_email === false) {
          q = q.is('email', null);
        }
        if (filters.has_phone === true) {
          q = q.not('phone_number', 'is', null);
        } else if (filters.has_phone === false) {
          q = q.is('phone_number', null);
        }
        if (filters.call_attempts_gte !== undefined) {
          q = q.gte('call_attempts', filters.call_attempts_gte);
        }
        if (filters.call_attempts_eq !== undefined) {
          q = q.eq('call_attempts', filters.call_attempts_eq);
        }
      }

      return q.range(pg * pgSize, (pg + 1) * pgSize - 1);
    };

    let allContactIds: string[] = [];
    let fetchPage = 0;
    const fetchPageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: pageContacts, error: fetchError } = await buildFilteredQuery(fetchPage, fetchPageSize);

      if (fetchError) throw fetchError;

      if (pageContacts && pageContacts.length > 0) {
        allContactIds = allContactIds.concat(pageContacts.map((c: { id: string }) => c.id));
        hasMore = pageContacts.length === fetchPageSize;
        fetchPage++;
      } else {
        hasMore = false;
      }
    }

    // Step 3: Assign matching contacts to the list in batches
    let assignedCount = 0;
    if (allContactIds.length > 0) {
      const batchSize = 500;

      for (let i = 0; i < allContactIds.length; i += batchSize) {
        const batch = allContactIds.slice(i, i + batchSize);
        const { error: updateError } = await supabase
          .from('contacts')
          .update({ list_id: listId })
          .in('id', batch);

        if (updateError) {
          console.error(`Batch update error (batch ${i / batchSize + 1}):`, updateError);
        } else {
          assignedCount += batch.length;
        }
      }
    }

    return NextResponse.json({
      listId,
      name,
      assignedCount,
      totalMatched: allContactIds.length,
    });
  } catch (error) {
    console.error('AI segment creation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create segment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
