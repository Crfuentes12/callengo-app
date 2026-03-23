---
tags: [workflow, agent, operations]
---

# Data Validation

AI agent workflow that calls contacts to verify and clean CRM data.

## Validation Targets

| Field | Verification Method |
|-------|-------------------|
| Phone number | Call itself validates reachability |
| Email | Ask to confirm on call |
| Address | Ask to confirm/update on call |
| Job title | Ask current role |
| Company | Ask current employer |

## Workflow

```
1. Campaign created with Data Validation agent
2. Contacts loaded (typically from CRM import)
3. Agent calls each contact:
   a. Identify self and purpose
   b. Verify each data field
   c. Note corrections
4. Post-call:
   a. AI analysis extracts verified vs. changed fields
   b. Contact record updated with clean data
   c. CRM sync pushes updates back (if configured)
   d. Invalid numbers marked as invalid_number
5. Campaign report shows data quality improvement
```

## Contact Outcomes

- `completed` → Data verified/updated successfully
- `invalid_number` → Number disconnected or wrong person
- `do_not_call` → Contact opted out
- `no_answer` / `busy` → Follow-up eligible

## Related Notes

- [[Agent]]
- [[Campaign]]
- [[Contact]]
- [[Integrations API]]
