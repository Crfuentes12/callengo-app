---
tags: [workflow, agent, sales]
---

# Lead Qualification

AI agent workflow that calls leads, applies the BANT framework, and classifies them.

## BANT Framework

| Dimension | What the Agent Asks |
|-----------|-------------------|
| **Budget** | Does the prospect have budget for the solution? |
| **Authority** | Is this person the decision-maker? |
| **Need** | Does the prospect have a clear need? |
| **Timeline** | When are they looking to implement? |

## Classification Output

| Classification | Criteria |
|---------------|---------|
| **Hot** | 3-4 BANT dimensions positive, ready to buy |
| **Warm** | 1-2 BANT dimensions positive, needs nurturing |
| **Cold** | 0 BANT dimensions, not a fit |

## Workflow

```
1. Campaign created with Lead Qualification agent
2. Contacts loaded from list or CRM import
3. Agent calls each contact:
   a. Opening greeting (configurable first_sentence)
   b. BANT discovery conversation
   c. If qualified: offer to schedule meeting
4. Post-call:
   a. AI analysis extracts BANT scores + sentiment
   b. Contact status updated (qualified/disqualified)
   c. If meeting scheduled → Calendar event created
   d. If no answer → Follow-up queued (if enabled)
5. Campaign dashboard shows qualification funnel
```

## Contact Outcomes

- `qualified` → Hot/warm lead, meeting scheduled
- `disqualified` → Cold lead, no fit
- `callback` → Prospect requested callback
- `no_answer` / `busy` / `voicemail` → Follow-up eligible

## Related Notes

- [[Agent]]
- [[Campaign]]
- [[Call]]
- [[Follow-Up]]
- [[Calendar Event]]
