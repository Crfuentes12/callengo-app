---
tags: [overview, identity, product]
aliases: [Callengo, Platform]
---

# App Identity

## What is Callengo?

Callengo is a **B2B SaaS platform** for automated outbound phone calls powered by AI agents. It replaces manual, repetitive calling tasks — lead qualification, data validation, and appointment confirmation — with intelligent voice agents that call, converse, analyze, and follow up autonomously.

**One-liner:** "AI agents that call your contacts, qualify your leads, verify your data, and confirm your appointments — so your team never has to."

## Core Value Proposition

| For | Problem Solved |
|-----|---------------|
| Sales teams | Manual lead qualification calls are time-consuming and inconsistent |
| Operations teams | Data validation requires hours of phone calls to verify contact info |
| Appointment-based businesses | No-shows and unconfirmed appointments waste resources |

## The 3 AI Agents

1. **[[Lead Qualification]]** — Calls leads, applies BANT framework, classifies as hot/warm/cold, schedules meetings
2. **[[Data Validation]]** — Calls contacts to verify email, phone, address, job title; updates CRM with clean data
3. **[[Appointment Confirmation]]** — Calls 24-48h before appointments; confirms, reschedules, or flags no-shows

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Backend | Next.js API Routes (142 serverless endpoints) |
| Database | [[Schema Overview\|Supabase]] (PostgreSQL) with RLS, 56 tables |
| Auth | Supabase Auth (email/password + Google/GitHub OAuth) |
| Payments | [[Stripe Integration\|Stripe]] (subscriptions, metered billing, add-ons) |
| Voice | [[Bland AI]] (voice calls + transcription, master key architecture) |
| Concurrency | [[Upstash Redis]] (rate limiting, call slots, concurrency tracking) |
| AI Analysis | [[OpenAI]] GPT-4o-mini (post-call intelligence, JSON mode) |
| i18n | 7 languages (en, es, fr, de, it, nl, pt) via geolocation detection |
| Deploy | Vercel |

## Key Architectural Decisions

- **Single Bland AI master key** — no sub-accounts; tenant isolation via `company_id` in Supabase
- **Redis-based concurrency** — atomic call slots, per-company and global rate limiting
- **Metered billing** — minutes are the internal metric; frontend displays `calls = minutes / 1.5`
- **RLS everywhere** — Row Level Security on all user-facing tables
- **Encrypted tokens** — AES-256-GCM for all OAuth tokens via `encryptToken()`/`decryptToken()`

## Related Notes

- [[ICP & Positioning]]
- [[Architecture Overview]]
- [[Pricing Model]]
- [[Schema Overview]]
