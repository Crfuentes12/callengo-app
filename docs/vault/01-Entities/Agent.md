---
tags: [entity, core, ai, voice, bland]
aliases: [AI Agent, Voice Agent, Agent Template, Company Agent]
---

# Agent

An AI-powered voice agent that makes outbound calls. Agents are built on [[Bland AI]] for voice synthesis and telephony, and [[OpenAI]] for post-call analysis. Callengo ships with three pre-built agent templates that cover the platform's three core use cases: lead qualification, data validation, and appointment confirmation.

The agent system is split into two layers: **agent templates** (global, read-only definitions shared across all companies) and **company agents** (company-specific instances that customize the template with a voice, language, and custom instructions).

---

## Agent Templates: `agent_templates`

Agent templates are the building blocks of the system. They define the agent's behavior, conversation strategy, opening sentence, voicemail message, and analysis criteria. Templates are global (not company-scoped) and visible to all authenticated users via RLS policy `agent_templates_select` (`WHERE is_active = true`).

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | UUID | `uuid_generate_v4()` | NO | Primary key |
| `name` | TEXT | — | NO | Display name (e.g., "Lead Qualification Agent") |
| `slug` | TEXT (UNIQUE) | — | NO | URL-safe identifier: `lead-qualification`, `data-validation`, `appointment-confirmation` |
| `description` | TEXT | — | YES | Marketing description |
| `icon` | TEXT | — | YES | Icon identifier |
| `category` | TEXT | — | YES | `sales`, `verification`, `appointment`, `feedback`, `other` |
| `task_template` | TEXT | — | NO | Full prompt/instruction set for the AI agent during calls |
| `first_sentence_template` | TEXT | — | YES | Opening greeting template |
| `voicemail_template` | TEXT | — | YES | Message to leave on voicemail |
| `analysis_questions` | JSONB | — | YES | Post-call analysis configuration |
| `is_active` | BOOLEAN | `true` | YES | Soft-deactivation flag |
| `sort_order` | INTEGER | `0` | YES | Display ordering |
| `created_at` | TIMESTAMPTZ | `now()` | YES | Creation timestamp |

**RLS:** `agent_templates_select` — All authenticated users can SELECT templates where `is_active = true`. No INSERT/UPDATE/DELETE for regular users.

### The Three Core Agents

Each agent has a specific category, conversation strategy, and post-call AI analysis type. The `task_template` field contains the full prompt that [[Bland AI]] uses during the call, including instructions for handling objections, collecting information, and managing conversation flow.

#### 1. Lead Qualification Agent (`lead-qualification`)

- **Category:** `sales`
- **Conversation strategy:** Applies the BANT framework (Budget, Authority, Need, Timeline) through natural discovery questions
- **Classification:** Hot (3-4 BANT dimensions), Warm (1-2), Cold (0)
- **Meeting scheduling:** If the lead is qualified and interested, offers to schedule a meeting using available calendar slots
- **Post-call AI:** `analyzeLeadQualificationIntent()` extracts qualification score (1-10), BANT fields, sentiment, meeting time
- **See:** [[Lead Qualification]] workflow

#### 2. Data Validation Agent (`data-validation`)

- **Category:** `verification`
- **Conversation strategy:** Confirms each data point conversationally, asks for corrections, captures new information
- **Fields verified:** Email, phone number, physical address, job title, company name
- **Post-call AI:** `analyzeDataValidationIntent()` extracts confirmed fields, updated values, new data points
- **See:** [[Data Validation]] workflow

#### 3. Appointment Confirmation Agent (`appointment-confirmation`)

- **Category:** `appointment`
- **Conversation strategy:** Calendar-aware — knows working hours, timezone, available slots. Confirms attendance, offers rescheduling, detects no-shows
- **Post-call AI:** `analyzeAppointmentIntent()` extracts intent (confirmed/reschedule/cancel/no_show/callback_requested), confidence, new appointment time, sentiment
- **See:** [[Appointment Confirmation]] workflow

**Migration:** Templates defined in `supabase/migrations/20260123000001_configure_core_agents.sql`, updated for calendar awareness in `20260225000002_update_agent_templates_calendar_aware.sql`.

---

## Company Agents: `company_agents`

Company agents are company-specific instances of agent templates. Each company creates their own agents by selecting a template and customizing it with a voice, language, and additional instructions. A company agent inherits the template's task structure but can override or augment it.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | UUID | `uuid_generate_v4()` | NO | Primary key |
| `company_id` | UUID FK → `companies` | — | NO | CASCADE on delete |
| `agent_template_id` | UUID FK → `agent_templates` | — | NO | Template reference |
| `name` | TEXT | — | NO | Custom agent name |
| `is_active` | BOOLEAN | `true` | YES | Active flag |
| `custom_task` | TEXT | — | YES | Additional prompt instructions |
| `custom_settings` | JSONB | — | YES | Agent-specific settings |
| `created_at` | TIMESTAMPTZ | `now()` | YES | |
| `updated_at` | TIMESTAMPTZ | `now()` | YES | |

**Indexes:**
- `idx_company_agents_company_id` — Company lookup
- `idx_company_agents_agent_template_id` — Template lookup

**RLS:**
- `company_agents_all` — Company-scoped access (SELECT/INSERT/UPDATE/DELETE)
- `company_agents_service` — Service role bypass

**Trigger:** `set_updated_at` → `handle_updated_at()` on UPDATE

---

## Voice Catalog

Callengo uses [[Bland AI]]'s voice catalog with **66 pre-built voices**. The catalog is defined in `src/lib/voices/bland-voices.ts`. The default voice is `'maya'` (young American female, highest ratings with 54 total ratings).

### Voice Categories

| Category | Example Voices | Description |
|----------|---------------|-------------|
| American English | Maya, Adriana, Mason, Ryan | Standard US accents, various ages |
| British English | Tanner, Alice, Julia, Emily, Dorothy, Willow | UK accents, various styles |
| Australian English | Ruth, Dave, Liam | Australian accents |
| Spanish | Helena, Rosa, Mariam | Native Spanish speakers |
| Professional | Ryan, Mason | Business-appropriate tones |

Each voice object includes: `id` (UUID), `name`, `description`, `tags` (e.g., `["english", "cloned", "professional"]`), `public` (boolean), `ratings` count, and `average_rating`.

Users can save favorite voices via the `fav_voices` JSONB array on the [[User]] table.

---

## Agent Configuration UI

The `AgentConfigModal` component (`src/components/agents/AgentConfigModal.tsx`, ~2,300 lines) is the primary UI for configuring agents. It handles:

- **Voice selection** — Browse and preview voices from the Bland AI catalog
- **Language selection** — Choose from 7 supported languages
- **Custom instructions** — Additional prompt text appended to the template
- **Voicemail settings** — Enable/disable, custom message, action (leave_message/hangup/ignore)
- **Calendar settings** — Timezone, working hours, working days, video provider
- **Follow-up settings** — Enable, max attempts, interval, conditions
- **Rescheduling settings** — Allow rescheduling, no-show auto-retry, retry delay

This is one of the intentionally large components in the codebase. Do not refactorize without explicit request.

---

## Plan Limits for Agents

The maximum number of agents a company can create is determined by their [[Subscription]] plan. This is enforced in `src/config/plan-features.ts` via the `CAMPAIGN_FEATURE_ACCESS` matrix under the `maxActiveAgents` field.

| Plan | Max Agents |
|------|-----------|
| Free | 1 |
| Starter | 3 |
| Growth | 5 |
| Business | 10 |
| Teams | 25 |
| Enterprise | Unlimited (`-1`) |

---

## Related Notes

- [[Company]] — Agents belong to companies
- [[Campaign]] — Campaigns use agents to make calls
- [[Call]] — Call logs reference agent templates
- [[Bland AI]] — Voice synthesis and telephony infrastructure
- [[OpenAI]] — Post-call AI analysis
- [[Lead Qualification]] — Lead qualification workflow
- [[Data Validation]] — Data validation workflow
- [[Appointment Confirmation]] — Appointment confirmation workflow
- [[Plan Features]] — Feature matrix by plan
