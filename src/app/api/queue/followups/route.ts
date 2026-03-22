// app/api/queue/followups/route.ts
// Background worker endpoint for processing the follow-up call queue.
// Can be triggered by: cron job, Vercel cron, edge function, or manual call.

import { NextRequest, NextResponse } from 'next/server';
import { processFollowUpBatch, getFollowUpQueueStats } from '@/lib/queue/followup-queue';

const QUEUE_SECRET = process.env.QUEUE_PROCESSING_SECRET || process.env.CRON_SECRET;

/**
 * POST /api/queue/followups
 * Process pending follow-up call jobs.
 * Protected by a shared secret (QUEUE_PROCESSING_SECRET or CRON_SECRET).
 */
export async function POST(request: NextRequest) {
  if (!QUEUE_SECRET) {
    console.error('QUEUE_PROCESSING_SECRET or CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Queue processing not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const cronHeader = request.headers.get('x-cron-secret');

  const authorized =
    (authHeader === `Bearer ${QUEUE_SECRET}`) ||
    (cronHeader === QUEUE_SECRET);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const batchSize = Math.min((body as Record<string, number>).batch_size || 10, 50);

    const result = await processFollowUpBatch(batchSize);

    return NextResponse.json({
      success: true,
      queue: 'followups',
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[queue/followups] Error:', error);
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/queue/followups
 * Returns follow-up queue stats (for monitoring dashboards).
 * Also serves as a Vercel Cron endpoint — triggers batch processing on cron hits.
 */
export async function GET(request: NextRequest) {
  if (!QUEUE_SECRET) {
    return NextResponse.json({ error: 'Queue processing not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const cronHeader = request.headers.get('x-cron-secret');
  const cronSecret = process.env.CRON_SECRET;

  const authorized =
    (authHeader === `Bearer ${QUEUE_SECRET}`) ||
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (cronHeader === QUEUE_SECRET);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const companyId = request.nextUrl.searchParams.get('company_id') || undefined;

    if (!companyId) {
      // Cron hit — process pending follow-up jobs
      const result = await processFollowUpBatch(10);
      return NextResponse.json({
        success: true,
        queue: 'followups',
        ...result,
        timestamp: new Date().toISOString(),
      });
    }

    // Manual monitoring call — return stats
    const stats = await getFollowUpQueueStats(companyId);

    return NextResponse.json({
      queue: 'followups',
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[queue/followups] Stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
