---
tags: [workflow, agent, operations, data-quality, verification]
aliases: [Data Validation Agent, Contact Verification]
updated: 2026-03-23
---

# Data Validation

The Data Validation agent is one of Callengo's three AI [[Agent]] templates. It calls contacts to verify and update their CRM data — email addresses, phone numbers, physical addresses, job titles, and company names — through natural conversation. This is essential for organizations with large, aging databases where a significant percentage of records are stale or incorrect.

**Slug:** `data-validation` | **Category:** `verification` | **Plan:** All plans (Free+)

---

## Workflow Overview

```
1. Campaign configured with data-validation agent
   │
2. Agent calls contact → opens with verification context
   │
3. Verification conversation:
   ├── "Can you confirm your email is john@example.com?"
   ├── "Is your current phone number 555-0100?"
   ├── "Are you still located at 123 Main Street?"
   ├── "What's your current job title?"
   └── "Are you still with Acme Corp?"
   │
4. Agent records confirmations, corrections, and new info
   │
5. Post-call AI analysis (GPT-4o-mini):
   ├── Intent: data_confirmed / data_updated / callback / refused / partial
   ├── Validated fields with status (confirmed / updated / rejected)
   ├── New fields discovered during conversation
   └── Extracted data (structured)
   │
6. Contact record updated with verified/corrected fields
   │
7. CRM sync → push verified data back to originating CRM
   │
8. Follow-up auto-created if no-answer/busy/voicemail
```

---

## Validation Targets

| Field | Verification Method | Example |
|-------|-------------------|---------|
| Email | Read back, ask for correction | "Is your email still john@acme.com?" |
| Phone | Confirm current number | "Is 555-0100 the best number to reach you?" |
| Address | Read back full address | "Are you still at 123 Main St, Springfield?" |
| City/State/Zip | Part of address verification | Confirms or updates |
| Job Title | Ask current role | "What's your current position?" |
| Company Name | Confirm employer | "Are you still with Acme Corporation?" |

---

## Post-Call AI Analysis

The `analyzeDataValidationIntent()` function sends the transcript to GPT-4o-mini:

**Output structure (`DataValidationResult`):**

| Field | Type | Description |
|-------|------|-------------|
| `intent` | string | `data_confirmed`, `data_updated`, `callback_requested`, `refused`, `partial` |
| `confidence` | number | 0.0-1.0 |
| `validatedFields` | map | Field → `{status: 'confirmed'│'updated'│'rejected', newValue?: string}` |
| `newFields` | object | New data discovered (e.g., job_title not previously known) |
| `extractedData` | object | All structured data from conversation |
| `summary` | string | One-sentence outcome |

### Example AI Output

```json
{
  "intent": "data_updated",
  "validatedFields": {
    "email": { "status": "confirmed", "value": "john@acme.com" },
    "phone": { "status": "updated", "newValue": "+1-555-0199" },
    "address": { "status": "updated", "newValue": "456 Oak Avenue" },
    "city": { "status": "confirmed", "value": "Springfield" },
    "job_title": { "status": "updated", "newValue": "VP Engineering" }
  },
  "newFields": { "direct_line": "+1-555-0200" },
  "summary": "Phone and address updated, email confirmed, new job title captured"
}
```

---

## Contact Field Updates

The webhook handler applies AI-extracted changes directly to the [[Contact]] record:

| Contact Field | Updated From |
|--------------|-------------|
| `contact_name` | `extractedData.contact_name` |
| `email` | `validatedFields.email.newValue` |
| `phone_number` | `validatedFields.phone.newValue` |
| `address` | `validatedFields.address.newValue` |
| `city` | `validatedFields.city.newValue` |
| `state` | `validatedFields.state.newValue` |
| `zip_code` | `validatedFields.zip_code.newValue` |
| `company_name` | `validatedFields.company.newValue` |
| `custom_fields` | Extended data (job_title, direct_line, etc.) |

---

## Contact Outcomes

| Outcome | Contact Status | Next Action |
|---------|---------------|-------------|
| Data confirmed | `Completed` | CRM sync with verification timestamp |
| Data updated | `Completed` | Contact updated, CRM sync |
| Callback requested | `Callback` | Schedule follow-up |
| Refused to verify | `Do Not Call` | Mark, no further calls |
| Partial verification | `Completed` | Update confirmed fields only |
| No answer | `No Answer` | Auto follow-up (if enabled) |
| Invalid number | `Invalid Number` | Mark bad number |

---

## Related Notes

- [[Agent]] — Agent template configuration
- [[Campaign]] — Campaign setup and dispatch
- [[Call]] — Call log with AI analysis
- [[Contact]] — Contact field updates
- [[OpenAI]] — AI analysis engine
- [[Follow-Up]] — Auto-retry for unanswered calls
- [[ICP & Positioning]] — Target market for data validation
