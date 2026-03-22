// app/api/admin/reconcile/route.ts
// Usage Reconciliation — detects discrepancies between call_logs and usage_tracking
// This is READ-ONLY. It NEVER moves money. It just reports discrepancies.
import { NextResponse } from 'next/server';
import { expensiveLimiter } from '@/lib/rate-limit';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || userData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const rateLimit = await expensiveLimiter.check(5, `reconcile_${user.id}`);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Get all active companies with subscriptions
    const { data: subscriptions } = await supabaseAdmin
      .from('company_subscriptions')
      .select('company_id, id')
      .in('status', ['active', 'trialing']);

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ discrepancies: [], summary: { total: 0, withIssues: 0, critical: 0, major: 0, minor: 0, ok: 0 } });
    }

    // Filter out orphaned companies (no users or archived)
    const { data: usersWithCompanies } = await supabaseAdmin
      .from('users')
      .select('company_id');
    const { data: allCompanies } = await supabaseAdmin
      .from('companies')
      .select('id, name');

    const companiesWithUsers = new Set(
      (usersWithCompanies || []).map(u => u.company_id).filter(Boolean)
    );
    const archivedNames = new Set(
      (allCompanies || []).filter(c => c.name.startsWith('[ARCHIVED] ')).map(c => c.id)
    );

    const companyIds = subscriptions
      .map(s => s.company_id)
      .filter(id => companiesWithUsers.has(id) && !archivedNames.has(id));

    if (companyIds.length === 0) {
      return NextResponse.json({ discrepancies: [], summary: { total: 0, withIssues: 0, critical: 0, major: 0, minor: 0, ok: 0 } });
    }

    // Get call_logs minutes per company (source of truth from Bland webhooks)
    const { data: callLogs } = await supabaseAdmin
      .from('call_logs')
      .select('company_id, call_length, status')
      .in('company_id', companyIds)
      .gte('created_at', monthStart)
      .eq('status', 'completed');

    // Calculate actual minutes from call_logs
    const actualMinutesByCompany = new Map<string, number>();
    const callCountByCompany = new Map<string, number>();
    (callLogs || []).forEach(log => {
      const minutes = Math.ceil((log.call_length || 0) / 60);
      actualMinutesByCompany.set(
        log.company_id,
        (actualMinutesByCompany.get(log.company_id) || 0) + minutes
      );
      callCountByCompany.set(
        log.company_id,
        (callCountByCompany.get(log.company_id) || 0) + 1
      );
    });

    // Get tracked minutes from usage_tracking
    const { data: usageRecords } = await supabaseAdmin
      .from('usage_tracking')
      .select('company_id, minutes_used')
      .in('company_id', companyIds)
      .gte('period_start', monthStart);

    const trackedMinutesByCompany = new Map<string, number>();
    (usageRecords || []).forEach(u => {
      trackedMinutesByCompany.set(u.company_id, u.minutes_used || 0);
    });

    // Get company names
    const { data: companies } = await supabaseAdmin
      .from('companies')
      .select('id, name')
      .in('id', companyIds);

    const companyNames = new Map<string, string>();
    (companies || []).forEach(c => companyNames.set(c.id, c.name));

    // Compare and find discrepancies
    const discrepancies: {
      companyId: string;
      companyName: string;
      actualMinutes: number;
      trackedMinutes: number;
      difference: number;
      callCount: number;
      severity: 'ok' | 'minor' | 'major' | 'critical';
    }[] = [];

    companyIds.forEach(companyId => {
      const actual = actualMinutesByCompany.get(companyId) || 0;
      const tracked = trackedMinutesByCompany.get(companyId) || 0;
      const diff = actual - tracked;
      const callCount = callCountByCompany.get(companyId) || 0;

      // Only flag if there's a meaningful discrepancy
      let severity: 'ok' | 'minor' | 'major' | 'critical' = 'ok';
      if (Math.abs(diff) >= 10) severity = 'critical';
      else if (Math.abs(diff) >= 5) severity = 'major';
      else if (Math.abs(diff) >= 1) severity = 'minor';

      discrepancies.push({
        companyId,
        companyName: companyNames.get(companyId) || 'Unknown',
        actualMinutes: actual,
        trackedMinutes: tracked,
        difference: diff,
        callCount,
        severity,
      });
    });

    // Sort by severity (critical first)
    const severityOrder = { critical: 0, major: 1, minor: 2, ok: 3 };
    discrepancies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const withIssues = discrepancies.filter(d => d.severity !== 'ok').length;

    return NextResponse.json({
      discrepancies,
      summary: {
        total: discrepancies.length,
        withIssues,
        critical: discrepancies.filter(d => d.severity === 'critical').length,
        major: discrepancies.filter(d => d.severity === 'major').length,
        minor: discrepancies.filter(d => d.severity === 'minor').length,
        ok: discrepancies.filter(d => d.severity === 'ok').length,
      },
      period: {
        start: monthStart,
        end: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error in reconciliation:', error);
    return NextResponse.json({ error: 'Failed to run reconciliation' }, { status: 500 });
  }
}
