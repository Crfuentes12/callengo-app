# CALLENGO CODEBASE AUDIT LOG
**Date:** 2026-03-23
**Auditor:** Claude Opus 4.6 (automated deep audit)
**Scope:** Full production-readiness assessment

---

## SYSTEM CONTEXT SUMMARY

### What this app does
Callengo is a B2B SaaS platform for automated outbound AI voice calls. It replaces manual phone campaigns (lead qualification, data validation, appointment confirmation) with AI agents powered by Bland AI. Companies create campaigns, upload contacts, configure AI agents, and the system dispatches calls, analyzes transcripts via OpenAI GPT-4o-mini, syncs results to CRMs, and tracks usage for metered billing via Stripe.

### Tech stack
- **Framework:** Next.js 16.1.1 (App Router), React 19, TypeScript 5.9.3
- **DB:** Supabase (PostgreSQL) with RLS, 56 tables
- **Auth:** Supabase Auth (email/password + OAuth: Google, Azure/Microsoft, Slack OIDC)
- **Payments:** Stripe 20.1.0 (subscriptions + metered billing for overage)
- **Voice/Calls:** Bland AI (single master API key architecture)
- **Concurrency:** Upstash Redis (rate limiting, call slot tracking)
- **AI Analysis:** OpenAI GPT-4o-mini
- **Hosting:** Vercel (serverless)

### Tables confirmed to exist (56 tables from DB schema JSON)
admin_audit_log, admin_finances, admin_platform_config, agent_runs, agent_templates, ai_conversations, ai_messages, analysis_queue, billing_events, billing_history, calendar_events, calendar_integrations, calendar_sync_log, call_logs, call_queue, cancellation_feedback, clio_contact_mappings, clio_integrations, clio_sync_logs, companies, company_addons, company_agents, company_settings, company_subscriptions, contact_lists, contacts, dynamics_contact_mappings, dynamics_integrations, dynamics_sync_logs, follow_up_queue, google_sheets_integrations, google_sheets_linked_sheets, hubspot_contact_mappings, hubspot_integrations, hubspot_sync_logs, integration_feedback, notifications, pipedrive_contact_mappings, pipedrive_integrations, pipedrive_sync_logs, retention_offer_log, retention_offers, salesforce_contact_mappings, salesforce_integrations, salesforce_sync_logs, simplybook_contact_mappings, simplybook_integrations, simplybook_sync_logs, simplybook_webhook_logs, stripe_events, subscription_plans, team_calendar_assignments, team_invitations, usage_tracking, users, voicemail_logs, webhook_deliveries, webhook_endpoints, zoho_contact_mappings, zoho_integrations, zoho_sync_logs

### Auth flow
1. **Request** → Edge middleware (`middleware.ts`) intercepts all non-static routes
2. **Middleware checks:** Creates Supabase server client with cookies, calls `supabase.auth.getUser()` to validate JWT
3. **Public API routes whitelisted:** Stripe webhook, Bland webhook, OAuth callbacks, queue endpoints (secret-based), health check
4. **Non-public API routes:** Returns 401 if no user
5. **Protected page routes:** Redirects unauthenticated to `/auth/login`, checks email verification, checks onboarding, checks admin role for `/admin/*`
6. **API routes consume auth:** Each route creates its own `createServerClient()`, calls `supabase.auth.getUser()`, then queries `users` table for `company_id` and `role`. RLS enforces tenant isolation at DB layer.
7. **Admin routes:** Defense-in-depth — middleware blocks non-admin pages AND API routes re-verify `role === 'admin'`
8. **User metadata caching:** httpOnly cookie `x-user-meta` with 5-min TTL

### Core services map
| Service | What it does | External APIs | DB tables |
|---------|-------------|---------------|-----------|
| Billing (lib/billing/) | Usage tracking, overage management, call throttling | Stripe | usage_tracking, company_subscriptions, billing_events |
| Bland Master Client (lib/bland/) | Dispatches calls via master API key, enforces plan limits | Bland AI | call_logs, company_settings, admin_platform_config |
| Redis Concurrency (lib/redis/) | Atomic call slot management, concurrency tracking | Upstash Redis | (Redis keys) |
| Stripe (lib/stripe.ts) | Customer mgmt, checkout, subscriptions, usage reporting | Stripe | (via webhook) |
| AI Intent Analyzer (lib/ai/) | Post-call transcript analysis | OpenAI | analysis_queue, call_logs, contacts |
| Calendar (lib/calendar/) | Google/Outlook/Zoom integration, availability | Google, MS Graph, Zoom | calendar_events, calendar_integrations |
| CRM Integrations (7 CRMs) | OAuth, contact sync, call result push | CRM APIs | *_integrations, *_contact_mappings, *_sync_logs |
| Queue (lib/queue/) | Async: AI analysis, dispatch, follow-ups | (internal) | analysis_queue, call_queue, follow_up_queue |
| Webhooks (lib/webhooks.ts) | Outbound webhook dispatch, HMAC signing, SSRF protection | User URLs | webhook_endpoints, webhook_deliveries |
| Rate Limit (lib/rate-limit.ts) | Distributed rate limiting via Upstash with LRU fallback | Upstash Redis | (Redis keys) |

### Integration trust model
| Integration | Trust | Notes |
|-------------|-------|-------|
| Stripe | TRUSTED | Webhook signature verified |
| Bland AI | TRUSTED | Master API key; returns our metadata |
| OpenAI | TRUSTED | We control prompts |
| CRMs (HubSpot, SF, etc.) | TRUSTED | OAuth-authenticated API data |
| User browser input | UNTRUSTED | Forms, API bodies |
| CSV/Excel imports | UNTRUSTED | User-uploaded files |
| User webhooks | N/A | Outbound only, SSRF-protected |

### Intentional patterns to not flag
1. Admin routes check role in BOTH middleware AND API routes (defense-in-depth)
2. Large components (>1k lines) are documented as intentional
3. `supabaseAdminRaw` for untyped tables — documented design choice
4. Rate limiting applied per-endpoint, not globally via middleware — documented known gap
5. Service role used server-side only, never client-side
6. `x-user-meta` cookie is cached metadata, not auth token
7. Seed endpoint protected by secret env var
8. Deprecated rate-limit exports return passthrough (moved to Redis)

### API routes inventory (112 endpoints)
- **Admin:** 9 endpoints (command-center, clients, finances, billing-events, reconcile, etc.)
- **Auth:** 2 (check-admin, verify-recaptcha)
- **Billing:** 17 (checkout, plans, subscriptions, overage, phone numbers, etc.)
- **Bland AI:** 4 (send-call, webhook, get-call, analyze-call)
- **Calendar:** 5 (events, availability, team, contact-sync)
- **Campaigns:** 1 (dispatch)
- **Company:** 4 (bootstrap, onboarding-status, scrape, update)
- **Contacts:** 8 (CRUD, import, export, AI analyze/segment, stats)
- **Integrations:** 45+ (7 CRMs × ~6 routes + calendar/sheets/slack/zoom)
- **OpenAI:** 3 (analyze-call, context-suggestions, recommend-agent)
- **Queue:** 2 (process, followups)
- **Team:** 5 (invite, accept, cancel, members, remove)
- **Webhooks:** 3 (endpoints CRUD, Stripe webhook)
- **Other:** 8 (health, seed, ai-chat, get-started, voices, etc.)
