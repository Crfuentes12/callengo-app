import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { checkUsageLimit } from '@/lib/billing/usage-tracker';

/**
 * Check if a company can make a call based on their usage limits.
 *
 * For free trial users: blocks calls once 15 minutes are exhausted.
 * For paid users: blocks calls when plan minutes are exceeded.
 * No overage option — users must upgrade to continue.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Verify authentication
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    // Also check for internal service key
    const serviceKey = req.headers.get('x-service-key');
    const isServiceCall = serviceKey === process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!user && !isServiceCall) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Verify user has access to this company
    if (user && !isServiceCall) {
      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (userData?.company_id !== companyId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    const result = await checkUsageLimit(companyId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error checking usage limit:', error);
    return NextResponse.json(
      {
        error: 'Failed to check usage limit',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    const result = await checkUsageLimit(userData.company_id);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error checking usage limit:', error);
    return NextResponse.json(
      {
        error: 'Failed to check usage limit',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
