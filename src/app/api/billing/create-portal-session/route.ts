import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createBillingPortalSession, stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Get current user
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

    // Get user's company (include email and name for Stripe sync)
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('company_id, role, email, full_name')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: 'User data not found' },
        { status: 404 }
      );
    }

    // Check permissions (only owner and admin can manage subscriptions)
    if (userData.role !== 'owner' && userData.role !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get company subscription with Stripe customer ID
    const { data: subscription, error: subscriptionError } = await supabase
      .from('company_subscriptions')
      .select('stripe_customer_id')
      .eq('company_id', userData.company_id)
      .single();

    if (subscriptionError || !subscription || !subscription.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No active Stripe subscription found' },
        { status: 404 }
      );
    }

    // Fetch company details to sync metadata to Stripe
    const { data: company } = await supabase
      .from('companies')
      .select('name, website')
      .eq('id', userData.company_id)
      .single();

    // Update Stripe customer metadata with latest company info
    if (company) {
      const displayName = userData.full_name && company.name
        ? `${userData.full_name} (${company.name})`
        : userData.full_name || company.name || undefined;

      await stripe.customers.update(subscription.stripe_customer_id, {
        ...(displayName && { name: displayName }),
        email: userData.email,
        metadata: {
          company_id: userData.company_id,
          user_id: user.id,
          company_name: company.name || '',
          company_website: company.website || '',
          metadata_updated_at: new Date().toISOString(),
        },
      }).catch((err) => {
        // Non-blocking: don't fail the portal session if metadata update fails
        console.error('[Portal] Error syncing customer metadata:', err);
      });
    }

    // Create billing portal session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const portalSession = await createBillingPortalSession({
      customerId: subscription.stripe_customer_id,
      returnUrl: `${appUrl}/settings`,
    });

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error) {
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      {
        error: 'Failed to create portal session',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
