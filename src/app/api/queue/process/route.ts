// app/api/queue/process/route.ts
// Background worker endpoint for processing the AI analysis queue.
// Can be triggered by: cron job, Vercel cron, edge function, or manual call.

import { NextRequest, NextResponse } from 'next/server';
import { processBatch, getQueueStats } from '@/lib/queue/analysis-queue';

const QUEUE_SECRET = process.env.QUEUE_PROCESSING_SECRET || process.env.CRON_SECRET;

/**
 * POST /api/queue/process
 * Process pending AI analysis jobs.
 * Protected by a shared secret (QUEUE_PROCESSING_SECRET or CRON_SECRET).
 */
export async function POST(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization');
  const cronHeader = request.headers.get('x-cron-secret');
  const vercelCron = request.headers.get('x-vercel-cron');

  const authorized =
    vercelCron === '1' || // Vercel Cron
    (QUEUE_SECRET && authHeader === `Bearer ${QUEUE_SECRET}`) ||
    (QUEUE_SECRET && cronHeader === QUEUE_SECRET);

  if (!authorized && QUEUE_SECRET) {
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
      { error: 'Processing failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/queue/process
 * Returns queue stats (for monitoring dashboards).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (QUEUE_SECRET && authHeader !== `Bearer ${QUEUE_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const companyId = request.nextUrl.searchParams.get('company_id') || undefined;
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
