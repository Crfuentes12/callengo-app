---
tags: [overview, icp, positioning, market, strategy]
aliases: [Market Positioning, Ideal Customer]
---

# ICP & Positioning

This document defines Callengo's ideal customer profile, buyer personas, competitive positioning, and go-to-market strategy. Understanding who the platform is built for is essential for making product decisions about features, integrations, and pricing.

---

## Ideal Customer Profile

Callengo targets three primary customer segments, each aligned to one of the three core [[Agent]] types. The common thread across all segments is organizations that make high-volume outbound calls for repetitive, structured conversations where human creativity adds little value but human cost is high.

### Segment 1: B2B Sales Teams (→ Lead Qualification Agent)

Mid-market companies with 10-200 employees that have dedicated sales development representative (SDR) teams. These organizations generate leads through marketing (inbound) or purchased lists (outbound) and need to qualify them before passing to account executives. The manual qualification process is slow, inconsistent, and expensive — an SDR costs $50K-$80K/year and can make 40-60 calls per day.

**Profile:**
- **Company size:** 10-200 employees
- **Revenue:** $2M-$50M ARR
- **Sales team size:** 3-20 SDRs
- **Call volume:** 200-5,000+ calls/month
- **CRM:** [[HubSpot]], [[Salesforce]], [[Pipedrive]]
- **Pain points:** Manual qualification is slow, inconsistent; SDRs churn; lead follow-up falls through cracks
- **Value proposition:** Qualify 10x more leads at 1/10th the cost with consistent BANT scoring

### Segment 2: Appointment-Based Businesses (→ Appointment Confirmation Agent)

Service-based businesses where no-shows directly impact revenue. Legal firms lose billable hours, healthcare practices lose consultation fees, dental offices lose chair time, and real estate agents lose showing opportunities. A single no-show can cost $100-$500+ in lost revenue, and the cost of a confirmation call is $2-5 with Callengo versus $10-20 manually.

**Profile:**
- **Industries:** Legal (→ [[Clio]] integration), healthcare, dental, real estate, consulting, fitness
- **Company size:** 5-100 employees
- **Appointment volume:** 50-500+ per month
- **Calendar:** [[Google Calendar]], [[Microsoft Outlook]], [[SimplyBook]]
- **Pain points:** No-shows cost money; manual confirmation is tedious; rescheduling is chaotic
- **Value proposition:** Reduce no-shows by 50-70%; automate 24-48h confirmation calls; sync directly to calendar

### Segment 3: Operations & Data Teams (→ Data Validation Agent)

Organizations with large contact databases (10K-100K+ records) where data quality directly impacts sales, marketing, and operations effectiveness. Bad data wastes sales effort, inflates marketing spend, and causes compliance issues. Manual data verification is impossibly tedious at scale.

**Profile:**
- **Company size:** 20-500 employees
- **Database size:** 10K-100K+ contacts
- **CRM:** [[Salesforce]], [[HubSpot]], [[Zoho]], [[Dynamics 365]]
- **Pain points:** Stale CRM data, wrong phone numbers, outdated job titles, bouncing emails
- **Value proposition:** Verify and update thousands of records automatically; clean data improves all downstream operations

---

## Buyer Personas

### VP of Sales / CRO

The primary decision maker for Lead Qualification use cases. Cares about pipeline velocity, conversion rates, and cost per qualified lead. Evaluates Callengo based on ROI: can AI agents qualify leads as effectively as human SDRs at a fraction of the cost?

| Attribute | Detail |
|-----------|--------|
| **Role** | VP Sales, Chief Revenue Officer, Head of Sales |
| **Reports to** | CEO / COO |
| **Budget authority** | $500-$5,000/month (Teams or Enterprise plan) |
| **Decision criteria** | ROI, lead quality, CRM integration, reporting |
| **Success metric** | More qualified leads per dollar spent |
| **Objections** | "Will AI calls feel robotic?", "Can it handle objections?", "What about compliance?" |

### Sales Operations Manager

The implementer for Sales teams. Responsible for CRM configuration, workflow automation, and reporting. Evaluates Callengo based on integration depth, customization, and data quality of results flowing back to the CRM.

| Attribute | Detail |
|-----------|--------|
| **Role** | Sales Ops Manager, Revenue Operations |
| **Reports to** | VP Sales |
| **Budget authority** | Recommends, doesn't decide |
| **Decision criteria** | CRM integration quality, API/webhook flexibility, data mapping |
| **Success metric** | Clean data, automated workflows, accurate reporting |
| **Objections** | "Does it integrate with our CRM?", "Can we customize the BANT questions?", "How does data sync work?" |

### Office Manager / Practice Administrator

The day-to-day user for Appointment-Based businesses. Manages the calendar, handles patient/client communications, and deals with no-shows. Evaluates Callengo based on ease of use, calendar sync reliability, and the actual reduction in no-shows.

| Attribute | Detail |
|-----------|--------|
| **Role** | Office Manager, Practice Admin, Receptionist |
| **Reports to** | Practice Owner / Managing Partner |
| **Budget authority** | Limited ($100-$300/month, Starter or Growth plan) |
| **Decision criteria** | Ease of use, calendar reliability, voice quality |
| **Success metric** | Fewer no-shows, less time on the phone |
| **Objections** | "Will patients think it's a robocall?", "What if they want to reschedule?", "Does it work with our calendar?" |

---

## Plan Segmentation Strategy

Each plan is designed for a specific customer segment based on call volume, team size, and integration needs:

| Plan | Price | Target Segment | Key Features |
|------|-------|----------------|-------------|
| [[Pricing Model\|Free]] | $0 | Trial users, solopreneurs | 10 calls one-time, 1 agent, basic integrations |
| [[Pricing Model\|Starter]] | $99/mo | Individual practitioners, small offices | 200 calls/mo, voicemail, follow-ups, Slack |
| [[Pricing Model\|Growth]] | $179/mo | Growing teams, small businesses | 400 calls/mo, all 3 agents, smart follow-ups |
| [[Pricing Model\|Business]] | $299/mo | Established sales teams, mid-market | 800 calls/mo, 3 users, CRM integrations |
| [[Pricing Model\|Teams]] | $649/mo | Multi-team organizations | 1,500 calls/mo, 5 users, Salesforce + Dynamics |
| [[Pricing Model\|Enterprise]] | $1,499/mo | Large organizations | 4,000+ calls/mo, unlimited users, custom SLAs |

### Integration Gating Strategy

Integrations are gated by plan to align with customer value and willingness to pay:

| Tier | Integrations | Rationale |
|------|-------------|-----------|
| **Free/Starter/Growth** | [[Google Calendar]], Google Meet, Zoom, Slack, [[SimplyBook]], Webhooks (Zapier/Make/n8n) | Basic productivity tools that everyone uses |
| **Business+** | + [[Microsoft Outlook]], Teams, [[HubSpot]], [[Pipedrive]], [[Zoho]], [[Clio]] | Mid-market CRMs that indicate a real sales process |
| **Teams+** | + [[Salesforce]], [[Dynamics 365]] | Enterprise CRMs that indicate large, established organizations |

This gating serves a dual purpose: it matches features to willingness to pay, and it creates natural upgrade triggers when a customer says "I need HubSpot integration" (→ Business plan) or "We use Salesforce" (→ Teams plan).

---

## Competitive Positioning

### vs Manual Calling (Status Quo)

The primary competitor is "just doing it by hand." Most potential customers currently use human staff to make these calls.

| Dimension | Manual | Callengo |
|-----------|--------|----------|
| Cost per call | $5-$15 (labor) | $0.15-$0.50 (AI + telephony) |
| Calls per day | 40-60 per person | 200-4,000+ (plan dependent) |
| Consistency | Varies by person | 100% consistent BANT/verification |
| Availability | Business hours only | 24/7 capability |
| CRM updates | Manual data entry | Automatic sync |
| Follow-ups | Often forgotten | Automatic scheduling |

### vs Generic Auto-Dialers (Five9, Dialpad, etc.)

Auto-dialers connect live agents to calls faster but don't replace the agent. Callengo replaces the agent entirely with AI.

| Dimension | Auto-Dialer | Callengo |
|-----------|-------------|----------|
| Agent needed? | Yes (human answers) | No (AI handles conversation) |
| Conversation quality | Depends on agent | Consistent, scriptable |
| Post-call analysis | Manual or basic | AI-powered intent analysis |
| Scalability | Linear with headcount | Elastic with plan |

### vs Other AI Voice Platforms (Air AI, Bland AI direct, etc.)

Other AI voice platforms are general-purpose; Callengo is purpose-built for three specific use cases with built-in CRM integration, calendar sync, and business-specific analysis.

| Dimension | General AI Voice | Callengo |
|-----------|-----------------|----------|
| Setup complexity | Build everything custom | 3 pre-built agents, configure and go |
| CRM integration | Build your own | 7 CRMs built-in (OAuth, sync, mapping) |
| Calendar sync | Build your own | Google/Outlook bi-directional sync |
| Post-call analysis | Raw transcript | Structured BANT/validation/confirmation analysis |
| Multi-tenant | Build your own | Built-in (company isolation, RLS, billing) |

---

## Value Propositions by Agent Type

### Lead Qualification Agent

> "Qualify 10x more leads at 1/10th the cost. Every lead gets the same thorough BANT assessment, every time."

- Consistent BANT scoring eliminates human bias
- Qualification scores (1-10) enable data-driven pipeline management
- Automatic meeting scheduling reduces friction
- CRM sync eliminates manual data entry
- Follow-up automation catches leads that don't answer the first call

### Data Validation Agent

> "Clean your entire database in days, not months. Verified data means higher deliverability, better targeting, and fewer wasted sales calls."

- Verify email, phone, address, job title, company name in one conversation
- Automatic contact record updates with before/after tracking
- CRM sync keeps your source of truth accurate
- Identify disconnected numbers and do-not-call requests
- Scale: 200-4,000+ verification calls per month

### Appointment Confirmation Agent

> "Cut no-shows in half with 24-48 hour confirmation calls that actually have a conversation — not just a robocall reminder."

- Conversational confirmation (not pre-recorded)
- Real-time rescheduling with calendar availability
- No-show detection with automatic retry
- Calendar sync (Google, Outlook) keeps everything updated
- Video link inclusion for telehealth/virtual meetings

---

## Related Notes

- [[App Identity]] — Product identity and technology stack
- [[Pricing Model]] — V4 pricing structure and unit economics
- [[Plan Features]] — Feature matrix by subscription plan
- [[HubSpot]] — CRM integration (Business+)
- [[Salesforce]] — CRM integration (Teams+)
- [[Pipedrive]] — CRM integration (Business+)
- [[Zoho]] — CRM integration (Business+)
- [[Dynamics 365]] — CRM integration (Teams+)
- [[Clio]] — Legal CRM integration (Business+)
- [[SimplyBook]] — Appointment scheduling (Free+)
- [[Google Calendar]] — Calendar integration (Free+)
- [[Microsoft Outlook]] — Calendar integration (Business+)
- [[Lead Qualification]] — Lead qualification workflow
- [[Data Validation]] — Data validation workflow
- [[Appointment Confirmation]] — Appointment confirmation workflow
