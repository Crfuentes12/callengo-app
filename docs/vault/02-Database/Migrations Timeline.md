---
tags: [database, migrations, changelog]
aliases: [Migration History, DB Migrations]
---

# Migrations Timeline

45 migration files in `supabase/migrations/`, applied sequentially. Convention: timestamp prefix `YYYYMMDDHHMMSS`. Last migration: `20260323000002_production_audit_fixes.sql`.

---

## Phase 1: Core Schema (January 2026)

Foundation tables, authentication, basic billing, and agent system.

| Migration | Description |
|-----------|-------------|
| `20260103000001_initial_schema.sql` | Core tables: companies, users, contacts, subscription_plans, company_subscriptions |
| `20260103000002_agent_system.sql` | agent_templates, company_agents, agent_runs tables |
| `20260103000003_call_system.sql` | call_logs, call_queue tables with indexes |
| `20260103000004_rls_policies.sql` | Initial RLS policies for all tables |
| `20260110000001_billing_tables.sql` | billing_history, usage_tracking, billing_events |
| `20260115000001_company_settings.sql` | company_settings table (voice, API keys) |
| `20260115000002_contact_lists.sql` | contact_lists table and contacts.list_id FK |
| `20260120000001_notifications.sql` | notifications table with triggers |
| `20260123000001_configure_core_agents.sql` | Insert 3 agent templates (lead-qualification, data-validation, appointment-confirmation) |
| `20260125000001_stripe_integration.sql` | stripe_events table, Stripe IDs on subscriptions |

## Phase 2: Integrations & Calendar (February 2026)

CRM integrations, calendar sync, follow-ups, and voicemail.

| Migration | Description |
|-----------|-------------|
| `20260201000001_hubspot_integration.sql` | hubspot_integrations, hubspot_contact_mappings, hubspot_sync_logs |
| `20260205000001_pipedrive_integration.sql` | pipedrive_integrations, pipedrive_contact_mappings, pipedrive_sync_logs |
| `20260208000001_salesforce_integration.sql` | salesforce_integrations, salesforce_contact_mappings, salesforce_sync_logs |
| `20260210000001_calendar_system.sql` | calendar_events, calendar_integrations, calendar_sync_log |
| `20260212000001_follow_up_queue.sql` | follow_up_queue table, auto_create_followup trigger |
| `20260214000001_voicemail_logs.sql` | voicemail_logs table, voicemail columns on call_logs and agent_runs |
| `20260215000001_campaign_queue.sql` | campaign_queue table with unique partial index |
| `20260218000001_team_invitations.sql` | team_invitations table with RLS |
| `20260220000001_zoho_integration.sql` | zoho_integrations, zoho_contact_mappings, zoho_sync_logs |
| `20260222000001_google_sheets.sql` | google_sheets_integrations, google_sheets_linked_sheets |
| `20260225000001_clio_integration.sql` | clio_integrations, clio_contact_mappings, clio_sync_logs |
| `20260225000002_update_agent_templates_calendar_aware.sql` | Calendar-aware agent templates (working hours, timezone, video provider) |
| `20260226000001_dynamics_integration.sql` | dynamics_integrations, dynamics_contact_mappings, dynamics_sync_logs |
| `20260227000001_simplybook_integration.sql` | simplybook_integrations, simplybook_contact_mappings, simplybook_sync_logs, simplybook_webhook_logs |
| `20260228000001_team_calendar.sql` | team_calendar_assignments table |
| `20260228000002_webhooks.sql` | webhook_endpoints, webhook_deliveries tables |

## Phase 3: Pricing V4, Admin, & Audit (March 2026)

Major pricing restructure, admin tooling, security hardening, and production audit fixes.

| Migration | Description |
|-----------|-------------|
| `20260301000001_analysis_queue.sql` | analysis_queue table for async AI processing |
| `20260303000001_ai_conversations.sql` | ai_conversations, ai_messages tables |
| `20260305000001_cancellation_feedback.sql` | cancellation_feedback, retention_offers, retention_offer_log |
| `20260306000001_pricing_v4.sql` | V4 pricing: update subscription_plans with new prices, minutes, features |
| `20260306000002_company_addons.sql` | company_addons table, addon flags on subscriptions |
| `20260308000001_overage_tracking.sql` | Overage columns on company_subscriptions |
| `20260310000001_integration_feedback.sql` | integration_feedback table |
| `20260312000001_user_geolocation.sql` | Geolocation columns on users (country, city, timezone, currency) |
| `20260315000001_admin_finances.sql` | admin_finances table for P&L tracking |
| `20260318000001_admin_platform_config.sql` | admin_platform_config singleton table |
| `20260320000001_admin_audit_log.sql` | admin_audit_log immutable table |
| `20260321000001_master_key_architecture.sql` | Bland AI master key support, bland_subaccount_id field |
| `20260321000002_recording_storage.sql` | Recording columns on call_logs (stored_url, expires_at, archived) |
| `20260323000001_token_encryption.sql` | Security audit: encryption references, CHECK constraints on statuses |
| `20260323000002_production_audit_fixes.sql` | 15 audit fixes: security triggers, soft-delete on companies, RLS hardening, subscription restrictions |

---

## Migration Statistics

| Metric | Value |
|--------|-------|
| Total migrations | 45 |
| Phase 1 (Jan) | 10 |
| Phase 2 (Feb) | 16 |
| Phase 3 (Mar) | 19 |
| Last migration | `20260323000002_production_audit_fixes.sql` |
| Naming convention | `YYYYMMDDHHMMSS_description.sql` |

---

## Related Notes

- [[Schema Overview]] — Current state of all 56 tables
- [[RLS Patterns]] — Security policies applied by migrations
- [[Triggers & Functions]] — Triggers created by migrations
- [[Known Issues & Audit]] — Issues found and fixed in audit migrations
