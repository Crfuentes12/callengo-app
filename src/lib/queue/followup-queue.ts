// lib/queue/followup-queue.ts
// Database-backed queue processor for follow-up calls.
// Reads pending entries from `follow_up_queue`, dispatches calls via Bland AI,
// and updates statuses. Designed to be triggered by a cron job.

import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';

// ============================================================================
// TYPES
// ============================================================================

export interface FollowUpJob {
  id: string;
  company_id: string;
  agent_run_id: string | null;
  contact_id: string;
  original_call_id: string | null;
  attempt_number: number;
  max_attempts: number;
  next_attempt_at: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  reason: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  last_attempt_at: string | null;
}

export interface FollowUpQueueStats {
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
}

// ============================================================================
// PROCESS — Claim and dispatch follow-up calls
// ============================================================================

/**
 * Process pending follow-up jobs whose next_attempt_at has passed.
 * Claims jobs atomically and dispatches them for calling.
 *
 * Returns a summary of what was processed.
 */
export async function processFollowUpBatch(batchSize: number = 10): Promise<{
  processed: number;
  failed: number;
  skipped: number;
  remaining: number;
}> {
  let processed = 0;
  let failed = 0;
  let skipped = 0;

  // Fetch pending jobs that are due
  const now = new Date().toISOString();
  const { data: pendingJobs, error: fetchError } = await supabaseAdmin
    .from('follow_up_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('next_attempt_at', now)
    .order('next_attempt_at', { ascending: true })
    .limit(batchSize);

  if (fetchError || !pendingJobs || pendingJobs.length === 0) {
    if (fetchError) {
      console.error('[followup-queue] Error fetching pending jobs:', fetchError.message);
    }
    const { count } = await supabaseAdmin
      .from('follow_up_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    return { processed: 0, failed: 0, skipped: 0, remaining: count || 0 };
  }

  for (const rawJob of pendingJobs) {
    const job = rawJob as unknown as FollowUpJob;

    // Optimistic lock: try to claim the job
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from('follow_up_queue')
      .update({
        status: 'in_progress',
        last_attempt_at: now,
        attempt_number: job.attempt_number + 1,
      })
      .eq('id', job.id)
      .eq('status', 'pending') // Only claim if still pending
      .select('id')
      .single();

    if (claimError || !claimed) {
      skipped++;
      continue; // Another worker claimed it
    }

    try {
      const result = await executeFollowUp(job);

      if (result.dispatched) {
        processed++;
      } else if (result.maxAttemptsReached) {
        // Mark as failed — exceeded max attempts
        await supabaseAdmin
          .from('follow_up_queue')
          .update({ status: 'failed' })
          .eq('id', job.id);
        failed++;
      } else {
        // Reschedule for next attempt
        const nextRetryHours = Math.min(24 * Math.pow(2, job.attempt_number), 168); // Max 7 days
        const nextAttempt = new Date(Date.now() + nextRetryHours * 60 * 60 * 1000).toISOString();
        await supabaseAdmin
          .from('follow_up_queue')
          .update({
            status: 'pending',
            next_attempt_at: nextAttempt,
          })
          .eq('id', job.id);
        failed++;
      }
    } catch (err) {
      console.error(`[followup-queue] Job ${job.id} failed:`, err);
      // If under max attempts, reschedule; otherwise mark failed
      const newAttempt = job.attempt_number + 1;
      if (newAttempt >= job.max_attempts) {
        await supabaseAdmin
          .from('follow_up_queue')
          .update({ status: 'failed' })
          .eq('id', job.id);
      } else {
        const nextRetryHours = Math.min(24 * Math.pow(2, job.attempt_number), 168);
        await supabaseAdmin
          .from('follow_up_queue')
          .update({
            status: 'pending',
            next_attempt_at: new Date(Date.now() + nextRetryHours * 60 * 60 * 1000).toISOString(),
          })
          .eq('id', job.id);
      }
      failed++;
    }
  }

  // Count remaining
  const { count } = await supabaseAdmin
    .from('follow_up_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  return { processed, failed, skipped, remaining: count || 0 };
}

/**
 * Execute a single follow-up job.
 *
 * Fetches the contact and agent run details, then dispatches a call
 * via the campaign dispatch system. If the contact has been reached
 * or the follow-up is no longer needed, marks as completed without calling.
 */
async function executeFollowUp(job: FollowUpJob): Promise<{
  dispatched: boolean;
  maxAttemptsReached?: boolean;
  error?: string;
}> {
  // Check max attempts
  if (job.attempt_number + 1 >= job.max_attempts) {
    return { dispatched: false, maxAttemptsReached: true };
  }

  // Fetch contact to check current status
  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('id, contact_name, phone_number, status, call_outcome')
    .eq('id', job.contact_id)
    .single();

  if (!contact) {
    console.warn(`[followup-queue] Contact ${job.contact_id} not found, marking completed`);
    await supabaseAdmin
      .from('follow_up_queue')
      .update({ status: 'completed' })
      .eq('id', job.id);
    return { dispatched: false, error: 'Contact not found' };
  }

  // If contact was already reached (confirmed, qualified, verified), skip
  const reachedStatuses = ['contacted', 'qualified', 'Fully Verified'];
  const reachedOutcomes = ['Appointment Confirmed', 'Meeting Scheduled', 'Data Confirmed', 'Data Updated'];
  if (
    reachedStatuses.includes(contact.status || '') ||
    reachedOutcomes.includes(contact.call_outcome || '')
  ) {
    console.log(`[followup-queue] Contact ${job.contact_id} already reached (${contact.status}/${contact.call_outcome}), marking completed`);
    await supabaseAdmin
      .from('follow_up_queue')
      .update({ status: 'completed' })
      .eq('id', job.id);
    return { dispatched: false };
  }

  // Fetch the agent run to get the agent config for dispatch
  if (!job.agent_run_id) {
    console.warn(`[followup-queue] Job ${job.id} has no agent_run_id, marking completed`);
    await supabaseAdmin
      .from('follow_up_queue')
      .update({ status: 'completed' })
      .eq('id', job.id);
    return { dispatched: false, error: 'No agent_run_id' };
  }

  const { data: agentRun } = await supabaseAdmin
    .from('agent_runs')
    .select('id, agent_template_id, settings, status, agent_templates(slug, name)')
    .eq('id', job.agent_run_id)
    .single();

  if (!agentRun || agentRun.status === 'cancelled') {
    console.warn(`[followup-queue] Agent run ${job.agent_run_id} not found or cancelled, marking completed`);
    await supabaseAdmin
      .from('follow_up_queue')
      .update({ status: 'completed' })
      .eq('id', job.id);
    return { dispatched: false, error: 'Agent run not found or cancelled' };
  }

  // Enqueue the contact for a new call via the existing dispatch system
  // We add the follow-up job ID to metadata so the webhook can mark it completed
  const { error: dispatchError } = await supabaseAdmin
    .from('campaign_queue')
    .insert({
      company_id: job.company_id,
      agent_run_id: job.agent_run_id,
      contact_id: job.contact_id,
      status: 'pending',
      priority: 1, // Follow-ups get higher priority
      metadata: JSON.parse(JSON.stringify({
        follow_up_queue_id: job.id,
        follow_up_attempt: job.attempt_number + 1,
        follow_up_reason: job.reason,
        original_call_id: job.original_call_id,
        calendar_event_id: job.metadata?.calendar_event_id,
      })),
    });

  if (dispatchError) {
    console.error(`[followup-queue] Failed to dispatch follow-up for job ${job.id}:`, dispatchError.message);
    return { dispatched: false, error: dispatchError.message };
  }

  // Mark as in_progress (will be completed by the webhook after the call)
  await supabaseAdmin
    .from('follow_up_queue')
    .update({ status: 'in_progress' })
    .eq('id', job.id);

  console.log(`[followup-queue] Dispatched follow-up call for contact ${contact.contact_name} (job ${job.id}, attempt ${job.attempt_number + 1})`);
  return { dispatched: true };
}

// ============================================================================
// STATS
// ============================================================================

export async function getFollowUpQueueStats(companyId?: string): Promise<FollowUpQueueStats> {
  const baseQuery = () => {
    let q = supabaseAdmin.from('follow_up_queue').select('id', { count: 'exact', head: true });
    if (companyId) q = q.eq('company_id', companyId);
    return q;
  };

  const [pending, inProgress, completed, failed] = await Promise.all([
    baseQuery().eq('status', 'pending'),
    baseQuery().eq('status', 'in_progress'),
    baseQuery().eq('status', 'completed'),
    baseQuery().eq('status', 'failed'),
  ]);

  return {
    pending: pending.count || 0,
    in_progress: inProgress.count || 0,
    completed: completed.count || 0,
    failed: failed.count || 0,
  };
}
