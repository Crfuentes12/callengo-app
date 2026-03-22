// app/api/health/route.ts
// Health check endpoint for load balancer probes and uptime monitoring.
// No authentication required (whitelisted in middleware).

import { NextResponse } from 'next/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {};
  let healthy = true;

  // Check Supabase connectivity
  try {
    const { error } = await supabaseAdmin
      .from('subscription_plans')
      .select('id', { count: 'exact', head: true })
      .limit(1);
    checks.database = error ? 'error' : 'ok';
    if (error) healthy = false;
  } catch {
    checks.database = 'error';
    healthy = false;
  }

  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
