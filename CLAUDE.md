# Callengo — Claude Code Context

> This file gives Claude full context about Callengo in every session.
> Read `docs/CALLENGO_MASTER_DOCUMENT.md` for the complete technical and business reference.

## What is Callengo?

Callengo is a B2B SaaS platform that automates outbound phone calls using AI voice agents. It replaces manual, repetitive calling with intelligent AI agents that call, converse, analyze, and follow up autonomously.

**One-Line Pitch:** "AI agents that call your contacts, qualify your leads, verify your data, and confirm your appointments — so your team never has to."

## Three AI Agents

1. **Lead Qualification Agent** — Filters unqualified leads before they reach SDRs. Uses BANT framework, scores leads (hot/warm/cold), schedules meetings with qualified ones.
2. **Data Validation Agent** — Calls contacts to verify/update email, phone, address, job title. Writes clean data back to CRM.
3. **Appointment Confirmation Agent** — Calls 24-48h before appointments. Confirms, reschedules, detects no-shows, auto-retries. Reduces no-shows by 15-30%.

## Target Market (ICP)

- **Industries:** Healthcare, Real Estate, SaaS, Financial Services, Legal Firms
- **Company size:** 5-500 employees, $500K-$50M ARR
- **Monthly call volume:** 300-6,000+ calls
- **Decision makers:** VP Sales, Operations Managers, Practice Managers, CRM Admins
- **Pain points:** Dirty CRM data, no-show appointments, unqualified leads wasting SDR time

## Pricing (V4 — March 2026)

| Plan | Price/mo | Calls/mo | Users |
|------|----------|----------|-------|
| Free | $0 | 10 (trial) | 1 |
| Starter | $99 | 200 | 1 |
| Growth | $179 | 400 | 1 |
| Business | $299 | 800 | 3 |
| Teams | $649 | 1,500 | 5 |
| Enterprise | $1,499 | 4,000+ | ∞ |

Annual billing = 12% off. Add-ons: Dedicated Number ($15), Recording Vault ($12), Calls Booster ($35).

## Integrations

- **CRMs:** Salesforce, HubSpot, Pipedrive, Zoho CRM, Clio, Microsoft Dynamics 365
- **Calendar:** Google Calendar, Microsoft Outlook, SimplyBook.me
- **Video:** Zoom, Google Meet, Microsoft Teams
- **Productivity:** Slack, Webhooks (Zapier/Make/n8n compatible), Google Sheets

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 4, Shadcn UI
- **Backend:** Next.js API Routes, Supabase (PostgreSQL + RLS), Edge functions
- **External:** Bland AI (telephony), OpenAI GPT-4o-mini (analysis), Stripe (billing)
- **Deployment:** Vercel

## Competitors

- **Aircall** — Cloud phone system, not AI-first, no autonomous agents
- **Dialpad** — AI-powered comms but enterprise-heavy, not focused on outbound automation
- **Aloware** — Power dialer, requires human agents
- **Smith.ai** — Virtual receptionist, inbound-focused, human-assisted
- **Bland AI direct** — Raw API, no UI/CRM/analytics layer (Callengo adds the product layer)

## Competitive Advantages

1. Purpose-built for 3 specific use cases (not a generic dialer)
2. Full product experience: UI + analytics + CRM sync + follow-ups
3. 6 CRM integrations with bidirectional sync
4. AI-powered post-call analysis (sentiment, intent, scoring)
5. Sub-account architecture (isolated per company, no shared limits)
6. Multi-language, multi-currency support

## Brand Voice

- **Tone:** Direct, confident, technical but accessible. No corporate fluff.
- **Personality:** The smart ops person who gets things done. Practical, data-driven.
- **Never:** Use "revolutionize", "cutting-edge", "game-changer", "leverage", "synergy". No buzzword soup.
- **Always:** Lead with the pain point, then the solution. Use specific numbers. Be concrete.
- **LinkedIn style:** Short paragraphs (1-2 lines max). Hook in first line. No hashtag spam (max 3-5). Use line breaks generously.

## Key Metrics to Reference

- No-show rates: 15-30% in healthcare
- SDR time wasted on unqualified leads: 60%+
- Cost per missed medical appointment: $150-500+
- Average cost of a bad CRM record: $100/year (Gartner)
- Manual confirmation call time: 3-5 min per call × hundreds per week

## Project Structure

```
src/app/(app)/     → 15 authenticated pages (dashboard, agents, campaigns, etc.)
src/app/api/       → ~80 API route endpoints
src/components/    → ~60 UI components organized by domain
src/lib/           → ~50 business logic modules
src/config/        → Feature matrix (plan-features.ts)
docs/              → Master document, architecture, audit, pricing, integration guides
```

## Custom Commands Available

Use `/project:command-name` to invoke marketing commands:
- `/project:linkedin-ceo` — CEO/founder LinkedIn posts
- `/project:linkedin-company` — Company LinkedIn posts
- `/project:carousel` — LinkedIn carousel structures
- `/project:seo-article` — SEO-optimized blog articles
- `/project:content-calendar` — Weekly/monthly content planning
- `/project:trend-scout` — AI news → reactive content
- `/project:market-research` — Market/competitor research
- `/project:competitor-watch` — Competitor content analysis
- `/project:reverse-seo` — Reverse SEO for AI search queries
- `/project:financial-model` — Unit economics & projections
- `/project:engagement-reply` — Engagement comments for LinkedIn
- `/project:blog-pulse` — LinkedIn Pulse-style articles
