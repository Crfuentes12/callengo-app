---
tags: [entity, core, ai]
aliases: [AI Agent, Voice Agent]
---

# Agent

An AI-powered voice agent that makes outbound calls. Built on [[Bland AI]] for voice synthesis and [[OpenAI]] for post-call analysis.

## Agent Templates: `agent_templates`

Pre-defined templates for the 3 core agent types:

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| slug | TEXT UNIQUE | lead-qualification, data-validation, appointment-confirmation |
| name | TEXT | |
| description | TEXT | |
| icon | TEXT | |
| category | TEXT | sales, verification, appointment, feedback, other |
| task_template | TEXT | Default prompt template |
| first_sentence_template | TEXT | Opening line |
| voicemail_template | TEXT | Voicemail message template |
| is_active | BOOLEAN | |
| sort_order | INTEGER | |

### The 3 Core Agents

1. **Lead Qualification** (`lead-qualification`)
   - Category: `sales`
   - Applies BANT framework (Budget, Authority, Need, Timeline)
   - Classifies leads as hot/warm/cold
   - Schedules meetings with sales team
   - See [[Lead Qualification]]

2. **Data Validation** (`data-validation`)
   - Category: `verification`
   - Verifies email, phone, address, job title, company
   - Updates CRM with clean data
   - Marks invalid numbers/disconnected contacts
   - See [[Data Validation]]

3. **Appointment Confirmation** (`appointment-confirmation`)
   - Category: `appointment`
   - Calls 24-48h before appointments
   - Confirms, reschedules, or flags no-shows
   - Auto-retries no-shows after configurable delay
   - See [[Appointment Confirmation]]

## Company Agents: `company_agents`

Company-specific instances of agent templates with custom configuration:

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| company_id | UUID FK → companies | CASCADE |
| agent_template_id | UUID FK → agent_templates | CASCADE |
| name | TEXT | Custom agent name |
| custom_instructions | TEXT | Additional prompt instructions |
| voice_id | TEXT | Bland AI voice ID |
| voice_name | TEXT | Display name |
| language | TEXT | Default 'en' |
| system_prompt | TEXT | Full system prompt |
| is_active | BOOLEAN | Default true |

## Configuration UI

The `AgentConfigModal` component (~2,300 lines) handles all agent configuration:
- Voice selection (from Bland AI catalog)
- Language selection
- Custom instructions
- Voicemail settings
- Calendar integration settings
- Follow-up configuration

**Source:** `src/components/agents/AgentConfigModal.tsx`

## Plan Limits

| Plan | Max Agents |
|------|-----------|
| Free | 1 |
| Starter | 3 |
| Growth | 5 |
| Business | 10 |
| Teams | 25 |
| Enterprise | Unlimited (-1) |

## Related Notes

- [[Campaign]]
- [[Call]]
- [[Bland AI]]
- [[Plan Features]]
