// app/api/webhooks/endpoints/[id]/route.ts
// Individual webhook endpoint operations: update, delete, test, regenerate secret

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  updateWebhookEndpoint,
  deleteWebhookEndpoint,
  regenerateWebhookSecret,
  sendTestWebhook,
  listWebhookDeliveries,
  ALL_WEBHOOK_EVENTS,
} from '@/lib/webhooks';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';

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
 * PATCH /api/webhooks/endpoints/[id]
 * Update a webhook endpoint.
 * Body: { url?: string, events?: string[], description?: string, is_active?: boolean }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getCompanyAndPlan();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!WEBHOOK_PLANS.includes(ctx.planSlug)) {
      return NextResponse.json({ error: 'Webhooks require Starter plan or higher' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    // Validate URL if provided
    if (body.url) {
      try {
        const parsed = new URL(body.url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return NextResponse.json({ error: 'URL must use HTTP or HTTPS' }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
      }
    }

    // Validate events if provided
    if (body.events) {
      if (!Array.isArray(body.events) || body.events.length === 0) {
        return NextResponse.json({ error: 'At least one event type is required' }, { status: 400 });
      }
      const validTypes = ALL_WEBHOOK_EVENTS.map(e => e.type);
      const invalidEvents = body.events.filter((e: string) => !validTypes.includes(e as typeof validTypes[number]));
      if (invalidEvents.length > 0) {
        return NextResponse.json({ error: `Invalid event types: ${invalidEvents.join(', ')}` }, { status: 400 });
      }
    }

    const endpoint = await updateWebhookEndpoint(id, ctx.companyId, {
      url: body.url,
      events: body.events,
      description: body.description,
      is_active: body.is_active,
    });

    return NextResponse.json({ endpoint });
  } catch (error) {
    console.error('[Webhooks API] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update webhook endpoint' }, { status: 500 });
  }
}

/**
 * DELETE /api/webhooks/endpoints/[id]
 * Delete a webhook endpoint and all its delivery history.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getCompanyAndPlan();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!WEBHOOK_PLANS.includes(ctx.planSlug)) {
      return NextResponse.json({ error: 'Webhooks require Starter plan or higher' }, { status: 403 });
    }

    const { id } = await params;
    await deleteWebhookEndpoint(id, ctx.companyId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Webhooks API] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete webhook endpoint' }, { status: 500 });
  }
}

/**
 * POST /api/webhooks/endpoints/[id]
 * Actions: test, regenerate-secret, deliveries
 * Body: { action: 'test' | 'regenerate-secret' | 'deliveries', limit?: number, offset?: number }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getCompanyAndPlan();
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!WEBHOOK_PLANS.includes(ctx.planSlug)) {
      return NextResponse.json({ error: 'Webhooks require Starter plan or higher' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action } = body;

    if (action === 'test') {
      // Fetch the endpoint
      const { data: endpoint, error } = await supabaseAdmin
        .from('webhook_endpoints')
        .select('*')
        .eq('id', id)
        .eq('company_id', ctx.companyId)
        .single();

      if (error || !endpoint) {
        return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });
      }

      const result = await sendTestWebhook(endpoint);
      return NextResponse.json(result);
    }

    if (action === 'regenerate-secret') {
      const newSecret = await regenerateWebhookSecret(id, ctx.companyId);
      return NextResponse.json({ secret: newSecret });
    }

    if (action === 'deliveries') {
      const deliveries = await listWebhookDeliveries(ctx.companyId, {
        endpointId: id,
        limit: body.limit || 50,
        offset: body.offset || 0,
      });
      return NextResponse.json({ deliveries });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[Webhooks API] POST action error:', error);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
