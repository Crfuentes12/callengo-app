// lib/queue/analysis-queue.ts
// Database-backed async queue for AI analysis processing.
// Decouples webhook response from expensive GPT-4o-mini calls.

import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import {
  analyzeCallIntent,
  type AppointmentIntentResult,
  type LeadQualificationResult,
  type DataValidationResult,
} from '@/lib/ai/intent-analyzer';

// ============================================================================
// TYPES
// ============================================================================

export interface AnalysisJob {
  id: string;
  company_id: string;
  call_log_id: string;
  contact_id: string | null;
  agent_run_id: string | null;
  template_slug: string;
  transcript: string;
  call_metadata: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result: Record<string, unknown> | null;
  error_message: string | null;
  attempts: number;
  max_attempts: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

// ============================================================================
// ENQUEUE — Called from webhook handler (fast path)
// ============================================================================

/**
 * Enqueue a transcript for async AI analysis.
 * Returns immediately so the webhook can respond fast.
 */
export async function enqueueAnalysis(params: {
  companyId: string;
  callLogId: string;
  contactId: string | null;
  agentRunId: string | null;
  templateSlug: string;
  transcript: string;
  callMetadata: Record<string, unknown>;
}): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('analysis_queue')
    .insert({
      company_id: params.companyId,
      call_log_id: params.callLogId,
      contact_id: params.contactId,
      agent_run_id: params.agentRunId,
      template_slug: params.templateSlug,
      transcript: params.transcript,
      call_metadata: params.callMetadata,
      status: 'pending',
      attempts: 0,
      max_attempts: 3,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[analysis-queue] Failed to enqueue:', error.message);
    return null;
  }

  return data?.id || null;
}

// ============================================================================
// PROCESS — Called by the worker endpoint (background)
// ============================================================================

/**
 * Claim and process the next pending analysis job.
 * Uses SELECT ... FOR UPDATE SKIP LOCKED pattern for concurrency safety.
 */
export async function processNextJob(): Promise<{
  processed: boolean;
  jobId?: string;
  error?: string;
}> {
  // Claim next pending job atomically
  const { data: job, error: claimError } = await supabaseAdmin
    .rpc('claim_analysis_job')
    .single();

  if (claimError || !job) {
    // No jobs available or RPC doesn't exist yet — try fallback
    return await processNextJobFallback();
  }

  return await executeJob(job as unknown as AnalysisJob);
}

/**
 * Fallback claim method (without RPC, uses simple update)
 */
async function processNextJobFallback(): Promise<{
  processed: boolean;
  jobId?: string;
  error?: string;
}> {
  // Find oldest pending job
  const { data: pendingJobs } = await supabaseAdmin
    .from('analysis_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1);

  if (!pendingJobs || pendingJobs.length === 0) {
    return { processed: false };
  }

  const job = pendingJobs[0] as unknown as AnalysisJob;

  // Try to claim it (optimistic lock via status check)
  const { data: claimed, error: updateError } = await supabaseAdmin
    .from('analysis_queue')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
      attempts: job.attempts + 1,
    })
    .eq('id', job.id)
    .eq('status', 'pending') // Only claim if still pending
    .select('*')
    .single();

  if (updateError || !claimed) {
    return { processed: false }; // Someone else claimed it
  }

  return await executeJob({ ...job, ...claimed } as unknown as AnalysisJob);
}

/**
 * Execute a claimed analysis job
 */
async function executeJob(job: AnalysisJob): Promise<{
  processed: boolean;
  jobId: string;
  error?: string;
}> {
  try {
    const contactName = job.call_metadata?.contact_name as string || 'Unknown';

    // Run AI analysis
    const intentResult = await analyzeCallIntent(job.template_slug, job.transcript, {
      ...job.call_metadata,
      contact_name: contactName,
    });

    // Store result in the queue job
    await supabaseAdmin
      .from('analysis_queue')
      .update({
        status: 'completed',
        result: JSON.parse(JSON.stringify(intentResult)),
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    // Store AI analysis in call_log metadata
    const { data: callLog } = await supabaseAdmin
      .from('call_logs')
      .select('metadata')
      .eq('id', job.call_log_id)
      .single();

    const existingMeta = (callLog?.metadata as Record<string, unknown>) || {};
    await supabaseAdmin
      .from('call_logs')
      .update({
        metadata: {
          ...existingMeta,
          ai_intent_analysis: JSON.parse(JSON.stringify(intentResult)),
          analysis_timestamp: new Date().toISOString(),
          analysis_mode: 'async_queue',
        },
      })
      .eq('id', job.call_log_id);

    // Apply intent results to contact/calendar (same logic as sync webhook)
    await applyIntentResults(job, intentResult);

    return { processed: true, jobId: job.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[analysis-queue] Job ${job.id} failed:`, errorMsg);

    // job.attempts was already incremented during claim, so compare directly
    const newStatus = job.attempts >= job.max_attempts ? 'failed' : 'pending';
    await supabaseAdmin
      .from('analysis_queue')
      .update({
        status: newStatus,
        error_message: errorMsg,
        completed_at: newStatus === 'failed' ? new Date().toISOString() : null,
      })
      .eq('id', job.id);

    return { processed: true, jobId: job.id, error: errorMsg };
  }
}

/**
 * Apply AI intent analysis results to contacts, calendar events, etc.
 * Mirrors the synchronous logic from the webhook but runs asynchronously.
 */
async function applyIntentResults(
  job: AnalysisJob,
  intentResult: AppointmentIntentResult | LeadQualificationResult | DataValidationResult
): Promise<void> {
  const contactId = job.contact_id;
  if (!contactId) return;

  // ---- Appointment Confirmation ----
  if (job.template_slug === 'appointment-confirmation') {
    const apptResult = intentResult as AppointmentIntentResult;

    if (apptResult.extractedData && Object.keys(apptResult.extractedData).length > 0) {
      const { data: contactData } = await supabaseAdmin
        .from('contacts')
        .select('custom_fields')
        .eq('id', contactId)
        .single();
      const cf = (contactData?.custom_fields as Record<string, unknown>) || {};
      await supabaseAdmin
        .from('contacts')
        .update({
          custom_fields: {
            ...cf,
            ...apptResult.extractedData,
            ai_sentiment: apptResult.patientSentiment,
            ai_analyzed_at: new Date().toISOString(),
          },
        })
        .eq('id', contactId);
    }
  }

  // ---- Lead Qualification ----
  if (job.template_slug === 'lead-qualification') {
    const leadResult = intentResult as LeadQualificationResult;
    const { data: contactData } = await supabaseAdmin
      .from('contacts')
      .select('custom_fields')
      .eq('id', contactId)
      .single();
    const cf = (contactData?.custom_fields as Record<string, unknown>) || {};
    await supabaseAdmin
      .from('contacts')
      .update({
        custom_fields: JSON.parse(JSON.stringify({
          ...cf,
          qualification_score: leadResult.qualificationScore,
          budget: leadResult.budget || cf.budget,
          authority: leadResult.authority || cf.authority,
          need: leadResult.need || cf.need,
          timeline: leadResult.timeline || cf.timeline,
          ...leadResult.extractedData,
          ai_analyzed_at: new Date().toISOString(),
        })),
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId);
  }

  // ---- Data Validation ----
  if (job.template_slug === 'data-validation') {
    const dvResult = intentResult as DataValidationResult;
    if (dvResult.intent === 'data_confirmed' || dvResult.intent === 'data_updated' || dvResult.intent === 'partial') {
      const contactUpdates: Record<string, unknown> = {};
      const extracted = dvResult.extractedData || {};

      if (extracted.contact_name) contactUpdates.contact_name = extracted.contact_name;
      if (extracted.email) contactUpdates.email = extracted.email;
      if (extracted.address) contactUpdates.address = extracted.address;
      if (extracted.city) contactUpdates.city = extracted.city;
      if (extracted.state) contactUpdates.state = extracted.state;
      if (extracted.zip_code) contactUpdates.zip_code = extracted.zip_code;
      if (extracted.company_name) contactUpdates.company_name = extracted.company_name;

      const { data: contactData } = await supabaseAdmin
        .from('contacts')
        .select('custom_fields')
        .eq('id', contactId)
        .single();
      const cf = (contactData?.custom_fields as Record<string, unknown>) || {};

      const extraFields: Record<string, unknown> = {};
      const newFields = dvResult.newFields || {};
      for (const [key, value] of Object.entries({ ...extracted, ...newFields })) {
        if (!['contact_name', 'email', 'address', 'city', 'state', 'zip_code', 'company_name', 'phone'].includes(key) && value) {
          extraFields[key] = value;
        }
      }

      for (const [field, validation] of Object.entries(dvResult.validatedFields)) {
        if (validation.status === 'updated' && validation.newValue) {
          extraFields[`validated_${field}`] = validation.newValue;
        }
        extraFields[`validation_status_${field}`] = validation.status;
      }

      contactUpdates.custom_fields = {
        ...cf,
        ...extraFields,
        data_validated: true,
        data_validated_at: new Date().toISOString(),
        validation_summary: dvResult.summary,
      };
      contactUpdates.updated_at = new Date().toISOString();

      if (dvResult.intent === 'data_confirmed' || dvResult.intent === 'data_updated') {
        contactUpdates.status = 'Fully Verified';
        contactUpdates.call_outcome = dvResult.intent === 'data_confirmed' ? 'Data Confirmed' : 'Data Updated';
      }

      await supabaseAdmin
        .from('contacts')
        .update(contactUpdates)
        .eq('id', contactId);
    }
  }
}

// ============================================================================
// BATCH PROCESSOR — Process multiple jobs in one invocation
// ============================================================================

/**
 * Process up to `batchSize` pending jobs.
 * Uses a DB-based lock to prevent overlap when two cron invocations fire simultaneously.
 * Designed to be called by a cron or edge function.
 */
export async function processBatch(batchSize: number = 10): Promise<{
  processed: number;
  failed: number;
  remaining: number;
  skipped_locked?: boolean;
}> {
  // Lightweight overlap guard: try to insert a processing lock row.
  // If another invocation is already running, skip this batch.
  const lockId = '00000000-0000-0000-0000-000000000001';
  const { error: lockError } = await supabaseAdmin
    .from('analysis_queue')
    .upsert({
      id: lockId,
      status: 'processing',
      company_id: '00000000-0000-0000-0000-000000000000',
      call_log_id: '00000000-0000-0000-0000-000000000000',
      template_slug: '_lock',
      transcript: '',
      call_metadata: {},
      attempts: 0,
      max_attempts: 1,
      started_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .eq('status', 'completed'); // Only acquire if previous lock was released (completed)

  // If we couldn't acquire the lock, another batch is running — skip gracefully
  // Note: if the lock row doesn't exist yet or is in 'completed' state, upsert succeeds
  if (lockError) {
    console.log('[analysis-queue] Another batch is running, skipping');
    const { count } = await supabaseAdmin
      .from('analysis_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    return { processed: 0, failed: 0, remaining: count || 0, skipped_locked: true };
  }

  let processed = 0;
  let failed = 0;

  try {
    for (let i = 0; i < batchSize; i++) {
      const result = await processNextJob();
      if (!result.processed) break; // No more jobs
      if (result.error) {
        failed++;
      } else {
        processed++;
      }
    }
  } finally {
    // Release the lock
    try {
      await supabaseAdmin
        .from('analysis_queue')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', lockId);
    } catch {} // Non-fatal if lock release fails
  }

  // Count remaining
  const { count } = await supabaseAdmin
    .from('analysis_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  return { processed, failed, remaining: count || 0 };
}

// ============================================================================
// STATS
// ============================================================================

export async function getQueueStats(companyId?: string): Promise<QueueStats> {
  const baseQuery = () => {
    let q = supabaseAdmin.from('analysis_queue').select('id', { count: 'exact', head: true });
    if (companyId) q = q.eq('company_id', companyId);
    return q;
  };

  const [pending, processing, completed, failed] = await Promise.all([
    baseQuery().eq('status', 'pending'),
    baseQuery().eq('status', 'processing'),
    baseQuery().eq('status', 'completed'),
    baseQuery().eq('status', 'failed'),
  ]);

  return {
    pending: pending.count || 0,
    processing: processing.count || 0,
    completed: completed.count || 0,
    failed: failed.count || 0,
  };
}
