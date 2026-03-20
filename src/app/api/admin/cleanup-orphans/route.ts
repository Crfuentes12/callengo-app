// app/api/admin/cleanup-orphans/route.ts
// Removes orphaned companies (no associated users) while preserving financial records
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin, supabaseAdminRaw } from '@/lib/supabase/service';

// Tables to DELETE when cleaning up an orphaned company (operational data)
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
  'calendar_integrations',
  'calendar_events',
  'calendar_sync_log',
  // CRM integration tables (may not exist in typed schema)
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
  'company_addons',
] as const;

// Tables to KEEP for financial audit trail
const FINANCIAL_TABLES_KEPT = [
  'company_subscriptions',
  'billing_history',
  'billing_events',
  'usage_tracking',
  'call_logs', // Keep call logs as they tie to billing/usage
] as const;

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || (userData.role !== 'admin' && userData.role !== 'owner')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Find orphaned companies (no users)
    const { data: allCompanies } = await supabaseAdmin
      .from('companies')
      .select('id, name, created_at');

    const { data: usersWithCompanies } = await supabaseAdmin
      .from('users')
      .select('company_id');

    const activeCompanyIds = new Set(
      (usersWithCompanies || []).map(u => u.company_id).filter(Boolean)
    );

    const orphans = (allCompanies || []).filter(c => !activeCompanyIds.has(c.id));

    return NextResponse.json({
      orphanedCompanies: orphans,
      count: orphans.length,
      financialTablesKept: [...FINANCIAL_TABLES_KEPT],
    });
  } catch (error) {
    console.error('Error finding orphans:', error);
    return NextResponse.json({ error: 'Failed to find orphaned companies' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || (userData.role !== 'admin' && userData.role !== 'owner')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Find orphaned companies
    const { data: allCompanies } = await supabaseAdmin
      .from('companies')
      .select('id, name');

    const { data: usersWithCompanies } = await supabaseAdmin
      .from('users')
      .select('company_id');

    const activeCompanyIds = new Set(
      (usersWithCompanies || []).map(u => u.company_id).filter(Boolean)
    );

    const orphanIds = (allCompanies || [])
      .filter(c => !activeCompanyIds.has(c.id))
      .map(c => c.id);

    if (orphanIds.length === 0) {
      return NextResponse.json({ message: 'No orphaned companies found', deleted: 0 });
    }

    const results: { table: string; deleted: number; error?: string }[] = [];

    // Delete operational data for orphaned companies
    for (const table of OPERATIONAL_TABLES) {
      try {
        const { count } = await supabaseAdminRaw
          .from(table)
          .delete({ count: 'exact' })
          .in('company_id', orphanIds);
        results.push({ table, deleted: count || 0 });
      } catch {
        // Table might not exist — skip silently
        results.push({ table, deleted: 0, error: 'table not found or no company_id column' });
      }
    }

    // Delete the orphaned companies themselves
    const { count: companiesDeleted } = await supabaseAdmin
      .from('companies')
      .delete({ count: 'exact' })
      .in('id', orphanIds);

    results.push({ table: 'companies', deleted: companiesDeleted || 0 });

    return NextResponse.json({
      message: `Cleaned up ${companiesDeleted || 0} orphaned companies`,
      deleted: companiesDeleted || 0,
      orphanIds,
      details: results.filter(r => r.deleted > 0 || r.error),
      financialRecordsKept: [...FINANCIAL_TABLES_KEPT],
    });
  } catch (error) {
    console.error('Error cleaning up orphans:', error);
    return NextResponse.json({ error: 'Failed to cleanup orphaned companies' }, { status: 500 });
  }
}
