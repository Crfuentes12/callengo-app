// app/api/webhooks/endpoints/route.ts
// CRUD API for managing outbound webhook endpoints

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  listWebhookEndpoints,
  createWebhookEndpoint,
  ALL_WEBHOOK_EVENTS,
} from '@/lib/webhooks';

// Plan gating: webhooks require Starter plan or higher
const WEBHOOK_PLANS = ['starter', 'business', 'teams', 'enterprise'];

async function getCompanyAndPlan() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user.id)
    .single();

  if (!userData?.company_id) return null;

  const { data: subscription } = await supabase
    .from('company_subscriptions')
    .select('subscription_plans(slug)')
    .eq('company_id', userData.company_id)
    .eq('status', 'active')
    .maybeSingle();

  const planSlug = (subscription?.subscription_plans as { slug?: string } | null)?.slug || 'free';

  return { companyId: userData.company_id, planSlug };
}

/**
 * GET /api/webhooks/endpoints
 * List all webhook endpoints for the company.
 * Also returns the list of available event types.
 */
export async function GET() {
  try {
    const ctx = await getCompanyAndPlan();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!WEBHOOK_PLANS.includes(ctx.planSlug)) {
      return NextResponse.json({ error: 'Webhooks require Starter plan or higher' }, { status: 403 });
    }

    const endpoints = await listWebhookEndpoints(ctx.companyId);

    return NextResponse.json({
      endpoints,
      available_events: ALL_WEBHOOK_EVENTS,
    });
  } catch (error) {
    console.error('[Webhooks API] GET error:', error);
    return NextResponse.json({ error: 'Failed to list webhook endpoints' }, { status: 500 });
  }
}

/**
 * POST /api/webhooks/endpoints
 * Create a new webhook endpoint.
 * Body: { url: string, events: string[], description?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getCompanyAndPlan();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!WEBHOOK_PLANS.includes(ctx.planSlug)) {
      return NextResponse.json({ error: 'Webhooks require Starter plan or higher' }, { status: 403 });
    }

    const body = await req.json();
    const { url, events, description } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL format
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return NextResponse.json({ error: 'URL must use HTTP or HTTPS' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'At least one event type is required' }, { status: 400 });
    }

    // Validate event types
    const validTypes = ALL_WEBHOOK_EVENTS.map(e => e.type);
    const invalidEvents = events.filter((e: string) => !validTypes.includes(e as typeof validTypes[number]));
    if (invalidEvents.length > 0) {
      return NextResponse.json({ error: `Invalid event types: ${invalidEvents.join(', ')}` }, { status: 400 });
    }

    // Limit endpoints per company (max 10)
    const existing = await listWebhookEndpoints(ctx.companyId);
    if (existing.length >= 10) {
      return NextResponse.json({ error: 'Maximum of 10 webhook endpoints allowed' }, { status: 400 });
    }

    const endpoint = await createWebhookEndpoint(ctx.companyId, url, events, description);

    return NextResponse.json({ endpoint }, { status: 201 });
  } catch (error) {
    console.error('[Webhooks API] POST error:', error);
    return NextResponse.json({ error: 'Failed to create webhook endpoint' }, { status: 500 });
  }
}
