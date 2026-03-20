// app/api/admin/cleanup-orphans/route.ts
// Cleans up orphaned companies (no associated users) while preserving financial records.
// Since all FK constraints use ON DELETE CASCADE, we CANNOT delete the company row
// without losing billing_history, billing_events, usage_tracking, etc.
// Instead: delete operational data, then soft-delete the company by prefixing its name.
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin, supabaseAdminRaw } from '@/lib/supabase/service';

// Tables to DELETE when cleaning up an orphaned company (operational data only)
const OPERATIONAL_TABLES = [
  'contacts',
  'contact_lists',
  'campaigns',
  'company_agents',
  'agent_runs',
  'call_queue',
  'follow_up_queue',
  'notifications',
  'voicemail_logs',
  'company_settings',
  'company_addons',
  'calendar_integrations',   // cascades to calendar_events, calendar_sync_log
  // CRM integration tables
  'hubspot_integrations',
  'hubspot_sync_logs',
  'hubspot_contact_mappings',
  'pipedrive_integrations',
  'pipedrive_sync_logs',
  'pipedrive_contact_mappings',
  'zoho_integrations',
  'zoho_sync_logs',
  'zoho_contact_mappings',
  'salesforce_integrations',
  'salesforce_sync_logs',
  'salesforce_contact_mappings',
  'dynamics_integrations',
  'dynamics_sync_logs',
  'dynamics_contact_mappings',
  'clio_integrations',
  'clio_sync_logs',
  'clio_contact_mappings',
  'google_sheets_integrations',
  'google_sheets_linked_sheets',
  'integration_feedback',
  'cancellation_feedback',
  'ai_conversations',
  'outbound_webhooks',
  'analysis_queue',
  'analysis_tasks',
] as const;

// Tables preserved (NOT deleted) for financial audit trail
const FINANCIAL_TABLES_KEPT = [
  'company_subscriptions',
  'billing_history',
  'billing_events',
  'usage_tracking',
  'call_logs',
] as const;

const ARCHIVED_PREFIX = '[ARCHIVED] ';

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!userData || (userData.role !== 'admin' && userData.role !== 'owner')) return null;
  return user;
}

async function findOrphans() {
  const { data: allCompanies } = await supabaseAdmin
    .from('companies')
    .select('id, name, created_at');

  const { data: usersWithCompanies } = await supabaseAdmin
    .from('users')
    .select('company_id');

  const activeCompanyIds = new Set(
    (usersWithCompanies || []).map(u => u.company_id).filter(Boolean)
  );

  return (allCompanies || []).filter(
    c => !activeCompanyIds.has(c.id) && !c.name.startsWith(ARCHIVED_PREFIX)
  );
}

// GET: Preview orphaned companies
export async function GET() {
  try {
    const supabase = await createServerClient();
    if (!await verifyAdmin(supabase)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const orphans = await findOrphans();

    return NextResponse.json({
      orphanedCompanies: orphans,
      count: orphans.length,
      financialTablesKept: [...FINANCIAL_TABLES_KEPT],
      note: 'DELETE request will clean operational data and archive these companies. Financial records are preserved.',
    });
  } catch (error) {
    console.error('Error finding orphans:', error);
    return NextResponse.json({ error: 'Failed to find orphaned companies' }, { status: 500 });
  }
}

// DELETE: Clean up orphaned companies
export async function DELETE() {
  try {
    const supabase = await createServerClient();
    if (!await verifyAdmin(supabase)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const orphans = await findOrphans();
    const orphanIds = orphans.map(c => c.id);

    if (orphanIds.length === 0) {
      return NextResponse.json({ message: 'No orphaned companies found', archived: 0 });
    }

    const results: { table: string; deleted: number; error?: string }[] = [];

    // 1. Delete operational data for orphaned companies
    for (const table of OPERATIONAL_TABLES) {
      try {
        const { count } = await supabaseAdminRaw
          .from(table)
          .delete({ count: 'exact' })
          .in('company_id', orphanIds);
        if (count && count > 0) {
          results.push({ table, deleted: count });
        }
      } catch {
        // Table might not exist — skip silently
      }
    }

    // 2. Soft-delete: rename companies with [ARCHIVED] prefix
    //    We do NOT delete the company row because ON DELETE CASCADE
    //    would destroy financial records (billing_history, billing_events, etc.)
    let archivedCount = 0;
    for (const orphan of orphans) {
      const { error } = await supabaseAdmin
        .from('companies')
        .update({
          name: `${ARCHIVED_PREFIX}${orphan.name}`,
          description: `Archived on ${new Date().toISOString().split('T')[0]} — user deleted, no active users. Financial records preserved.`,
        })
        .eq('id', orphan.id);

      if (!error) archivedCount++;
    }

    return NextResponse.json({
      message: `Archived ${archivedCount} orphaned companies. Operational data cleaned, financial records preserved.`,
      archived: archivedCount,
      orphanIds,
      operationalDataDeleted: results,
      financialRecordsKept: [...FINANCIAL_TABLES_KEPT],
    });
  } catch (error) {
    console.error('Error cleaning up orphans:', error);
    return NextResponse.json({ error: 'Failed to cleanup orphaned companies' }, { status: 500 });
  }
}
