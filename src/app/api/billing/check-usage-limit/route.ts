import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { checkUsageLimit } from '@/lib/billing/usage-tracker';

/**
 * API endpoint to check if a company can make a call based on usage limits
 * This should be called before initiating any call
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await req.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Verify user has access to this company (if authenticated)
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (userData?.company_id !== companyId) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        );
      }
    }

    // Check usage limit
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

/**
 * GET endpoint to retrieve usage limit information
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json(
        { error: 'User data not found' },
        { status: 404 }
      );
    }

    // Check usage limit
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
