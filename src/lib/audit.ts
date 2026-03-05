import { supabaseAdminRaw } from '@/lib/supabase/service';
import { NextRequest } from 'next/server';

export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'user.role_change'
  | 'user.invite'
  | 'user.remove'
  | 'billing.plan_change'
  | 'billing.subscription_cancel'
  | 'billing.overage_enable'
  | 'billing.overage_disable'
  | 'integration.connect'
  | 'integration.disconnect'
  | 'integration.sync'
  | 'agent.create'
  | 'agent.update'
  | 'agent.delete'
  | 'campaign.create'
  | 'campaign.start'
  | 'campaign.pause'
  | 'campaign.delete'
  | 'settings.update'
  | 'admin.action';

interface AuditLogEntry {
  company_id: string;
  user_id?: string;
  action: AuditAction;
  entity_type: string;
  entity_id?: string;
  changes?: Record<string, unknown>;
  request?: NextRequest;
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const ip = entry.request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || entry.request?.headers.get('x-real-ip')
      || undefined;
    const userAgent = entry.request?.headers.get('user-agent') || undefined;

    await supabaseAdminRaw
      .from('audit_logs')
      .insert({
        company_id: entry.company_id,
        user_id: entry.user_id,
        action: entry.action,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        changes: entry.changes,
        ip_address: ip,
        user_agent: userAgent,
      });
  } catch (error) {
    // Audit logging should never break the main flow
    console.error('Failed to log audit event:', error);
  }
}
