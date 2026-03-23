---
tags: [index, home]
aliases: [Vault Index, Home]
---

# Callengo Knowledge Base

> Obsidian vault documenting the complete Callengo SaaS platform.
> Generated: March 23, 2026

## How to Open in Obsidian

1. Download and install [Obsidian](https://obsidian.md) (free, Mac/Windows/Linux)
2. Open Obsidian
3. Click **"Open folder as vault"** (or "Open" if it's your first vault)
4. Navigate to this folder: `callengo-app/docs/vault/`
5. Select it and click Open

That's it. Obsidian will automatically detect all `.md` files, resolve the `[[wikilinks]]` between notes, and index the tags from the YAML frontmatter.

### Recommended After Opening

- **Graph View** (`Ctrl/Cmd + G`) — See all 48 notes and their connections visually
- **Install "Dataview" plugin** — Enables querying notes by tags (e.g., all `#entity` notes)
- **Star this note** — Use it as your home page / entry point

---

## Quick Start

**What is Callengo?** → [[App Identity]]
**Who is it for?** → [[ICP & Positioning]]
**How is it built?** → [[Architecture Overview]]

---

## 00 — Overview
- [[App Identity]] — Product definition, tech stack, key decisions
- [[ICP & Positioning]] — Target customers, market segments, plan segmentation
- [[Architecture Overview]] — System design, project structure, patterns

## 01 — Entities
- [[Company]] — Multi-tenant root entity
- [[User]] — Platform users with roles (owner/admin/member)
- [[Contact]] — People that AI agents call
- [[Agent]] — AI voice agents (3 types: lead qualification, data validation, appointment confirmation)
- [[Campaign]] — Batch call runs using agents
- [[Call]] — Individual call records with transcripts and AI analysis
- [[Follow-Up]] — Auto-retry queue for unreached contacts
- [[Voicemail]] — Voicemail detection and messaging
- [[Calendar Event]] — Synced calendar events with confirmation tracking
- [[Subscription]] — Plan billing and status
- [[Add-on]] — Paid extras (dedicated number, recording vault, calls booster)
- [[Notification]] — In-app alerts for campaigns and usage
- [[Webhook]] — Outbound webhook delivery
- [[Team Invitation]] — Team member invitations

## 02 — Database
- [[Schema Overview]] — 56 tables, categories, statistics
- [[RLS Patterns]] — 5 Row Level Security patterns
- [[Triggers & Functions]] — Business logic triggers and RPC functions
- [[Migrations Timeline]] — 45 migrations from Jan-Mar 2026

## 03 — API
- [[API Overview]] — 142 endpoints, common patterns
- [[Billing API]] — 13 endpoints for plans, checkout, usage
- [[Bland AI API]] — Call dispatch and webhook processing
- [[Calendar API]] — 10 endpoints for events and sync
- [[Admin API]] — 8 endpoints for Command Center
- [[Integrations API]] — 60+ endpoints for 7 CRMs + Google Sheets
- [[Contacts API]] — CRUD and import/export
- [[Auth API]] — Authentication and team management

## 04 — Integrations
- [[Bland AI]] — Voice calls (master key architecture)
- [[Stripe Integration]] — Payments and subscriptions
- [[OpenAI]] — Post-call AI analysis (GPT-4o-mini)
- [[Upstash Redis]] — Concurrency and rate limiting
- **CRMs:** [[HubSpot]] · [[Salesforce]] · [[Pipedrive]] · [[Zoho]] · [[Dynamics 365]] · [[Clio]] · [[SimplyBook]]
- **Calendar:** [[Google Calendar]] · [[Microsoft Outlook]]
- [[Video Providers]] — Google Meet, Zoom, Microsoft Teams

## 05 — Billing
- [[Pricing Model]] — 6 tiers, annual discounts, add-ons
- [[Plan Features]] — Feature matrix by plan
- [[Usage Tracking]] — Minute metering, overage billing

## 06 — Workflows
- [[Lead Qualification]] — BANT framework agent workflow
- [[Data Validation]] — Contact data verification workflow
- [[Appointment Confirmation]] — Pre-appointment calling workflow
- [[Campaign Dispatch Flow]] — Technical call dispatch architecture
- [[Call Processing Flow]] — Webhook processing and post-call pipeline
- [[Onboarding Flow]] — New user registration flow

## 07 — Admin
- [[Command Center]] — 6-tab admin monitoring panel
- [[Platform Config]] — Global platform settings (singleton)
- [[Audit Log]] — Immutable admin action log

---

## Vault Statistics

| Metric | Count |
|--------|-------|
| Total notes | 48 |
| Sections | 8 |
| Entity notes | 14 |
| Database notes | 4 |
| API notes | 8 |
| Integration notes | 15 |
| Billing notes | 3 |
| Workflow notes | 6 |
| Admin notes | 3 |
