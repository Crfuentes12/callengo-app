# n8n Setup Guide for Callengo

> Complete guide to configure n8n as Callengo's automation backbone.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [n8n Account Setup](#n8n-account-setup)
3. [Credentials to Configure](#credentials-to-configure)
4. [Core Workflows](#core-workflows)
5. [Webhook URLs & Routing](#webhook-urls--routing)
6. [Environment Variables](#environment-variables)
7. [Testing & Debugging](#testing--debugging)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CALLENGO (Vercel)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐             │
│  │ Dashboard │  │ Auth/UI  │  │ Stripe       │             │
│  │ (Next.js) │  │ (Supabase│  │ Checkout     │             │
│  │           │  │  RLS)    │  │ Portal       │             │
│  └──────────┘  └──────────┘  └──────────────┘             │
│                         │                                   │
│                    Webhooks OUT                              │
│                         │                                   │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      n8n (Cloud)                            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ WORKFLOW 1: Call Post-Processing Pipeline            │   │
│  │ Bland AI Webhook → AI Analysis → CRM Sync →         │   │
│  │ Calendar Ops → Slack Notify → Usage Track            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ WORKFLOW 2: CRM Bidirectional Sync                  │   │
│  │ Schedule (every 15min) → Fetch CRM changes →        │   │
│  │ Update Supabase → Push back to CRMs                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ WORKFLOW 3: Appointment Reminders                   │   │
│  │ Cron (daily 8am) → Query upcoming appointments →    │   │
│  │ Filter 24-48h window → Trigger Bland AI call        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ WORKFLOW 4: Billing Events                          │   │
│  │ Stripe Webhook → Update subscription → Email →      │   │
│  │ Slack alert (failures)                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ WORKFLOW 5: Lead Scoring & Routing                  │   │
│  │ New contact → OpenAI scoring → Assign to agent →    │   │
│  │ Notify team → Schedule call                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ WORKFLOW 6: Slack Notifications Hub                 │   │
│  │ Multiple triggers → Format message →                │   │
│  │ Post to appropriate channel                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└────────────────┬──────────────┬──────────────┬──────────────┘
                 │              │              │
          ┌──────▼──────┐ ┌────▼────┐ ┌───────▼───────┐
          │  CRMs       │ │ Bland   │ │  Supabase     │
          │  Salesforce  │ │ AI API  │ │  (Database)   │
          │  HubSpot     │ │         │ │               │
          │  Pipedrive   │ │         │ │               │
          │  Zoho        │ │         │ │               │
          │  Clio        │ │         │ │               │
          │  Dynamics    │ │         │ │               │
          └─────────────┘ └─────────┘ └───────────────┘
```

**What stays in Vercel:**
- Dashboard UI (Next.js pages)
- Authentication (Supabase Auth + RLS)
- OAuth redirect handlers (CRM connect/callback)
- Stripe checkout/portal sessions
- Static API routes that the UI calls directly

**What moves to n8n:**
- Post-call processing pipeline (the heavy lifting)
- CRM data sync (bidirectional)
- Calendar event creation/updates
- AI analysis (OpenAI calls)
- Slack notifications
- Scheduled jobs (reminders, retries, cleanup)
- Webhook dispatching to user endpoints
- Usage tracking and alerts

---

## n8n Account Setup

### Step 1: Create n8n Cloud Account

1. Go to [n8n.io](https://n8n.io) and sign up
2. Choose the **Starter plan** ($20/mo) or **Pro plan** ($50/mo) based on execution volume
3. Your instance URL will be: `https://your-instance.app.n8n.cloud`

### Step 2: Recommended n8n Settings

In **Settings > General**:
- **Timezone:** Set to your primary market timezone (e.g., `America/New_York`)
- **Save execution data:** Yes (for debugging)
- **Execution timeout:** 120 seconds (some AI calls take time)

In **Settings > Workflow**:
- **Save failed executions:** Always
- **Save successful executions:** Last 100 (saves storage)

---

## Credentials to Configure

Go to **Credentials** in n8n and add these:

### Required Credentials

| Credential Name | Type in n8n | Values Needed |
|----------------|-------------|---------------|
| `Supabase` | Supabase API | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (NOT anon key) |
| `Bland AI` | Header Auth | Header: `Authorization`, Value: `Bearer {BLAND_API_KEY}` |
| `OpenAI` | OpenAI API | `OPENAI_API_KEY` |
| `Stripe` | Stripe API | `STRIPE_SECRET_KEY` |
| `Slack` | Slack OAuth2 | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, Bot token |

### CRM Credentials (add as needed)

| Credential Name | Type in n8n | Notes |
|----------------|-------------|-------|
| `Salesforce` | Salesforce OAuth2 | Use n8n's built-in Salesforce node |
| `HubSpot` | HubSpot OAuth2 | Use n8n's built-in HubSpot node |
| `Pipedrive` | Pipedrive API | Use n8n's built-in Pipedrive node |
| `Zoho CRM` | Zoho OAuth2 | Use n8n's built-in Zoho node |
| `Microsoft Dynamics` | Microsoft OAuth2 | Custom HTTP requests |
| `Clio` | HTTP Header Auth | Custom OAuth flow |

### Calendar Credentials

| Credential Name | Type in n8n | Notes |
|----------------|-------------|-------|
| `Google Calendar` | Google OAuth2 | Use n8n's built-in Google Calendar node |
| `Microsoft Outlook` | Microsoft OAuth2 | Use n8n's built-in Microsoft Outlook node |

> **Important:** For Supabase, use the **Service Role Key** (not the anon key). This bypasses RLS and gives n8n full access to all tables. Keep this credential secure.

---

## Core Workflows

### Workflow 1: Call Post-Processing Pipeline

**This is the most critical workflow.** It replaces the logic in `/api/bland/webhook`.

```
Trigger: Webhook (POST)
URL: https://your-instance.app.n8n.cloud/webhook/bland-call-complete

Flow:
1. [Webhook Trigger] → Receive Bland AI call data
2. [IF] → Check if call was answered
   ├─ YES →
   │   3. [HTTP Request] → Call OpenAI GPT-4o-mini for intent analysis
   │   4. [Switch] → Route based on agent type
   │   │   ├─ appointment-confirmation →
   │   │   │   5a. [Supabase] → Update contact status
   │   │   │   5b. [Google Calendar / Outlook] → Create/update event
   │   │   │   5c. [Supabase] → Log to call_logs
   │   │   │
   │   │   ├─ lead-qualification →
   │   │   │   5a. [Supabase] → Update lead score
   │   │   │   5b. [IF score > threshold] → Schedule meeting
   │   │   │   5c. [CRM node] → Push to active CRM
   │   │   │
   │   │   └─ data-validation →
   │   │       5a. [Supabase] → Update contact fields
   │   │       5b. [CRM node] → Sync validated data back
   │   │
   │   6. [Supabase] → Log call to call_logs table
   │   7. [HTTP Request] → Dispatch to user webhook endpoints
   │   8. [Slack] → Notify team channel
   │   9. [Supabase] → Track usage (billing)
   │
   └─ NO (voicemail/no-answer) →
       3. [Supabase] → Log as missed
       4. [Supabase] → Schedule retry
       5. [Slack] → Notify if configured
```

**Webhook Signature Verification (important!):**

Add a **Code node** right after the webhook trigger:

```javascript
// Verify Bland AI webhook signature
const crypto = require('crypto');

const signature = $input.first().headers['x-bland-signature'];
const body = JSON.stringify($input.first().body);
const secret = $credentials.blandWebhookSecret; // Store in n8n credentials

const expectedSignature = crypto
  .createHmac('sha256', secret)
  .update(body)
  .digest('hex');

if (signature !== expectedSignature) {
  throw new Error('Invalid webhook signature');
}

return $input.all();
```

### Workflow 2: CRM Bidirectional Sync

```
Trigger: Schedule (every 15 minutes)

Flow:
1. [Schedule Trigger] → Every 15 min
2. [Supabase] → Get all companies with active CRM integrations
3. [Loop] → For each company:
   │
   4. [Switch] → Based on CRM type
   │   ├─ Salesforce →
   │   │   5a. [Salesforce] → Query recently modified contacts
   │   │   5b. [Supabase] → Upsert contacts
   │   │
   │   ├─ HubSpot →
   │   │   5a. [HubSpot] → Get recently modified contacts
   │   │   5b. [Supabase] → Upsert contacts
   │   │
   │   ├─ Pipedrive →
   │   │   5a. [Pipedrive] → Get recent persons
   │   │   5b. [Supabase] → Upsert contacts
   │   │
   │   └─ (other CRMs similar pattern)
   │
   6. [Supabase] → Update last_sync timestamp
```

### Workflow 3: Appointment Reminders

```
Trigger: Cron (daily at 8:00 AM)

Flow:
1. [Cron Trigger] → Every day at 8am
2. [Supabase] → Query appointments in next 24-48 hours
   WHERE status = 'scheduled'
   AND reminder_sent = false
3. [Filter] → Remove already confirmed
4. [Loop] → For each appointment:
   │
   5. [HTTP Request] → POST to Bland AI /v1/calls
      {
        "phone_number": contact.phone,
        "task": "Confirm appointment for {date} at {time}",
        "model": "enhanced",
        "webhook": "https://your-n8n/webhook/bland-call-complete",
        "metadata": {
          "company_id": "...",
          "contact_id": "...",
          "agent_type": "appointment-confirmation"
        }
      }
   │
   6. [Supabase] → Mark reminder_sent = true
   7. [Slack] → Post summary "Sent X reminder calls today"
```

### Workflow 4: Stripe Billing Events

```
Trigger: Webhook (POST)
URL: https://your-instance.app.n8n.cloud/webhook/stripe-events

Flow:
1. [Webhook Trigger] → Receive Stripe event
2. [Code] → Verify Stripe signature
3. [Switch] → Based on event.type
   │
   ├─ checkout.session.completed →
   │   4a. [Supabase] → Create/update subscription record
   │   4b. [Slack] → "New subscriber: {company}"
   │
   ├─ invoice.payment_failed →
   │   4a. [Supabase] → Mark subscription as past_due
   │   4b. [Slack] → Alert: "Payment failed for {company}"
   │   4c. [Email] → Send dunning email
   │
   ├─ customer.subscription.deleted →
   │   4a. [Supabase] → Mark as canceled
   │   4b. [Slack] → "Churned: {company}"
   │
   └─ invoice.payment_succeeded →
       4a. [Supabase] → Create billing_history entry
```

### Workflow 5: Lead Scoring & Auto-Routing

```
Trigger: Webhook (POST) — called after Workflow 1 identifies a qualified lead
URL: https://your-instance.app.n8n.cloud/webhook/lead-scored

Flow:
1. [Webhook Trigger] → Receive scored lead data
2. [Switch] → Based on lead_score
   │
   ├─ HOT (score >= 80) →
   │   3a. [Google Calendar] → Find next available slot
   │   3b. [HTTP Request] → Create Zoom meeting
   │   3c. [Supabase] → Update contact with meeting link
   │   3d. [Slack] → Alert sales team immediately
   │   3e. [CRM] → Update lead status to "Meeting Scheduled"
   │
   ├─ WARM (score 50-79) →
   │   3a. [Supabase] → Add to nurture queue
   │   3b. [Slack] → Daily digest
   │
   └─ COLD (score < 50) →
       3a. [Supabase] → Mark as disqualified
```

### Workflow 6: Slack Notifications Hub

```
Trigger: Webhook (POST) — called by other workflows
URL: https://your-instance.app.n8n.cloud/webhook/slack-notify

Flow:
1. [Webhook Trigger] → { event_type, company_id, data }
2. [Supabase] → Get company's Slack integration (channel, token)
3. [IF] → Slack connected?
   │
   ├─ YES →
   │   4. [Switch] → Based on event_type
   │   │   ├─ call.completed → Format call summary block
   │   │   ├─ appointment.confirmed → Format confirmation message
   │   │   ├─ lead.qualified → Format lead card
   │   │   ├─ payment.failed → Format alert
   │   │   └─ campaign.completed → Format campaign report
   │   │
   │   5. [Slack] → Post message to channel
   │
   └─ NO → [No Op] (skip)
```

---

## Webhook URLs & Routing

After creating your workflows, you'll have these webhook URLs:

| Webhook URL | Purpose | Configure In |
|-------------|---------|-------------|
| `https://your-n8n.app.n8n.cloud/webhook/bland-call-complete` | Receives all Bland AI call completions | Bland AI dashboard + each agent config |
| `https://your-n8n.app.n8n.cloud/webhook/stripe-events` | Receives Stripe billing events | Stripe dashboard > Webhooks |
| `https://your-n8n.app.n8n.cloud/webhook/lead-scored` | Internal: receives scored leads | Called by Workflow 1 |
| `https://your-n8n.app.n8n.cloud/webhook/slack-notify` | Internal: notification dispatcher | Called by other workflows |

### Update Bland AI Webhook URL

In your Bland AI dashboard (or in your agent config), change the webhook URL from:
```
https://callengo.com/api/bland/webhook
```
to:
```
https://your-n8n.app.n8n.cloud/webhook/bland-call-complete
```

### Update Stripe Webhook URL

In Stripe Dashboard > Developers > Webhooks, add a new endpoint:
```
https://your-n8n.app.n8n.cloud/webhook/stripe-events
```

Events to subscribe:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

> **Tip:** Keep the existing Callengo webhook endpoint active too. You can have multiple webhook endpoints in Stripe. This way your app still handles billing UI updates while n8n handles the automation layer.

---

## Environment Variables

### Add to Callengo `.env` (for forwarding to n8n)

```bash
# n8n Webhook Base URL
N8N_WEBHOOK_BASE_URL=https://your-instance.app.n8n.cloud/webhook

# n8n webhook paths
N8N_BLAND_WEBHOOK_PATH=/bland-call-complete
N8N_STRIPE_WEBHOOK_PATH=/stripe-events
N8N_LEAD_SCORED_PATH=/lead-scored
N8N_SLACK_NOTIFY_PATH=/slack-notify
```

### Store in n8n Credentials

These go in n8n's credential storage (encrypted):

```
BLAND_API_KEY=your_bland_api_key
BLAND_WEBHOOK_SECRET=your_bland_webhook_secret
OPENAI_API_KEY=your_openai_key
STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret_for_n8n
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## Testing & Debugging

### Test Bland AI Workflow

1. In n8n, open Workflow 1 and click **"Listen for test event"** on the webhook node
2. Make a test call from Callengo dashboard
3. Watch the execution flow through each node
4. Check the output of each node for correct data

### Test Stripe Workflow

1. Use Stripe CLI to forward events locally:
   ```bash
   stripe listen --forward-to https://your-n8n.app.n8n.cloud/webhook/stripe-events
   ```
2. Trigger test events:
   ```bash
   stripe trigger checkout.session.completed
   stripe trigger invoice.payment_failed
   ```

### Common Issues

| Issue | Solution |
|-------|----------|
| Webhook not receiving data | Check n8n workflow is **active** (toggle ON) |
| Signature verification failing | Ensure webhook secrets match between services and n8n |
| Supabase RLS blocking | Use **Service Role Key**, not anon key |
| CRM OAuth expired | n8n auto-refreshes tokens, but check credential status |
| Timeout on AI analysis | Increase node timeout to 120s in node settings |
| Duplicate processing | Add idempotency check: query call_logs by call_id before processing |

### Monitoring

- **n8n Executions page:** Shows all workflow runs with success/failure
- **Slack alerts:** Workflow 6 sends real-time notifications
- **Supabase:** Check `call_logs` and `analysis_queue` tables for data consistency

---

## Migration Checklist

- [ ] Create n8n Cloud account
- [ ] Configure all credentials (Supabase, Bland, OpenAI, Stripe, Slack)
- [ ] Import/build Workflow 1 (Call Post-Processing) — **start here, it's the core**
- [ ] Test Workflow 1 with a real Bland AI call
- [ ] Update Bland AI webhook URL to point to n8n
- [ ] Import/build Workflow 4 (Stripe Billing)
- [ ] Add Stripe webhook endpoint for n8n
- [ ] Import/build Workflow 3 (Appointment Reminders)
- [ ] Import/build Workflow 2 (CRM Sync) — per CRM as needed
- [ ] Import/build Workflow 5 (Lead Scoring)
- [ ] Import/build Workflow 6 (Slack Hub)
- [ ] Monitor for 1 week, compare results with old pipeline
- [ ] Deprecate redundant Callengo API routes

---

## Cost Estimate

| Component | Cost/month |
|-----------|-----------|
| n8n Cloud Starter | $20 |
| n8n Cloud Pro (if >2,500 executions) | $50 |
| OpenAI API (GPT-4o-mini, ~1000 calls) | ~$5-15 |
| Bland AI | (already paying) |
| Stripe | (already paying) |
| **Total added cost** | **$25-65/mo** |

Compare to: building and maintaining 120+ API routes on Vercel, debugging serverless cold starts, managing Vercel cron jobs, dealing with execution timeouts.

---

## OpenAI Intent Analysis — n8n Code Node

Use this in Workflow 1 as the AI analysis step:

```javascript
// Node: Code — Analyze Call Intent
const transcript = $input.first().json.concatenated_transcript;
const agentType = $input.first().json.metadata?.agent_type || 'general';
const contactName = $input.first().json.metadata?.contact_name || 'Unknown';

const systemPrompt = {
  'appointment-confirmation': `You are analyzing a phone call transcript where an AI agent called ${contactName} to confirm an upcoming appointment. Extract: confirmed (boolean), needs_reschedule (boolean), new_datetime (if rescheduling), no_show_risk (low/medium/high), sentiment (positive/neutral/negative), key_notes (string).`,
  'lead-qualification': `You are analyzing a phone call transcript where an AI agent called ${contactName} to qualify them as a lead. Score using BANT: budget (1-10), authority (1-10), need (1-10), timeline (1-10), overall_score (1-100), qualification (hot/warm/cold), next_action (string), key_notes (string).`,
  'data-validation': `You are analyzing a phone call transcript where an AI agent called ${contactName} to verify their contact information. Extract: verified_fields (object with email, phone, address, job_title - each with value and verified boolean), corrections (array of field changes), confidence (high/medium/low).`
};

const prompt = systemPrompt[agentType] || systemPrompt['lead-qualification'];

// This will be sent to the OpenAI node
return [{
  json: {
    ...$input.first().json,
    ai_prompt: prompt,
    ai_transcript: transcript,
    agent_type: agentType
  }
}];
```

Then connect to an **OpenAI Chat node** with:
- Model: `gpt-4o-mini`
- System Message: `{{ $json.ai_prompt }}`
- User Message: `Transcript:\n{{ $json.ai_transcript }}\n\nRespond with valid JSON only.`
- Response Format: JSON

---

## Supabase Queries — Common Patterns for n8n

### Log a completed call
```sql
INSERT INTO call_logs (
  company_id, contact_id, agent_run_id,
  bland_call_id, status, duration_seconds,
  transcript, summary, recording_url,
  metadata, created_at
) VALUES (
  '{{ $json.metadata.company_id }}',
  '{{ $json.metadata.contact_id }}',
  '{{ $json.metadata.agent_run_id }}',
  '{{ $json.call_id }}',
  '{{ $json.status }}',
  {{ $json.call_length }},
  '{{ $json.concatenated_transcript }}',
  '{{ $json.summary }}',
  '{{ $json.recording_url }}',
  '{{ JSON.stringify($json.ai_analysis) }}',
  NOW()
);
```

### Get upcoming appointments (for reminders)
```sql
SELECT ce.*, c.phone, c.full_name, c.email, co.name as company_name
FROM calendar_events ce
JOIN contacts c ON ce.contact_id = c.id
JOIN companies co ON ce.company_id = co.id
WHERE ce.start_time BETWEEN NOW() + INTERVAL '24 hours'
  AND NOW() + INTERVAL '48 hours'
  AND ce.status = 'scheduled'
  AND ce.reminder_sent = false;
```

### Update contact after call
```sql
UPDATE contacts
SET
  status = '{{ $json.new_status }}',
  last_called_at = NOW(),
  call_count = call_count + 1,
  custom_fields = custom_fields || '{{ JSON.stringify($json.extracted_data) }}'::jsonb
WHERE id = '{{ $json.metadata.contact_id }}';
```
