# CALLENGO: Business Model, Pricing Strategy & Competitive Analysis

**Version:** 2.0 Final
**Date:** March 2026
**Purpose:** Definitive pricing structure, feature gating, competitive positioning, and unit economics for Callengo subscription tiers.

---

# TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Current State Audit](#2-current-state-audit)
3. [Infrastructure Cost Analysis (Bland AI)](#3-infrastructure-cost-analysis-bland-ai)
4. [Competitive Landscape](#4-competitive-landscape)
5. [Unit Economics & Margin Analysis](#5-unit-economics--margin-analysis)
6. [New Pricing Architecture](#6-new-pricing-architecture)
7. [Feature Gating Matrix](#7-feature-gating-matrix)
8. [Integration Access by Tier](#8-integration-access-by-tier)
9. [Revenue Maximization Strategy](#9-revenue-maximization-strategy)
10. [Recommendations & Gap Analysis](#10-recommendations--gap-analysis)
11. [Implementation Roadmap](#11-implementation-roadmap)

---

# 1. EXECUTIVE SUMMARY

## 1.1 What Callengo Is

Callengo is a **plug-and-play AI voice calling platform** built on top of Bland AI's infrastructure. It enables businesses to deploy AI phone agents (Lead Qualifier, Appointment Confirmation, Customer Satisfaction) without writing code, managing infrastructure, or dealing with APIs. The core value proposition: **"Call and Go"** -- select an agent, upload contacts, click start. The AI handles calls, voicemails, follow-ups, rescheduling, CRM updates, and calendar bookings automatically.

## 1.2 Core Problem

The current pricing structure has several issues:
- **Features listed that don't exist or aren't understood** ("governance", "audit logs", "compliance" -- partially implemented)
- **Pricing not aligned with actual infrastructure costs** (Bland AI changed pricing in Dec 2025)
- **Revenue leakage risk** on lower tiers -- Bland AI costs $0.11-$0.14/min while we charge $0.60/min overage on Starter but the BASE plan at $99/mo only includes 300 min (~$0.33/min cost to Callengo before any Bland costs)
- **Feature confusion** -- plans promise things like "governance & audit logs" that aren't fully built
- **No clear progressive value ladder** between tiers

## 1.3 What We're Building Here

A **definitive, honest pricing structure** based on:
- Real features that exist today in the codebase
- Real infrastructure costs from Bland AI (post-Dec 2025 pricing)
- Real competitive positioning against Synthflow, Retell, Vapi, etc.
- Pricing that **maximizes margins** while staying competitive
- Clear value progression from tier to tier

---

# 2. CURRENT STATE AUDIT

## 2.1 Current Plans (As Configured in Database)

| Attribute | Free | Starter | Business | Teams | Enterprise |
|-----------|------|---------|----------|-------|------------|
| **Price/mo** | $0 | $99 | $279 | $599 | $1,500 |
| **Price/yr** | $0 | $1,068 ($89/mo) | $2,988 ($249/mo) | $6,348 ($529/mo) | $16,200 ($1,350/mo) |
| **Minutes included** | 15 | 300 | 1,200 | 2,400 | 6,000 |
| **Max call duration** | 3 min | 3 min | 5 min | 8 min | 15 min |
| **Overage/min** | N/A (blocked) | $0.60 | $0.35 | $0.22 | $0.18 |
| **Max users** | 1 | 1 | 3 | 5 | Unlimited |
| **Max agents** | 1 | 1 | Unlimited | Unlimited | Unlimited |
| **Max concurrent calls** | 1 | 2 | 5 | 10 | 25 |
| **Extra seat price** | N/A | N/A | N/A | $79/seat | N/A |

## 2.2 Existing Features (REAL, built and working)

### Core Platform
- AI agent creation & configuration (3 templates: Lead Qualifier, Appointment Confirmation, Customer Satisfaction)
- Custom task/prompt editing per agent
- Voice selection (multiple Bland AI voices)
- Campaign creation & execution (agent runs)
- Call queue processing with interval controls
- Contact management (CRUD, lists, tags, custom fields)
- CSV/Excel/JSON import & export
- Phone number normalization & deduplication
- Call logs with recording, transcript, summary, analysis
- Usage dashboard with minute tracking
- Billing history with Stripe invoices
- Overage system (enable/disable, set budget, alerts at 50/75/90%)
- Notifications system (in-app, configurable)

### Voice & Call Features
- Auto-rotating phone numbers (spam protection via Bland)
- Voicemail detection (via Bland's answered_by)
- Custom voicemail messages per agent
- Voicemail logging & playback
- Follow-up queue (auto-schedule follow-ups after no-answer/voicemail)
- Smart follow-up scheduling (configurable intervals)
- Callback scheduling (from call outcomes)
- Max call duration controls per plan
- Working hours / timezone scheduling
- No-show auto-retry

### Calendar & Scheduling
- Google Calendar integration (bidirectional sync)
- Microsoft Outlook integration (bidirectional sync)
- Zoom meeting links (auto-generated, server-to-server)
- Google Meet links (auto-generated with Google Calendar)
- Microsoft Teams links (auto-generated with Outlook)
- Appointment confirmation via AI agent
- Rescheduling handling via AI agent
- No-show detection & retry
- Calendar event creation from call outcomes
- Working hours / working days configuration
- Meeting duration configuration

### CRM Integrations
- **HubSpot** -- OAuth, bidirectional contact sync, call result pushback
- **Pipedrive** -- OAuth, bidirectional contact sync, call result pushback
- **Salesforce** -- OAuth, contact/lead sync, call result pushback
- **Zoho CRM** -- OAuth, contact/lead sync
- **Microsoft Dynamics 365** -- OAuth, contact sync
- **Clio** (legal CRM) -- OAuth, contact sync, call result pushback
- **SimplyBook.me** -- Client/booking sync

### Data Integrations
- **Google Sheets** -- Import contacts from spreadsheets (read-only)
- **Slack** -- Real-time notifications (calls, appointments, follow-ups, no-shows)
- **Webhooks** -- Custom endpoints, event-based delivery, HMAC signing
- **Twilio** -- BYOP (Bring Your Own Provider) for custom phone numbers

### AI Features
- AI call analysis (OpenAI-powered)
- AI contact segmentation
- AI agent recommendations
- AI chat assistant ("Cali")
- Transcript-based outcome classification

### Team & Admin
- Team invitations (email-based, role-based)
- Roles: Owner, Admin, Member
- Seat management with limits per plan
- Admin financial dashboard (internal)
- Retention offers system
- Cancellation feedback collection

## 2.3 Features Listed in Plans That Are Problematic

| Feature Claim | Reality | Assessment |
|---------------|---------|------------|
| "Governance & audit logs" | Basic billing events + notification logs exist. No formal governance UI. | **REMOVE** -- don't promise what's not fully built |
| "Compliance & audit logs" | Same as above. No compliance dashboard. | **REMOVE** from Enterprise |
| "Security & compliance" | RLS, OAuth token encryption exist. No formal compliance certification. | **REWORD** to "Enterprise-grade security" |
| "Custom workflows" | Agent templates + webhook dispatch. Not a visual workflow builder. | **REWORD** to "Custom agent configurations" |
| "REST API access" | Webhooks exist. No public REST API for external developers. | **REMOVE** until built, or **REWORD** to "Webhook API" |
| "Custom integrations" | Webhook endpoints + existing CRM OAuth flows. | **REWORD** to "Webhooks + all CRM integrations" |
| "Roadmap influence" | Not a real feature. | **REMOVE** |
| "Priority infrastructure" | All customers share the same Bland AI infra. | **REMOVE** |
| "Dedicated account manager" | Sales/support commitment, not a tech feature. | **KEEP** for Enterprise (operational promise) |
| "SLA guarantee" | Not formally defined. | **KEEP** for Enterprise (must define SLA terms) |
| "Retry logic + voicemail" | Exists in ALL plans (follow-up queue + voicemail detection). | **Available on all paid plans** |

---

# 3. INFRASTRUCTURE COST ANALYSIS (BLAND AI)

## 3.1 Bland AI Pricing (Post-December 2025)

| Plan | Monthly Fee | Connected Min Rate | Transfer Rate | Concurrent | Daily Cap | Hourly Cap | Voice Clones |
|------|-------------|-------------------|---------------|------------|-----------|------------|--------------|
| **Start** (Free) | $0 | $0.14/min | $0.05/min | 10 | 100 calls | 100 calls | 1 |
| **Build** | $299/mo | $0.12/min | $0.04/min | 50 | 2,000 calls | 1,000 calls | 5 |
| **Scale** | $499/mo | $0.11/min | $0.03/min | 100 | 5,000 calls | 1,000 calls | 15 |
| **Enterprise** | Custom | ~$0.09/min | Custom | Unlimited | Unlimited | Unlimited | Unlimited |

**Additional Bland Costs:**
- Outbound minimum: $0.015 per call attempt (even failed/no-answer)
- SMS: $0.02/message
- Voicemail: Billed at standard connected minute rate

## 3.2 Callengo's Current Bland AI Cost Structure

**Assumption: Callengo is on Bland's Build plan ($299/mo) or Scale plan ($499/mo).**

For the analysis, we'll use **Scale plan** ($499/mo, $0.11/min) as the baseline since Callengo needs 100 concurrent calls to serve multiple customers simultaneously.

### Per-Minute Cost to Callengo

| Component | Cost |
|-----------|------|
| Bland AI connected minute | $0.11 |
| Bland outbound attempt fee (amortized) | ~$0.005 |
| OpenAI analysis (post-call, amortized) | ~$0.005 |
| Supabase (amortized per minute) | ~$0.002 |
| **Total COGS per minute** | **~$0.122** |

### Monthly Fixed Costs

| Component | Cost |
|-----------|------|
| Bland AI Scale plan | $499 |
| Supabase Pro | ~$25-50 |
| Vercel/Hosting | ~$20-50 |
| OpenAI API (estimated) | ~$50-100 |
| **Total monthly fixed** | **~$600-700** |

## 3.3 Current Margin Analysis (Per Plan)

### Free Plan ($0/mo, 15 min included)
- Revenue: $0
- COGS: 15 min x $0.122 = $1.83
- **Margin: -$1.83** (acquisition cost, acceptable)

### Starter Plan ($99/mo, 300 min included)
- Revenue: $99
- COGS (if all minutes used): 300 x $0.122 = $36.60
- **Gross margin: $62.40 (63%)**
- Effective cost per minute to Callengo: $0.33/min
- Overage at $0.60/min: **$0.478 margin per overage minute (80%)**

### Business Plan ($279/mo, 1,200 min included)
- Revenue: $279
- COGS (if all minutes used): 1,200 x $0.122 = $146.40
- **Gross margin: $132.60 (48%)**
- Effective cost per minute to Callengo: $0.232/min
- Overage at $0.35/min: **$0.228 margin per overage minute (65%)**

### Teams Plan ($599/mo, 2,400 min included)
- Revenue: $599
- COGS (if all minutes used): 2,400 x $0.122 = $292.80
- **Gross margin: $306.20 (51%)**
- Effective cost per minute to Callengo: $0.25/min
- Overage at $0.22/min: **$0.098 margin per overage minute (45%)**
- **WARNING: Overage margin is thin**

### Enterprise Plan ($1,500/mo, 6,000 min included)
- Revenue: $1,500
- COGS (if all minutes used): 6,000 x $0.122 = $732.00
- **Gross margin: $768.00 (51%)**
- Effective cost per minute: $0.25/min
- Overage at $0.18/min: **$0.058 margin per overage minute (32%)**
- **WARNING: Overage margin is dangerously thin**

## 3.4 Key Findings

1. **Starter plan has excellent margins (63%)** -- this is the bread-and-butter tier
2. **Business plan margins are acceptable (48%)** but could be higher
3. **Teams/Enterprise overage pricing is too low** -- at $0.22/min and $0.18/min respectively, margins on overage are thin (45% and 32%)
4. **The $0.18/min Enterprise overage is barely profitable** after accounting for per-attempt fees and overhead
5. **Fixed Bland AI cost ($499/mo)** must be distributed across all paying customers

---

# 4. COMPETITIVE LANDSCAPE

## 4.1 Direct Competitors Comparison

### Synthflow AI (Closest Competitor -- No-Code Voice AI)
| Plan | Price/mo | Minutes | Overage | Concurrent | Notes |
|------|----------|---------|---------|------------|-------|
| Starter | $29 | 50 | N/A | 5 | Very limited, lead gen |
| Pro | $375 | 2,000 | $0.13/min | 25 | Team access, workflows |
| Growth | $750 | 4,000 | $0.12/min | 50 | 25 subaccounts |
| Agency | $1,250 | 6,000 | ~$0.12/min | N/A | Full agency features |
| Enterprise | Custom | Custom | Custom | 200+ | Custom |

**Key Differences vs Callengo:**
- Synthflow Pro ($375) for 2,000 min vs Callengo Business ($279) for 1,200 min
- Synthflow has lower overage ($0.12-0.13) vs Callengo ($0.35 Business)
- Synthflow has workflow builder, Callengo does not
- **Callengo advantage**: More CRM integrations, calendar sync, plug-and-play simplicity

### Bland AI Direct (Developer Platform)
| Plan | Price/mo | Per-Min | Concurrent | Notes |
|------|----------|---------|------------|-------|
| Start | Free | $0.14 | 10 | 100 calls/day |
| Build | $299 | $0.12 | 50 | 2,000 calls/day |
| Scale | $499 | $0.11 | 100 | 5,000 calls/day |
| Enterprise | Custom | ~$0.09 | Unlimited | Custom |

**Key Differences vs Callengo:**
- Bland is raw infrastructure -- no UI, no CRM, no calendar, no follow-ups
- Users must build EVERYTHING themselves (prompts, webhooks, analytics, billing)
- **Callengo advantage**: Complete platform, zero development needed, all integrations built-in

### Vapi AI (Developer-Focused)
| Plan | Price/mo | Per-Min | Concurrent | Notes |
|------|----------|---------|------------|-------|
| Ad-Hoc | $0 | $0.05 + providers | 10 SIP lines | Pay-per-use, need own LLM/TTS/Telephony |
| Startup | $999 | Reduced rates | More lines | Packaged minutes |
| Enterprise | Custom | Custom | Unlimited | SOC2, HIPAA |

**Real cost**: $0.13-$0.31/min (all-in with LLM + TTS + telephony)
**Key Differences**: Developer-only, requires coding, no UI, no CRM integrations

### Retell AI (Developer-Focused)
| Plan | Price/mo | Per-Min | Concurrent | Notes |
|------|----------|---------|------------|-------|
| Pay-as-you-go | $0 | $0.07+/min | 20 free | Need to add LLM + Voice costs |
| Enterprise | Custom ($3k+) | $0.05+/min | 50+ | Managed setup |

**Real cost**: $0.13-$0.31/min (all-in)
**Key Differences**: Developer platform, visual flow builder, no CRM native integrations

### Air AI (Premium/Inactive)
- $25,000-$100,000 upfront licensing
- $0.11/min outbound, $0.32/min inbound
- Currently inactive/unreliable (FTC lawsuit Aug 2025)
- **Not a viable competitor**

## 4.2 Competitive Positioning Summary

```
                    DEVELOPER PLATFORMS           NO-CODE PLATFORMS
                    (Build your own)              (Plug & Play)

                    Bland AI    Vapi    Retell    Synthflow    CALLENGO    Air AI
Price/mo (entry)    $0          $0      $0        $29          $99*        $25k+
Price/mo (mid)      $299-499    $999    $3k+      $375-750     $279*       N/A
Per-min (real)      $0.11-0.14  $0.13+  $0.13+    $0.12-0.13   $0.33*      $0.11
CRM Integrations    0           0       0         Few          7+          Some
Calendar Sync       No          No      No        Basic        Full        No
Voicemail/Followup  DIY         DIY     DIY       Basic        Full        Some
Setup Complexity    Very High   High    High      Medium       Very Low    High
```

**Callengo's Position**: The **ONLY** platform that offers 7+ native CRM integrations, full bidirectional calendar sync, voicemail handling, smart follow-ups, AND zero-code setup. The price premium over developer platforms is justified by the **hundreds of hours of development** that users would need to replicate this themselves.

---

# 5. UNIT ECONOMICS & MARGIN ANALYSIS

## 5.1 Target Margin Structure

| Metric | Target | Reasoning |
|--------|--------|-----------|
| **Gross margin on base subscription** | 55-70% | SaaS industry standard |
| **Gross margin on overage minutes** | 50-65% | Must cover Bland + overhead |
| **Minimum overage price** | $0.25/min | Below this, margin is too thin |
| **CAC payback** | < 3 months | Standard for SMB SaaS |
| **Annual discount** | 10-15% | Standard for annual billing |

## 5.2 Revenue Per Minute Analysis

To achieve 60% margin on included minutes:

| Plan | Desired Margin | COGS/min ($0.122) | Target Revenue/min | Min Price at X minutes |
|------|---------------|--------------------|--------------------|----------------------|
| Starter | 60% | $0.122 | $0.305 | 300 min = $91.50 → $99 OK |
| Business | 55% | $0.122 | $0.271 | 1,000 min = $271 → $279 OK |
| Teams | 55% | $0.122 | $0.271 | 2,000 min = $542 → $599 OK |
| Enterprise | 50% | $0.122 | $0.244 | 5,000 min = $1,220 → $1,499 OK |

## 5.3 Overage Pricing Recalibration

Current overage prices vs. recommended:

| Plan | Current Overage | Issue | Recommended | Margin |
|------|----------------|-------|-------------|--------|
| Starter | $0.60/min | Correct -- high premium for lowest tier | **$0.55/min** | 78% |
| Business | $0.35/min | Good but can be slightly higher | **$0.39/min** | 69% |
| Teams | $0.22/min | **TOO LOW** -- only 45% margin | **$0.29/min** | 58% |
| Enterprise | $0.18/min | **DANGEROUS** -- only 32% margin | **$0.25/min** | 51% |

---

# 6. NEW PRICING ARCHITECTURE

## 6.1 Plan Redesign -- 5 Tiers

### FREE TIER -- "Trial"
**Purpose**: Let prospects experience the platform. Conversion tool.
**Price**: $0
**What's included**:
- 15 minutes of AI calling (~5 test calls)
- 1 AI agent (choose from 3 templates)
- 1 user
- 1 concurrent call
- Max 3 min per call
- CSV/Excel import & export
- Google Calendar integration
- Google Sheets import
- Zoom meeting links
- Basic call analytics
- Auto-rotating phone numbers
- Email support only
- **No overage -- must upgrade after 15 minutes**

**What's NOT included**:
- CRM integrations
- Slack notifications
- Webhooks
- Follow-ups
- Voicemail messages
- Team members
- Twilio BYOP

---

### STARTER -- "Solo Operator"
**Purpose**: Solo operators, freelancers, small agencies testing AI calling.
**Price**: **$99/month** ($89/mo annual = $1,068/yr, save 10%)
**What's included**:
- **300 minutes** (~100-150 calls)
- 1 AI agent (all 3 templates available)
- 1 user
- 1 concurrent call
- Max 3 min per call
- Everything in Free PLUS:
  - Voicemail detection
  - 1 automatic follow-up per contact
  - Webhooks (Zapier, Make, n8n compatible)
  - Slack notifications
  - SimplyBook.me integration
  - Google Calendar + Meet
  - Google Sheets import
  - Zoom meeting links
  - Transcript downloads
  - Auto-rotating phone numbers
  - Email support (48h response)
- **Overage: $0.55/min** (opt-in, with budget cap)

**What's NOT included**:
- CRM integrations (HubSpot, Salesforce, etc.)
- Multiple agents
- Team members
- Microsoft 365/Outlook
- Twilio BYOP
- Unlimited follow-ups
- Custom voicemail messages

---

### BUSINESS -- "Growth Engine"
**Purpose**: Growing businesses running AI calling as part of their sales/operations pipeline.
**Price**: **$299/month** ($259/mo annual = $3,108/yr, save 13%)
**What's included**:
- **1,200 minutes** (~300-400 calls)
- **Unlimited AI agents** (all templates + custom config)
- **3 users** (Owner + 2 team members)
- **3 concurrent calls**
- Max 5 min per call
- Everything in Starter PLUS:
  - **Unlimited automatic follow-ups**
  - **Smart follow-up scheduling** (AI-optimized timing)
  - **Custom voicemail messages** per agent
  - **Campaign management** (create, schedule, track)
  - Microsoft 365 Outlook calendar sync
  - Microsoft Teams meeting links
  - HubSpot CRM integration
  - Pipedrive CRM integration
  - Zoho CRM integration
  - Twilio BYOP (bring your own phone numbers)
  - Advanced call scheduling (working hours, timezone)
  - Priority email support (24h response)
- **Overage: $0.39/min** (opt-in, with budget cap)

**What's NOT included**:
- Salesforce
- Microsoft Dynamics 365
- Clio (legal CRM)
- User permissions/roles
- Campaign analytics
- Custom dialing pools
- 5+ users (need Teams plan)

---

### TEAMS -- "Scale Machine"
**Purpose**: Teams that need collaboration, governance, and enterprise CRM integrations.
**Price**: **$649/month** ($559/mo annual = $6,708/yr, save 14%)
**What's included**:
- **2,500 minutes** (~500-700 calls)
- Unlimited AI agents
- **5 users included** (additional users: $69/seat/mo)
- **10 concurrent calls**
- Max 8 min per call
- Everything in Business PLUS:
  - **Salesforce CRM integration**
  - **Microsoft Dynamics 365 integration**
  - **Clio integration** (legal practice management)
  - User roles & permissions (Owner, Admin, Member)
  - Campaign analytics & reporting
  - Agent performance tracking
  - No-show auto-retry
  - Advanced retry logic (configurable attempts & intervals)
  - Callback scheduling from call outcomes
  - Custom dialing pools
  - Priority support (12h response, email + chat)
- **Overage: $0.29/min** (opt-in, with budget cap)

---

### ENTERPRISE -- "Full Control"
**Purpose**: Large organizations with high volume, compliance needs, and custom requirements.
**Price**: **$1,499/month** ($1,299/mo annual = $15,588/yr, save 13%)
**What's included**:
- **6,000 minutes** (~1,500-2,000 calls, custom volume available)
- Unlimited AI agents
- **Unlimited users**
- **25+ concurrent calls** (configurable)
- Max 15 min per call (configurable)
- Everything in Teams PLUS:
  - All CRM integrations included
  - All calendar integrations included
  - Custom agent configurations
  - Dedicated account manager
  - SLA guarantee (99.5% uptime)
  - Annual contract option with custom terms
  - Onboarding & training session
  - Priority support (4h response, dedicated channel)
  - Custom webhook events
  - Geospatial dialing (coming Q2 2026)
  - SIP integration (coming Q3 2026)
- **Overage: $0.25/min** (opt-in, with budget cap)

---

## 6.2 Pricing Comparison Table (New vs Current)

| Attribute | Free | Starter | Business | Teams | Enterprise |
|-----------|------|---------|----------|-------|------------|
| **NEW Price/mo** | $0 | $99 | $299 | $649 | $1,499 |
| **OLD Price/mo** | $0 | $99 | $279 | $599 | $1,500 |
| **Change** | -- | Same | +$20 | +$50 | -$1 |
| **NEW Minutes** | 15 | 300 | 1,200 | 2,500 | 6,000 |
| **OLD Minutes** | 15 | 300 | 1,200 | 2,400 | 6,000 |
| **NEW Overage** | N/A | $0.55 | $0.39 | $0.29 | $0.25 |
| **OLD Overage** | N/A | $0.60 | $0.35 | $0.22 | $0.18 |
| **NEW Annual** | $0 | $89/mo | $259/mo | $559/mo | $1,299/mo |
| **OLD Annual** | $0 | $89/mo | $249/mo | $529/mo | $1,350/mo |

**Key Changes:**
- Business: +$20/mo (justified by added value clarity)
- Teams: +$50/mo, +100 min, and **overage UP from $0.22 to $0.29** (critical margin fix)
- Enterprise: Essentially same price, **overage UP from $0.18 to $0.25** (prevents revenue leakage)
- All overage prices adjusted to maintain minimum 50% margin

---

## 6.3 Pricing Justification

### Why $99 for Starter?
- **300 minutes at $0.33/min effective rate** vs doing it yourself on Bland at $0.11-0.14/min
- But on Bland, you need to: build a UI, write API code, handle webhooks, build contact management, analytics, billing system, calendar integration, etc.
- A freelance developer would charge **$10,000-50,000** to build what Callengo provides
- $99/mo = **$3.30/day** for a complete AI calling solution
- Cheaper than hiring even a part-time VA ($500+/mo)

### Why $299 for Business?
- 1,200 minutes at $0.249/min effective rate
- Synthflow's comparable tier (Pro) is $375/mo for 2,000 min but with fewer CRM integrations
- Includes 3 users, unlimited agents, full CRM suite
- The HubSpot/Pipedrive/Zoho integrations alone would cost $500+/mo to build custom
- **An SDR costs $4,000-6,000/mo**. Callengo replaces the first 300-400 calls/mo for $299

### Why $649 for Teams?
- Current $599 was slightly underpriced given Salesforce/Dynamics access
- These enterprise CRM integrations are high-value: Salesforce alone costs $150+/user/mo
- 5 users included with $69/extra (down from $79 -- more competitive)
- 2,500 minutes (up from 2,400) -- small gesture, significant perception
- **Overage at $0.29/min** (up from $0.22) fixes the margin problem

### Why $1,499 for Enterprise?
- Market price for enterprise AI voice solutions: $1,000-5,000/mo
- Synthflow Agency: $1,250/mo for 6,000 min with fewer integrations
- Air AI: $25,000+ upfront
- Vapi Startup: $999/mo with NO CRM integrations, NO calendar, requires development
- **$1,499/mo with 6,000 min, unlimited users, all integrations = excellent value**
- Overage at $0.25/min ensures profitability at scale

---

# 7. FEATURE GATING MATRIX

## 7.1 Complete Feature Access Table

| Feature | Free | Starter | Business | Teams | Enterprise |
|---------|------|---------|----------|-------|------------|
| **CALLING** | | | | | |
| AI voice calls | 15 min | 300 min | 1,200 min | 2,500 min | 6,000 min |
| Max call duration | 3 min | 3 min | 5 min | 8 min | 15 min |
| Concurrent calls | 1 | 1 | 3 | 10 | 25+ |
| Auto-rotating numbers | Yes | Yes | Yes | Yes | Yes |
| Voicemail detection | Yes | Yes | Yes | Yes | Yes |
| Custom voicemail messages | No | No | Yes | Yes | Yes |
| Overage (opt-in) | No | $0.55/min | $0.39/min | $0.29/min | $0.25/min |
| | | | | | |
| **AGENTS** | | | | | |
| Agent templates (3) | All | All | All | All | All |
| Active agents | 1 | 1 | Unlimited | Unlimited | Unlimited |
| Custom agent prompts | Yes | Yes | Yes | Yes | Yes |
| Voice selection | Yes | Yes | Yes | Yes | Yes |
| | | | | | |
| **FOLLOW-UPS** | | | | | |
| Auto follow-ups | No | 1 per contact | Unlimited | Unlimited | Unlimited |
| Smart follow-up timing | No | No | Yes | Yes | Yes |
| Callback scheduling | No | No | Yes | Yes | Yes |
| No-show auto-retry | No | No | No | Yes | Yes |
| Advanced retry logic | No | No | No | Yes | Yes |
| | | | | | |
| **CAMPAIGNS** | | | | | |
| Campaign creation | No | No | Yes | Yes | Yes |
| Campaign scheduling | No | No | Yes | Yes | Yes |
| Campaign analytics | No | No | Basic | Advanced | Advanced |
| Agent performance tracking | No | No | No | Yes | Yes |
| | | | | | |
| **CONTACTS** | | | | | |
| Contact management | Yes | Yes | Yes | Yes | Yes |
| CSV/Excel import | Yes | Yes | Yes | Yes | Yes |
| JSON import/export | Yes | Yes | Yes | Yes | Yes |
| Google Sheets import | Yes | Yes | Yes | Yes | Yes |
| Contact lists & tags | Yes | Yes | Yes | Yes | Yes |
| Custom fields | Yes | Yes | Yes | Yes | Yes |
| Phone normalization | Yes | Yes | Yes | Yes | Yes |
| Deduplication | Yes | Yes | Yes | Yes | Yes |
| AI contact segmentation | No | No | Yes | Yes | Yes |
| | | | | | |
| **CALENDAR** | | | | | |
| Google Calendar sync | Yes | Yes | Yes | Yes | Yes |
| Google Meet links | Yes | Yes | Yes | Yes | Yes |
| Zoom meeting links | Yes | Yes | Yes | Yes | Yes |
| Microsoft Outlook sync | No | No | Yes | Yes | Yes |
| Microsoft Teams links | No | No | Yes | Yes | Yes |
| Working hours config | No | Yes | Yes | Yes | Yes |
| Meeting duration config | No | No | Yes | Yes | Yes |
| | | | | | |
| **CRM INTEGRATIONS** | | | | | |
| SimplyBook.me | No | Yes | Yes | Yes | Yes |
| HubSpot | No | No | Yes | Yes | Yes |
| Pipedrive | No | No | Yes | Yes | Yes |
| Zoho CRM | No | No | Yes | Yes | Yes |
| Salesforce | No | No | No | Yes | Yes |
| Microsoft Dynamics 365 | No | No | No | Yes | Yes |
| Clio (legal) | No | No | No | Yes | Yes |
| | | | | | |
| **COMMUNICATION** | | | | | |
| Slack notifications | No | Yes | Yes | Yes | Yes |
| Webhooks (Zapier/Make/n8n) | No | Yes | Yes | Yes | Yes |
| Twilio BYOP | No | No | Yes | Yes | Yes |
| Custom dialing pools | No | No | No | Yes | Yes |
| | | | | | |
| **ANALYTICS** | | | | | |
| Call logs & recordings | Yes | Yes | Yes | Yes | Yes |
| Transcripts | Yes | Yes | Yes | Yes | Yes |
| Usage dashboard | Yes | Yes | Yes | Yes | Yes |
| Billing alerts | Yes | Yes | Yes | Yes | Yes |
| AI call analysis | No | No | Yes | Yes | Yes |
| Campaign reports | No | No | Basic | Advanced | Advanced |
| Export reports | No | Yes | Yes | Yes | Yes |
| | | | | | |
| **TEAM** | | | | | |
| Users included | 1 | 1 | 3 | 5 | Unlimited |
| Extra user price | N/A | N/A | N/A | $69/mo | N/A |
| User roles & permissions | No | No | No | Yes | Yes |
| Team invitations | No | No | Yes | Yes | Yes |
| | | | | | |
| **AI FEATURES** | | | | | |
| AI Chat Assistant | Yes | Yes | Yes | Yes | Yes |
| AI Agent Recommendations | Yes | Yes | Yes | Yes | Yes |
| AI Call Analysis | No | No | Yes | Yes | Yes |
| AI Contact Segmentation | No | No | Yes | Yes | Yes |
| | | | | | |
| **SUPPORT** | | | | | |
| Email support | Yes (72h) | Yes (48h) | Priority (24h) | Priority (12h) | Dedicated (4h) |
| Chat support | No | No | No | Yes | Yes |
| Dedicated account mgr | No | No | No | No | Yes |
| Onboarding session | No | No | No | No | Yes |
| SLA guarantee | No | No | No | No | Yes (99.5%) |

---

# 8. INTEGRATION ACCESS BY TIER

## 8.1 Integration Availability Matrix

| Integration | Free | Starter | Business | Teams | Enterprise |
|-------------|------|---------|----------|-------|------------|
| **Calendar** | | | | | |
| Google Calendar | Yes | Yes | Yes | Yes | Yes |
| Google Meet | Yes | Yes | Yes | Yes | Yes |
| Zoom | Yes | Yes | Yes | Yes | Yes |
| Microsoft Outlook | -- | -- | Yes | Yes | Yes |
| Microsoft Teams | -- | -- | Yes | Yes | Yes |
| **CRM** | | | | | |
| SimplyBook.me | -- | Yes | Yes | Yes | Yes |
| HubSpot | -- | -- | Yes | Yes | Yes |
| Pipedrive | -- | -- | Yes | Yes | Yes |
| Zoho CRM | -- | -- | Yes | Yes | Yes |
| Salesforce | -- | -- | -- | Yes | Yes |
| Dynamics 365 | -- | -- | -- | Yes | Yes |
| Clio | -- | -- | -- | Yes | Yes |
| **Data** | | | | | |
| Google Sheets | Yes | Yes | Yes | Yes | Yes |
| CSV/Excel | Yes | Yes | Yes | Yes | Yes |
| JSON | Yes | Yes | Yes | Yes | Yes |
| **Communication** | | | | | |
| Slack | -- | Yes | Yes | Yes | Yes |
| Webhooks | -- | Yes | Yes | Yes | Yes |
| **Phone** | | | | | |
| Auto-rotating pool | Yes | Yes | Yes | Yes | Yes |
| Twilio BYOP | -- | -- | Yes | Yes | Yes |
| Custom dialing pools | -- | -- | -- | Yes | Yes |

## 8.2 Integration Gating Logic

The integration gating is already partially implemented in the frontend via `planSlug` prop passed to `IntegrationsPage`. Here's the recommended enforcement:

```
Free: google_calendar, zoom, google_sheets, csv, json
Starter: + slack, webhooks, simplybook
Business: + hubspot, pipedrive, zoho, outlook, teams, twilio
Teams: + salesforce, dynamics, clio, custom_dialing
Enterprise: + all, sip (future), geospatial (future)
```

---

# 9. REVENUE MAXIMIZATION STRATEGY

## 9.1 Revenue Model

Callengo's revenue comes from 4 streams:

1. **Base subscription** (predictable, recurring)
2. **Overage minutes** (usage-based, high-margin)
3. **Extra seats** (Teams plan, $69/seat/mo)
4. **Annual discounts** (lower monthly rate but guaranteed retention)

## 9.2 Optimization Levers

### Lever 1: Overage Pricing (Fixed Now)
| Plan | Old Overage | New Overage | Margin Improvement |
|------|-------------|-------------|-------------------|
| Starter | $0.60 | $0.55 | -8% (slightly lower to encourage usage) |
| Business | $0.35 | $0.39 | +11% |
| Teams | $0.22 | $0.29 | +32% |
| Enterprise | $0.18 | $0.25 | +39% |

**Impact**: If a Teams customer uses 500 overage min/mo:
- Old: 500 x $0.22 = $110 revenue, $61 cost = $49 profit
- New: 500 x $0.29 = $145 revenue, $61 cost = $84 profit
- **+71% profit improvement per overage minute**

### Lever 2: Extra Seat Pricing (Teams)
- Reduced from $79 to $69/seat to increase adoption
- At $69/seat/mo, still 100% margin (no additional Bland cost per seat)
- Encourages Teams plan customers to add more users
- Revenue per extra seat: $69/mo = $828/yr pure profit

### Lever 3: Annual Billing Incentive
| Plan | Monthly | Annual (per mo) | Discount | Revenue Lock |
|------|---------|-----------------|----------|--------------|
| Starter | $99 | $89 | 10% | $1,068 upfront |
| Business | $299 | $259 | 13% | $3,108 upfront |
| Teams | $649 | $559 | 14% | $6,708 upfront |
| Enterprise | $1,499 | $1,299 | 13% | $15,588 upfront |

**Strategy**: Offer 10-14% annual discount (industry standard). The upfront cash flow and retention benefit far outweigh the discount.

### Lever 4: Upgrade Path Friction Removal
- Free → Starter: **"Your 15 minutes are up. Upgrade for $99/mo to keep calling."**
- Starter → Business: **"You've hit your 300 min limit. Upgrade for unlimited agents + CRM integrations."**
- Business → Teams: **"Need Salesforce? Need 10 concurrent calls? Upgrade to Teams."**
- Each upgrade should feel natural and justified by a clear feature unlock.

## 9.3 Revenue Projections (Per 100 Customers)

### Scenario: Conservative Mix

| Plan | Customers | Monthly Revenue | Annual Revenue |
|------|-----------|-----------------|----------------|
| Free | 40 | $0 | $0 |
| Starter | 30 | $2,970 | $35,640 |
| Business | 18 | $5,382 | $64,584 |
| Teams | 8 | $5,192 | $62,304 |
| Enterprise | 4 | $5,996 | $71,952 |
| **Subtotal (base)** | **100** | **$19,540** | **$234,480** |
| Overage (est 20% of base) | -- | $3,908 | $46,896 |
| Extra seats (est 5 at $69) | -- | $345 | $4,140 |
| **Total** | **100** | **$23,793** | **$285,516** |

### Cost Structure (Per 100 Customers)

| Cost | Monthly | Notes |
|------|---------|-------|
| Bland AI Scale plan | $499 | Fixed |
| Bland AI minutes (est 15,000 min) | $1,650 | 15,000 x $0.11 |
| Bland AI per-attempt fees | $300 | ~20,000 attempts x $0.015 |
| OpenAI API | $150 | Call analysis, AI chat |
| Supabase | $50 | Pro plan |
| Hosting | $50 | Vercel |
| **Total COGS** | **$2,699** | |
| **Gross Margin** | **$21,094 (89%)** | |

**Note**: At 100 customers, the per-customer infrastructure cost is minimal because Bland's fixed costs ($499/mo) are amortized across all customers. The per-minute variable cost ($0.11) is the dominant factor.

---

# 10. RECOMMENDATIONS & GAP ANALYSIS

## 10.1 What's Working Well

1. **CRM integration breadth** -- 7 CRM integrations is industry-leading for a no-code platform
2. **Calendar sync** -- Bidirectional Google/Outlook sync with meeting link generation is excellent
3. **Voicemail handling** -- Complete pipeline (detect → leave message → log → schedule follow-up)
4. **Usage tracking** -- Robust minute metering with Stripe metered billing
5. **Overage system** -- Budget caps and alerts prevent bill shock
6. **Agent templates** -- 3 well-designed templates cover 80% of use cases
7. **Webhook system** -- Proper HMAC-signed delivery with retry tracking

## 10.2 What Needs Fixing

### HIGH PRIORITY

1. **Remove fake features from plan descriptions**
   - Remove "Governance & audit logs" (not built as a feature)
   - Remove "Compliance & audit logs" (no compliance dashboard)
   - Remove "REST API access" (no public API exists)
   - Remove "Custom workflows" (misleading -- it's just agent configuration)
   - Remove "Priority infrastructure" (everyone shares the same Bland infra)
   - Remove "Roadmap influence" (not a feature)

2. **Fix overage pricing on Teams/Enterprise** (margin protection)
   - Teams: $0.22 → $0.29/min
   - Enterprise: $0.18 → $0.25/min

3. **Enforce integration gating in backend**
   - Currently, the frontend shows/hides integrations based on `planSlug`
   - But the API endpoints don't check plan tier -- a Free user could potentially call `/api/integrations/salesforce/connect`
   - Need server-side middleware that validates plan tier before allowing OAuth flows

### MEDIUM PRIORITY

4. **Add campaign feature gating**
   - Campaigns should be Business+ only (currently no enforcement)
   - Free/Starter users should use single-contact calling only

5. **Implement concurrent call enforcement**
   - The database stores `max_concurrent_calls` per plan
   - But there's no server-side check counting active calls before allowing new ones
   - Need: Before `/api/bland/send-call`, count active calls for company, reject if at limit

6. **Add max call duration enforcement**
   - `max_call_duration` is stored per plan (3, 3, 5, 8, 15 min)
   - This should be passed to Bland AI's `max_duration` parameter in every call
   - Currently, the frontend sends `max_duration` from the request body -- need server-side override based on plan

7. **Follow-up limits enforcement**
   - Starter: 1 follow-up per contact (need to count existing follow-ups before creating new ones)
   - Free: No follow-ups (block auto_create_followup trigger for free plans)

### LOW PRIORITY (FUTURE)

8. **Public API** -- Build a proper REST API for Enterprise customers
9. **Geospatial dialing** -- Route calls through local area codes (planned)
10. **SIP integration** -- Allow enterprise customers to connect their own telephony (planned)
11. **WhatsApp/SMS follow-ups** -- Multi-channel follow-ups after calls
12. **Inbound call handling** -- Currently outbound-only; inbound would open new market
13. **A/B testing for agent scripts** -- Test different prompts to optimize conversion

## 10.3 Competitive Gaps to Address

| Gap | Competitors That Have It | Priority | Difficulty |
|-----|------------------------|----------|------------|
| Visual workflow builder | Synthflow, Retell | Medium | High |
| Inbound call handling | Bland AI, Synthflow, Retell | High | Medium |
| Multi-language support | Synthflow (31+ languages) | Medium | Low (Bland supports it) |
| White-label / sub-accounts | Synthflow (Agency plan) | Low | High |
| Knowledge base / RAG | Vapi, Retell | Medium | Medium |
| SMS follow-ups | Several competitors | High | Medium |
| Batch call launch UI | Retell | Medium | Low |
| Call transfer to human | Bland supports it, not in Callengo UI | High | Low |
| HIPAA compliance | Retell, Vapi | Low | High |
| Real-time call monitoring | Some competitors | Medium | Medium |

## 10.4 Quick Wins (High Impact, Low Effort)

1. **Multi-language support** -- Bland AI already supports multiple languages. Just add a language selector to the agent config UI. This opens the LATAM, Europe, and Asia markets.

2. **Call transfer to human** -- Bland AI supports warm transfer. Add a toggle in agent settings: "Transfer to human if lead is qualified." This is a MASSIVE value-add for sales teams.

3. **SMS follow-up** -- After a no-answer call, send an SMS via Bland ($0.02/msg). "Hi, we tried to reach you. Please call back at [number]." This dramatically improves contact rates.

4. **Batch call UI** -- Let users select 50-100 contacts and launch calls immediately (not just through campaigns). Quick-action for ad-hoc calling.

## 10.5 Bland AI Infrastructure Assessment

### Is the Current Architecture Scalable?

**YES, with caveats:**

1. **Bland's Scale plan supports 100 concurrent calls** -- sufficient for ~50-100 active customers
2. **At 200+ customers**, you'll need Enterprise or multiple API keys
3. **Single API key bottleneck** -- All customers share one Bland API key. If one customer triggers rate limits, all are affected
4. **Recommendation**: Move to Bland Enterprise when reaching 100+ active customers

### Scaling Milestones

| Customers | Bland Plan Needed | Monthly Bland Cost | Notes |
|-----------|-------------------|-------------------|-------|
| 1-50 | Scale ($499) | $499 + $0.11/min | Current setup works |
| 50-200 | Enterprise (custom) | ~$800-2,000 + ~$0.09/min | Need to negotiate |
| 200-500 | Enterprise + dedicated | ~$2,000-5,000 + ~$0.08/min | Volume discounts kick in |
| 500+ | Enterprise premium | Custom | Direct partnership level |

### Risk Mitigation
- **Bland AI downtime**: No fallback. If Bland is down, Callengo is down. Consider secondary provider (Retell/Vapi) for failover.
- **Price increases**: Bland changed pricing in Dec 2025. Lock in enterprise rates with annual contract.
- **API key rotation**: Implement per-company API key management if Bland supports it. Currently, all calls use one key.

---

# 11. IMPLEMENTATION ROADMAP

## Phase 1: Pricing & Feature Cleanup (Week 1-2)

- [ ] Update `subscription_plans` table with new prices
- [ ] Update `plan-features.ts` with honest feature lists
- [ ] Remove misleading features from plan descriptions
- [ ] Update Stripe products and prices via sync script
- [ ] Update `BillingSettings.tsx` to reflect new plan cards
- [ ] Adjust overage prices (Teams: $0.29, Enterprise: $0.25)
- [ ] Update extra seat price to $69 (from $79)

## Phase 2: Backend Enforcement (Week 2-3)

- [ ] Add plan-tier middleware for integration API routes
- [ ] Implement concurrent call limit checking before send-call
- [ ] Server-side override of max_call_duration based on plan
- [ ] Follow-up limit enforcement for Starter plan
- [ ] Campaign access gating (Business+ only)

## Phase 3: Quick Wins (Week 3-4)

- [ ] Multi-language selector in agent config
- [ ] Call transfer toggle in agent settings
- [ ] SMS follow-up option (via Bland)
- [ ] Batch call UI for ad-hoc calling

## Phase 4: Growth Features (Month 2-3)

- [ ] Inbound call handling
- [ ] Knowledge base / RAG for agents
- [ ] Real-time call monitoring dashboard
- [ ] Advanced reporting / custom dashboards

---

# APPENDIX A: PRICE COMPARISON QUICK REFERENCE

| Feature | Callengo | Synthflow | Bland AI (DIY) | Vapi (DIY) | Retell (DIY) |
|---------|----------|-----------|----------------|------------|---------------|
| **Entry price** | $99/mo | $29/mo | Free | Free | Free |
| **Mid-tier price** | $299/mo | $375/mo | $299/mo | $999/mo | $3,000+/mo |
| **Effective $/min** | $0.25-0.33 | $0.12-0.19 | $0.11-0.14 | $0.13-0.31 | $0.13-0.31 |
| **Setup required** | None | Low | Very High | Very High | High |
| **CRM integrations** | 7 native | 2-3 | 0 (DIY) | 0 (DIY) | 0 (DIY) |
| **Calendar sync** | Full | Basic | 0 (DIY) | 0 (DIY) | 0 (DIY) |
| **Follow-ups** | Built-in | Basic | 0 (DIY) | 0 (DIY) | 0 (DIY) |
| **Voicemail** | Built-in | Basic | Basic | 0 (DIY) | Basic |
| **Team mgmt** | Built-in | Basic | 0 (DIY) | 0 (DIY) | 0 (DIY) |

**Callengo's premium over raw infrastructure is justified by the complete, ready-to-use platform. The "DIY tax" (building all features yourself) would cost $50,000-200,000 in development and 3-6 months of engineering time.**

---

# APPENDIX B: COMPLETE DATABASE CHANGES NEEDED

```sql
-- Update subscription_plans with new pricing
UPDATE subscription_plans SET
  price_monthly = 99,
  price_annual = 1068,
  minutes_included = 300,
  max_call_duration = 3,
  price_per_extra_minute = 0.55,
  max_users = 1,
  max_agents = 1,
  max_concurrent_calls = 1,
  max_seats = 1,
  extra_seat_price = NULL
WHERE slug = 'starter';

UPDATE subscription_plans SET
  price_monthly = 299,
  price_annual = 3108,
  minutes_included = 1200,
  max_call_duration = 5,
  price_per_extra_minute = 0.39,
  max_users = 3,
  max_agents = -1,
  max_concurrent_calls = 3,
  max_seats = 3,
  extra_seat_price = NULL
WHERE slug = 'business';

UPDATE subscription_plans SET
  price_monthly = 649,
  price_annual = 6708,
  minutes_included = 2500,
  max_call_duration = 8,
  price_per_extra_minute = 0.29,
  max_users = 5,
  max_agents = -1,
  max_concurrent_calls = 10,
  max_seats = 5,
  extra_seat_price = 69
WHERE slug = 'teams';

UPDATE subscription_plans SET
  price_monthly = 1499,
  price_annual = 15588,
  minutes_included = 6000,
  max_call_duration = 15,
  price_per_extra_minute = 0.25,
  max_users = -1,
  max_agents = -1,
  max_concurrent_calls = 25,
  max_seats = -1,
  extra_seat_price = NULL
WHERE slug = 'enterprise';
```

---

# APPENDIX C: UPDATED PLAN FEATURES (for plan-features.ts)

```typescript
export const PLAN_SPECIFIC_FEATURES: Record<string, string[]> = {
  free: [
    '15 minutes of AI calling (trial)',
    '1 active agent',
    '1 user',
    '1 concurrent call',
    'Max 3 min per call',
    'CSV/Excel/JSON import & export',
    'Google Calendar + Meet',
    'Zoom meeting links',
    'Google Sheets import',
    'Basic call analytics',
    'Auto-rotating phone numbers',
    'Email support',
    'No overage — upgrade required after trial',
  ],

  starter: [
    '300 minutes/month (~100-150 calls)',
    '1 active agent',
    '1 user',
    '1 concurrent call',
    'Max 3 min per call',
    'Voicemail detection',
    '1 automatic follow-up per contact',
    'Webhooks (Zapier, Make, n8n)',
    'Slack notifications',
    'SimplyBook.me integration',
    'Google Calendar + Meet',
    'Zoom meeting links',
    'Google Sheets import',
    'Transcript downloads',
    'Auto-rotating phone numbers',
    'Email support (48h)',
    '$0.55/min overage (opt-in)',
  ],

  business: [
    '1,200 minutes/month (~300-400 calls)',
    'Unlimited AI agents',
    '3 users included',
    '3 concurrent calls',
    'Max 5 min per call',
    'Unlimited automatic follow-ups',
    'Smart follow-up scheduling',
    'Custom voicemail messages',
    'Campaign management',
    'Microsoft 365 Outlook + Teams',
    'HubSpot CRM integration',
    'Pipedrive CRM integration',
    'Zoho CRM integration',
    'Twilio BYOP',
    'AI call analysis',
    'Advanced call scheduling',
    'Priority email support (24h)',
    '$0.39/min overage (opt-in)',
  ],

  teams: [
    '2,500 minutes/month (~500-700 calls)',
    'Unlimited AI agents',
    '5 users included ($69/extra)',
    '10 concurrent calls',
    'Max 8 min per call',
    'Salesforce CRM integration',
    'Microsoft Dynamics 365',
    'Clio (legal practice management)',
    'User roles & permissions',
    'Campaign analytics & reporting',
    'Agent performance tracking',
    'No-show auto-retry',
    'Advanced retry logic',
    'Custom dialing pools',
    'Priority support (12h, email + chat)',
    '$0.29/min overage (opt-in)',
  ],

  enterprise: [
    '6,000 minutes/month (custom available)',
    'Unlimited AI agents & users',
    '25+ concurrent calls',
    'Max 15 min per call (configurable)',
    'All CRM integrations included',
    'All calendar integrations',
    'Custom agent configurations',
    'Dedicated account manager',
    'SLA guarantee (99.5% uptime)',
    'Annual contract option',
    'Onboarding & training session',
    'Dedicated support (4h response)',
    'Custom webhook events',
    '$0.25/min overage (opt-in)',
  ],
};
```

---

# APPENDIX D: UPDATED PLAN FEATURE DESCRIPTIONS (for migration SQL)

```sql
-- Free Plan
UPDATE subscription_plans SET
  description = 'Test AI calling workflows risk-free',
  features = '[
    "15 free minutes (~5 test calls)",
    "Max 3 min per call",
    "1 concurrent call",
    "1 user, 1 agent",
    "CSV/Excel/JSON import & export",
    "Google Calendar + Meet + Zoom",
    "Google Sheets import",
    "Basic call analytics",
    "Auto-rotating phone numbers",
    "Email support",
    "No overage — upgrade to continue"
  ]'::jsonb
WHERE slug = 'free';

-- Starter Plan
UPDATE subscription_plans SET
  description = 'For solo operators getting started with AI calling',
  features = '[
    "300 minutes/month (~100-150 calls)",
    "Max 3 min per call",
    "1 concurrent call",
    "1 user, 1 agent",
    "Voicemail detection",
    "1 follow-up per contact",
    "Webhooks (Zapier, Make, n8n)",
    "Slack notifications",
    "SimplyBook.me integration",
    "Google Calendar + Meet + Zoom",
    "Google Sheets import",
    "Transcript downloads",
    "Auto-rotating phone numbers",
    "$0.55/min overage (opt-in)"
  ]'::jsonb
WHERE slug = 'starter';

-- Business Plan
UPDATE subscription_plans SET
  description = 'Run AI calling as part of your sales and operations',
  features = '[
    "1,200 minutes/month (~300-400 calls)",
    "Max 5 min per call",
    "3 concurrent calls",
    "3 users, unlimited agents",
    "Unlimited follow-ups + smart scheduling",
    "Custom voicemail messages",
    "Campaign management",
    "Outlook + Teams calendar sync",
    "HubSpot, Pipedrive, Zoho CRM",
    "Twilio BYOP",
    "AI call analysis",
    "Priority email support (24h)",
    "$0.39/min overage (opt-in)"
  ]'::jsonb
WHERE slug = 'business';

-- Teams Plan
UPDATE subscription_plans SET
  description = 'Scale AI calling across your team with enterprise CRMs',
  features = '[
    "2,500 minutes/month (~500-700 calls)",
    "Max 8 min per call",
    "10 concurrent calls",
    "5 users ($69/extra), unlimited agents",
    "Salesforce, Dynamics 365, Clio CRM",
    "User roles & permissions",
    "Campaign analytics & reporting",
    "Agent performance tracking",
    "No-show auto-retry + advanced retry logic",
    "Custom dialing pools",
    "Priority support (12h, email + chat)",
    "$0.29/min overage (opt-in)"
  ]'::jsonb
WHERE slug = 'teams';

-- Enterprise Plan
UPDATE subscription_plans SET
  description = 'Full-scale AI calling with dedicated support and custom terms',
  features = '[
    "6,000 minutes/month (custom available)",
    "Max 15 min per call (configurable)",
    "25+ concurrent calls",
    "Unlimited users & agents",
    "All CRM integrations included",
    "All calendar integrations",
    "Dedicated account manager",
    "SLA guarantee (99.5% uptime)",
    "Annual contract option",
    "Onboarding & training session",
    "Dedicated support (4h response)",
    "$0.25/min overage (opt-in)"
  ]'::jsonb
WHERE slug = 'enterprise';
```

---

**END OF DOCUMENT**

*This document represents the definitive pricing and business model analysis for Callengo. All prices, features, and recommendations are based on real codebase analysis, real infrastructure costs, and real competitive data as of March 2026.*
