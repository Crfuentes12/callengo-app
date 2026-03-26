# CALLENGO — Complete Platform Master Document

> **Version:** 1.7.0
> **Last Updated:** March 26, 2026 (Guided tour system with driver.js, PageTipCard on 10 pages, campaign creation flow without contact blocking, tour persistence bugfixes)
> **Purpose:** Comprehensive reference for the entire Callengo platform — business strategy, target market, architecture, features, pricing, database schema, API endpoints, integrations, and business logic.

---

## Table of Contents

### Business & Strategy
1. [Platform Overview & Vision](#1-platform-overview--vision)
2. [Problem & Pain Points](#2-problem--pain-points)
3. [Target Market & ICP](#3-target-market--icp)
4. [Use Cases by Agent](#4-use-cases-by-agent)
5. [Business Model & Revenue](#5-business-model--revenue)
6. [Go-to-Market & Positioning](#6-go-to-market--positioning)

### Product & Pricing
7. [Subscription Plans & Pricing](#7-subscription-plans--pricing)
8. [Application Pages & Features](#8-application-pages--features)
9. [AI Agent System](#9-ai-agent-system)
10. [Contact Management](#10-contact-management)
11. [Call System](#11-call-system)
12. [Calendar & Scheduling](#12-calendar--scheduling)
13. [Follow-ups & Voicemails](#13-follow-ups--voicemails)
14. [Integrations](#14-integrations)
15. [Billing & Usage](#15-billing--usage)

### Technical Reference
16. [Technology Stack](#16-technology-stack)
17. [Database Schema](#17-database-schema)
18. [API Endpoints](#18-api-endpoints)
19. [Authentication & Security](#19-authentication--security)
20. [Internationalization](#20-internationalization)
21. [Frontend Architecture](#21-frontend-architecture)
22. [Business Logic & Constraints](#22-business-logic--constraints)
23. [Promotional Coupons](#23-promotional-coupons)
24. [Notification System](#24-notification-system)
25. [Utility Libraries](#25-utility-libraries)
26. [Environment & Deployment](#26-environment--deployment)

### Integrations Deep Dive
27. [Integrations Guide](#27-integrations-guide)

---

## 1. Platform Overview & Vision

Callengo is a B2B SaaS platform that automates outbound phone calls using AI voice agents. It replaces manual, repetitive calling tasks — lead qualification, data verification, and appointment confirmation — with intelligent AI agents that call, converse, analyze, and follow up autonomously.

**Vision:** Become the default AI calling infrastructure for any business that needs to talk to its contacts at scale, starting with three high-pain, high-frequency use cases.

**One-Line Pitch:** "AI agents that call your contacts, qualify your leads, verify your data, and confirm your appointments — so your team never has to."

**Core Capabilities:**
- Create AI calling agents from templates (Lead Qualification, Data Validation, Appointment Confirmation)
- Import contacts from CSV, Excel, Google Sheets, JSON, or CRM integrations
- Run automated calling campaigns with voicemail detection, follow-ups, and smart scheduling
- Track results with call analytics, transcriptions, recordings, and sentiment analysis
- Integrate with CRMs (Salesforce, HubSpot, Pipedrive, Zoho, Clio, Dynamics 365), calendars (Google, Outlook), video conferencing (Zoom, Meet, Teams), and communication tools (Slack, webhooks)

---

## 2. Problem & Pain Points

### The Core Problem
Businesses waste enormous amounts of time and money on repetitive, low-skill outbound calls. These calls are necessary but draining — and when they don't happen, the consequences are expensive: dirty CRM data, unqualified leads clogging sales pipelines, and no-show appointments that cost real revenue.

### Three Pain Pillars

#### Pain 1: "My database is garbage"
**Who feels it:** Operations managers, CRM administrators, sales ops teams
**What happens:**
- Emails bounce because contacts changed jobs
- Phone numbers are wrong or disconnected
- Leads are duplicated across systems
- CRM is inflated with outdated, unverified data
- Marketing campaigns underperform because they target bad data

**Cost of inaction:** Wasted ad spend, failed campaigns, poor deliverability, compliance risk (calling wrong people).

**Callengo solution:** The **Data Validation Agent** calls contacts to verify and update their information — email, phone, address, job title — and writes the clean data back to your CRM.

#### Pain 2: "No-shows are killing my revenue"
**Who feels it:** Clinic administrators, practice managers, salon owners, service-based business operators
**What happens:**
- Patients/clients don't show up for scheduled appointments
- Staff sits idle, rooms are empty, revenue is lost
- Manual confirmation calls consume hours of receptionist time
- Some businesses lose 15-30% of appointments to no-shows

**Cost of inaction:** Direct revenue loss ($150-500+ per missed medical appointment), wasted staff time, scheduling inefficiency.

**Callengo solution:** The **Appointment Confirmation Agent** calls every contact 24-48h before their appointment. Confirms attendance, handles rescheduling requests, detects no-shows and auto-retries, and syncs results to your calendar.

#### Pain 3: "My sales team wastes time on junk leads"
**Who feels it:** Sales directors, SDR managers, founders doing their own sales
**What happens:**
- SDRs spend 60%+ of their time on calls that go nowhere
- Unqualified leads clog the pipeline and distort forecasts
- High-value reps waste energy on people who can't buy
- Manual qualification is slow, inconsistent, and hard to scale

**Cost of inaction:** Burned-out SDRs, low conversion rates, missed quota, high sales team turnover.

**Callengo solution:** The **Lead Qualification Agent** calls leads, runs BANT qualification (Budget, Authority, Need, Timeline), scores them, and schedules meetings with sales reps for qualified prospects — only human-ready leads reach your team.

---

## 3. Target Market & ICP

### Primary Target Segments

#### 1. Healthcare & Medical Practices
- **Pain:** No-shows (15-30% rates), manual confirmation calls
- **Agent:** Appointment Confirmation
- **Examples:** Dental clinics, medical practices, specialist offices, wellness centers, vision/eye care, dermatology, pediatrics, cardiology
- **Why they buy:** Direct ROI — every confirmed appointment = revenue retained
- **Plan fit:** Starter ($99/mo) for solo practices, Business ($299/mo) for multi-location

#### 2. Real Estate Agencies
- **Pain:** Outdated contact databases, unverified property leads
- **Agent:** Data Validation + Lead Qualification
- **Examples:** Brokerages, property management firms, real estate groups
- **Why they buy:** Clean data = better listings, qualified leads = faster closings
- **Plan fit:** Business ($299/mo) for CRM integration (HubSpot, Pipedrive)

#### 3. SaaS & Technology Companies
- **Pain:** SDR burnout, unqualified demo requests, bloated pipelines
- **Agent:** Lead Qualification
- **Examples:** B2B SaaS, tech startups, cloud services, digital platforms
- **Why they buy:** Automate top-of-funnel qualification, free SDRs for closing
- **Plan fit:** Teams ($649/mo) for Salesforce integration and multi-user access

#### 4. Financial Services
- **Pain:** Compliance data verification, lead qualification, appointment setting
- **Agent:** All three
- **Examples:** Insurance agencies, wealth management, accounting firms, banks, credit unions, mortgage brokers
- **Why they buy:** Regulatory compliance requires verified data; high-value client relationships need qualification
- **Plan fit:** Business to Teams

#### 5. Legal Firms
- **Pain:** Client data accuracy, consultation confirmation, lead intake
- **Agent:** Data Validation + Appointment Confirmation
- **Examples:** Law firms, legal practices (personal injury, family, corporate)
- **Why they buy:** Clio integration, matter-linked scheduling, client verification
- **Plan fit:** Business ($299/mo) with Clio integration

#### 6. E-commerce & Retail (Emerging)
- **Pain:** Cart abandonment, customer reactivation, feedback collection
- **Agent:** Future agents (abandoned cart, winback, feedback — in development for Q1 2026)
- **Plan fit:** Starter to Business

### Ideal Customer Profile (ICP)

| Attribute | Ideal Profile |
|---|---|
| **Company size** | 5-500 employees |
| **Revenue** | $500K - $50M ARR |
| **Contact database** | 500 - 50,000 contacts |
| **Monthly call volume** | 300 - 6,000+ calls |
| **Current process** | Manual calling, no automation, or basic auto-dialers |
| **CRM usage** | Uses HubSpot, Salesforce, Pipedrive, Zoho, or Clio |
| **Decision maker** | VP Sales, Operations Manager, Practice Manager, CRM Admin |
| **Budget** | $99 - $1,499/month |
| **Key trigger** | Scaling pains — too many calls for current staff, data quality complaints, no-show rates climbing |

### Who is NOT the target
- Individual consumers (B2C cold calling)
- Very large enterprises with custom telephony infrastructure (they build in-house)
- Businesses without existing contact databases
- Companies with <100 contacts (not enough volume to justify)

---

## 4. Use Cases by Agent

### Lead Qualification Agent
**Category:** Sales
**Tagline:** "Qualify leads before sales touches them — stop wasting your team's time"

**How it works:**
1. Upload lead list (CSV, CRM sync, Google Sheets)
2. Agent calls each lead using BANT framework
3. Asks about Budget, Authority, Need, Timeline
4. Scores lead as hot/warm/cold
5. If qualified + interested → schedules meeting with sales rep (Google Meet, Zoom, Teams)
6. Writes qualification data back to CRM
7. Unqualified leads are flagged — sales never wastes time on them

**Qualification Data Captured:**
- Budget range and timeline
- Decision-making authority level
- Specific needs and product interest
- Lead temperature (hot/warm/cold)
- Meeting scheduled (yes/no, date, video link)

**ROI Example:** A 10-person SDR team spending 60% time on unqualified calls saves ~2,400 hours/year. At $25/hr loaded cost = $60,000/year saved. Callengo Teams plan = $7,788/year.

### Data Validation Agent
**Category:** Verification
**Tagline:** "Clean my database — stop wasting money on bad data"

**How it works:**
1. Import contact database with existing data
2. Agent calls each contact to verify: email, phone, address, job title, company info
3. Updates records with verified data
4. Flags disconnected numbers, wrong contacts, outdated info
5. Syncs clean data back to CRM
6. Schedules callbacks for contacts who weren't available

**Verified Fields:**
- Email address (current/changed)
- Phone number (correct/disconnected/changed)
- Mailing address (current/moved)
- Job title and department
- Company name confirmation
- Decision maker identification

**ROI Example:** A database of 10,000 contacts with 20% outdated data = 2,000 bad records. Manual verification at 5 min/call = 166 hours. At $20/hr = $3,333. Callengo Business plan verifies all 10,000 in days for $299/mo.

### Appointment Confirmation Agent
**Category:** Appointment
**Tagline:** "Stop losing money from no-shows — every missed appointment is money lost"

**How it works:**
1. Connect calendar (Google Calendar, Outlook)
2. Agent identifies upcoming appointments
3. Calls contacts 24-48h before appointment
4. Confirms attendance, handles rescheduling, answers logistics questions
5. If no answer → auto-retry with follow-up system
6. Updates calendar with confirmed/rescheduled/cancelled status
7. Sends video meeting links if switching to virtual

**Confirmation Outcomes:**
- Confirmed — attendance verified
- Rescheduled — new time set with reason recorded
- Cancelled — freed slot, reason captured
- No-show flagged — auto-retry scheduled
- Callback requested — specific time noted

**ROI Example:** A dental clinic with 40 appointments/day at 20% no-show rate loses 8 appointments/day. At $200 avg revenue per visit = $1,600/day lost = $33,600/month. Reducing no-shows to 5% recovers $25,200/month. Callengo Starter plan = $99/mo.

---

## 5. Business Model & Revenue

### Revenue Streams

| Stream | Description | % of Revenue (Target) |
|---|---|---|
| **Subscription Revenue** | Monthly/annual plan fees | 65-70% |
| **Overage Revenue** | Per-minute charges above included minutes | 20-25% |
| **Add-on Revenue** | Dedicated Number ($15), Recording Vault ($12), Calls Booster ($35) | 5-8% |
| **Extra Seat Revenue** | $49/seat on Business and Teams plans | 3-5% |
| **Enterprise Custom** | Custom contracts above standard tiers | 2-5% |

### Unit Economics Model (Bland AI Scale Plan: $0.11/min)

| Plan | Revenue | Bland Cost | Gross Profit | Margin |
|---|---|---|---|---|
| **Starter** | $99 | $33 (300 min × $0.11) | $66 | 66.7% |
| **Growth** | $179 | $66 (600 min × $0.11) | $113 | 63.1% |
| **Business** | $299 | $132 (1,200 min × $0.11) | $167 | 55.9% |
| **Teams** | $649 | $247.50 (2,250 min × $0.11) | $401.50 | 61.9% |
| **Enterprise** | $1,499 | $660 (6,000 min × $0.11) | $839 | 56.0% |

Overage rates ($0.29 → $0.17/min ladder) all remain above the $0.11/min Bland cost floor.

### Expansion Revenue Strategy
1. **Vertical expansion:** User starts with one agent, discovers value, activates other agents
2. **Volume expansion:** Growing contact lists push users into overage → upgrade to next tier
3. **Add-on expansion:** Users add Dedicated Number, Recording Vault, or Calls Booster as needed
4. **Seat expansion:** Business and Teams plan users add team members at $49/seat
5. **Integration expansion:** Users connect CRMs → become stickier → lower churn
6. **Annual lock-in:** 12% discount for annual billing (2 months free) → improved cash flow + retention

### Customer Journey
```
Free Trial (15 min) → Starter ($99/mo) → Growth ($179/mo) → Business ($299/mo) → Teams ($649/mo) → Enterprise ($1,499/mo)
     │                      │                   │                   │                    │
     │                      │                   │                   │                    └─ Multi-team, Salesforce/Dynamics, unlimited
     │                      │                   │                   └─ CRM integrations, 5 concurrent, 3 users
     │                      │                   └─ 3 concurrent, smart follow-ups, no-show retry
     │                      └─ Voicemail, follow-ups, Slack/Zoom, 2 concurrent
     └─ Test with 15 minutes, 1 agent
```

---

## 6. Go-to-Market & Positioning

### Positioning Statement
"For sales teams, operations managers, and practice administrators who waste hours on repetitive outbound calls, Callengo is the AI calling platform that automates lead qualification, data verification, and appointment confirmation — so your team focuses only on high-value work."

### Competitive Differentiation
| Dimension | Callengo | Generic Auto-dialers | Manual BPOs |
|---|---|---|---|
| Intelligence | AI conversation + analysis | Recorded messages | Human agents |
| Setup time | Minutes (template agents) | Hours/days | Weeks |
| Cost per call | $0.17-0.29/min overage | $0.05-0.15/min (no intelligence) | $2-5/min |
| Scalability | Unlimited concurrent (Enterprise) | Depends on lines | Depends on headcount |
| Data capture | Auto-structured + CRM sync | None | Manual entry |
| Follow-up | Automated scheduling | None | Manual |
| Availability | 24/7 | 24/7 | Business hours only |

### Key Differentiators
1. **Template-first approach:** Three proven, battle-tested agent templates vs. "build from scratch" competitors
2. **Full-loop automation:** Not just the call — includes follow-ups, voicemail handling, calendar scheduling, CRM sync
3. **Deep CRM integration:** Native integrations with 6 major CRMs (not just Zapier/webhook)
4. **Vertical expertise:** Clio for legal, SimplyBook.me for services — not just generic
5. **Try-before-you-buy:** 15 free minutes with full platform access, not a gated demo

### Onboarding Flow (Pain-First)
1. Signup → Company details + website scraping for context
2. **"What challenge would you like to solve first?"**
   - "Clean my database" → Data Validation Agent
   - "Stop losing money from no-shows" → Appointment Confirmation Agent
   - "Qualify leads before sales touches them" → Lead Qualification Agent
3. Agent test call → user experiences the AI firsthand
4. Dashboard → ready to create first campaign

### Promotional Strategy
- **LAUNCH50:** 50% off for 3 months (launch campaign, 100 uses)
- **EARLY25:** 25% off first month (early bird, 500 uses)
- **WELCOME15:** 15% off first month (new user, 1,000 uses)
- **LEGAL20:** 20% off for 12 months (law firms via Clio vertical, 200 uses)
- **PARTNER40:** 40% off for 6 months (referral/partner program, 50 uses)
- **ANNUAL20:** 20% off forever (annual billing incentive)

### Future Product Roadmap (Agents in Development)
- **Abandoned Cart Agent** — E-commerce recovery calls
- **Win-back Agent** — Re-engage churned customers
- **Feedback Collection Agent** — Post-service satisfaction calls
- Target release: Q1 2026

---

## 7. Subscription Plans & Pricing

### Plan Tiers (V4 — March 2026)

#### FREE (Trial)
- **Price:** $0
- **Calls:** ~10 calls (15 minutes one-time, not monthly, no renewal)
- **Max Call Duration:** 3 min per call
- **Concurrent Calls:** 1
- **Active Agents:** 1 (locked after selection — cannot switch)
- **Users:** 1
- **Overage:** Blocked — must upgrade after trial exhausted
- **Integrations:** Google Calendar, Google Meet, Google Sheets, Zoom
- **Features:** Full campaign wizard, CSV/Excel/JSON import, phone normalization, contact deduplication, custom fields, tags, AI agent creation, call analytics, transcription downloads, usage dashboard, billing alerts, auto-rotated phone numbers from Callengo pool
- **Target:** Anyone testing the platform before committing

#### STARTER — $99/month ($87/mo annual)
- **Calls:** ~200 calls/month (300 minutes)
- **Max Call Duration:** 3 min per call
- **Concurrent Calls:** 2
- **Active Agents:** 1 (switchable between campaigns)
- **Users:** 1
- **Overage:** $0.29/min
- **Annual Price:** $87/mo ($1,044/year — 12% savings)
- **Add-ons Available:** Dedicated Number ($15), Recording Vault ($12), Calls Booster ($35)
- **Integrations:** Everything in Free + Slack notifications, SimplyBook.me, Webhooks (Zapier/Make/n8n)
- **Features:** Voicemail detection, follow-ups (max 2 attempts), rescheduling, data export, async email support, auto-rotated phone numbers
- **Target:** Solo founders, freelancers, small clinics, individual agents

#### GROWTH — $179/month ($159/mo annual)
- **Calls:** ~400 calls/month (600 minutes)
- **Max Call Duration:** 4 min per call
- **Concurrent Calls:** 3
- **Active Agents:** All (simultaneous)
- **Users:** 1
- **Overage:** $0.26/min
- **Annual Price:** $159/mo ($1,908/year — 12% savings)
- **Add-ons Available:** Dedicated Number ($15), Recording Vault ($12), Calls Booster ($35)
- **Integrations:** Everything in Starter
- **Features:** Voicemail smart handling, smart follow-ups (max 5 attempts), no-show auto-retry, priority email support
- **Target:** Growing solo operators and small teams needing more volume and smart automation

#### BUSINESS — $299/month ($269/mo annual)
- **Calls:** ~800 calls/month (1,200 minutes)
- **Max Call Duration:** 5 min per call
- **Concurrent Calls:** 5
- **Active Agents:** All (simultaneous)
- **Users:** 3 (+$49/extra seat)
- **Overage:** $0.23/min
- **Annual Price:** $269/mo ($3,228/year — 12% savings)
- **Add-ons Available:** Dedicated Number ($15), Recording Vault ($12), Calls Booster ($35)
- **Integrations:** Everything in Growth + Microsoft Outlook, Microsoft Teams, HubSpot, Pipedrive, Zoho, Clio (legal)
- **Features:** Smart follow-ups (max 5 attempts), voicemail smart handling, no-show auto-retry, priority email support
- **Target:** Growing businesses, multi-agent operations, CRM-integrated teams

#### TEAMS — $649/month ($579/mo annual)
- **Calls:** ~1,500 calls/month (2,250 minutes)
- **Max Call Duration:** 6 min per call
- **Concurrent Calls:** 10
- **Active Agents:** All (simultaneous)
- **Users:** 5 (+$49/extra seat)
- **Overage:** $0.20/min
- **Annual Price:** $579/mo ($6,948/year — 12% savings)
- **Add-ons Available:** Dedicated Number ($15), Recording Vault ($12), Calls Booster ($35)
- **Integrations:** Everything in Business + Salesforce, Microsoft Dynamics 365
- **Features:** User permissions (admin/member roles), advanced follow-ups (max 10 attempts), priority support
- **Target:** Sales teams, multi-department operations, enterprise CRM users

#### ENTERPRISE — $1,499/month ($1,349/mo annual)
- **Calls:** ~4,000+ calls/month (6,000 minutes)
- **Max Call Duration:** Unlimited
- **Concurrent Calls:** Unlimited
- **Active Agents:** All (simultaneous)
- **Users:** Unlimited
- **Overage:** $0.17/min
- **Annual Price:** $1,349/mo ($16,188/year — 12% savings)
- **Add-ons Available:** All included
- **Integrations:** All current + future integrations
- **Features:** Unlimited follow-up attempts, SLA guarantee, dedicated account manager, annual contract required
- **Target:** Large organizations with high-volume calling needs

### Pricing by Currency
| Currency | Multiplier | Example (Starter) |
|---|---|---|
| USD | 1.00x | $99/mo |
| EUR | 0.92x | ~€91/mo |
| GBP | 0.79x | ~£78/mo |

### Annual vs. Monthly Comparison

| Plan | Monthly | Annual (per mo) | Annual Total | Savings |
|---|---|---|---|---|
| Free | $0 | — | — | — |
| Starter | $99 | $87 | $1,044 | $144 (12%) |
| Growth | $179 | $159 | $1,908 | $240 (12%) |
| Business | $299 | $269 | $3,228 | $360 (12%) |
| Teams | $649 | $579 | $6,948 | $840 (12%) |
| Enterprise | $1,499 | $1,349 | $16,188 | $1,800 (12%) |

### Add-ons (Starter and above)

| Add-on | Price/mo | Description |
|---|---|---|
| **Dedicated Number** | $15 | Own dedicated outbound phone number via Bland AI |
| **Recording Vault** | $12 | Extends call recording retention from 30 days → 12 months |
| **Calls Booster** | $35 | +150 calls (~+225 min) per month. Stackable. |

### Feature Access Matrix

| Feature | Free | Starter | Growth | Business | Teams | Enterprise |
|---|---|---|---|---|---|---|
| Price (monthly) | $0 | $99 | $179 | $299 | $649 | $1,499 |
| Calls/month (approx) | ~10 (trial) | ~200 | ~400 | ~800 | ~1,500 | ~4,000+ |
| Minutes Included | 15 (one-time) | 300/mo | 600/mo | 1,200/mo | 2,250/mo | 6,000+/mo |
| Max Call Duration | 3 min | 3 min | 4 min | 5 min | 6 min | Unlimited |
| Concurrent Calls | 1 | 2 | 3 | 5 | 10 | Unlimited |
| Max Active Agents | 1 (locked) | 1 (switchable) | All | All | All | All |
| Max Users | 1 | 1 | 1 | 3 (+$49/ea) | 5 (+$49/ea) | Unlimited |
| Overage Rate | Blocked | $0.29/min | $0.26/min | $0.23/min | $0.20/min | $0.17/min |
| Voicemail Detection | No | Yes | Yes (smart) | Yes (smart) | Yes (smart) | Yes (smart) |
| Follow-ups | No | 2 attempts | 5 attempts | 5 attempts | 10 attempts | Unlimited |
| Smart Follow-up | No | No | Yes | Yes | Yes | Yes |
| No-Show Auto Retry | No | No | Yes | Yes | Yes | Yes |
| Google Calendar | Yes | Yes | Yes | Yes | Yes | Yes |
| Microsoft Outlook | No | No | No | Yes | Yes | Yes |
| Google Meet | Yes | Yes | Yes | Yes | Yes | Yes |
| Zoom | Yes | Yes | Yes | Yes | Yes | Yes |
| Microsoft Teams | No | No | No | Yes | Yes | Yes |
| Slack | No | Yes | Yes | Yes | Yes | Yes |
| SimplyBook.me | No | Yes | Yes | Yes | Yes | Yes |
| Webhooks | No | Yes | Yes | Yes | Yes | Yes |
| HubSpot | No | No | No | Yes | Yes | Yes |
| Pipedrive | No | No | No | Yes | Yes | Yes |
| Zoho | No | No | No | Yes | Yes | Yes |
| Clio | No | No | No | Yes | Yes | Yes |
| Salesforce | No | No | No | No | Yes | Yes |
| Dynamics 365 | No | No | No | No | Yes | Yes |
| Rescheduling | No | Yes | Yes | Yes | Yes | Yes |
| Data Export | No | Yes | Yes | Yes | Yes | Yes |
| User Permissions | No | No | No | No | Yes | Yes |
| Extra Seats | No | No | No | $49/seat | $49/seat | Included |
| Dedicated Number add-on | No | Yes | Yes | Yes | Yes | Yes |
| Recording Vault add-on | No | Yes | Yes | Yes | Yes | Yes |
| Calls Booster add-on | No | Yes | Yes | Yes | Yes | Yes |

---

## 8. Application Pages & Features

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
- Campaign creation wizard (AgentConfigModal):
  1. Agent selection & preview — configurable and testable even with 0 contacts (shows amber nudge if no contacts)
  2. Contact list selection — shows empty state with "Go to Contacts" / "Connect CRM" CTAs if 0 contacts
  3. Voice configuration
  4. Calendar/scheduling settings
  5. Follow-up configuration
  6. Voicemail settings
  7. Compliance confirmations (AI disclosure checkbox)
- **Contact gating:** Campaign creation is no longer blocked at launch — step 1 is always accessible. Contact requirement is enforced at step 2 with actionable empty states rather than an upfront blocker.

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

## 9. AI Agent System

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

## 10. Contact Management

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
> Note: Stored as Title Case strings in the database and TypeScript types.

| Status | Description |
|---|---|
| `Pending` | Not yet called |
| `Calling` | Call in progress |
| `Fully Verified` | Successfully verified |
| `Research Needed` | Requires follow-up investigation |
| `No Answer` | No one answered |
| `For Callback` | Scheduled for callback |
| `Wrong Number` | Wrong phone number |
| `Number Disconnected` | Number is disconnected |
| `Withheld & Hung Up` | Contact withheld info or hung up |
| `Voicemail Left` | Voicemail was left |

### Call Outcomes
> Note: Stored as Title Case strings in the database and TypeScript types.

| Outcome | Description |
|---|---|
| `Not Called` | Default — never called |
| `Owner Gave Email` | Contact provided email |
| `Staff Gave Email` | Staff member provided email |
| `Incomplete Data Shared` | Partial information obtained |
| `Refused` | Contact refused |
| `Left Voicemail` | Voicemail message left |
| `Follow-up Scheduled` | Follow-up has been scheduled |
| `Wrong Number` | Wrong number confirmed |
| `Disconnected` | Number disconnected |

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

## 11. Call System

### Call Provider
Bland AI is the underlying call engine. Calls are initiated via the Bland AI API and results are received via webhook.

### Bland AI Architecture — Single Master Key

All calls go through **one master Bland API key**. There are no sub-accounts. Company isolation is handled entirely in Supabase via `company_id` on every record. Bland sees a single flat pool of calls — correlation is done via metadata UUIDs.

**Key Principle: Stripe and Bland are completely independent systems.**
- **Stripe** only handles customer payments. It never interacts with Bland.
- **Bland** master account is funded by the platform owner (auto-recharge or manual top-up).
- The platform owner selects their Bland plan in the Command Center admin dropdown, and all limits auto-configure.

**Bland AI Plan Tiers (configurable in Command Center):**

| Plan | Cost/min | Concurrent | Daily Cap | Hourly Cap | Voice Clones |
|------|----------|-----------|-----------|-----------|-------------|
| Start | $0.14 | 10 | 100 | 100 | 1 |
| Build | $0.12 | 50 | 2,000 | 1,000 | 5 |
| Scale | $0.11 | 100 | 5,000 | 1,000 | 15 |
| Enterprise | $0.09 | ∞ | ∞ | ∞ | 999 |

**Concurrency Management (Redis / Upstash):**
- Global counters: concurrent (TTL 30min), daily (TTL 24h), hourly (TTL 2h)
- Per-company counters: concurrent, daily, hourly
- Active call slots: `callengo:active_call:{callId}` with 30min TTL auto-expiry
- Contact cooldown: 5min between calls to same contact
- Bland plan limits cached in Redis with 1h TTL
- Safety margin: 90% of Bland limits enforced to prevent overruns
- Implementation: `src/lib/redis/concurrency-manager.ts`

**Call Dispatch Flow:**
1. Campaign dispatched → `checkCallAllowed()` validates Callengo per-plan limits + Bland global limits
2. Pre-register call_log entry (TOCTOU race prevention)
3. `acquireCallSlot()` atomically reserves Redis slot
4. Call sent via master API key with `company_id` in metadata
5. On failure: pre-log cleaned up (wrapped in try-catch, non-fatal)
6. Webhook receives result → slot released → usage tracked

**Implementation:** `src/lib/bland/master-client.ts` — plan limits (`BLAND_PLAN_LIMITS`), account info, dispatch, plan detection.

### Call Flow
1. Campaign started → contacts dispatched via `/api/campaigns/dispatch`
2. Per-contact: pre-register call_log → check throttle → acquire Redis slot
3. Call sent to Bland AI via master API key (metadata includes company_id, contact_id)
4. Bland AI executes call with configured voice, prompt, and settings
5. Webhook received at `/api/bland/webhook` on call completion
6. Call log updated (upsert by call_id), contact status updated, Redis slot released
7. CRM outbound sync (Salesforce, HubSpot, Pipedrive, Clio) if integration active
8. Follow-ups scheduled if applicable
9. Usage tracked for Stripe metered billing (`usage_tracking` table)

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

## 12. Calendar & Scheduling

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
| Zoom | Free+ (always active) | Server-to-Server OAuth (env-based) |
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

## 13. Follow-ups & Voicemails

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

## 14. Integrations

### Integration Summary

| Integration | Type | Auth Method | Plan Required |
|---|---|---|---|
| Google Calendar | Calendar | OAuth 2.0 | Free+ |
| Microsoft Outlook | Calendar | OAuth 2.0 (Graph) | Business+ |
| Google Meet | Video | Via Google Calendar | Free+ |
| Zoom | Video | Server-to-Server OAuth | Free+ (always active) |
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

## 15. Billing & Usage

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
- **Stripe does NOT interact with Bland AI** — it only handles customer payments

### Stripe ↔ Bland Separation (Critical Architecture)

Stripe and Bland AI operate as **completely independent financial systems**:

| System | Role | Funded By |
|---|---|---|
| **Stripe** | Collects payments from Callengo customers | Customer credit cards |
| **Bland AI** | Provides calling infrastructure and per-minute billing | Platform owner loads credits manually |

**How they connect (indirectly):**
1. Customer pays via Stripe → Stripe webhook fires
2. Webhook updates subscription in Supabase (plan, period, status)
3. Usage tracking reset for new period with fresh minute allocation
4. Platform owner funds Bland master account independently (auto-recharge or manual)
5. Bland deducts credits per-minute during calls — no money flows between Stripe and Bland

**Webhook-Triggered Operations:**

| Stripe Event | Action |
|---|---|
| `checkout.session.completed` | Create subscription + usage tracking |
| `invoice.payment_succeeded` | Update period, reset usage counters |
| `customer.subscription.updated` | Update plan, adjust limits |
| `customer.subscription.deleted` | Mark canceled, clear overage |

**Admin Monitoring (Command Center):**
The Command Center (`/admin/command-center`) provides real-time monitoring with 7 tabs:
- **Health:** KPIs, Bland plan dropdown selector, Redis concurrency gauges, call charts
- **Operations:** MRR/ARR, churn rate, trial conversion, burn rate, unit economics, failed calls analysis
- **Clients:** Per-company usage, profit, cost breakdown
- **Billing Events:** Paginated event log
- **Reconciliation:** Minutes actual vs tracked discrepancy detection
- **Finances:** P&L with Bland master account info, OpenAI usage panel (cost by feature, daily trend, model breakdown)
- **AI Costs:** 30d OpenAI totals (cost, requests, tokens, avg cost/request), feature breakdown, daily cost chart, model breakdown, recent 50 API call logs

---

## 16. Technology Stack

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
| OpenAI | 6.15.0 | Post-call analysis, Cali AI assistant, contact intelligence, onboarding suggestions (8 feature areas, per-feature API keys) |
| Bland AI | (API) | AI voice calling engine |
| Google APIs | 144.0.0 | Calendar, Sheets, Meet |
| Axios | 1.13.2 | HTTP client |
| LRU-Cache | 11.2.6 | Performance caching |
| Recharts | 3.8.0 | Data visualization / charts |
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
| OpenAI | AI chat assistant (Cali AI), post-call analysis, contact intelligence, onboarding suggestions; per-feature API keys; usage tracked in `openai_usage_logs` |
| Vercel | Hosting & deployment |

---

## 17. Database Schema

### Tables (57 total, including integration-specific tables)

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
| deleted_at | timestamp? | Soft-delete (RLS excludes when set, 30-day recovery) |
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
| bland_subaccount_id | text? | Set to `'master'` for admin company (legacy field, no sub-accounts) |
| bland_api_key | text? | Bland API key (master key for admin, legacy for others) |
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
| extra_seat_price | number? | Per-seat overage ($49 for Business and Teams) |
| max_follow_up_attempts | number | -1 = unlimited |
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
| event_type | text | See event types below |
| event_data | json | |
| minutes_consumed | number? | |
| cost_usd | number? | For Bland events: dollar equivalent of credits (not actual financial transaction) |
| created_at | timestamp | |

**Event Types:**
- `payment_succeeded`, `payment_failed` — Stripe payment events
- `subscription_updated`, `subscription_canceled`, `trial_ending` — Subscription lifecycle
- `bland_credits_allocated` — Credits tracking event (legacy, master key architecture)
- `bland_credits_reclaimed` — Credits tracking event (legacy)
- `bland_subaccount_deactivated` — Legacy event type (no sub-accounts in current architecture)
- `overage_alert`, `overage_budget_exceeded`, `overage_enabled`, `overage_disabled` — Overage events

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

#### AI Tables
- `ai_conversations`: id, user_id, company_id, title, created_at, updated_at — Cali AI assistant conversation sessions (user-scoped RLS)
- `ai_messages`: id, conversation_id, role, content, created_at — Individual messages within Cali AI conversations
- `openai_usage_logs`: Tracks every OpenAI API call across all features. Columns: id, company_id, user_id, feature_key, api_key_label, model, input_tokens, output_tokens, total_tokens, cost_usd, openai_request_id, metadata, created_at. RLS: admin/owner read-only, service role insert. Feature keys: call_analysis, contact_analysis, cali_ai, onboarding, demo_analysis.

#### CRM Integration Tables
Each CRM has an integration table + sync log table + contact mapping table:

**Integration tables** (8 total):
`salesforce_integrations`, `hubspot_integrations`, `pipedrive_integrations`, `clio_integrations`, `zoho_integrations`, `dynamics_integrations`, `simplybook_integrations`, `google_sheets_integrations`
- Common columns: id, company_id, access_token, refresh_token, provider-specific user ID/email, is_active, last_synced_at, created_at, updated_at

**Sync log tables** (6 total):
`clio_sync_logs`, `hubspot_sync_logs`, `pipedrive_sync_logs`, `simplybook_sync_logs`, `zoho_sync_logs`, `dynamics_sync_logs`
- Tracks sync operations: direction, records created/updated/deleted, errors, duration

**Contact mapping tables** (6 total):
`clio_contact_mappings`, `hubspot_contact_mappings`, `pipedrive_contact_mappings`, `simplybook_contact_mappings`, `zoho_contact_mappings`, `dynamics_contact_mappings`
- Maps provider contact IDs to Callengo contact IDs for bidirectional sync

#### Google Sheets Tables
- `google_sheets_integrations`: OAuth connection data
- `google_sheets_linked_sheets`: Linked spreadsheet references (spreadsheet_id, sheet_name)

#### Webhook Tables
- `webhook_endpoints`: Endpoint URLs, secrets, event subscriptions, failure tracking
- `webhook_deliveries`: Delivery log with payload, HTTP status, response, duration

#### Team Tables
- `team_invitations`: Pending team member invitations (email, role, invited_by, status, token)

#### SimplyBook Webhook Logs
- `simplybook_webhook_logs`: Incoming webhook event history from SimplyBook.me

---

## 18. API Endpoints

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

### Bland AI Master Client (`src/lib/bland/master-client.ts`)
| Function | Purpose |
|---|---|
| `getBlandAccountInfo()` | Fetches plan, balance, limits from Bland `/v1/me` or `/v1/org` |
| `getBlandPlanLimits(plan)` | Returns limits for a given plan slug |
| `dispatchCall(config)` | Sends call via master API key |
| `inferPlanFromOrgData(data)` | Infers plan from Bland API response fields |
| `BLAND_PLAN_LIMITS` | Exported config with all 4 plan tiers (Start/Build/Scale/Enterprise) |

### Admin Command Center API
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/command-center` | Health metrics, concurrency, MRR, burn rate, failed calls |
| POST | `/api/admin/command-center` | Save selected Bland plan → cache limits in Redis |
| GET | `/api/admin/clients` | Per-company usage, profit, cost breakdown |
| GET | `/api/admin/finances` | P&L with Bland master account info |
| GET | `/api/admin/billing-events` | Paginated billing event log |
| GET | `/api/admin/reconcile` | Minutes actual vs tracked comparison |
| DELETE | `/api/admin/cleanup-orphans` | Archive orphaned companies |

### Bland AI / Calls (4 endpoints)
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/bland/send-call` | Initiate AI call |
| GET | `/api/bland/get-call/[callId]` | Get call details |
| POST | `/api/bland/analyze-call` | Analyze call results |
| POST | `/api/bland/webhook` | Call completion webhook |

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

## 19. Authentication & Security

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
| `owner` | Full access, team management, billing, subscription changes, Command Center |
| `admin` | Full access, team management, billing, Command Center |
| `member` | Standard access, no team/billing/subscription management |

### Data Protection
- **Token encryption at rest:** All OAuth tokens and API keys encrypted with AES-256-GCM via `src/lib/encryption.ts`. Uses `TOKEN_ENCRYPTION_KEY` env var (64 hex chars = 32-byte key). Backward-compatible: `decryptToken()` handles both encrypted and legacy plaintext data.
- **Integrations covered:** HubSpot, Salesforce, Pipedrive, Zoho, Clio, Dynamics 365, Google Calendar, Microsoft Outlook, Google Sheets, SimplyBook, Slack (11 providers, 22 files modified)
- No price/cost data shown to regular users in frontend
- Bland AI call prices stored but never displayed
- Company-scoped multi-tenancy
- **Soft-delete for companies:** `deleted_at` column with partial index and RLS exclusion. 30-day recovery window before permanent deletion.

### Database Hardening (March 2026 Audit)
- **RLS self-update restriction:** Trigger `trg_prevent_sensitive_field_changes` blocks users from changing their own `company_id` or `email` via direct Supabase client
- **Subscription RLS:** `company_subscriptions` update restricted to `owner`/`admin` roles only
- **CHECK constraints:** Status columns validated at DB level on 8 tables: `company_subscriptions`, `contacts`, `agent_runs`, `call_queue`, `campaign_queue`, `follow_up_queue`, `team_invitations`, `company_addons`
- **Role escalation prevention:** Trigger `trg_prevent_role_self_escalation` blocks role self-changes (pre-existing)

### Compliance
- AI disclosure checkbox in campaign creation
- User consent collection
- Privacy policy and Terms of Service links
- Rate limiting on API routes (`/lib/rate-limit.ts`) — defined but not yet globally applied
- **Input validation:** Zod schemas on all API routes with specific validations (session_id `cs_` prefix, UUID format for contact_id, addon_type whitelist)

---

## 20. Internationalization

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

## 21. Frontend Architecture

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
├── home/           — HomePage + HomeTour (driver.js guided tour, 9 steps)
├── layout/         — Sidebar, Header (with tour DOM IDs)
├── notifications/  — Notification UI
└── ui/             — Shared UI components (buttons, modals, forms, PageTipCard)
```

### Guided Tour System (driver.js)

The platform includes an interactive guided tour powered by **driver.js v1.4.0** that activates after the onboarding wizard completes.

**HomeTour component** (`src/components/home/HomePage.tsx`):
- 9 sequential steps spotlighting key UI elements with custom dark-theme popovers
- Overlay click disabled — tour requires explicit dismissal
- Persists `tour_home_seen: true` to `company_settings.settings` on close
- Exposes `window.__callengoTourClose()` global so Sidebar/Header can close tour on navigation
- Uses `useCallback` for stable `onDismiss` reference to prevent tour restart on re-renders

**PageTipCard component** (`src/components/ui/PageTipCard.tsx`):
- Reusable contextual tip card deployed on all 10 main pages
- 3 states: full card → minimized "Tips" button → re-expanded
- Persists dismissal to `company_settings.settings[settingKey]` per-page
- Fade-in animation (opacity + translateY, 500ms ease-out)

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

## 22. Business Logic & Constraints

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

## 23. Promotional Coupons

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

## 24. Notification System

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

## 25. Utility Libraries

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

### `/lib/openai/tracker.ts`
- `getOpenAIClient(featureKey)` — returns OpenAI instance with correct API key per feature, with fallback to `OPENAI_API_KEY`
- `trackOpenAIUsage(params)` — async fire-and-forget usage logger (writes to `openai_usage_logs` table)
- `calculateOpenAICost(model, inputTokens, outputTokens)` — cost calculator (per-model pricing)
- `getDefaultModel()` — returns `OPENAI_MODEL ?? 'gpt-4o-mini'`
- `getPremiumModel()` — returns `OPENAI_MODEL_PREMIUM ?? 'gpt-4o'`
- `FeatureKey` type: `'call_analysis' | 'contact_analysis' | 'cali_ai' | 'onboarding' | 'demo_analysis'`

**Per-feature API key routing:**
| Feature Key | API Key Used | Fallback |
|---|---|---|
| `call_analysis` | `OPENAI_API_KEY` | — |
| `contact_analysis` | `OPENAI_API_KEY` | — |
| `cali_ai` | `OPENAI_API_KEY_CALI_AI` | `OPENAI_API_KEY` |
| `onboarding` | `OPENAI_API_KEY` | — |
| `demo_analysis` | `OPENAI_API_KEY` | — |

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

## 26. Environment & Deployment

### Required Environment Variables
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (server-only) |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_APP_URL` | Application URL |
| `OPENAI_API_KEY` | OpenAI API key for all features (call analysis, contact analysis, onboarding, demo) |
| `OPENAI_API_KEY_CALI_AI` | OpenAI key for Cali AI assistant (isolated for rate limit separation) |
| `OPENAI_MODEL` | Default model override (default: gpt-4o-mini) |
| `OPENAI_MODEL_PREMIUM` | Premium model override (default: gpt-4o) |
| `OPENAI_WEBHOOK_SECRET` | HMAC-SHA256 secret for OpenAI webhook verification (optional) |
| `BLAND_API_KEY` | Bland AI master API key (single key for all calls) |
| `BLAND_COST_PER_MINUTE` | Bland per-minute rate override (default: $0.14 — Start plan; set to match your Bland plan) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL for concurrency tracking |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis auth token |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Microsoft OAuth |
| `SALESFORCE_CLIENT_ID` / `SALESFORCE_CLIENT_SECRET` | Salesforce OAuth |
| `HUBSPOT_CLIENT_ID` / `HUBSPOT_CLIENT_SECRET` | HubSpot OAuth |
| `PIPEDRIVE_CLIENT_ID` / `PIPEDRIVE_CLIENT_SECRET` | Pipedrive OAuth |
| `CLIO_CLIENT_ID` / `CLIO_CLIENT_SECRET` | Clio OAuth |
| `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` | Zoho OAuth |
| `ZOOM_ACCOUNT_ID` / `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` | Zoom S2S OAuth |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` | Slack OAuth |
| `SLACK_SIGNING_SECRET` | Slack webhook signature verification |
| `TOKEN_ENCRYPTION_KEY` | AES-256-GCM key for OAuth token encryption (64 hex chars = 32 bytes) |
| `SEED_ENDPOINT_SECRET` | Secret for seed data endpoint (POST and DELETE) |
| `QUEUE_PROCESSING_SECRET` | Secret for queue processing endpoint auth |
| `CRON_SECRET` | Secret for cron/followup processing endpoint auth |

### Build & Deploy
- **Build:** `next build` (TypeScript compilation, Tailwind, ESLint)
- **Deploy:** Vercel-ready
- **Stripe Sync:** `npm run stripe:sync` (sandbox) / `npm run stripe:sync -- --env=live` (production)

---

## 27. Integrations Guide

> This section provides detailed documentation for every Callengo integration — what it does, how to set it up, what data flows between systems, and which plan is required. Designed to serve as the basis for a public documentation site.

---

### 27.1 Integration Overview

Callengo connects with 16 external services across 4 categories. Each integration is plan-gated: users on lower plans see the integration locked with an upgrade prompt.

| Category | Integrations | Purpose |
|---|---|---|
| **Calendar** | Google Calendar, Microsoft Outlook, SimplyBook.me | Schedule events, sync appointments, manage availability |
| **Video Conferencing** | Google Meet, Zoom, Microsoft Teams | Auto-generate meeting links for scheduled calls |
| **CRM** | Salesforce, HubSpot, Pipedrive, Zoho, Clio, Dynamics 365, Google Sheets | Import contacts, sync call results, map fields |
| **Communication** | Slack, Webhooks | Notifications and automation triggers |
| **Payment** | Stripe | Billing, subscriptions, overage tracking (built-in) |

**Coming Soon:** GoHighLevel (Business+, CRM), Acuity Scheduling (Starter+, Calendar)

---

### 27.2 Google Calendar

**What it does:**
Bidirectional sync between Callengo and Google Calendar. When the AI agent schedules a meeting or confirms an appointment, it appears in your Google Calendar. Events created in Google Calendar also sync back to Callengo.

**Plan Required:** Free+

**Authentication:** OAuth 2.0 via Google APIs

**Setup Steps:**
1. Navigate to Integrations page
2. Click "Connect" on Google Calendar
3. Google OAuth consent screen appears
4. Grant calendar read/write permissions
5. Select which calendar to sync (default: primary)
6. Connection confirmed with email display

**What Syncs:**
| Direction | Data |
|---|---|
| Callengo → Google | AI-scheduled meetings, confirmed appointments, rescheduled events, callback slots |
| Google → Callengo | External calendar events (for availability checking), event updates, cancellations |

**Capabilities:**
- Create events with title, description, location, and attendees
- Check calendar availability before scheduling
- Incremental sync using Google sync tokens (efficient — only fetches changes)
- Timezone-aware scheduling
- Working hours enforcement (respects your configured business hours)
- US holiday exclusion
- Auto-generated Google Meet links when video provider is set to "Meet"

**Sync Behavior:**
- Initial sync: pulls events from 3 months back to 3 months forward
- Ongoing: incremental sync via sync tokens
- Sync log tracks: events created, updated, deleted, and any errors
- Last synced timestamp visible in UI

**API Endpoints:**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/integrations/google-calendar/connect` | Initiate OAuth flow |
| GET | `/api/integrations/google-calendar/callback` | Handle OAuth callback |
| POST | `/api/integrations/google-calendar/sync` | Trigger manual sync |
| POST | `/api/integrations/google-calendar/disconnect` | Revoke connection |

---

### 27.3 Microsoft Outlook (Microsoft 365)

**What it does:**
Same as Google Calendar but for Microsoft 365/Outlook users. Bidirectional sync with Outlook calendar via Microsoft Graph API.

**Plan Required:** Business+ ($299/mo)

**Authentication:** OAuth 2.0 via Microsoft Identity Platform (Entra ID)

**Setup Steps:**
1. Navigate to Integrations page
2. Click "Connect" on Microsoft 365
3. Microsoft login/consent screen appears
4. Grant calendar read/write permissions
5. Connection confirmed with Microsoft account email

**What Syncs:**
| Direction | Data |
|---|---|
| Callengo → Outlook | AI-scheduled meetings, appointments, rescheduled events |
| Outlook → Callengo | Calendar events for availability, updates, cancellations |

**Capabilities:**
- Full calendar CRUD operations via Microsoft Graph API
- Microsoft Teams meeting link auto-generation
- Tenant-aware (stores `microsoft_tenant_id`)
- Specific calendar selection (`microsoft_calendar_id`)
- Incremental sync with delta tokens

**API Endpoints:**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/integrations/microsoft-outlook/connect` | Initiate OAuth flow |
| GET | `/api/integrations/microsoft-outlook/callback` | Handle OAuth callback |
| POST | `/api/integrations/microsoft-outlook/sync` | Trigger manual sync |
| POST | `/api/integrations/microsoft-outlook/disconnect` | Revoke connection |

---

### 27.4 Google Meet

**What it does:**
Automatically generates Google Meet video conference links when scheduling meetings via the AI agent. Requires Google Calendar to be connected.

**Plan Required:** Free+

**Authentication:** Uses Google Calendar OAuth (no separate connection needed)

**How it Works:**
1. Connect Google Calendar (prerequisite)
2. Set video provider to "Google Meet" in campaign/agent settings
3. When AI agent schedules a meeting, a Meet link is auto-generated
4. Meet link included in the calendar event and shared with the contact
5. No separate Zoom/Teams needed

**Important:** Google Meet is a "child" integration — it activates automatically when Google Calendar is connected and the video provider is set to Meet. No separate OAuth flow.

---

### 27.5 Zoom

**What it does:**
Server-to-server integration for generating Zoom meeting links. Unlike Google Meet, Zoom uses a server-to-server OAuth app (no per-user consent needed).

**Plan Required:** Free+ (integration always active). Note: Zoom meeting links in campaigns require Starter+ plan (`zoomMeetings` feature flag).

**Authentication:** Server-to-Server OAuth (configured via environment variables, not per-user)

**Setup:**
Zoom is automatically available — no user setup required. The integration is configured at the platform level via environment variables:
- `ZOOM_ACCOUNT_ID`
- `ZOOM_CLIENT_ID`
- `ZOOM_CLIENT_SECRET`

**How it Works:**
1. Integration shows as "Always available" in the Integrations page
2. Set video provider to "Zoom" in campaign/agent settings
3. When AI agent schedules a meeting, a Zoom meeting is auto-created
4. Zoom link included in the calendar event

**API Endpoints:**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/integrations/zoom/connect` | Status check (server-to-server) |
| GET | `/api/integrations/zoom/callback` | OAuth callback (if applicable) |
| POST | `/api/integrations/zoom/disconnect` | Disable Zoom (rarely used) |

---

### 27.6 Microsoft Teams

**What it does:**
Auto-generates Microsoft Teams meeting links for scheduled events. Requires Microsoft Outlook to be connected.

**Plan Required:** Business+ ($299/mo)

**Authentication:** Uses Microsoft Outlook OAuth (no separate connection needed)

**How it Works:**
1. Connect Microsoft Outlook (prerequisite)
2. Set video provider to "Microsoft Teams" in campaign/agent settings
3. When AI agent schedules a meeting, a Teams link is auto-generated
4. Teams link included in the calendar event

**Important:** Like Google Meet, Teams is a "child" integration that activates through the Microsoft Outlook connection.

---

### 27.7 Salesforce CRM

**What it does:**
Full CRM integration with Salesforce. Import contacts and leads from Salesforce into Callengo, push call results back as activities, and sync team members.

**Plan Required:** Teams+ ($649/mo)

**Authentication:** OAuth 2.0 (Salesforce Web Server Flow)

**Setup Steps:**
1. Navigate to Integrations page
2. Click "Connect" on Salesforce
3. Salesforce login/consent screen appears
4. Grant API access permissions
5. Connection confirmed with Salesforce username

**What Syncs:**
| Direction | Data | Details |
|---|---|---|
| Salesforce → Callengo | Contacts | Name, email, phone, company, title, address, custom fields |
| Salesforce → Callengo | Leads | Lead source, status, company, phone, email |
| Callengo → Salesforce | Activities/Tasks | Call results, transcripts, outcomes, follow-up notes |
| Callengo → Salesforce | Events | Scheduled meetings from AI agent |
| Salesforce → Callengo | Users/Owners | Team member import for Callengo team setup |

**Dedicated Contact Page:**
Users can browse and import Salesforce contacts from `/contacts/salesforce` with:
- Search and filter Salesforce contacts
- Select contacts for import into Callengo lists
- View existing Salesforce data before import
- Bulk import with automatic field mapping

**Organization Member Import:**
Import Salesforce users as Callengo team members via Settings → Team → CRM Import.

**API Endpoints:**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/integrations/salesforce/connect` | Initiate OAuth flow |
| GET | `/api/integrations/salesforce/callback` | Handle OAuth callback |
| POST | `/api/integrations/salesforce/sync` | Trigger contact sync |
| GET | `/api/integrations/salesforce/contacts` | Fetch Salesforce contacts |
| GET | `/api/integrations/salesforce/users` | Fetch Salesforce users |
| POST | `/api/integrations/salesforce/disconnect` | Revoke connection |

---

### 27.8 HubSpot CRM

**What it does:**
Connect your HubSpot CRM to import contacts, sync call outcomes, and create activities. Supports contact lists and custom property mapping.

**Plan Required:** Business+ ($299/mo)

**Authentication:** OAuth 2.0 (HubSpot OAuth)

**Setup Steps:**
1. Navigate to Integrations page
2. Click "Connect" on HubSpot
3. HubSpot OAuth consent screen appears
4. Select your HubSpot portal and grant permissions
5. Connection confirmed with HubSpot email and domain

**What Syncs:**
| Direction | Data | Details |
|---|---|---|
| HubSpot → Callengo | Contacts | Name, email, phone, company, lifecycle stage, owner |
| HubSpot → Callengo | Companies | Company name, domain, industry |
| HubSpot → Callengo | Deals | Deal name, stage, amount (for context) |
| Callengo → HubSpot | Notes/Activities | Call results, transcripts, outcomes |
| HubSpot → Callengo | Contact Lists | Import from existing HubSpot lists |
| HubSpot → Callengo | Users | Team member import |

**Dedicated Contact Page:** `/contacts/hubspot`

**API Endpoints:**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/integrations/hubspot/connect` | Initiate OAuth flow |
| GET | `/api/integrations/hubspot/callback` | Handle OAuth callback |
| POST | `/api/integrations/hubspot/sync` | Trigger contact sync |
| GET | `/api/integrations/hubspot/contacts` | Fetch HubSpot contacts |
| GET | `/api/integrations/hubspot/users` | Fetch HubSpot users |
| POST | `/api/integrations/hubspot/disconnect` | Revoke connection |

---

### 27.9 Pipedrive CRM

**What it does:**
Bidirectional sync with Pipedrive. Import persons/contacts and organizations, push call results back as activities and notes.

**Plan Required:** Business+ ($299/mo)

**Authentication:** OAuth 2.0 (Pipedrive Marketplace)

**What Syncs:**
| Direction | Data | Details |
|---|---|---|
| Pipedrive → Callengo | Persons/Contacts | Name, email, phone, organization, custom fields |
| Pipedrive → Callengo | Organizations | Company name, address, industry |
| Pipedrive → Callengo | Deals | Deal value, stage (for lead qualification context) |
| Callengo → Pipedrive | Activities | Call results, outcomes with activity types |
| Callengo → Pipedrive | Notes | Call transcripts, analysis summaries |
| Pipedrive → Callengo | Users | Team member import |

**Dedicated Contact Page:** `/contacts/pipedrive`

**API Endpoints:**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/integrations/pipedrive/connect` | Initiate OAuth flow |
| GET | `/api/integrations/pipedrive/callback` | Handle OAuth callback |
| POST | `/api/integrations/pipedrive/sync` | Trigger contact sync |
| GET | `/api/integrations/pipedrive/contacts` | Fetch Pipedrive persons |
| GET | `/api/integrations/pipedrive/users` | Fetch Pipedrive users |
| POST | `/api/integrations/pipedrive/disconnect` | Revoke connection |

---

### 27.10 Zoho CRM

**What it does:**
Sync contacts, leads, and accounts with Zoho CRM. Push call results and notes back to Zoho.

**Plan Required:** Business+ ($299/mo)

**Authentication:** OAuth 2.0 (Zoho OAuth)

**What Syncs:**
| Direction | Data | Details |
|---|---|---|
| Zoho → Callengo | Contacts | Name, email, phone, account, title |
| Zoho → Callengo | Leads | Lead source, status, company info |
| Zoho → Callengo | Accounts | Company/organization data |
| Callengo → Zoho | Notes/Activities | Call outcomes, transcripts |
| Zoho → Callengo | Users | Team member import |

**Dedicated Contact Page:** `/contacts/zoho`

**API Endpoints:**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/integrations/zoho/connect` | Initiate OAuth flow |
| GET | `/api/integrations/zoho/callback` | Handle OAuth callback |
| POST | `/api/integrations/zoho/sync` | Trigger contact sync |
| GET | `/api/integrations/zoho/contacts` | Fetch Zoho contacts |
| GET | `/api/integrations/zoho/users` | Fetch Zoho users |
| POST | `/api/integrations/zoho/disconnect` | Revoke connection |

---

### 27.11 Clio — Legal Practice Management

**What it does:**
Purpose-built integration for law firms using Clio. Sync clients/contacts, matters/cases, and calendar entries. Map attorneys to contacts and link events to specific legal matters.

**Plan Required:** Business+ ($299/mo)

**Authentication:** OAuth 2.0 (Clio Developer Platform)

**Why Clio is Special:**
Clio is the only vertical-specific CRM integration. It was specifically added for the legal industry because:
- Law firms have unique data structures (matters, cases, billing)
- Appointment confirmation is critical for consultations
- Client data verification is compliance-relevant
- Dedicated coupon: LEGAL20 (20% off for 12 months)

**What Syncs:**
| Direction | Data | Details |
|---|---|---|
| Clio → Callengo | Contacts/Clients | Name, email, phone, address, client type |
| Clio → Callengo | Matters/Cases | Matter name, case type, status, responsible attorney |
| Clio → Callengo | Calendar Entries | Court dates, consultations, deadlines |
| Callengo → Clio | Activities | Call results linked to matters |
| Callengo → Clio | Calendar Events | Confirmed/rescheduled appointments |
| Clio → Callengo | Users/Attorneys | Team member import with role mapping |

**Dedicated Contact Page:** `/contacts/clio`

**API Endpoints:**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/integrations/clio/connect` | Initiate OAuth flow |
| GET | `/api/integrations/clio/callback` | Handle OAuth callback |
| POST | `/api/integrations/clio/sync` | Trigger contact sync |
| GET | `/api/integrations/clio/contacts` | Fetch Clio contacts |
| GET | `/api/integrations/clio/users` | Fetch Clio users/attorneys |
| POST | `/api/integrations/clio/disconnect` | Revoke connection |

---

### 27.12 Microsoft Dynamics 365

**What it does:**
Enterprise CRM integration with Microsoft Dynamics 365. Sync contacts, accounts, leads, and push call activities back.

**Plan Required:** Teams+ ($649/mo)

**Authentication:** OAuth 2.0 via Microsoft Entra ID (formerly Azure AD)

**What Syncs:**
| Direction | Data | Details |
|---|---|---|
| Dynamics → Callengo | Contacts | Name, email, phone, account, job title |
| Dynamics → Callengo | Accounts | Company name, industry, address |
| Dynamics → Callengo | Leads | Lead data, source, status |
| Callengo → Dynamics | Notes/Activities | Call results, outcomes |
| Dynamics → Callengo | Users | Team member import |

**Dedicated Contact Page:** `/contacts/microsoft-dynamics`

**API Endpoints:**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/integrations/dynamics/connect` | Initiate OAuth flow |
| GET | `/api/integrations/dynamics/callback` | Handle OAuth callback |
| POST | `/api/integrations/dynamics/sync` | Trigger contact sync |
| GET | `/api/integrations/dynamics/contacts` | Fetch Dynamics contacts |
| GET | `/api/integrations/dynamics/users` | Fetch Dynamics users |
| POST | `/api/integrations/dynamics/disconnect` | Revoke connection |

---

### 27.13 Google Sheets

**What it does:**
Import contacts directly from Google Sheets spreadsheets. Connect your Google account, browse your spreadsheets, select columns, and bulk-import contacts with automatic field mapping.

**Plan Required:** Free+

**Authentication:** OAuth 2.0 via Google APIs (separate from Google Calendar OAuth)

**Setup Steps:**
1. Navigate to Contacts page or Integrations page
2. Click "Import from Google Sheets"
3. Google OAuth consent screen (if not already connected)
4. Browse your Google Drive spreadsheets
5. Select a spreadsheet and sheet tab
6. Preview data with auto-detected column mapping
7. Confirm mapping and import

**Capabilities:**
- Browse all spreadsheets in user's Google Drive
- Select specific sheet tabs within a spreadsheet
- Auto-column mapping using 88+ field name patterns
- Preview data before import
- Batch import with progress tracking
- Link a spreadsheet for repeated imports

**API Endpoints:**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/integrations/google-sheets/connect` | Initiate OAuth flow |
| GET | `/api/integrations/google-sheets/callback` | Handle OAuth callback |
| GET | `/api/integrations/google-sheets/spreadsheets` | List user's spreadsheets |
| GET | `/api/integrations/google-sheets/sheet-data` | Read sheet data |
| POST | `/api/integrations/google-sheets/link` | Link a spreadsheet |
| POST | `/api/integrations/google-sheets/sync` | Import contacts |
| POST | `/api/integrations/google-sheets/disconnect` | Revoke connection |

---

### 27.14 SimplyBook.me

**What it does:**
Connect with SimplyBook.me to sync clients, bookings, and service providers. Designed for appointment-based businesses (salons, clinics, consultants) that use SimplyBook.me for scheduling.

**Plan Required:** Starter+ ($99/mo)

**Authentication:** REST API v2 with token-based authentication (NOT OAuth). Users provide their SimplyBook.me company login, user email, and password.

**Important:** SimplyBook.me is the only integration that uses credential-based auth instead of OAuth. Credentials are encrypted before storage.

**Setup Steps:**
1. Navigate to Integrations page
2. Click "Connect" on SimplyBook.me
3. Inline setup modal appears (not a redirect)
4. Enter your company login (subdomain), email, and password
5. Credentials verified against SimplyBook.me API
6. Connection confirmed

**What Syncs:**
| Direction | Data | Details |
|---|---|---|
| SimplyBook → Callengo | Clients | Name, email, phone, booking history |
| SimplyBook → Callengo | Bookings | Upcoming appointments with service details |
| SimplyBook → Callengo | Providers/Staff | Service providers with availability |
| Callengo → SimplyBook | Calendar Notes/Blocks | Confirmed/cancelled status updates |
| Bidirectional | Booking Status | Confirmation and rescheduling sync |

**Dedicated Contact Page:** `/contacts/simplybook`

**API Endpoints:**
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/integrations/simplybook/connect` | Authenticate with credentials |
| POST | `/api/integrations/simplybook/sync` | Trigger client/booking sync |
| GET | `/api/integrations/simplybook/clients` | Fetch SimplyBook clients |
| GET | `/api/integrations/simplybook/bookings` | Fetch bookings |
| GET | `/api/integrations/simplybook/providers` | Fetch service providers |
| POST | `/api/integrations/simplybook/webhook` | Receive booking events |
| POST | `/api/integrations/simplybook/disconnect` | Revoke connection |

---

### 27.15 Slack

**What it does:**
Send real-time notifications to Slack channels when key events happen: calls completed, appointments scheduled, follow-ups due, no-shows detected. Configurable per-channel and per-event-type.

**Plan Required:** Starter+ ($99/mo)

**Authentication:** OAuth 2.0 (Slack Workspace install)

**Setup Steps:**
1. Navigate to Integrations page
2. Click "Connect" on Slack
3. Slack OAuth consent screen — select workspace
4. Grant bot permissions
5. Connection confirmed with workspace name
6. Click "Configure" to set up notification preferences

**Configuration Options:**
| Setting | Description |
|---|---|
| **Notification Channels** | Select one or more Slack channels to receive notifications |
| **Call Completed** | Notify when an AI call finishes |
| **Appointments** | Notify on new, confirmed, or rescheduled appointments |
| **Follow-ups** | Notify when follow-up calls are scheduled |
| **No-shows** | Notify when a contact is marked as no-show |
| **Set as Default** | Apply this config to all new campaigns automatically |

**Notification Format:**
Slack messages include rich formatting with:
- Contact name and phone number
- Call outcome/status
- Agent name and campaign
- Direct links to Callengo for details

**API Endpoints:**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/integrations/slack/connect` | Initiate OAuth flow |
| GET | `/api/integrations/slack/callback` | Handle OAuth callback |
| GET | `/api/integrations/slack/channels` | List workspace channels |
| POST | `/api/integrations/slack/disconnect` | Revoke connection |
| POST | `/api/integrations/slack/webhook` | Receive Slack interactive actions |

**Slack Webhook Features:**
- Signature verification (`x-slack-request-timestamp`, `x-slack-signature`)
- Interactive actions: confirm appointment, cancel appointment, mark no-show
- Slash command support (future)

---

### 27.16 Phone Numbers (Auto-Rotation + Dedicated Add-on)

**What it does:**
All plans use auto-rotated phone numbers from Callengo's pool to minimize spam flags and ensure number freshness. A Dedicated Number add-on ($15/mo) is available on Starter+ for companies needing a branded caller ID.

> **Note:** Twilio BYOP is NOT supported. All calls go through Bland AI's auto-rotated number pool or dedicated numbers purchased as add-ons.

**Auto-Rotated Numbers (all plans):**
- Numbers sourced from Callengo's Bland AI number pool
- Automatically rotated to prevent spam flagging
- No setup required — available immediately

**Dedicated Number Add-on ($15/mo, Starter+):**
- Own dedicated outbound phone number via Bland AI
- Consistent caller ID for brand recognition
- Available on Starter, Growth, Business, Teams, and Enterprise plans

---

### 27.17 Webhooks

**What it does:**
Send real-time HTTP POST notifications to your own servers or automation platforms (Zapier, Make, n8n) when events occur in Callengo. Each webhook endpoint has a signing secret for verification.

**Plan Required:** Starter+ ($99/mo)

**Authentication:** HMAC-SHA256 signing (each endpoint gets a unique secret)

**Setup Steps:**
1. Navigate to Integrations page
2. Click "Set Up" on Webhooks
3. Inline setup modal with endpoint management
4. Add endpoint URL, select event types, optional description
5. Each endpoint receives a unique signing secret
6. Test endpoint with a sample payload

**Available Event Types (12 total):**

| Event | Description |
|---|---|
| `call.completed` | Fired when an AI call finishes successfully |
| `call.failed` | Fired when a call fails or errors out |
| `call.no_answer` | Fired when a contact does not answer |
| `call.voicemail` | Fired when voicemail is detected |
| `appointment.scheduled` | Fired when a new appointment is created |
| `appointment.confirmed` | Fired when an appointment is confirmed |
| `appointment.rescheduled` | Fired when an appointment is rescheduled |
| `appointment.cancelled` | Fired when an appointment is cancelled |
| `appointment.no_show` | Fired when a contact is marked as no-show |
| `contact.updated` | Fired when contact data is modified after a call |
| `campaign.completed` | Fired when all contacts in a campaign have been called |
| `campaign.started` | Fired when a campaign begins making calls |

**Webhook Payload Format:**
```json
{
  "event": "call.completed",
  "event_id": "unique-event-id",
  "timestamp": "2026-03-06T10:30:00Z",
  "data": {
    "call_id": "...",
    "contact_id": "...",
    "contact_name": "John Doe",
    "contact_phone": "+1234567890",
    "duration": 120,
    "outcome": "verified",
    "analysis": { ... }
  }
}
```

**Security:**
- Each delivery signed with `X-Webhook-Signature` header
- HMAC-SHA256 using endpoint's unique secret
- Verify by computing `HMAC-SHA256(secret, request_body)` and comparing

**Reliability:**
- Delivery tracking per endpoint: `last_triggered_at`, `last_success_at`, `last_failure_at`
- `consecutive_failures` counter
- Auto-disable after repeated failures (`auto_disabled_at`)
- Delivery log with HTTP status, response body, duration

**Endpoint Management:**
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/webhooks/endpoints` | List all webhook endpoints |
| POST | `/api/webhooks/endpoints` | Create new endpoint |
| PATCH | `/api/webhooks/endpoints/[id]` | Update endpoint (URL, events, status) |
| DELETE | `/api/webhooks/endpoints/[id]` | Delete endpoint |

**Automation Platform Compatibility:**
- **Zapier:** Use "Webhooks by Zapier" trigger → paste Callengo webhook URL
- **Make (Integromat):** Use "Custom Webhook" module → paste URL
- **n8n:** Use "Webhook" node → paste URL
- Any HTTP-capable system can receive Callengo webhooks

---

### 27.18 Stripe (Built-in)

**What it does:**
Handles all payment processing, subscription management, and overage billing. Stripe is always active and requires no user setup — it's configured at the platform level.

**Plan Required:** Free+ (always active, always connected)

**User-Facing Features:**
- Subscription checkout (plan selection → Stripe Checkout)
- Billing portal (update payment method, view invoices)
- Usage-based overage billing (metered billing)
- Multi-currency support (USD, EUR, GBP)
- Invoice generation and history
- Cancellation with prorated refunds

**Not User-Configurable:** Stripe is a platform integration, not a user-connected integration. Users interact with Stripe through Callengo's billing UI, not directly.

---

### 27.19 Common Integration Patterns

#### OAuth Flow (Most Integrations)
```
1. User clicks "Connect" → GET /api/integrations/[provider]/connect
2. Redirect to provider's OAuth consent screen
3. User grants permissions
4. Provider redirects to /api/integrations/[provider]/callback
5. Callback exchanges code for access_token + refresh_token
6. Tokens stored in [provider]_integrations table (encrypted)
7. User redirected back to /integrations with success
```

#### Token Refresh
- Access tokens have limited lifetimes (1 hour typical)
- Refresh tokens used to obtain new access tokens automatically
- `token_expires_at` tracked per integration
- Refresh happens transparently before API calls

#### Sync Pattern (CRM Integrations)
```
1. User clicks "Sync" or sync triggered automatically
2. POST /api/integrations/[provider]/sync
3. Fetch contacts from provider API (paginated)
4. Map provider fields to Callengo contact fields
5. Create/update contacts in Callengo database
6. Push call results back to provider (if bidirectional)
7. Update last_synced_at timestamp
8. Log sync results (created/updated/deleted/errors)
```

#### Contact Import Flow (CRM → Callengo)
```
1. User navigates to /contacts/[provider]
2. GET /api/integrations/[provider]/contacts → list provider contacts
3. User selects contacts to import
4. Selected contacts mapped to Callengo fields
5. Phone numbers normalized to E.164
6. Contacts deduplicated (phone + email)
7. Custom fields preserved in JSON
8. Contacts added to selected contact list
```

#### Organization Member Import
```
1. User navigates to Settings → Team → CRM Import
2. GET /api/integrations/[provider]/users → list provider users
3. User selects team members to invite
4. POST /api/team/invite for each selected member
5. Team invitations sent via email
```

---

### 27.20 Integration Database Tables

Each CRM integration stores its connection data in a dedicated table:

| Table | Provider | Key Extra Columns |
|---|---|---|
| `calendar_integrations` | Google Calendar, Outlook | `google_calendar_id`, `microsoft_tenant_id`, `microsoft_calendar_id`, `sync_token`, `scopes` |
| `salesforce_integrations` | Salesforce | `instance_url`, `sf_user_id`, `sf_username` |
| `hubspot_integrations` | HubSpot | `hub_id`, `hub_domain`, `portal_id` |
| `pipedrive_integrations` | Pipedrive | `pipedrive_user_id`, `company_name`, `company_domain` |
| `clio_integrations` | Clio | `clio_user_id`, `firm_name`, `firm_id` |
| `zoho_integrations` | Zoho | `zoho_user_id`, `org_name`, `org_id` |
| `dynamics_integrations` | Dynamics 365 | `dynamics_user_id`, `instance_url`, `tenant_id` |
| `simplybook_integrations` | SimplyBook.me | `company_login`, `user_login`, `api_token`, `token_expires_at` |
| `google_sheets_integrations` | Google Sheets | `google_user_id`, `spreadsheet_id`, `sheet_name` |

**Common Columns (all tables):**
- `id` (uuid, PK)
- `company_id` (uuid, FK)
- `access_token` (text, encrypted with AES-256-GCM at application level via `src/lib/encryption.ts`)
- `refresh_token` (text, encrypted with AES-256-GCM, nullable)
- `is_active` (boolean)
- `last_synced_at` (timestamp, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

**Slack Integration:**
Slack config is stored in `company_settings.settings.slack_default_config` (JSON) rather than a dedicated table. The config includes:
- `enabled` (boolean)
- `channelIds` / `channelNames` (arrays)
- `notifyOnCallCompleted`, `notifyOnAppointment`, `notifyOnFollowUp`, `notifyOnNoShow` (booleans)
- `setAsDefault` (boolean)

**Webhook Endpoints:**
Stored in `webhook_endpoints` table with columns:
- `id`, `company_id`, `url`, `description`, `secret`
- `events` (text array), `is_active`
- `last_triggered_at`, `last_success_at`, `last_failure_at`, `last_failure_reason`
- `consecutive_failures`, `auto_disabled_at`
- `created_at`, `updated_at`

Delivery log in `webhook_deliveries` table:
- `id`, `endpoint_id`, `company_id`, `event_type`, `event_id`
- `payload` (JSON), `status` (pending/success/failed)
- `http_status`, `response_body`, `error_message`
- `attempt_number`, `delivered_at`, `duration_ms`

---

### 27.21 Plan-Gated Access Reference

| Integration | Free | Starter | Growth | Business | Teams | Enterprise |
|---|---|---|---|---|---|---|
| Google Calendar | Yes | Yes | Yes | Yes | Yes | Yes |
| Google Meet | Yes | Yes | Yes | Yes | Yes | Yes |
| Google Sheets | Yes | Yes | Yes | Yes | Yes | Yes |
| Zoom | Yes | Yes | Yes | Yes | Yes | Yes |
| Stripe | Yes (auto) | Yes | Yes | Yes | Yes | Yes |
| Slack | - | Yes | Yes | Yes | Yes | Yes |
| SimplyBook.me | - | Yes | Yes | Yes | Yes | Yes |
| Webhooks | - | Yes | Yes | Yes | Yes | Yes |
| Microsoft Outlook | - | - | - | Yes | Yes | Yes |
| Microsoft Teams | - | - | - | Yes | Yes | Yes |
| HubSpot | - | - | - | Yes | Yes | Yes |
| Pipedrive | - | - | - | Yes | Yes | Yes |
| Zoho CRM | - | - | - | Yes | Yes | Yes |
| Clio | - | - | - | Yes | Yes | Yes |
| Salesforce | - | - | - | - | Yes | Yes |
| Dynamics 365 | - | - | - | - | Yes | Yes |
| GoHighLevel | - | - | - | Coming Soon | | |
| Acuity Scheduling | - | Coming Soon | | | | |

---

## 28. Production Readiness Audit (March 23, 2026)

Full audit log: `AUDIT_LOG.md` (root). Migration: `supabase/migrations/20260323000002_production_audit_fixes.sql`.

### Summary
- **Scope:** Database schema (57 tables), billing/payments, auth/security, core call flow, admin/contacts/integrations, performance
- **Result:** 0 critical issues remaining, 1 warning (no automated tests), 15 issues fixed, 13 potential issues investigated and confirmed mitigated

### Fixes Applied (15)

| # | Fix | Category |
|---|-----|----------|
| 1 | OAuth tokens encrypted at rest (AES-256-GCM, 11 providers, 22 files) | Security |
| 2 | Users table RLS: blocked self-update of `company_id` and `email` | Security |
| 3 | `company_subscriptions` update restricted to `owner`/`admin` | Security |
| 4 | CHECK constraints on status columns (8 tables) | Data Integrity |
| 5 | Admin Command Center role check: added `owner` role | Auth |
| 6 | `verify-session` session_id `cs_` prefix validation | Input Validation |
| 7 | Stripe webhook `addon_type` whitelist validation | Input Validation |
| 8 | Seed DELETE route: consistent `SEED_ENDPOINT_SECRET` auth | Auth |
| 9 | `send-call` metadata.contact_id UUID validation | Input Validation |
| 10 | Command Center query parallelization (hourly + daily) | Performance |
| 11 | Admin monitor N+1 refactored to batch parallel queries | Performance |
| 12 | Cleanup-orphans: `Promise.allSettled()` for loops | Performance |
| 13 | Soft-delete for companies (`deleted_at` + RLS + partial index) | Data Safety |
| 14 | Seed endpoint protection consistency | Security |
| 15 | Slack callback state validation standardized | Security |

### Remaining Open Items
- **No automated tests** — Test framework not configured. Recommended: Vitest + test critical paths (webhooks, throttle, OAuth state, Redis concurrency, CSV import)
- **Rate limiting not globally applied** — `rate-limit.ts` defined but not enforced on all endpoints
- **Exchange rates static** — EUR/GBP hardcoded, no dynamic updates
- **`select('*')` optimization** — 71 occurrences across 47 files (optimize as traffic grows)

### Verdict: GO for Production
The codebase demonstrates strong security practices: RLS, Zod validation, webhook signature verification, idempotency, Redis concurrency control, signed OAuth state, TOCTOU race prevention, and encrypted tokens at rest.

---

## 29. Updates — March 25, 2026

### OpenAI Usage Tracking & Per-Feature API Keys

**New library:** `src/lib/openai/tracker.ts` centralizes all OpenAI usage. Every file that calls the OpenAI API now uses `getOpenAIClient(featureKey)` instead of direct instantiation, and calls `trackOpenAIUsage()` after each completion. This enables per-feature cost visibility.

**Feature areas using OpenAI:**
| Feature Key | Files | Model | Purpose |
|---|---|---|---|
| `call_analysis` | `intent-analyzer.ts`, `/api/openai/analyze`, `/api/openai/intent` | gpt-4o-mini | Post-call transcript analysis (BANT, appointment, data validation) |
| `contact_analysis` | Contact quality, agent suggestions, web scraper | gpt-4o-mini | Contact intelligence and enrichment |
| `cali_ai` | `/api/ai/chat`, `AIChatPanel.tsx` | gpt-4o-mini | Cali AI in-app assistant (Cmd+K) |
| `onboarding` | Onboarding flow suggestions | gpt-4o-mini | Onboarding context suggestions |
| `demo_analysis` | Demo/seed analysis | gpt-4o-mini | Demo data analysis |

**New table:** `openai_usage_logs` (migration: `20260325000001_openai_usage_tracking.sql`). Total tables: 57.

**New endpoints:**
- `POST /api/openai/webhook` — OpenAI webhook receiver (HMAC-SHA256 via `OPENAI_WEBHOOK_SECRET`)
- `GET /api/admin/openai-usage` — Admin: 30d totals, by-feature, by-model, daily chart, recent 50 logs

**Admin Command Center:** New 7th tab **AI Costs** shows 30d OpenAI spending, feature breakdown, daily trend chart, model breakdown, and recent API call log.

### Analytics PII Fix

Email address removed as analytics identifier in both GA4 and PostHog. All user identification now uses the Supabase user UUID as `distinct_id` (PostHog) and as the GA4 user identifier. The `user_email` property has been removed from GA4 user properties. Files updated: `AnalyticsProvider.tsx`, `PostHogProvider.tsx`, `src/lib/analytics.ts`, `src/lib/posthog.ts`, `src/app/(app)/layout.tsx`.

### Cali AI Assistant (Documented)

Previously undocumented: `src/components/ai/AIChatPanel.tsx` is an in-app AI assistant opened via Cmd+K. It uses GPT-4o-mini (temperature 0.7, max 1000 tokens) and persists conversation history in `ai_conversations` and `ai_messages` tables. Feature key: `cali_ai`.

---

*End of Callengo Master Document v1.6.0*
