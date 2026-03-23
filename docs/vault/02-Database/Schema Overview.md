---
tags: [database, schema, supabase]
aliases: [DB Schema, Database]
---

# Schema Overview

Callengo uses **Supabase (PostgreSQL)** with 56 tables, RLS on all user-facing tables, and 45 sequential migrations.

## Table Categories

### Core Tables (8)
| Table | Description | See |
|-------|-------------|-----|
| `companies` | Top-level tenant | [[Company]] |
| `company_settings` | Per-company config | [[Company]] |
| `users` | Platform users | [[User]] |
| `contacts` | Call targets | [[Contact]] |
| `contact_lists` | Contact grouping | [[Contact]] |
| `company_agents` | Agent instances | [[Agent]] |
| `agent_templates` | 3 built-in agent types | [[Agent]] |
| `agent_runs` | Campaigns | [[Campaign]] |

### Call & Processing Tables (6)
| Table | Description | See |
|-------|-------------|-----|
| `call_logs` | Call records | [[Call]] |
| `follow_up_queue` | Auto-retry queue | [[Follow-Up]] |
| `voicemail_logs` | Voicemail detection | [[Voicemail]] |
| `campaign_queue` | Campaign call dispatch | [[Campaign]] |
| `call_queue` | Individual call dispatch | [[Call]] |
| `analysis_queue` | Post-call AI analysis | [[Call]] |

### Billing Tables (6)
| Table | Description | See |
|-------|-------------|-----|
| `subscription_plans` | 6 plan definitions | [[Subscription]] |
| `company_subscriptions` | Active subscriptions | [[Subscription]] |
| `company_addons` | Paid add-ons | [[Add-on]] |
| `usage_tracking` | Minute/call consumption | [[Usage Tracking]] |
| `billing_history` | Payment records | [[Stripe Integration]] |
| `billing_events` | Billing event log | [[Stripe Integration]] |
| `stripe_events` | Idempotency tracking | [[Stripe Integration]] |

### Calendar Tables (4)
| Table | Description | See |
|-------|-------------|-----|
| `calendar_integrations` | OAuth connections | [[Calendar Event]] |
| `calendar_events` | Synced events | [[Calendar Event]] |
| `calendar_sync_log` | Sync operations | [[Calendar Event]] |
| `team_calendar_assignments` | Resource routing | [[Calendar Event]] |

### CRM Integration Tables (21 = 7 × 3)
Each CRM has 3 tables: `{crm}_integrations`, `{crm}_contact_mappings`, `{crm}_sync_logs`

| CRM | Tables prefix | See |
|-----|--------------|-----|
| HubSpot | `hubspot_` | [[HubSpot]] |
| Salesforce | `salesforce_` | [[Salesforce]] |
| Pipedrive | `pipedrive_` | [[Pipedrive]] |
| Zoho | `zoho_` | [[Zoho]] |
| Dynamics 365 | `dynamics_` | [[Dynamics 365]] |
| Clio | `clio_` | [[Clio]] |
| SimplyBook | `simplybook_` | [[SimplyBook]] |

### Google Sheets (2)
| Table | Description |
|-------|-------------|
| `google_sheets_integrations` | OAuth connections |
| `google_sheets_linked_sheets` | Linked spreadsheets with column mapping |

### Other Tables (6)
| Table | Description | See |
|-------|-------------|-----|
| `ai_conversations` | AI chat sessions | |
| `ai_messages` | AI chat messages | |
| `notifications` | In-app alerts | [[Notification]] |
| `webhook_endpoints` | Outbound webhook config | [[Webhook]] |
| `webhook_deliveries` | Webhook delivery log | [[Webhook]] |
| `integration_feedback` | User feedback on integrations | |
| `simplybook_webhook_logs` | SimplyBook webhook log | |
| `team_invitations` | Team invites | [[Team Invitation]] |

### Admin Tables (3)
| Table | Description | See |
|-------|-------------|-----|
| `admin_finances` | Monthly P&L snapshots | [[Command Center]] |
| `admin_platform_config` | Singleton platform config | [[Platform Config]] |
| `admin_audit_log` | Immutable admin action log | [[Audit Log]] |

## Schema Statistics

- **Tables:** 56
- **Foreign Keys:** 200+
- **Indexes:** 150+
- **RLS-Enabled Tables:** 45 (80%)
- **CHECK Constraints:** 8 status columns
- **Unique Constraints:** 12+
- **Triggers:** 30+
- **Functions/RPCs:** 15+
- **Storage Buckets:** 1 (`call-recordings`, max 50MB, audio only)

## Related Notes

- [[RLS Patterns]]
- [[Triggers & Functions]]
- [[Migrations Timeline]]
