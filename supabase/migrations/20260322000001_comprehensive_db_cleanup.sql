-- ============================================================================
-- Migration: Comprehensive Database Cleanup
-- Date: 2026-03-22
-- Purpose: Fix all Supabase linter warnings and performance issues:
--   1. SECURITY: Fix overly permissive RLS policies
--   2. SECURITY: Fix function search_path mutable warnings
--   3. SECURITY: Fix admin_audit_log INSERT WITH CHECK (true)
--   4. PERFORMANCE: Wrap auth.uid()/auth.role() in subselects (auth_rls_initplan)
--   5. PERFORMANCE: Consolidate duplicate permissive RLS policies
--   6. PERFORMANCE: Drop duplicate indexes
--   7. PERFORMANCE: Add missing FK indexes
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- 1. SECURITY: Fix companies table - remove USING(true) policy
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "authenticated_can_view_companies" ON companies;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. SECURITY: Fix function search_path mutable warnings
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_max_dedicated_numbers()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.addon_type = 'dedicated_number' AND NEW.status = 'active' THEN
    IF (
      SELECT COUNT(*)
      FROM public.company_addons
      WHERE company_id = NEW.company_id
        AND addon_type = 'dedicated_number'
        AND status = 'active'
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
    ) >= 3 THEN
      RAISE EXCEPTION 'Maximum 3 dedicated numbers per company';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_admin_platform_config_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. SECURITY: Fix admin_audit_log INSERT WITH CHECK (true)
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "admin_audit_log_service_insert" ON admin_audit_log;
CREATE POLICY "admin_audit_log_service_insert" ON admin_audit_log
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

-- ════════════════════════════════════════════════════════════════════════════
-- 4 & 5. PERFORMANCE + CONSOLIDATION: Rebuild all RLS policies with
--         (select auth.uid()) / (select auth.role()) and remove duplicates.
--         For each table, drop ALL existing policies and recreate clean ones.
-- ════════════════════════════════════════════════════════════════════════════

-- ── companies ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own company" ON companies;
DROP POLICY IF EXISTS "view_own_company" ON companies;
DROP POLICY IF EXISTS "Authenticated users can create company" ON companies;
DROP POLICY IF EXISTS "Users can update own company" ON companies;
DROP POLICY IF EXISTS "update_own_company" ON companies;
DROP POLICY IF EXISTS "Service role bypass for companies" ON companies;

CREATE POLICY "companies_select" ON companies FOR SELECT
  USING (
    id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid()))
    OR (select auth.role()) = 'service_role'
  );
CREATE POLICY "companies_insert" ON companies FOR INSERT
  WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "companies_update" ON companies FOR UPDATE
  USING (id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));
CREATE POLICY "companies_service" ON companies FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- ── users ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert own record" ON users;
DROP POLICY IF EXISTS "users_can_view_own_record" ON users;
DROP POLICY IF EXISTS "view_own_user" ON users;
DROP POLICY IF EXISTS "update_own_user" ON users;
DROP POLICY IF EXISTS "users_can_update_own_record" ON users;

CREATE POLICY "users_select" ON users FOR SELECT
  USING (id = (select auth.uid()));
CREATE POLICY "users_insert" ON users FOR INSERT
  WITH CHECK (id = (select auth.uid()));
CREATE POLICY "users_update" ON users FOR UPDATE
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- ── contacts ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company members can manage contacts" ON contacts;
DROP POLICY IF EXISTS "Service role bypass for contacts" ON contacts;
DROP POLICY IF EXISTS "users_can_delete_contacts" ON contacts;
DROP POLICY IF EXISTS "users_can_insert_contacts" ON contacts;
DROP POLICY IF EXISTS "users_can_update_contacts" ON contacts;
DROP POLICY IF EXISTS "users_can_view_company_contacts" ON contacts;

CREATE POLICY "contacts_all" ON contacts FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));
CREATE POLICY "contacts_service" ON contacts FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- ── company_agents ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company members can manage agents" ON company_agents;
DROP POLICY IF EXISTS "Service role bypass for company agents" ON company_agents;
DROP POLICY IF EXISTS "users_can_delete_company_agents" ON company_agents;
DROP POLICY IF EXISTS "users_can_insert_company_agents" ON company_agents;
DROP POLICY IF EXISTS "users_can_update_company_agents" ON company_agents;
DROP POLICY IF EXISTS "users_can_view_company_agents" ON company_agents;

CREATE POLICY "company_agents_all" ON company_agents FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));
CREATE POLICY "company_agents_service" ON company_agents FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- ── contact_lists ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company members can manage contact lists" ON contact_lists;
DROP POLICY IF EXISTS "Service role bypass for contact lists" ON contact_lists;
DROP POLICY IF EXISTS "Users can delete their company's contact lists" ON contact_lists;
DROP POLICY IF EXISTS "Users can insert contact lists for their company" ON contact_lists;
DROP POLICY IF EXISTS "Users can update their company's contact lists" ON contact_lists;
DROP POLICY IF EXISTS "Users can view their company's contact lists" ON contact_lists;

CREATE POLICY "contact_lists_all" ON contact_lists FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));
CREATE POLICY "contact_lists_service" ON contact_lists FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- ── call_logs ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company members can manage call logs" ON call_logs;
DROP POLICY IF EXISTS "Service role bypass for call logs" ON call_logs;
DROP POLICY IF EXISTS "users_can_insert_call_logs" ON call_logs;
DROP POLICY IF EXISTS "users_can_view_call_logs" ON call_logs;

CREATE POLICY "call_logs_all" ON call_logs FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));
CREATE POLICY "call_logs_service" ON call_logs FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- ── agent_runs ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company members can manage agent runs" ON agent_runs;
DROP POLICY IF EXISTS "Service role bypass for agent runs" ON agent_runs;
DROP POLICY IF EXISTS "users_can_delete_agent_runs" ON agent_runs;
DROP POLICY IF EXISTS "users_can_insert_agent_runs" ON agent_runs;
DROP POLICY IF EXISTS "users_can_update_agent_runs" ON agent_runs;
DROP POLICY IF EXISTS "users_can_view_agent_runs" ON agent_runs;

CREATE POLICY "agent_runs_all" ON agent_runs FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));
CREATE POLICY "agent_runs_service" ON agent_runs FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- ── company_settings ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company members can manage settings" ON company_settings;
DROP POLICY IF EXISTS "Service role bypass for company settings" ON company_settings;
DROP POLICY IF EXISTS "users_can_insert_company_settings" ON company_settings;
DROP POLICY IF EXISTS "users_can_update_company_settings" ON company_settings;
DROP POLICY IF EXISTS "users_can_view_company_settings" ON company_settings;

CREATE POLICY "company_settings_all" ON company_settings FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));
CREATE POLICY "company_settings_service" ON company_settings FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- ── company_subscriptions ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view their company's subscription" ON company_subscriptions;
DROP POLICY IF EXISTS "Users can update their company's subscription" ON company_subscriptions;

CREATE POLICY "company_subscriptions_select" ON company_subscriptions FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));
CREATE POLICY "company_subscriptions_update" ON company_subscriptions FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── usage_tracking ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view their company's usage" ON usage_tracking;

CREATE POLICY "usage_tracking_select" ON usage_tracking FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── billing_history ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view their company's billing history" ON billing_history;

CREATE POLICY "billing_history_select" ON billing_history FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── billing_events ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view their company's billing events" ON billing_events;

CREATE POLICY "billing_events_select" ON billing_events FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── notifications ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company members or system can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete notifications for their company" ON notifications;
DROP POLICY IF EXISTS "Users can update notifications for their company" ON notifications;
DROP POLICY IF EXISTS "Users can view notifications for their company" ON notifications;

CREATE POLICY "notifications_select" ON notifications FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));
CREATE POLICY "notifications_insert" ON notifications FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid()))
    OR (select auth.role()) = 'service_role'
  );
CREATE POLICY "notifications_update" ON notifications FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));
CREATE POLICY "notifications_delete" ON notifications FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── voicemail_logs ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company members or system can insert voicemail logs" ON voicemail_logs;
DROP POLICY IF EXISTS "Users can view voicemails for their company" ON voicemail_logs;

CREATE POLICY "voicemail_logs_select" ON voicemail_logs FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));
CREATE POLICY "voicemail_logs_insert" ON voicemail_logs FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid()))
    OR (select auth.role()) = 'service_role'
  );

-- ── follow_up_queue ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage follow-ups for their company" ON follow_up_queue;

CREATE POLICY "follow_up_queue_all" ON follow_up_queue FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── call_queue ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage their company's call queue" ON call_queue;
DROP POLICY IF EXISTS "Users can view their company's call queue" ON call_queue;

CREATE POLICY "call_queue_all" ON call_queue FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── team_invitations ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company admins can create invitations" ON team_invitations;
DROP POLICY IF EXISTS "Company admins can delete invitations" ON team_invitations;
DROP POLICY IF EXISTS "Company admins can update invitations" ON team_invitations;
DROP POLICY IF EXISTS "Company members can view invitations" ON team_invitations;

CREATE POLICY "team_invitations_select" ON team_invitations FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));
CREATE POLICY "team_invitations_insert" ON team_invitations FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.users
    WHERE id = (select auth.uid()) AND role IN ('owner', 'admin')
  ));
CREATE POLICY "team_invitations_update" ON team_invitations FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM public.users
    WHERE id = (select auth.uid()) AND role IN ('owner', 'admin')
  ));
CREATE POLICY "team_invitations_delete" ON team_invitations FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM public.users
    WHERE id = (select auth.uid()) AND role IN ('owner', 'admin')
  ));

-- ── calendar_events ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company calendar events access" ON calendar_events;
DROP POLICY IF EXISTS "Users can view own company events" ON calendar_events;
DROP POLICY IF EXISTS "Users can insert own company events" ON calendar_events;
DROP POLICY IF EXISTS "Users can update own company events" ON calendar_events;
DROP POLICY IF EXISTS "Users can delete own company events" ON calendar_events;

CREATE POLICY "calendar_events_all" ON calendar_events FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── calendar_integrations ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company calendar integrations access" ON calendar_integrations;
DROP POLICY IF EXISTS "Users can view own company integrations" ON calendar_integrations;
DROP POLICY IF EXISTS "Users can insert own company integrations" ON calendar_integrations;
DROP POLICY IF EXISTS "Users can update own company integrations" ON calendar_integrations;
DROP POLICY IF EXISTS "Users can delete own company integrations" ON calendar_integrations;

CREATE POLICY "calendar_integrations_all" ON calendar_integrations FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── calendar_sync_log ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own company sync logs" ON calendar_sync_log;

CREATE POLICY "calendar_sync_log_select" ON calendar_sync_log FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── cancellation_feedback ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own company cancellation feedback" ON cancellation_feedback;

CREATE POLICY "cancellation_feedback_select" ON cancellation_feedback FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── retention_offers ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own company retention offers" ON retention_offers;

CREATE POLICY "retention_offers_select" ON retention_offers FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── retention_offer_log ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own company retention logs" ON retention_offer_log;

CREATE POLICY "retention_offer_log_select" ON retention_offer_log FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── subscription_plans ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view active subscription plans" ON subscription_plans;

CREATE POLICY "subscription_plans_select" ON subscription_plans FOR SELECT
  USING (is_active = true);

-- ── agent_templates ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anyone_can_view_active_agent_templates" ON agent_templates;
DROP POLICY IF EXISTS "authenticated_can_view_templates" ON agent_templates;

CREATE POLICY "agent_templates_select" ON agent_templates FOR SELECT
  USING (is_active = true);

-- ── stripe_events ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role only for stripe_events" ON stripe_events;

CREATE POLICY "stripe_events_service" ON stripe_events FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- ── salesforce_integrations ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company members can view SF integrations" ON salesforce_integrations;
DROP POLICY IF EXISTS "Service role full access SF integrations" ON salesforce_integrations;
DROP POLICY IF EXISTS "Users can view own company SF integrations" ON salesforce_integrations;

CREATE POLICY "salesforce_integrations_select" ON salesforce_integrations FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));
CREATE POLICY "salesforce_integrations_service" ON salesforce_integrations FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- ── salesforce_contact_mappings ────────────────────────────────────────────
DROP POLICY IF EXISTS "Company members can view SF mappings" ON salesforce_contact_mappings;
DROP POLICY IF EXISTS "Service role full access SF mappings" ON salesforce_contact_mappings;
DROP POLICY IF EXISTS "Users can view own company SF mappings" ON salesforce_contact_mappings;

CREATE POLICY "salesforce_contact_mappings_select" ON salesforce_contact_mappings FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));
CREATE POLICY "salesforce_contact_mappings_service" ON salesforce_contact_mappings FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- ── salesforce_sync_logs ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company members can view SF sync logs" ON salesforce_sync_logs;
DROP POLICY IF EXISTS "Service role full access SF sync logs" ON salesforce_sync_logs;
DROP POLICY IF EXISTS "Users can view own company SF sync logs" ON salesforce_sync_logs;

CREATE POLICY "salesforce_sync_logs_select" ON salesforce_sync_logs FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));
CREATE POLICY "salesforce_sync_logs_service" ON salesforce_sync_logs FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- ── hubspot_integrations ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert hubspot integrations for their company" ON hubspot_integrations;
DROP POLICY IF EXISTS "Users can update their company hubspot integrations" ON hubspot_integrations;
DROP POLICY IF EXISTS "Users can view their company hubspot integrations" ON hubspot_integrations;

CREATE POLICY "hubspot_integrations_all" ON hubspot_integrations FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── hubspot_contact_mappings ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert hubspot contact mappings for their company" ON hubspot_contact_mappings;
DROP POLICY IF EXISTS "Users can update their company hubspot contact mappings" ON hubspot_contact_mappings;
DROP POLICY IF EXISTS "Users can view their company hubspot contact mappings" ON hubspot_contact_mappings;

CREATE POLICY "hubspot_contact_mappings_all" ON hubspot_contact_mappings FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── hubspot_sync_logs ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert hubspot sync logs for their company" ON hubspot_sync_logs;
DROP POLICY IF EXISTS "Users can update their company hubspot sync logs" ON hubspot_sync_logs;
DROP POLICY IF EXISTS "Users can view their company hubspot sync logs" ON hubspot_sync_logs;

CREATE POLICY "hubspot_sync_logs_all" ON hubspot_sync_logs FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── pipedrive_integrations ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert pipedrive integrations for their company" ON pipedrive_integrations;
DROP POLICY IF EXISTS "Users can update their company pipedrive integrations" ON pipedrive_integrations;
DROP POLICY IF EXISTS "Users can view their company pipedrive integrations" ON pipedrive_integrations;

CREATE POLICY "pipedrive_integrations_all" ON pipedrive_integrations FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── pipedrive_contact_mappings ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert pipedrive contact mappings for their company" ON pipedrive_contact_mappings;
DROP POLICY IF EXISTS "Users can update their company pipedrive contact mappings" ON pipedrive_contact_mappings;
DROP POLICY IF EXISTS "Users can view their company pipedrive contact mappings" ON pipedrive_contact_mappings;

CREATE POLICY "pipedrive_contact_mappings_all" ON pipedrive_contact_mappings FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── pipedrive_sync_logs ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert pipedrive sync logs for their company" ON pipedrive_sync_logs;
DROP POLICY IF EXISTS "Users can update their company pipedrive sync logs" ON pipedrive_sync_logs;
DROP POLICY IF EXISTS "Users can view their company pipedrive sync logs" ON pipedrive_sync_logs;

CREATE POLICY "pipedrive_sync_logs_all" ON pipedrive_sync_logs FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── google_sheets_integrations ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert google sheets integrations for their company" ON google_sheets_integrations;
DROP POLICY IF EXISTS "Users can update their company google sheets integrations" ON google_sheets_integrations;
DROP POLICY IF EXISTS "Users can view their company google sheets integrations" ON google_sheets_integrations;

CREATE POLICY "google_sheets_integrations_all" ON google_sheets_integrations FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── google_sheets_linked_sheets ────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can delete their company linked sheets" ON google_sheets_linked_sheets;
DROP POLICY IF EXISTS "Users can insert linked sheets for their company" ON google_sheets_linked_sheets;
DROP POLICY IF EXISTS "Users can update their company linked sheets" ON google_sheets_linked_sheets;
DROP POLICY IF EXISTS "Users can view their company linked sheets" ON google_sheets_linked_sheets;

CREATE POLICY "google_sheets_linked_sheets_all" ON google_sheets_linked_sheets FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── clio_integrations ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "clio_integrations_insert" ON clio_integrations;
DROP POLICY IF EXISTS "clio_integrations_select" ON clio_integrations;
DROP POLICY IF EXISTS "clio_integrations_update" ON clio_integrations;

CREATE POLICY "clio_integrations_all" ON clio_integrations FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── clio_sync_logs ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "clio_sync_logs_select" ON clio_sync_logs;

CREATE POLICY "clio_sync_logs_select" ON clio_sync_logs FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── clio_contact_mappings ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "clio_contact_mappings_select" ON clio_contact_mappings;

CREATE POLICY "clio_contact_mappings_select" ON clio_contact_mappings FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── zoho_integrations ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "zoho_integrations_insert" ON zoho_integrations;
DROP POLICY IF EXISTS "zoho_integrations_select" ON zoho_integrations;
DROP POLICY IF EXISTS "zoho_integrations_update" ON zoho_integrations;

CREATE POLICY "zoho_integrations_all" ON zoho_integrations FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── zoho_sync_logs ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "zoho_sync_logs_select" ON zoho_sync_logs;

CREATE POLICY "zoho_sync_logs_select" ON zoho_sync_logs FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── zoho_contact_mappings ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "zoho_contact_mappings_select" ON zoho_contact_mappings;

CREATE POLICY "zoho_contact_mappings_select" ON zoho_contact_mappings FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── dynamics_integrations ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "dynamics_integrations_insert" ON dynamics_integrations;
DROP POLICY IF EXISTS "dynamics_integrations_select" ON dynamics_integrations;
DROP POLICY IF EXISTS "dynamics_integrations_update" ON dynamics_integrations;

CREATE POLICY "dynamics_integrations_all" ON dynamics_integrations FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── dynamics_sync_logs ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "dynamics_sync_logs_select" ON dynamics_sync_logs;

CREATE POLICY "dynamics_sync_logs_select" ON dynamics_sync_logs FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── dynamics_contact_mappings ──────────────────────────────────────────────
DROP POLICY IF EXISTS "dynamics_contact_mappings_select" ON dynamics_contact_mappings;

CREATE POLICY "dynamics_contact_mappings_select" ON dynamics_contact_mappings FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── simplybook_integrations ────────────────────────────────────────────────
DROP POLICY IF EXISTS "simplybook_integrations_insert" ON simplybook_integrations;
DROP POLICY IF EXISTS "simplybook_integrations_select" ON simplybook_integrations;
DROP POLICY IF EXISTS "simplybook_integrations_update" ON simplybook_integrations;

CREATE POLICY "simplybook_integrations_all" ON simplybook_integrations FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── simplybook_sync_logs ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "simplybook_sync_logs_select" ON simplybook_sync_logs;

CREATE POLICY "simplybook_sync_logs_select" ON simplybook_sync_logs FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── simplybook_contact_mappings ────────────────────────────────────────────
DROP POLICY IF EXISTS "simplybook_contact_mappings_insert" ON simplybook_contact_mappings;
DROP POLICY IF EXISTS "simplybook_contact_mappings_select" ON simplybook_contact_mappings;
DROP POLICY IF EXISTS "simplybook_contact_mappings_update" ON simplybook_contact_mappings;

CREATE POLICY "simplybook_contact_mappings_all" ON simplybook_contact_mappings FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── simplybook_webhook_logs ────────────────────────────────────────────────
DROP POLICY IF EXISTS "sb_webhook_logs_read" ON simplybook_webhook_logs;

CREATE POLICY "simplybook_webhook_logs_select" ON simplybook_webhook_logs FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── webhook_endpoints ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "webhook_endpoints_delete" ON webhook_endpoints;
DROP POLICY IF EXISTS "webhook_endpoints_insert" ON webhook_endpoints;
DROP POLICY IF EXISTS "webhook_endpoints_select" ON webhook_endpoints;
DROP POLICY IF EXISTS "webhook_endpoints_update" ON webhook_endpoints;

CREATE POLICY "webhook_endpoints_all" ON webhook_endpoints FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── webhook_deliveries ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "webhook_deliveries_select" ON webhook_deliveries;

CREATE POLICY "webhook_deliveries_select" ON webhook_deliveries FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── integration_feedback ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "integration_feedback_insert" ON integration_feedback;
DROP POLICY IF EXISTS "integration_feedback_select" ON integration_feedback;

CREATE POLICY "integration_feedback_insert" ON integration_feedback FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid()))
    AND user_id = (select auth.uid())
  );
CREATE POLICY "integration_feedback_select" ON integration_feedback FOR SELECT
  USING (user_id = (select auth.uid()));

-- ── ai_conversations ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can create own conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can view own conversations" ON ai_conversations;

CREATE POLICY "ai_conversations_all" ON ai_conversations FOR ALL
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ── ai_messages ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can create messages in own conversations" ON ai_messages;
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON ai_messages;

CREATE POLICY "ai_messages_select" ON ai_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.ai_conversations
    WHERE ai_conversations.id = ai_messages.conversation_id
      AND ai_conversations.user_id = (select auth.uid())
  ));
CREATE POLICY "ai_messages_insert" ON ai_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ai_conversations
    WHERE ai_conversations.id = ai_messages.conversation_id
      AND ai_conversations.user_id = (select auth.uid())
  ));

-- ── analysis_queue ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "analysis_queue_company_read" ON analysis_queue;

CREATE POLICY "analysis_queue_select" ON analysis_queue FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── team_calendar_assignments ──────────────────────────────────────────────
DROP POLICY IF EXISTS "team_cal_read" ON team_calendar_assignments;
DROP POLICY IF EXISTS "team_cal_write" ON team_calendar_assignments;

CREATE POLICY "team_calendar_assignments_all" ON team_calendar_assignments FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));

-- ── admin_finances ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Only admins can manage finances" ON admin_finances;
DROP POLICY IF EXISTS "Only admins can view finances" ON admin_finances;

CREATE POLICY "admin_finances_all" ON admin_finances FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = (select auth.uid()) AND role IN ('admin', 'owner'))
    OR (select auth.role()) = 'service_role'
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = (select auth.uid()) AND role IN ('admin', 'owner'))
    OR (select auth.role()) = 'service_role'
  );

-- ── admin_platform_config ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_platform_config_admin_access" ON admin_platform_config;

CREATE POLICY "admin_platform_config_all" ON admin_platform_config FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = (select auth.uid()) AND role IN ('admin', 'owner')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users WHERE id = (select auth.uid()) AND role IN ('admin', 'owner')
  ));

-- ── admin_audit_log (SELECT already uses subselect via recreated policy) ──
DROP POLICY IF EXISTS "admin_audit_log_admin_read" ON admin_audit_log;

CREATE POLICY "admin_audit_log_select" ON admin_audit_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = (select auth.uid()) AND role IN ('admin', 'owner')
  ));

-- ── company_addons ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company members can view addons" ON company_addons;
DROP POLICY IF EXISTS "Service role can manage addons" ON company_addons;
DROP POLICY IF EXISTS "company_addons_company_members_select" ON company_addons;

CREATE POLICY "company_addons_select" ON company_addons FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = (select auth.uid())));
CREATE POLICY "company_addons_service" ON company_addons FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- ════════════════════════════════════════════════════════════════════════════
-- 6. PERFORMANCE: Drop duplicate indexes (keep the one with the better name)
-- ════════════════════════════════════════════════════════════════════════════

-- billing_history: idx_billing_history_company_id and idx_billing_history_company are duplicates
DROP INDEX IF EXISTS idx_billing_history_company;

-- calendar_events: multiple duplicate pairs
DROP INDEX IF EXISTS idx_cal_events_company;     -- dup of idx_calendar_events_company
DROP INDEX IF EXISTS idx_cal_events_contact;     -- dup of idx_calendar_events_contact
DROP INDEX IF EXISTS idx_cal_events_source;      -- dup of idx_calendar_events_source
DROP INDEX IF EXISTS idx_cal_events_external;    -- dup of idx_calendar_events_external
DROP INDEX IF EXISTS idx_cal_events_status;      -- dup of idx_calendar_events_status

-- calendar_integrations: duplicate pairs
DROP INDEX IF EXISTS idx_cal_integrations_company;   -- dup of idx_calendar_integrations_company
DROP INDEX IF EXISTS idx_cal_integrations_provider;  -- dup of idx_calendar_integrations_provider

-- call_logs: call_logs_call_id_idx and idx_call_logs_call_id are duplicates
DROP INDEX IF EXISTS call_logs_call_id_idx;

-- salesforce_contact_mappings: idx_sf_mappings_contact and idx_sf_mappings_callengo_contact are duplicates
DROP INDEX IF EXISTS idx_sf_mappings_contact;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. PERFORMANCE: Add missing FK indexes (unindexed_foreign_keys)
-- ════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_template_id
  ON agent_runs (agent_template_id);
CREATE INDEX IF NOT EXISTS idx_analysis_queue_contact_id
  ON analysis_queue (contact_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_subscription_id
  ON billing_history (subscription_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_follow_up_id
  ON calendar_events (follow_up_id) WHERE follow_up_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_logs_agent_template_id
  ON call_logs (agent_template_id) WHERE agent_template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_queue_agent_id
  ON call_queue (agent_id);
CREATE INDEX IF NOT EXISTS idx_call_queue_contact_id
  ON call_queue (contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_subscription_id
  ON cancellation_feedback (subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cancellation_feedback_user_id
  ON cancellation_feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_clio_contact_mappings_company_id
  ON clio_contact_mappings (company_id);
CREATE INDEX IF NOT EXISTS idx_clio_integrations_user_id
  ON clio_integrations (user_id);
CREATE INDEX IF NOT EXISTS idx_clio_sync_logs_company_id
  ON clio_sync_logs (company_id);
CREATE INDEX IF NOT EXISTS idx_company_agents_agent_template_id
  ON company_agents (agent_template_id);
CREATE INDEX IF NOT EXISTS idx_company_agents_company_id
  ON company_agents (company_id);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_plan_id
  ON company_subscriptions (plan_id);
CREATE INDEX IF NOT EXISTS idx_dynamics_contact_mappings_company_id
  ON dynamics_contact_mappings (company_id);
CREATE INDEX IF NOT EXISTS idx_dynamics_integrations_user_id
  ON dynamics_integrations (user_id);
CREATE INDEX IF NOT EXISTS idx_dynamics_sync_logs_company_id
  ON dynamics_sync_logs (company_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_queue_original_call_id
  ON follow_up_queue (original_call_id) WHERE original_call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_google_sheets_integrations_user_id
  ON google_sheets_integrations (user_id);
CREATE INDEX IF NOT EXISTS idx_integration_feedback_user_id
  ON integration_feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_retention_offer_log_user_id
  ON retention_offer_log (user_id);
CREATE INDEX IF NOT EXISTS idx_retention_offer_log_subscription_id
  ON retention_offer_log (subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_salesforce_contact_mappings_company_id
  ON salesforce_contact_mappings (company_id);
CREATE INDEX IF NOT EXISTS idx_salesforce_integrations_user_id
  ON salesforce_integrations (user_id);
CREATE INDEX IF NOT EXISTS idx_simplybook_contact_mappings_company_id
  ON simplybook_contact_mappings (company_id);
CREATE INDEX IF NOT EXISTS idx_simplybook_integrations_user_id
  ON simplybook_integrations (user_id);
CREATE INDEX IF NOT EXISTS idx_simplybook_sync_logs_company_id
  ON simplybook_sync_logs (company_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_invited_by
  ON team_invitations (invited_by);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_subscription_id
  ON usage_tracking (subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_voicemail_logs_contact_id
  ON voicemail_logs (contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_voicemail_logs_follow_up_id
  ON voicemail_logs (follow_up_id) WHERE follow_up_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_zoho_contact_mappings_company_id
  ON zoho_contact_mappings (company_id);
CREATE INDEX IF NOT EXISTS idx_zoho_integrations_user_id
  ON zoho_integrations (user_id);
CREATE INDEX IF NOT EXISTS idx_zoho_sync_logs_company_id
  ON zoho_sync_logs (company_id);
