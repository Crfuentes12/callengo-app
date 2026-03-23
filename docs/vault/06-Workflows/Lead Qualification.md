---
tags: [workflow, agent, sales, bant, lead-scoring, ai-analysis]
aliases: [Lead Qualification Agent, BANT Qualification, Lead Scoring]
updated: 2026-03-23
---

# Lead Qualification

The Lead Qualification agent is one of Callengo's three AI [[Agent]] templates. It calls prospective leads, conducts a structured discovery conversation based on the **BANT framework** (Budget, Authority, Need, Timeline), classifies each lead as Hot, Warm, or Cold, and optionally schedules meetings with the sales team.

**Slug:** `lead-qualification` | **Category:** `sales` | **Plan:** All plans (Free+)

---

## Workflow Overview

```
1. Campaign configured with lead-qualification agent
   │
2. Agent calls lead → opens with personalized greeting
   │
3. Discovery conversation:
   ├── Budget: "Do you have budget allocated for this type of solution?"
   ├── Authority: "Are you the decision maker for this kind of purchase?"
   ├── Need: "What challenges are you currently facing?"
   └── Timeline: "When are you looking to implement a solution?"
   │
4. Classification:
   ├── Hot (3-4 BANT dimensions) → Offer to schedule meeting
   ├── Warm (1-2 BANT dimensions) → Note for nurturing
   └── Cold (0 BANT dimensions) → Close gracefully
   │
5. If interested → Check calendar availability → Schedule meeting
   │
6. Post-call AI analysis (GPT-4o-mini):
   ├── Qualification score (1-10)
   ├── BANT field extraction
   ├── Sentiment analysis
   └── Meeting time extraction
   │
7. Contact record updated with BANT scores + status
   │
8. Calendar event created (if meeting scheduled)
   │
9. CRM sync → push results to HubSpot/Salesforce/Pipedrive
   │
10. Follow-up auto-created if no-answer/busy/voicemail
```

---

## BANT Classification

| Classification | BANT Dimensions | Score Range | Action |
|---------------|----------------|------------|--------|
| **Hot** | 3-4 confirmed | 7-10 | Offer meeting, create calendar event, mark qualified |
| **Warm** | 1-2 confirmed | 4-6 | Note for nurturing, schedule follow-up |
| **Cold** | 0 confirmed | 1-3 | Close gracefully, mark disqualified |

---

## Post-Call AI Analysis

The `analyzeLeadQualificationIntent()` function (in `src/lib/ai/intent-analyzer.ts`) sends the transcript to GPT-4o-mini with `temperature=0.1` and `response_format: { type: "json_object" }`.

**Output structure (`LeadQualificationResult`):**

| Field | Type | Description |
|-------|------|-------------|
| `intent` | string | `qualified`, `not_qualified`, `needs_nurturing`, `meeting_requested`, `callback_requested` |
| `qualificationScore` | number | 1-10 score |
| `confidence` | number | 0.0-1.0 confidence in the assessment |
| `budget` | string | Extracted budget information |
| `authority` | string | Authority determination |
| `need` | string | Identified needs |
| `timeline` | string | Implementation timeline |
| `meetingTime` | string (ISO) | Scheduled meeting datetime (if applicable) |
| `extractedData` | object | Additional data points from conversation |
| `summary` | string | One-sentence outcome summary |

---

## Contact Outcomes

| Outcome | Contact Status | Next Action |
|---------|---------------|-------------|
| Qualified + meeting | `qualified` | Calendar event created, CRM sync |
| Qualified, no meeting | `qualified` | Manual sales follow-up |
| Not qualified | `disqualified` | Close, no follow-up |
| Needs nurturing | `callback` | Schedule follow-up call |
| No answer | `No Answer` | Auto follow-up (if enabled) |
| Busy | `Busy` | Auto follow-up (if enabled) |
| Voicemail | `Voicemail` | Leave message, auto follow-up |
| Invalid number | `Invalid Number` | Mark bad, no follow-up |

---

## Calendar Integration

When a lead requests a meeting, the agent:

1. Checks campaign's `calendar_context_enabled` setting
2. Queries available time slots using `getNextAvailableSlot()` respecting `calendar_working_hours_start/end`, `calendar_working_days`, `calendar_timezone`
3. Proposes 2-3 available slots to the lead
4. If accepted, creates a [[Calendar Event]] with:
   - `type = 'meeting'`
   - `video_link` (if `preferred_video_provider` is set)
   - `duration_minutes` = campaign's `default_meeting_duration`
   - Contact details (name, phone, email)
5. Syncs event to [[Google Calendar]] or [[Microsoft Outlook]] if connected

---

## CRM Sync

After the call, results are pushed to connected CRMs:

| CRM | Data Pushed |
|-----|------------|
| [[HubSpot]] | Qualification score, BANT fields, call outcome, meeting link |
| [[Salesforce]] | Lead score, BANT fields, call notes, next steps |
| [[Pipedrive]] | Person notes, activity, deal stage |
| [[Zoho]] | Contact notes, score, call log |
| [[Clio]] | Contact notes, call record |

---

## Related Notes

- [[Agent]] — Agent template configuration
- [[Campaign]] — Campaign setup and dispatch
- [[Call]] — Call log with AI analysis
- [[Contact]] — Contact status updates
- [[Calendar Event]] — Meeting scheduling
- [[Follow-Up]] — Auto-retry for unanswered calls
- [[OpenAI]] — AI analysis engine
- [[ICP & Positioning]] — Target market for lead qualification
