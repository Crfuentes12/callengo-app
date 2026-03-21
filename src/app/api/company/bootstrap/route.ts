import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { expensiveLimiter } from '@/lib/rate-limit';

/**
 * POST /api/company/bootstrap
 * Creates a company + user record during onboarding using supabaseAdmin
 * to bypass RLS (new users don't have a company_id yet, so RLS blocks them).
 *
 * Requires authenticated user. Rate-limited to 3 req/min per IP.
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimitResult = expensiveLimiter.check(3, `company-bootstrap:${ip}`);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { companyName, companyWebsite } = await req.json();

    if (!companyName || typeof companyName !== 'string' || companyName.trim().length === 0) {
      return NextResponse.json({ error: 'companyName is required' }, { status: 400 });
    }

    // Check if user already has a company (prevent duplicates)
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle();

    if (existingUser?.company_id) {
      return NextResponse.json({
        status: 'already_exists',
        company_id: existingUser.company_id,
      });
    }

    // Create company using admin client (bypasses RLS)
    const { data: companyData, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: companyName.trim(),
        website: companyWebsite || null,
      })
      .select()
      .single();

    if (companyError || !companyData) {
      console.error('[bootstrap] Company creation failed:', companyError);
      return NextResponse.json({ error: 'Failed to create company' }, { status: 500 });
    }

    // Create or update user record using admin client (bypasses RLS)
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || '';

    const { error: userRecordError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: user.id,
        company_id: companyData.id,
        email: user.email || '',
        full_name: fullName,
        role: 'owner',
      }, { onConflict: 'id' });

    if (userRecordError) {
      console.error('[bootstrap] User record creation failed:', userRecordError);
      // Try to clean up the company we just created
      await supabaseAdmin.from('companies').delete().eq('id', companyData.id);
      return NextResponse.json({ error: 'Failed to create user record' }, { status: 500 });
    }

    // Create company settings using admin client
    const { error: settingsError } = await supabaseAdmin
      .from('company_settings')
      .insert({ company_id: companyData.id });

    if (settingsError) {
      console.error('[bootstrap] Settings creation error (non-fatal):', settingsError);
    }

    console.log(`[bootstrap] Company ${companyData.id} created for user ${user.id}`);

    return NextResponse.json({
      status: 'created',
      company_id: companyData.id,
    });
  } catch (error) {
    console.error('[bootstrap] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
