---
tags: [database, migrations]
---

# Migrations Timeline

45 migration files in `supabase/migrations/`, applied sequentially. Convention: timestamp prefix `YYYYMMDDHHMMSS`.

## Timeline

| Date | Migration | Description |
|------|-----------|-------------|
| 2026-01-03 | 20260103* | Stripe fields, geolocation, voices |
| 2026-01-04 | 20260104* | User favorite voices |
| 2026-01-23 | 20260123* | 3 core agents, plan descriptions, follow-ups/voicemails |
| 2026-02-19 | 20260219* | Plan features v2, voicemail/followup stats |
| 2026-02-22 | 20260222* | AI conversations table |
| 2026-02-23 | 20260223* | Calendar integrations (Google, Microsoft Outlook) |
| 2026-02-25 | 20260225* | Campaign calendar config, agent templates calendar-aware |
| 2026-02-26 | 20260226* | Comprehensive FK fixes, RLS fixes, team_invitations, max_seats |
| 2026-02-27 | 20260227* | Salesforce integration fix, HubSpot integration |
| 2026-02-28 | 20260228* | HubSpot search_path fix, Pipedrive, Google Sheets |
| 2026-03-01 | 20260301* | Clio integration |
| 2026-03-02 | 20260302* | Integration feedback, outbound webhooks, Zoho |
| 2026-03-03 | 20260303* | Dynamics, SimplyBook integrations |
| 2026-03-04 | 20260304* | V3 pricing, annual pricing fix, search_path fixes, analysis queue, team calendar assignments |
| 2026-03-05 | 20260305* | SimplyBook search_path fix |
| 2026-03-06 | 20260306* | **V4 Pricing**: Growth plan ($179), add-ons, recording storage, company_addons table |
| 2026-03-20 | 20260320* | Billing audit: bland_api_key, atomic increment RPC, indexes |
| 2026-03-21 | 20260321* | Master API key architecture, admin_platform_config, admin_audit_log |
| 2026-03-22 | 20260322* | DB cleanup: RLS consolidation, auth_rls_initplan, index dedup |
| 2026-03-23 | 20260323* | Production audit fixes: role escalation, sensitive fields, CHECK constraints, soft-delete, campaign_queue dedup |

## Key Architectural Changes

1. **V3 → V4 Pricing** (March 6): Added Growth plan, add-on system, recording storage
2. **Master Key Architecture** (March 21): Single Bland AI key, admin_platform_config singleton
3. **Production Audit** (March 23): 15 security/performance fixes

## Convention

New migrations should use:
```
supabase/migrations/YYYYMMDDHHMMSS_description.sql
```

Last migration: `20260323000002_production_audit_fixes.sql`

## Related Notes

- [[Schema Overview]]
- [[Pricing Model]]
