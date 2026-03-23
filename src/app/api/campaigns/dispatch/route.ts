// app/api/campaigns/dispatch/route.ts
// Server-side campaign batch dispatch — single master API key architecture
// Enqueues contacts into campaign_queue for background processing (avoids Vercel timeout).
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { checkCallAllowed, getMaxCallDuration } from '@/lib/billing/call-throttle';
import { expensiveLimiter } from '@/lib/rate-limit';
import { getCompanyCallerNumber } from '@/lib/bland/phone-numbers';

const dispatchSchema = z.object({
  company_id: z.string().uuid(),
  campaign_id: z.string().uuid().optional(),
  agent_run_id: z.string().uuid().optional(),
  contacts: z.array(z.object({
    contact_id: z.string().uuid(),
    phone_number: z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format (E.164)'),
    contact_name: z.string().optional(),
  })).min(1).max(500),
  call_config: z.object({
    task: z.string().min(1).max(5000).refine(s => s.trim().length > 0, 'Task cannot be empty'),
    voice: z.string().default('maya'),
    first_sentence: z.string().max(500).optional(),
    voicemail_action: z.enum(['leave_message', 'hangup', 'ignore']).default('leave_message'),
    voicemail_message: z.string().max(1000).optional(),
    max_duration: z.number().int().min(1).max(600).optional(),
    agent_template_slug: z.string().optional(),
    agent_name: z.string().optional(),
  }),
  webhook_url: z.string().url().optional(),
  delay_between_calls_ms: z.number().int().min(500).max(30000).default(2000),
});

// Minimum 5 minutes (300s) between calls to the same contact — handled by Redis contactCooldown
// The delay_between_calls_ms is for sequential dispatch pacing (not same-contact protection)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: 2 campaign dispatches per minute per user
    const rateLimit = await expensiveLimiter.check(2, `campaign_dispatch_${user.id}`);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many dispatch requests. Please wait.' }, { status: 429 });
    }

    const rawBody = await request.json();
    const parseResult = dispatchSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { company_id, campaign_id, agent_run_id, contacts, call_config, webhook_url } = parseResult.data;

    // Verify user belongs to the company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!userData || userData.company_id !== company_id) {
      return NextResponse.json({ error: 'Unauthorized for this company' }, { status: 403 });
    }

    // Initial throttle check before starting
    const initialCheck = await checkCallAllowed(company_id);
    if (!initialCheck.allowed) {
      return NextResponse.json(
        { error: initialCheck.reason, code: initialCheck.reasonCode },
        { status: 429 }
      );
    }

    const planMaxDuration = getMaxCallDuration(initialCheck.planSlug || 'free');
    const effectiveMaxDuration = call_config.max_duration
      ? Math.min(call_config.max_duration, planMaxDuration)
      : planMaxDuration;

    // Build the base webhook URL (use company's custom webhook or the platform webhook)
    const platformWebhook = `${request.nextUrl.origin}/api/bland/webhook`;

    // Get dedicated number if company has one
    const dedicatedNumber = await getCompanyCallerNumber(company_id);

    // Validate all contact_ids belong to this company before dispatching
    const contactIds = contacts.map(c => c.contact_id);
    const { data: validContacts } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('company_id', company_id)
      .in('id', contactIds);
    const validContactIds = new Set((validContacts || []).map(c => c.id));

    // Insert contacts into dispatch queue for background processing
    const queueEntries = contacts
      .filter(c => validContactIds.has(c.contact_id))
      .map((contact, index) => ({
        company_id,
        campaign_id: campaign_id || null,
        agent_run_id: agent_run_id || null,
        contact_id: contact.contact_id,
        phone_number: contact.phone_number,
        contact_name: contact.contact_name || null,
        call_config: JSON.parse(JSON.stringify(call_config)),
        webhook_url: webhook_url || platformWebhook,
        dedicated_number: dedicatedNumber || null,
        effective_max_duration: effectiveMaxDuration,
        status: 'pending',
        priority: index, // Preserve dispatch order
        created_at: new Date().toISOString(),
      }));

    const invalidContacts = contacts
      .filter(c => !validContactIds.has(c.contact_id))
      .map(c => ({ contact_id: c.contact_id, status: 'failed' as const, error: 'Contact not found in company' }));

    if (queueEntries.length === 0) {
      return NextResponse.json({
        status: 'completed',
        summary: { total: contacts.length, queued: 0, failed: invalidContacts.length },
        results: invalidContacts,
      });
    }

    // Batch insert into campaign_queue (Supabase supports bulk insert)
    const { error: queueError } = await supabaseAdmin
      .from('campaign_queue')
      .insert(queueEntries);

    if (queueError) {
      console.error('[dispatch] Failed to enqueue contacts:', queueError);
      return NextResponse.json({ error: 'Failed to enqueue contacts for dispatch' }, { status: 500 });
    }

    // Update agent_run status to 'dispatching'
    if (agent_run_id) {
      await supabaseAdmin
        .from('agent_runs')
        .update({ status: 'dispatching' })
        .eq('id', agent_run_id)
        .in('status', ['pending', 'running', 'active']);
    }

    return NextResponse.json({
      status: 'queued',
      summary: {
        total: contacts.length,
        queued: queueEntries.length,
        failed: invalidContacts.length,
      },
      results: [
        ...queueEntries.map(e => ({ contact_id: e.contact_id, status: 'queued' as const })),
        ...invalidContacts,
      ],
      message: `${queueEntries.length} contacts queued for dispatch. Processing will begin shortly.`,
    });
  } catch (error) {
    console.error('[dispatch] Campaign dispatch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
