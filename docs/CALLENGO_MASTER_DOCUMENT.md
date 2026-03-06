# CALLENGO — Complete Platform Master Document

> **Version:** 1.0.0
> **Last Updated:** March 2026
> **Purpose:** Comprehensive reference for the entire Callengo platform — architecture, features, pricing, database schema, API endpoints, integrations, and business logic.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Technology Stack](#2-technology-stack)
3. [Subscription Plans & Pricing](#3-subscription-plans--pricing)
4. [Application Pages & Features](#4-application-pages--features)
5. [AI Agent System](#5-ai-agent-system)
6. [Contact Management](#6-contact-management)
7. [Call System](#7-call-system)
8. [Calendar & Scheduling](#8-calendar--scheduling)
9. [Follow-ups & Voicemails](#9-follow-ups--voicemails)
10. [Integrations](#10-integrations)
11. [Billing & Usage](#11-billing--usage)
12. [Database Schema](#12-database-schema)
13. [API Endpoints](#13-api-endpoints)
14. [Authentication & Security](#14-authentication--security)
15. [Internationalization](#15-internationalization)
16. [Frontend Architecture](#16-frontend-architecture)
17. [Business Logic & Constraints](#17-business-logic--constraints)
18. [Promotional Coupons](#18-promotional-coupons)
19. [Notification System](#19-notification-system)
20. [Utility Libraries](#20-utility-libraries)
21. [Environment & Deployment](#21-environment--deployment)

---

## 1. Platform Overview

Callengo is a B2B SaaS platform for AI-powered outbound calling campaigns. Businesses use Callengo to automate phone calls for lead qualification, data validation, and appointment confirmation using AI voice agents.

**Core Value Proposition:**
- Create AI calling agents from templates (Lead Qualification, Data Validation, Appointment Confirmation)
- Import contacts from CSV, Excel, Google Sheets, JSON, or CRM integrations
- Run automated calling campaigns with voicemail detection, follow-ups, and smart scheduling
- Track results with call analytics, transcriptions, recordings, and sentiment analysis
- Integrate with CRMs (Salesforce, HubSpot, Pipedrive, Zoho, Clio, Dynamics 365), calendars (Google, Outlook), video conferencing (Zoom, Meet, Teams), and communication tools (Slack, webhooks)

---

## 2. Technology Stack

### Core Framework
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.1.1 | React framework (App Router) |
| React | 19.2.1 | UI library |
| TypeScript | 5.9.3 | Type safety |
| Tailwind CSS | 4 | Styling (with PostCSS) |
| Supabase | 2.87.1 | Database, auth, real-time |
| Zod | 4.3.6 | Schema validation |

### Key Dependencies
| Library | Version | Purpose |
|---|---|---|
| Stripe | 20.1.0 (Node), 8.6.0 (JS) | Billing & payments |
| OpenAI | 6.15.0 | AI chat assistant |
| Bland AI | (API) | AI voice calling engine |
| Google APIs | 144.0.0 | Calendar, Sheets, Meet |
| Axios | 1.13.2 | HTTP client |
| LRU-Cache | 11.2.6 | Performance caching |
| Lucide React | 0.562.0 | Icon library |
| PapaParse | 5.5.3 | CSV parsing |
| XLSX | 0.18.5 | Excel file support |
| XML2JS | 0.6.2 | XML parsing |

### External Services
| Service | Purpose |
|---|---|
| Supabase | PostgreSQL database, authentication, row-level security |
| Stripe | Payment processing, subscriptions, invoicing |
| Bland AI | AI voice call engine (send calls, transcription, analysis) |
| OpenAI | AI chat assistant, call analysis, context suggestions |
| Twilio | BYOP (Bring Your Own Phone) for Business+ plans |
| Vercel | Hosting & deployment |

---

## 3. Subscription Plans & Pricing

### Plan Tiers (V3 — March 2026)

#### FREE (Trial)
- **Price:** $0
- **Minutes:** 15 one-time (not monthly)
- **Max Call Duration:** 3 min per call
- **Concurrent Calls:** 1
- **Active Agents:** 1 (locked after selection)
- **Users:** 1
- **Overage:** None — must upgrade after minutes used
- **Integrations:** Google Calendar, Google Meet, Google Sheets
- **Features:** Full campaign wizard, CSV/Excel/JSON import, phone normalization, contact deduplication, custom fields, tags, AI agent creation, call analytics, transcription downloads, usage dashboard, billing alerts, auto-rotated phone numbers

#### STARTER — $299/month
- **Minutes:** 300/month
- **Max Call Duration:** 3 min per call
- **Concurrent Calls:** 2
- **Active Agents:** 1 (switchable between campaigns)
- **Users:** 1
- **Overage:** $0.55/min
- **Integrations:** Everything in Free + Zoom, Slack notifications, SimplyBook.me, Webhooks (Zapier/Make/n8n)
- **Features:** Voicemail detection, follow-ups (max 2 attempts), rescheduling, data export, async email support, auto-rotated phone numbers

#### BUSINESS — $299/month
- **Minutes:** 1,200/month
- **Max Call Duration:** 5 min per call
- **Concurrent Calls:** 5
- **Active Agents:** Unlimited (simultaneous)
- **Users:** 3
- **Overage:** $0.39/min
- **Integrations:** Everything in Starter + Microsoft Outlook, Microsoft Teams, HubSpot, Pipedrive, Zoho, Clio (legal), Twilio BYOP
- **Features:** Smart follow-ups (max 5 attempts), voicemail smart handling, no-show auto-retry, priority email support

#### TEAMS — $649/month
- **Minutes:** 2,500/month
- **Max Call Duration:** 8 min per call
- **Concurrent Calls:** 10
- **Active Agents:** Unlimited
- **Users:** 5 (+$69/extra seat)
- **Overage:** $0.29/min
- **Integrations:** Everything in Business + Salesforce, Microsoft Dynamics 365
- **Features:** User permissions (admin/member roles), advanced follow-ups (max 10 attempts), priority support

#### ENTERPRISE — $1,499/month
- **Minutes:** 6,000+/month
- **Max Call Duration:** 15 min per call
- **Concurrent Calls:** 25+
- **Active Agents:** Unlimited
- **Users:** Unlimited
- **Overage:** $0.25/min
- **Integrations:** All current + future integrations
- **Features:** Unlimited follow-up attempts, SLA guarantee, dedicated account manager, annual contract required

### Pricing by Currency
| Currency | Multiplier | Example (Starter) |
|---|---|---|
| USD | 1.00x | $299/mo |
| EUR | 0.92x | ~€275/mo |
| GBP | 0.79x | ~£236/mo |

### Feature Access Matrix

| Feature | Free | Starter | Business | Teams | Enterprise |
|---|---|---|---|---|---|
| Max Active Agents | 1 (locked) | 1 (switchable) | Unlimited | Unlimited | Unlimited |
| Max Users | 1 | 1 | 3 | 5 (+$69/ea) | Unlimited |
| Voicemail Detection | No | Yes | Yes | Yes | Yes |
| Follow-ups | No | 2 attempts | 5 attempts | 10 attempts | Unlimited |
| Smart Follow-up | No | No | Yes | Yes | Yes |
| Google Calendar | Yes | Yes | Yes | Yes | Yes |
| Microsoft Outlook | No | No | Yes | Yes | Yes |
| Google Meet | Yes | Yes | Yes | Yes | Yes |
| Zoom | No | Yes | Yes | Yes | Yes |
| Microsoft Teams | No | No | Yes | Yes | Yes |
| Slack | No | Yes | Yes | Yes | Yes |
| SimplyBook.me | No | Yes | Yes | Yes | Yes |
| Webhooks | No | Yes | Yes | Yes | Yes |
| HubSpot | No | No | Yes | Yes | Yes |
| Pipedrive | No | No | Yes | Yes | Yes |
| Zoho | No | No | Yes | Yes | Yes |
| Clio | No | No | Yes | Yes | Yes |
| Salesforce | No | No | No | Yes | Yes |
| Dynamics 365 | No | No | No | Yes | Yes |
| Twilio BYOP | No | No | Yes | Yes | Yes |
| Rescheduling | No | Yes | Yes | Yes | Yes |
| Data Export | No | Yes | Yes | Yes | Yes |
| No-Show Auto Retry | No | No | Yes | Yes | Yes |
| User Permissions | No | No | No | Yes | Yes |
| Extra Seats | No | No | No | $69/seat | Included |

---

## 4. Application Pages & Features

### Routing Structure

```
/(app) — Main authenticated app layout
├── /dashboard          — Overview & statistics
├── /agents             — AI agent library & management
├── /campaigns          — Campaign creation & management
│   └── /[id]           — Campaign detail & call logs
├── /contacts           — Contact database & import
│   ├── /salesforce     — Salesforce contact sync
│   ├── /hubspot        — HubSpot contact sync
│   ├── /pipedrive      — Pipedrive contact sync
│   ├── /clio           — Clio contact sync
│   ├── /zoho           — Zoho contact sync
│   ├── /microsoft-dynamics — Dynamics contact sync
│   └── /simplybook     — SimplyBook.me sync
├── /calls              — Call history & transcripts
├── /calendar           — Calendar & scheduling
├── /follow-ups         — Follow-up queue
├── /voicemails         — Voicemail logs
├── /analytics          — Analytics dashboard
├── /reports            — Report generation
├── /integrations       — Integration management
├── /settings           — Settings (company, user, billing, team)
├── /team               — Team management (Business+)
├── /billing            — Redirects to /settings?tab=billing
├── /subscription       — Subscription success page
└── /admin              — Admin dashboard

/auth — Authentication
├── /login
├── /signup
├── /forgot-password
├── /reset-password
├── /verify-email
└── /callback

/onboarding — Company setup wizard
```

### Dashboard (`/dashboard`)
- Contact status breakdown: Pending, Calling, Fully Verified, No Answer, Voicemail Left, For Callback, Research Needed, Wrong Number, Number Disconnected
- Recent calls with contact info
- Active agents list
- Active campaigns (last 5)
- Contact lists overview
- Usage tracking: minutes used vs. included, overage minutes, total cost
- Subscription status with billing cycle
- Call statistics: total calls, successful calls, success rate, avg duration
- Contact statistics: pending, called, verified counts

### Agents (`/agents`)
- AI agent library browser with 3 core templates:
  - **Lead Qualification Agent** — qualifies leads via phone
  - **Data Validation Agent** — verifies contact/business data
  - **Appointment Confirmation Agent** — confirms scheduled appointments
- Company agent customization (custom task prompts, settings)
- Agent configuration: voice selection, max duration, interval, working hours
- Agent test call feature with test phone number
- Voice selection: Maya (female), Josh (male), Matt (male), Nat/Natalie (female)
- Settings locked based on subscription plan
- Feature gating: Free = 1 agent locked, Business+ = all agents simultaneously

### Campaigns (`/campaigns`)
- Campaign overview with status filters (all, active, completed, paused, failed)
- Campaign statistics: active count, completed count, total calls, success rate
- Campaign search and filtering
- Follow-up queue stats display
- Voicemail statistics
- Campaign creation wizard:
  1. Agent selection
  2. Contact list selection
  3. Voice configuration
  4. Calendar/scheduling settings
  5. Follow-up configuration
  6. Voicemail settings
  7. Compliance confirmations (AI disclosure checkbox)

### Campaign Detail (`/campaigns/[id]`)
- Full campaign metadata and status
- Call logs (50 most recent): status, duration, answered by (human/voicemail/unknown), recording URL, contact info
- Follow-up queue entries with status and attempt number
- Voicemail logs: message left, duration, detection timestamp
- Call analysis data per contact

### Contacts (`/contacts`)
- Contact database with pagination (initial 50 server-side, lazy-load more)
- Import methods:
  - CSV/Excel with auto-column mapping (88+ known field patterns)
  - JSON import/export
  - Google Sheets integration
  - Manual entry
  - CRM sync (plan-gated)
- Contact lists: create, manage, organize
- Phone number normalization (E.164 format, +1XXXXXXXXXX for US)
- Contact deduplication (phone + email based)
- Custom fields support (auto-captured from any import column)
- Contact detail view: all fields, call history, status, notes
- Tagging and notes system

### Calls (`/calls`)
- Full call history with all logs
- Call filtering by agent template
- Call detail modal:
  - Full transcript (conversation entries with timestamps)
  - Call duration and timestamps
  - Recording playback
  - Call analysis: sentiment, customer interest, key points, category
  - Contact information
  - Agent used
  - Status and outcome

### Calendar (`/calendar`)
- Calendar event visualization (3 months back to 3 months forward)
- Event types: call, follow_up, no_show_retry, meeting, appointment, callback, voicemail_followup
- Event statuses: scheduled, confirmed, completed, no_show, cancelled, rescheduled, pending_confirmation
- Calendar integrations: Google Calendar (Free+), Microsoft Outlook (Business+)
- Video conferencing: Google Meet (Free+), Zoom (Starter+), Microsoft Teams (Business+)
- Working hours configuration: start/end time, working days
- Timezone support and auto-detection
- US holiday exclusion
- Event sources: manual, campaign, Google Calendar, Outlook, AI agent, follow_up_queue, webhook
- Event confirmation workflow
- Rescheduling (Starter+)
- Slack notifications for events (Starter+)
- SimplyBook.me booking integration (Starter+)

### Follow-ups (`/follow-ups`)
- Follow-up queue with status tracking
- Attempt tracking (max varies by plan)
- Next attempt scheduling
- Linked to contacts and campaigns
- Statuses: pending, completed, failed

### Voicemails (`/voicemails`)
- Voicemail log display
- Detection status and confidence
- Message duration and content
- Linked to contacts and campaigns
- Follow-up scheduling from voicemails

### Analytics (`/analytics`)
- Call logs analysis
- Contact statistics breakdown
- Agent performance metrics
- Campaign performance analysis
- Data visualizations

### Reports (`/reports`)
- Campaign report generation
- Call statistics reporting
- Contact status reporting
- Export capabilities

### Integrations (`/integrations`)
- Connection management for all platforms
- Real-time sync capability
- Status display for each integration
- Plan-gated access enforcement
- Setup modals for OAuth and API connections

### Settings (`/settings`)
- **Company:** name, website, logo, description, industry, context data
- **User:** full name, email, role, notifications_enabled, timezone, language
- **Call Settings:** default voice, max duration, interval minutes, max calls per day
- **Calendar Settings:** timezone, working hours, working days, US holidays
- **Notifications:** per-event-type toggles
- **Team (Business+):** invite members, set permissions (admin/member)
- **Billing:** plan selection, usage monitoring, overage management, cancellation
- **CRM Org Import:** sync users and invite team from connected CRMs

### Team (`/team`)
- Upgrade CTA for Free/Starter plans
- Team member list with roles
- User permissions management (admin/member)
- Integration connection status for org member imports

### Billing (`/billing` → `/settings?tab=billing`)
- Current plan display with billing cycle
- Monthly vs. Annual toggle
- Usage progress bar (minutes used vs. included)
- Overage display with cost calculation
- Billing history with payment status and invoice URLs
- Payment method display
- Plan comparison table
- Upgrade/downgrade capability
- Cancellation workflow: reason selection, feedback, retention offers, scheduled cancellation
- Overage budget configuration: enable/disable, budget limits, alert thresholds (70%, 90%, 100%)

### AI Chat Assistant
- Slide-out chat panel accessible from any page
- Multi-turn conversations with persistent history
- Context-aware about all platform features
- Navigation linking within responses
- Markdown formatting
- Conversation list sidebar with new conversation creation

---

## 5. AI Agent System

### Agent Templates
Three core templates (seeded in database):

| Template | Slug | Purpose |
|---|---|---|
| Lead Qualification | `lead-qualification` | Qualify leads via phone calls |
| Data Validation | `data-validation` | Verify contact/business information |
| Appointment Confirmation | `appointment-confirmation` | Confirm scheduled appointments |

### Agent Configuration
- **Voice:** Maya (female), Josh (male), Matt (male), Nat/Natalie (female)
- **Max Call Duration:** Plan-dependent (3–15 min)
- **Interval:** Configurable minutes between calls
- **Working Hours:** Start/end time, working days
- **Custom Task:** Override template prompt per company
- **Custom Settings:** JSON configuration overrides

### Agent Run (Campaign) Settings
```typescript
interface AgentRunSettings {
  voice: string;
  maxDuration: number;
  intervalMinutes: number;
  maxCallsPerDay: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  workingDays: number[];
  calendarEnabled: boolean;
  calendarTimezone: string;
  meetingDuration: number;
  meetingBuffer: number;
  videoProvider: string;
  followUpEnabled: boolean;
  followUpMaxAttempts: number;
  followUpIntervalHours: number;
  voicemailEnabled: boolean;
  voicemailDetectionEnabled: boolean;
  voicemailMessage: string;
  voicemailAction: string;
}
```

### Agent Limits by Plan
| Plan | Max Active Agents | Behavior |
|---|---|---|
| Free | 1 | Locked after first selection |
| Starter | 1 | Switchable between campaigns |
| Business | Unlimited | All agents simultaneously |
| Teams | Unlimited | All agents simultaneously |
| Enterprise | Unlimited | All agents simultaneously |

---

## 6. Contact Management

### Contact Fields

**Core Fields:**
- Company Name, First/Last/Full Name
- Address (Address2, City, State, Zip Code, Country)
- Phone Number (normalized to E.164), Original Phone Number
- Email, Job Title, Department, Industry
- Decision Maker info (first, last, email, phone)
- Owner/Manager Name

**Healthcare-Specific:**
- Patient Sex/Gender, Date of Birth
- Patient ID / MRN, Doctor Assigned
- Insurance / Insurance ID
- Appointment Date/Time/Type

**Lead Management:**
- Lead Source, Lead Status, Deal Value, Product Interest

**Extra Fields:**
- Corporate/Personal Email/Phone variants, Fax
- Website/Domain, Company Size/Revenue
- Neighborhood/District, Language, Timezone
- External ID (CRM reference)
- Tags (string array), Notes (text)
- Custom Fields (JSON — any columns from import)

### Contact Statuses
| Status | Description |
|---|---|
| `pending` | Not yet called |
| `calling` | Call in progress |
| `fully_verified` | Successfully verified |
| `research_needed` | Requires follow-up investigation |
| `no_answer` | No one answered |
| `for_callback` | Scheduled for callback |
| `wrong_number` | Wrong phone number |
| `number_disconnected` | Number is disconnected |
| `withheld_hung_up` | Contact withheld info or hung up |
| `voicemail_left` | Voicemail was left |

### Call Outcomes
| Outcome | Description |
|---|---|
| `not_called` | Default — never called |
| `owner_gave_email` | Contact provided email |
| `staff_gave_email` | Staff member provided email |
| `incomplete_data` | Partial information obtained |
| `refused` | Contact refused |
| `left_voicemail` | Voicemail message left |
| `follow_up_scheduled` | Follow-up has been scheduled |
| `wrong_number` | Wrong number confirmed |
| `disconnected` | Number disconnected |

### Import Auto-Column Mapping
The system recognizes 88+ field name patterns for automatic column mapping from CSV/Excel imports, including variations like:
- `company`, `business_name`, `organization` → Company Name
- `phone`, `tel`, `mobile`, `cell` → Phone Number
- `first_name`, `fname`, `given_name` → First Name
- `email`, `e_mail`, `email_address` → Email
- etc.

### Phone Number Normalization
- Converts to E.164 format (`+1XXXXXXXXXX` for US)
- Strips formatting characters
- Validates before call placement
- Stores original number separately

---

## 7. Call System

### Call Provider
Bland AI is the underlying call engine. Calls are initiated via the Bland AI API and results are received via webhook.

### Call Flow
1. Campaign started → contacts queued in `call_queue`
2. Queue processor picks up contacts based on concurrency limits
3. Call sent to Bland AI via `/api/bland/send-call`
4. Bland AI executes call with configured voice, prompt, and settings
5. Webhook received at `/api/bland/webhook` on call completion
6. Call log created, contact status updated, analysis stored
7. Follow-ups scheduled if applicable
8. Usage tracked for billing

### Call Statuses
| Status | Description |
|---|---|
| `pending` | Queued for calling |
| `queued` | In the call queue |
| `in_progress` | Call currently active |
| `completed` | Call finished successfully |
| `failed` | Call failed (error) |
| `no_answer` | No one picked up |
| `voicemail` | Reached voicemail |
| `busy` | Line was busy |

### Voices
| Voice ID | Name | Gender |
|---|---|---|
| `maya` | Maya | Female |
| `josh` | Josh | Male |
| `matt` | Matt | Male |
| `nat` | Natalie | Female |

### Call Analysis Data
Each completed call captures:
- **Verified Info:** address, contact name, email, business confirmation
- **Sentiment:** positive, neutral, negative
- **Customer Interest:** high, medium, low, none
- **Category:** successful, partial, callback_needed, wrong_number, not_interested, voicemail, no_answer
- **Key Points:** extracted from conversation
- **Follow-up Required:** boolean flag with reason
- **Outcome Notes:** free-text summary

### Call Metadata
- From/To phone numbers
- Start/End timestamps
- Duration (corrected after completion)
- Price (internal only — never shown to users)
- Answered by: human, voicemail, unknown
- AI Model used, Language
- Batch ID (for bulk campaigns)
- Recording URL, Transcript
- Voicemail detected flag
- Local dialing flag

---

## 8. Calendar & Scheduling

### Calendar Event Types
`call`, `follow_up`, `no_show_retry`, `meeting`, `appointment`, `callback`, `voicemail_followup`

### Calendar Event Statuses
`scheduled`, `confirmed`, `completed`, `no_show`, `cancelled`, `rescheduled`, `pending_confirmation`

### Calendar Event Sources
`manual`, `campaign`, `google_calendar`, `microsoft_outlook`, `ai_agent`, `follow_up_queue`, `webhook`

### Confirmation Workflow
- Events have a `confirmation_status`: `pending`, `confirmed`, `declined`
- `confirmation_attempts` tracks retry count
- `last_confirmation_at` tracks last attempt
- Rescheduling supported (Starter+) with `rescheduled_count` and `rescheduled_reason`

### Calendar Integrations
| Provider | Plan Required | Auth Method |
|---|---|---|
| Google Calendar | Free+ | OAuth 2.0 |
| Microsoft Outlook | Business+ | OAuth 2.0 (Microsoft Graph) |

### Video Conferencing
| Provider | Plan Required | Setup |
|---|---|---|
| Google Meet | Free+ | Auto-generated via Google Calendar |
| Zoom | Starter+ | Server-to-Server OAuth (env-based) |
| Microsoft Teams | Business+ | OAuth 2.0 (Microsoft Graph) |

### Working Hours Configuration
- Start time, end time
- Working days (array of day numbers)
- Timezone (auto-detected, configurable)
- US holiday exclusion

### Calendar Sync
- Bidirectional sync with Google Calendar and Outlook
- Sync tokens for incremental updates
- Sync log tracking (events created/updated/deleted, errors)
- Last synced timestamp per integration

---

## 9. Follow-ups & Voicemails

### Follow-up System
- Automatically queued after initial call failure (no answer, voicemail, busy)
- Retry attempts limited by plan tier
- Configurable interval between attempts (hours)
- Smart follow-up (Business+): auto-schedules based on contact availability
- No-show auto-retry (Business+): retries when contact misses scheduled callback

| Plan | Max Attempts | Type |
|---|---|---|
| Free | 0 (disabled) | — |
| Starter | 2 | Basic scheduling |
| Business | 5 | Smart scheduling |
| Teams | 10 | Advanced scheduling |
| Enterprise | Unlimited | Full automation |

### Follow-up Queue Fields
- `attempt_number` / `max_attempts`
- `next_attempt_at` / `last_attempt_at`
- `status`: pending, completed, failed
- `reason`: why follow-up was created
- `original_call_id`: reference to first call
- `metadata`: JSON additional data

### Voicemail System
- **Detection:** Available on Starter+ plans
- **Detection Method:** Bland AI auto-detection with confidence score
- **Message Left:** Boolean + message text/audio URL
- **Message Duration:** Tracked in seconds
- **Follow-up:** Can auto-schedule follow-up from voicemail
- **Logs:** Separate `voicemail_logs` table tracks all voicemail events

---

## 10. Integrations

### Integration Summary

| Integration | Type | Auth Method | Plan Required |
|---|---|---|---|
| Google Calendar | Calendar | OAuth 2.0 | Free+ |
| Microsoft Outlook | Calendar | OAuth 2.0 (Graph) | Business+ |
| Google Meet | Video | Via Google Calendar | Free+ |
| Zoom | Video | Server-to-Server OAuth | Starter+ |
| Microsoft Teams | Video | OAuth 2.0 (Graph) | Business+ |
| Slack | Communication | OAuth 2.0 | Starter+ |
| Google Sheets | Data Import | OAuth 2.0 | Free+ |
| HubSpot | CRM | OAuth 2.0 | Business+ |
| Pipedrive | CRM | OAuth 2.0 | Business+ |
| Zoho CRM | CRM | OAuth 2.0 | Business+ |
| Clio | CRM (Legal) | OAuth 2.0 | Business+ |
| Salesforce | CRM | OAuth 2.0 (Web Flow) | Teams+ |
| Microsoft Dynamics 365 | CRM | OAuth 2.0 (Entra/Azure AD) | Teams+ |
| SimplyBook.me | Booking | REST API v2 (Token) | Starter+ |
| Twilio BYOP | Phone | Account SID + Auth Token | Business+ |
| Webhooks | Automation | API Key / URL | Starter+ |
| Stripe | Billing | API Key (built-in) | All |

### CRM Integration Details

All CRM integrations support:
- **Sync Directions:** Inbound (CRM → Callengo), Outbound (Callengo → CRM), Bidirectional
- **Contact Sync:** Import/export contacts with field mapping
- **User/Owner Mapping:** Map CRM users to Callengo contacts
- **Organization Member Import:** Import CRM team members to Callengo team
- **Notes/Activity Creation:** Push call results back to CRM
- **Disconnect:** Revoke integration and clean up tokens

#### Salesforce (Teams+)
- Contact, Lead, Event sync
- Activity/Task creation
- Custom field mapping
- Organization member import

#### HubSpot (Business+)
- Contact, Company, Deal sync
- Contact list support
- Notes/Activity creation
- Custom field mapping
- Organization member import

#### Pipedrive (Business+)
- Person/Contact, Organization, Deal sync
- Activity/Note creation
- Activity type support
- Organization member import

#### Clio — Legal Practice Management (Business+)
- Contact/Client, Matter/Case sync
- Calendar entry sync
- User/Attorney mapping
- Matter-linked event support
- Organization member import

#### Zoho CRM (Business+)
- Contact, Lead, Account sync
- Notes/Activity creation
- Custom field support
- Organization member import

#### Microsoft Dynamics 365 (Teams+)
- Contact/Account, Lead sync
- Notes/Activity creation
- Custom entity mapping
- Organization member import

#### SimplyBook.me (Starter+)
- REST API v2 (token-based, NOT OAuth)
- Client sync (bidirectional)
- Booking sync and confirmation
- Service/Provider mapping
- Calendar note/block creation
- Provider/Staff management

### Slack Integration (Starter+)
- Workspace authorization with channel selection
- Notification types: call completed, appointment scheduled, follow-up reminders, no-show alerts
- Channel-level configuration

### Google Sheets (Free+)
- Sheet reading with column detection
- Auto-column mapping interface
- Batch import with progress tracking

### Twilio BYOP (Business+)
- Account SID & Auth Token setup
- Phone number provisioning and import
- Incoming call routing

### Webhooks (Starter+)
- Incoming webhooks for external system triggers
- Outbound webhooks for Callengo events
- Compatible with Zapier, Make, n8n
- Custom event triggers with JSON payloads
- Retry logic on failure

### Integration Database Tables
Each CRM has its own integration table storing:
- `company_id`, `access_token`, `refresh_token`
- Provider-specific user ID and email
- `is_active`, `last_synced_at`
- `created_at`, `updated_at`

Tables: `salesforce_integrations`, `hubspot_integrations`, `pipedrive_integrations`, `clio_integrations`, `zoho_integrations`, `dynamics_integrations`, `simplybook_integrations`, `google_sheets_integrations`, `calendar_integrations`

---

## 11. Billing & Usage

### Billing System
- **Provider:** Stripe
- **Billing Cycles:** Monthly or Annual
- **Currencies:** USD, EUR, GBP (geolocation-based)
- **Annual Discount:** Supported via Stripe annual prices

### Usage Tracking
- Per-call minute tracking via `billing_events` table
- Period-based aggregation in `usage_tracking` table (monthly cycles)
- Real-time display vs. actual (corrected after call completes)
- Overage calculation: `overage_minutes = minutes_used - minutes_included`
- Cost tracking: `overage_minutes * plan.price_per_extra_minute`

### Overage Budget System
- Enable/disable overage spending per company
- Set budget limit (max overage spend per period)
- Alert thresholds at 70%, 90%, 100% of budget
- `overage_spent` tracked in `company_subscriptions`
- `overage_alert_level` tracks last triggered alert level

### Cancellation Workflow
1. User initiates cancellation
2. Cancellation reason selection (UI)
3. Feedback collection
4. Retention offer (optional)
5. Scheduled cancellation at period end (`cancel_at_period_end = true`)
6. Cancellation feedback stored via `/api/billing/cancellation-feedback`

### Billing History
- Payment records with amount, currency, status
- Invoice URLs from Stripe
- Payment method display
- Failure reasons tracked

### Stripe Integration
- Customer creation/update per company
- Subscription management (create, upgrade, downgrade, cancel)
- Checkout session creation for new subscriptions
- Billing portal sessions for self-service
- Metered billing for overage
- Webhook processing at `/api/webhooks/stripe`

---

## 12. Database Schema

### Tables (23 total)

#### `companies`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| name | text | |
| website | text? | |
| description | text? | |
| logo_url | text? | |
| favicon_url | text? | |
| industry | text? | |
| context_data | json? | Scraped company context |
| context_summary | text? | AI-generated summary |
| context_extracted_at | timestamp? | |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `users`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| company_id | uuid (FK) | |
| email | text | |
| full_name | text? | |
| role | text | admin or member |
| currency | text | USD, EUR, GBP |
| country_code | text? | |
| country_name | text? | |
| city | text? | |
| region | text? | |
| timezone | text? | |
| ip_address | text? | |
| location_logs | json | |
| location_updated_at | timestamp? | |
| notifications_enabled | boolean | |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `company_settings`
| Column | Type | Notes |
|---|---|---|
| company_id | uuid (PK, FK) | |
| bland_api_key | text? | Encrypted |
| openai_api_key | text? | Encrypted |
| default_voice | text | maya, josh, matt, nat |
| default_max_duration | number | Minutes |
| default_interval_minutes | number | Between calls |
| test_phone_number | text? | |
| settings | json? | Additional settings |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `agent_templates`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| name | text | |
| slug | text | lead-qualification, data-validation, appointment-confirmation |
| description | text? | |
| icon | text? | |
| category | text? | |
| task_template | text | Prompt template |
| first_sentence_template | text? | Opening line template |
| voicemail_template | text? | Voicemail message template |
| analysis_questions | json? | Questions for call analysis |
| is_active | boolean | |
| sort_order | number | |
| created_at | timestamp | |

#### `company_agents`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| company_id | uuid (FK) | |
| agent_template_id | uuid (FK) | |
| name | text | |
| custom_task | text? | Override template prompt |
| custom_settings | json? | |
| is_active | boolean | |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `agent_runs`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| company_id | uuid (FK) | |
| agent_template_id | uuid (FK) | |
| name | text | Campaign name |
| status | text | active, completed, paused, failed |
| total_contacts | number | |
| completed_calls | number | |
| successful_calls | number | |
| failed_calls | number | |
| total_cost | number | Internal cost tracking |
| settings | json? | AgentRunSettings object |
| started_at | timestamp? | |
| completed_at | timestamp? | |
| follow_up_enabled | boolean | |
| follow_up_max_attempts | number | |
| follow_up_interval_hours | number | |
| follow_up_conditions | json | Conditions for follow-up |
| voicemail_enabled | boolean | |
| voicemail_detection_enabled | boolean | |
| voicemail_message | text? | |
| voicemail_action | text | leave_message, hang_up, etc. |
| voicemails_detected | number | Counter |
| voicemails_left | number | Counter |
| follow_ups_scheduled | number | Counter |
| follow_ups_completed | number | Counter |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `contacts`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| company_id | uuid (FK) | |
| company_name | text | |
| phone_number | text | Normalized E.164 |
| original_phone_number | text? | Before normalization |
| address | text? | |
| city | text? | |
| state | text? | |
| zip_code | text? | |
| contact_name | text? | |
| email | text? | |
| status | text | See Contact Statuses |
| call_outcome | text? | See Call Outcomes |
| last_call_date | timestamp? | |
| call_attempts | number | |
| call_id | text? | Last Bland call ID |
| call_status | text? | |
| call_duration | number? | Seconds |
| recording_url | text? | |
| transcript_text | text? | |
| transcripts | json? | Conversation entries |
| analysis | json? | Call analysis data |
| call_metadata | json? | |
| notes | text? | |
| is_test_call | boolean | |
| tags | text[]? | |
| list_id | uuid? (FK) | Contact list reference |
| custom_fields | json? | Any extra columns from import |
| source | text? | Import source |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `contact_lists`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| company_id | uuid (FK) | |
| name | text | |
| description | text? | |
| color | text? | UI color coding |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `call_logs`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| company_id | uuid (FK) | |
| contact_id | uuid? (FK) | |
| agent_template_id | uuid? (FK) | |
| agent_run_id | uuid? (FK) | |
| call_id | text | Bland AI call ID |
| status | text? | |
| completed | boolean | |
| call_length | number? | Seconds |
| price | number? | Internal — never shown to users |
| answered_by | text? | human, voicemail, unknown |
| recording_url | text? | |
| transcript | text? | |
| summary | text? | |
| analysis | json? | |
| error_message | text? | |
| metadata | json? | |
| voicemail_detected | boolean | |
| voicemail_left | boolean | |
| voicemail_message_url | text? | |
| voicemail_duration | number? | |
| created_at | timestamp | |

#### `call_queue`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| company_id | uuid (FK) | |
| contact_id | uuid? (FK) | |
| agent_id | uuid (FK) | |
| agent_run_id | uuid (FK) | |
| status | text | pending, processing, completed, failed |
| priority | number | |
| queued_at | timestamp | |
| started_at | timestamp? | |
| completed_at | timestamp? | |
| call_id | text? | |
| error_message | text? | |
| metadata | json | |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `follow_up_queue`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| company_id | uuid (FK) | |
| agent_run_id | uuid (FK) | |
| contact_id | uuid (FK) | |
| original_call_id | text? | |
| attempt_number | number | |
| max_attempts | number | |
| next_attempt_at | timestamp | |
| last_attempt_at | timestamp? | |
| status | text | pending, completed, failed |
| reason | text? | |
| metadata | json | |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `voicemail_logs`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| company_id | uuid (FK) | |
| call_id | text (FK) | |
| agent_run_id | uuid? (FK) | |
| contact_id | uuid? (FK) | |
| detected_at | timestamp | |
| confidence_score | number? | |
| detection_method | text? | |
| message_left | boolean | |
| message_text | text? | |
| message_duration | number? | Seconds |
| message_audio_url | text? | |
| follow_up_scheduled | boolean | |
| follow_up_id | uuid? (FK) | |
| metadata | json | |
| created_at | timestamp | |

#### `calendar_events`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| company_id | uuid (FK) | |
| integration_id | uuid? (FK) | |
| external_event_id | text? | Google/Outlook event ID |
| external_calendar_id | text? | |
| title | text | |
| description | text? | |
| location | text? | |
| start_time | timestamp | |
| end_time | timestamp | |
| timezone | text | |
| all_day | boolean | |
| event_type | text | call, follow_up, meeting, etc. |
| status | text | scheduled, confirmed, etc. |
| source | text | manual, campaign, google_calendar, etc. |
| contact_id | uuid? (FK) | |
| contact_name | text? | |
| contact_phone | text? | |
| contact_email | text? | |
| agent_run_id | uuid? (FK) | |
| call_log_id | uuid? (FK) | |
| follow_up_id | uuid? (FK) | |
| agent_name | text? | |
| ai_notes | text? | |
| confirmation_status | text | pending, confirmed, declined |
| confirmation_attempts | number | |
| last_confirmation_at | timestamp? | |
| original_start_time | timestamp? | Before rescheduling |
| rescheduled_count | number | |
| rescheduled_reason | text? | |
| recurrence_rule | text? | |
| recurring_event_id | text? | |
| attendees | json | |
| last_synced_at | timestamp? | |
| sync_status | text | |
| sync_error | text? | |
| metadata | json | |
| notes | text? | |
| video_link | text? | Meet/Zoom/Teams URL |
| video_provider | text? | |
| created_by_feature | text? | |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `calendar_integrations`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| company_id | uuid (FK) | |
| user_id | uuid (FK) | |
| provider | text | google_calendar, microsoft_outlook |
| access_token | text | Encrypted |
| refresh_token | text? | Encrypted |
| token_expires_at | timestamp? | |
| provider_email | text? | |
| provider_user_id | text? | |
| provider_user_name | text? | |
| microsoft_tenant_id | text? | |
| microsoft_calendar_id | text? | |
| google_calendar_id | text | |
| last_synced_at | timestamp? | |
| sync_token | text? | For incremental sync |
| is_active | boolean | |
| scopes | text[]? | |
| raw_profile | json? | |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `calendar_sync_log`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| company_id | uuid (FK) | |
| integration_id | uuid (FK) | |
| sync_type | text | |
| sync_direction | text | inbound, outbound, bidirectional |
| events_created | number | |
| events_updated | number | |
| events_deleted | number | |
| errors | json | |
| started_at | timestamp | |
| completed_at | timestamp? | |
| status | text | |
| error_message | text? | |
| created_at | timestamp | |

#### `subscription_plans`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| name | text | |
| slug | text | free, starter, business, teams, enterprise |
| description | text? | |
| price_monthly | number | USD cents |
| price_annual | number | USD cents |
| minutes_included | number | |
| max_call_duration | number | Minutes |
| price_per_extra_minute | number | |
| max_users | number | |
| price_per_extra_user | number? | |
| max_agents | number? | |
| max_concurrent_calls | number | |
| max_calls_per_hour | number? | |
| max_calls_per_day | number? | |
| auto_overage_default | boolean | |
| features | json | Feature flags and limits |
| is_active | boolean | |
| display_order | number | |
| stripe_product_id | text? | |
| stripe_price_id_monthly | text? | |
| stripe_price_id_annual | text? | |
| stripe_metered_price_id | text? | |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `company_subscriptions`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| company_id | uuid (FK) | |
| plan_id | uuid (FK) | |
| billing_cycle | text | monthly, annual |
| status | text | active, canceled, past_due |
| current_period_start | timestamp | |
| current_period_end | timestamp | |
| cancel_at_period_end | boolean | |
| trial_end | timestamp? | |
| extra_users | number | |
| overage_enabled | boolean | |
| overage_budget | number | Max overage spend |
| overage_spent | number | Current period overage |
| last_overage_alert_at | timestamp? | |
| overage_alert_level | number | 0, 70, 90, 100 |
| stripe_subscription_id | text? | |
| stripe_customer_id | text? | |
| stripe_subscription_item_id | text? | |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `usage_tracking`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| company_id | uuid (FK) | |
| subscription_id | uuid? (FK) | |
| period_start | timestamp | |
| period_end | timestamp | |
| minutes_used | number | |
| minutes_included | number | |
| overage_minutes | number | |
| total_cost | number | |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `billing_history`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| company_id | uuid (FK) | |
| subscription_id | uuid? (FK) | |
| amount | number | |
| currency | text | |
| description | text? | |
| status | text | paid, pending, failed |
| invoice_url | text? | |
| stripe_invoice_id | text? | |
| stripe_payment_intent_id | text? | |
| payment_method | text? | |
| failure_reason | text? | |
| billing_date | timestamp | |
| created_at | timestamp | |

#### `billing_events`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| company_id | uuid (FK) | |
| subscription_id | uuid? (FK) | |
| event_type | text | |
| event_data | json | |
| minutes_consumed | number? | |
| cost_usd | number? | |
| created_at | timestamp | |

#### `notifications`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| company_id | uuid (FK) | |
| user_id | uuid? (FK) | |
| type | text | |
| title | text | |
| message | text | |
| read | boolean | |
| metadata | json | |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `stripe_events`
| Column | Type | Notes |
|---|---|---|
| id | text (PK) | Stripe event ID |
| type | text | |
| data | json | |
| processed | boolean | |
| created_at | timestamp | |
| processed_at | timestamp? | |

#### `admin_finances`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| period_start / period_end | timestamp | |
| bland_plan, bland_plan_cost, bland_talk_rate, bland_transfer_rate | Various | Bland AI costs |
| bland_concurrent_limit, bland_hourly_limit, bland_daily_limit | number? | Bland limits |
| openai_cost, openai_tokens_used | number? | OpenAI costs |
| supabase_cost | number? | |
| total_minutes_used, total_calls_made | number? | Platform usage |
| total_companies_active, total_users_active | number? | |
| revenue_subscriptions, revenue_overages, revenue_extras, revenue_total | number? | Revenue |
| cost_bland, cost_openai, cost_supabase, cost_total | number? | Costs |
| gross_margin, gross_margin_percent | number? | Margins |
| avg_revenue_per_company, avg_minutes_per_call | number? | Metrics |
| overage_revenue_percent | number? | |
| notes | text? | |
| created_at, updated_at | timestamp | |

#### AI Conversation Tables
- `ai_conversations`: id, user_id, company_id, title, created_at, updated_at
- `ai_conversation_messages`: id, conversation_id, role, content, created_at

#### CRM Integration Tables
Each follows the same pattern:
- `salesforce_integrations`, `hubspot_integrations`, `pipedrive_integrations`, `clio_integrations`, `zoho_integrations`, `dynamics_integrations`, `simplybook_integrations`, `google_sheets_integrations`
- Common columns: id, company_id, access_token, refresh_token, provider-specific user ID/email, is_active, last_synced_at, created_at, updated_at

---

## 13. API Endpoints

### Authentication
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/auth/check-admin` | Check if user is admin |
| * | `/api/auth/callback` | Supabase OAuth callback |

### AI
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/ai/chat` | AI chat assistant |
| POST | `/api/openai/analyze-call` | AI call analysis |
| POST | `/api/openai/context-suggestions` | Company context suggestions |
| POST | `/api/openai/recommend-agent` | Agent recommendation |

### Billing (13 endpoints)
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/billing/plans` | Fetch plans with multi-currency pricing |
| GET | `/api/billing/subscription` | Get current subscription |
| GET | `/api/billing/history` | Billing history |
| POST | `/api/billing/create-checkout-session` | Initiate Stripe checkout |
| POST | `/api/billing/create-portal-session` | Stripe billing portal |
| POST | `/api/billing/change-plan` | Upgrade/downgrade plan |
| POST | `/api/billing/check-usage-limit` | Validate call permissions |
| POST | `/api/billing/report-usage` | Track call usage |
| POST | `/api/billing/cancellation-feedback` | Store cancellation reason |
| POST | `/api/billing/check-retention` | Check retention offer |
| POST | `/api/billing/ensure-free-plan` | Ensure free plan exists |
| POST | `/api/billing/update-overage` | Update overage settings |
| POST | `/api/billing/verify-session` | Verify Stripe session |

### Bland AI / Calls (7 endpoints)
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/bland/send-call` | Initiate AI call |
| GET | `/api/bland/get-call/[callId]` | Get call details |
| POST | `/api/bland/analyze-call` | Analyze call results |
| POST | `/api/bland/webhook` | Call completion webhook |
| POST | `/api/bland/twilio/connect` | Connect Twilio BYOP |
| POST | `/api/bland/twilio/disconnect` | Disconnect Twilio |
| POST | `/api/bland/twilio/import-numbers` | Import Twilio numbers |

### Calendar (4 endpoints)
| Method | Endpoint | Purpose |
|---|---|---|
| GET/POST | `/api/calendar/events` | List/Create events |
| GET | `/api/calendar/events/personal` | Personal calendar events |
| GET | `/api/calendar/availability` | Check availability |
| GET | `/api/calendar/team` | Team calendar view |

### Company (2 endpoints)
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/company/update` | Update company details |
| POST | `/api/company/scrape` | Scrape company website for context |

### Contacts (8 endpoints)
| Method | Endpoint | Purpose |
|---|---|---|
| GET/POST | `/api/contacts` | List/Create contacts |
| GET/PATCH/DELETE | `/api/contacts/[id]` | Single contact CRUD |
| GET | `/api/contacts/stats` | Contact statistics |
| POST | `/api/contacts/import` | Bulk import contacts |
| POST | `/api/contacts/parse-csv` | Parse CSV for preview |
| POST | `/api/contacts/export` | Export contacts |
| POST | `/api/contacts/ai-analyze` | AI contact analysis |
| POST | `/api/contacts/ai-segment` | AI contact segmentation |

### Integrations (64 endpoints)

**Per CRM (6 each for Salesforce, HubSpot, Pipedrive, Clio, Zoho, Dynamics):**
| Method | Pattern | Purpose |
|---|---|---|
| GET | `/api/integrations/[provider]/connect` | Initiate OAuth |
| GET | `/api/integrations/[provider]/callback` | OAuth callback |
| POST | `/api/integrations/[provider]/sync` | Trigger sync |
| GET | `/api/integrations/[provider]/contacts` | Fetch CRM contacts |
| GET | `/api/integrations/[provider]/users` | Fetch CRM users |
| POST | `/api/integrations/[provider]/disconnect` | Revoke integration |

**Google Calendar (4):** connect, callback, sync, disconnect
**Microsoft Outlook (4):** connect, callback, sync, disconnect
**Google Sheets (7):** connect, callback, sync, disconnect, spreadsheets, sheet-data, link
**Slack (5):** connect, callback, channels, disconnect, webhook
**SimplyBook (7):** connect, sync, disconnect, clients, bookings, providers, webhook
**Zoom (3):** connect, callback, disconnect
**Other:** `/api/integrations/status` (all integration statuses), `/api/integrations/feedback` (feedback)

### Queue
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/queue/process` | Process call queue |

### Settings
| Method | Endpoint | Purpose |
|---|---|---|
| GET/POST | `/api/settings/calendar-config` | Calendar configuration |

### Team (5 endpoints)
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/team/members` | List team members |
| POST | `/api/team/invite` | Invite team member |
| POST | `/api/team/accept-invite` | Accept invitation |
| POST | `/api/team/cancel-invite` | Cancel invitation |
| POST | `/api/team/remove` | Remove team member |

### User
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/user/update-location` | Update geolocation data |

### Voices
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/voices/sample` | Voice sample audio |

### Webhooks
| Method | Endpoint | Purpose |
|---|---|---|
| GET/POST | `/api/webhooks/endpoints` | List/Create webhook endpoints |
| PATCH/DELETE | `/api/webhooks/endpoints/[id]` | Update/Delete endpoint |
| POST | `/api/webhooks/stripe` | Stripe webhook handler |

### Admin
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/finances` | Platform financial data |

### Seed (Development Only)
| Method | Endpoint | Purpose |
|---|---|---|
| POST/DELETE | `/api/seed` | Seed/clear demo data |

---

## 14. Authentication & Security

### Authentication Flow
1. **Supabase Auth** — email/password and OAuth providers
2. **JWT tokens** — stored in secure cookies
3. **Automatic token refresh** — via Supabase client
4. **Email verification** — required before app access
5. **Onboarding** — required before dashboard (creates company, sets up free plan)

### Middleware Enforcement
- Email verification check
- Onboarding completion check
- Company-scoped data access
- Admin route protection

### Row-Level Security (RLS)
- All Supabase tables use RLS policies
- Queries filtered by `company_id`
- Users can only access their own company's data

### Role-Based Access
| Role | Permissions |
|---|---|
| `admin` | Full access, team management, billing |
| `member` | Standard access, no team/billing management |

### Data Protection
- Encrypted integration credentials (OAuth tokens, API keys)
- No price/cost data shown to regular users in frontend
- Bland AI call prices stored but never displayed
- Company-scoped multi-tenancy

### Compliance
- AI disclosure checkbox in campaign creation
- User consent collection
- Privacy policy and Terms of Service links
- Rate limiting on API routes (`/lib/rate-limit.ts`)

---

## 15. Internationalization

### Supported Languages
| Code | Language |
|---|---|
| `en` | English |
| `es` | Spanish |
| `fr` | French |
| `de` | German |
| `it` | Italian |
| `nl` | Dutch |

### Translation Modules
`billing`, `team`, `common`, `dashboard`, `agents`, `campaigns`, `contacts`, `calendar`, `integrations`, `settings`, `reports`

---

## 16. Frontend Architecture

### Component Organization
```
/components/
├── agents/         — Agent selection, config, calendar settings
├── campaigns/      — Campaign overview, detail, creation wizard
├── contacts/       — Contact management, CRM pages, import
├── calls/          — Call history, detail modal
├── calendar/       — Calendar UI, event management
├── integrations/   — Integration management, setup modals
├── settings/       — Settings pages, team management, CRM org imports
├── billing/        — Billing page, plan comparison
├── analytics/      — Analytics dashboard
├── reports/        — Report generation
├── ai/             — AI chat assistant panel
├── voicemails/     — Voicemail management
├── followups/      — Follow-up queue
├── dashboard/      — Dashboard overview
├── notifications/  — Notification UI
└── ui/             — Shared UI components (buttons, modals, forms)
```

### State Management
- **Supabase client** — data persistence and real-time subscriptions
- **React hooks** — local component state
- **URL search params** — filter/tab state
- **Context API** — `AuthContext` for user authentication

### Data Fetching Patterns
- Server-side pagination (contacts: initial 50, lazy-load more)
- Count headers for total record display
- Aggregation queries to avoid 1000-row Supabase cap
- Parallel `Promise.all()` for independent queries
- Conditional lazy loading of CRM data based on plan

### Performance Optimizations
- **LRU Cache** — server-side caching for repeated queries
- **Next.js Image** — optimized image loading
- **Dynamic imports** — code splitting for modals and heavy components
- **Route-based splitting** — automatic via Next.js App Router

---

## 17. Business Logic & Constraints

### Agent/Campaign Limits
- Free: 1 agent, locked after first selection
- Starter: 1 agent, switchable between campaigns
- Business+: Unlimited agents simultaneously

### Call Duration Enforcement
- Max call duration set per plan (3–15 min)
- Configurable per campaign (within plan limits)
- Enforced by Bland AI during call

### Usage Enforcement
- `/api/billing/check-usage-limit` called before each call
- Checks: minutes remaining, active subscription, overage budget
- Blocks calls if no minutes and overage disabled

### Contact Data Flow
1. Import → normalize phone → deduplicate → store with custom fields
2. Assign to contact list → select for campaign
3. Campaign runs → calls made → status updated → analysis stored
4. Follow-ups scheduled → voicemails logged → calendar events created

### Multi-Tenancy
- All data scoped to `company_id`
- RLS enforces isolation at database level
- Users belong to exactly one company
- Admin service role key used only in server-side operations

---

## 18. Promotional Coupons

| Code | Discount | Duration | Max Uses | Target |
|---|---|---|---|---|
| ADMIN100 | 100% off | Forever | — | Internal admin access |
| TESTER_100 | 100% off | 3 months | 10 | QA team (TESTER01-10) |
| LAUNCH50 | 50% off | 3 months | 100 | Launch campaign 2026 |
| EARLY25 | 25% off | 1st month | 500 | Early bird offer |
| ANNUAL20 | 20% off | Forever | — | Annual billing incentive |
| CALLENGO30 | 30% off | 2 months | 250 | General marketing |
| WELCOME15 | 15% off | 1st month | 1000 | New user welcome |
| PARTNER40 | 40% off | 6 months | 50 | Partner/referral program |
| LEGAL20 | 20% off | 12 months | 200 | Law firms (Clio vertical) |

---

## 19. Notification System

### Notification Types
- Email notifications (various events)
- Slack notifications (channel-based, Starter+)
- In-app notifications (notification bell)
- Billing alerts (70%, 90%, 100% of budget)
- Calendar event reminders
- Follow-up due notifications
- Appointment confirmation reminders
- No-show alerts
- Voicemail received notifications

### Notification Settings
- Global toggle (notifications_enabled on user)
- Per-event-type granular control
- Channel preferences (email, Slack, in-app)

---

## 20. Utility Libraries

### `/lib/call-agent-utils.ts`
- Voice configuration mapping
- CSV/Excel parsing
- Auto column mapping (88+ field patterns)
- Phone number normalization
- Contact status/outcome definitions
- Dashboard statistics calculation

### `/lib/supabase/`
- `client.ts` — Browser Supabase client
- `server.ts` — Server-side Supabase client
- `service.ts` — Service role admin client (`supabaseAdmin`, `supabaseAdminRaw`)

### `/lib/stripe/`
- Customer creation/update
- Subscription management
- Checkout/Portal session creation

### `/lib/billing-utils.ts`
- Usage tracking
- Overage calculation
- Plan limit enforcement
- Cost computation

### `/lib/rate-limit.ts`
- API route rate limiting

### `/lib/mock-data.ts`
- Demo data generation for seed endpoint
- Generates: contact lists, contacts, company agents, agent runs, call logs, follow-up queue, voicemail logs, usage tracking, notifications

### `/scripts/stripe-sync.ts`
- Universal Stripe synchronization (v3.0)
- Syncs products, prices (multi-currency), coupons, features
- Idempotent — safe to run multiple times
- Supports sandbox and live environments

### `/scripts/sync-stripe-plans.ts`
- Syncs subscription plans from Supabase to Stripe

---

## 21. Environment & Deployment

### Required Environment Variables
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (server-only) |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_APP_URL` | Application URL |
| `OPENAI_API_KEY` | OpenAI API key |
| `BLAND_API_KEY` | Bland AI API key |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Microsoft OAuth |
| `SALESFORCE_CLIENT_ID` / `SALESFORCE_CLIENT_SECRET` | Salesforce OAuth |
| `HUBSPOT_CLIENT_ID` / `HUBSPOT_CLIENT_SECRET` | HubSpot OAuth |
| `PIPEDRIVE_CLIENT_ID` / `PIPEDRIVE_CLIENT_SECRET` | Pipedrive OAuth |
| `CLIO_CLIENT_ID` / `CLIO_CLIENT_SECRET` | Clio OAuth |
| `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` | Zoho OAuth |
| `ZOOM_ACCOUNT_ID` / `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` | Zoom S2S OAuth |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` | Slack OAuth |

### Build & Deploy
- **Build:** `next build` (TypeScript compilation, Tailwind, ESLint)
- **Deploy:** Vercel-ready
- **Stripe Sync:** `npm run stripe:sync` (sandbox) / `npm run stripe:sync -- --env=live` (production)

---

*End of Callengo Master Document v1.0.0*
