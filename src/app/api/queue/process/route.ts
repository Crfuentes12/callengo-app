// app/api/queue/process/route.ts
// Background worker endpoint for processing the AI analysis queue.
// Can be triggered by: cron job, Vercel cron, edge function, or manual call.

import { NextRequest, NextResponse } from 'next/server';
import { processBatch, getQueueStats } from '@/lib/queue/analysis-queue';
import { resetStaleConcurrency } from '@/lib/redis/concurrency-manager';

const QUEUE_SECRET = process.env.QUEUE_PROCESSING_SECRET || process.env.CRON_SECRET;

/**
 * POST /api/queue/process
 * Process pending AI analysis jobs.
 * Protected by a shared secret (QUEUE_PROCESSING_SECRET or CRON_SECRET).
 */
export async function POST(request: NextRequest) {
  // Verify authorization — QUEUE_PROCESSING_SECRET or CRON_SECRET is required
  if (!QUEUE_SECRET) {
    console.error('QUEUE_PROCESSING_SECRET or CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Queue processing not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const cronHeader = request.headers.get('x-cron-secret');

  // Removed x-vercel-cron header check — anyone can send that header.
  // Use only secret-based authorization.
  const authorized =
    (authHeader === `Bearer ${QUEUE_SECRET}`) ||
    (cronHeader === QUEUE_SECRET);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const batchSize = Math.min((body as Record<string, number>).batch_size || 10, 50);

    const result = await processBatch(batchSize);

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[queue/process] Error:', error);
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/queue/process
 * Returns queue stats (for monitoring dashboards).
 * Also serves as the Vercel Cron endpoint — triggers batch processing on cron hits.
 */
export async function GET(request: NextRequest) {
  if (!QUEUE_SECRET) {
    return NextResponse.json({ error: 'Queue processing not configured' }, { status: 500 });
  }

  // Accept both QUEUE_PROCESSING_SECRET and CRON_SECRET for authorization.
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> automatically.
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
    // If called by Vercel Cron (no company_id param), process the queue batch
    const companyId = request.nextUrl.searchParams.get('company_id') || undefined;

    if (!companyId) {
      // Cron hit — process pending jobs + reconcile Redis concurrency counters
      const [result] = await Promise.all([
        processBatch(10),
        resetStaleConcurrency().catch(err =>
          console.error('[queue/process] Concurrency reconciliation failed (non-fatal):', err)
        ),
      ]);
      return NextResponse.json({
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      });
    }

    // Manual monitoring call — return stats
    const stats = await getQueueStats(companyId);

    return NextResponse.json({
      queue: 'analysis',
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[queue/process] Stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
