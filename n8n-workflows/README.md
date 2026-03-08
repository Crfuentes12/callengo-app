# n8n Workflows for Callengo

## How to Import

1. Open your n8n instance
2. Go to **Workflows** > **Add Workflow**
3. Click the **...** menu > **Import from File**
4. Select the JSON file
5. Configure credentials (replace `REPLACE_WITH_CREDENTIAL_ID` placeholders)
6. Set environment variables in **Settings > Environment Variables**
7. Activate the workflow

## Required Environment Variables (n8n)

Set these in your n8n instance under **Settings > Environment Variables**:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
BLAND_API_KEY=your_bland_api_key
BLAND_WEBHOOK_SECRET=your_bland_webhook_hmac_secret
OPENAI_API_KEY=your_openai_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
N8N_WEBHOOK_BASE_URL=https://your-instance.app.n8n.cloud/webhook
```

## Workflows

| # | File | Purpose | Trigger |
|---|------|---------|---------|
| 01 | `01-call-post-processing.json` | Core pipeline: AI analysis, CRM sync, logging | Bland AI webhook |
| 02 | `02-crm-sync.json` | Bidirectional CRM contact sync | Schedule (15 min) |
| 03 | `03-appointment-reminders.json` | Auto-call contacts 24-48h before appointments | Cron (daily 8 AM) |
| 04 | `04-stripe-billing.json` | Process billing events, log payments | Stripe webhook |
| 05 | `05-slack-notifications.json` | Route notifications to Slack channels | Internal webhook |

## Webhook URLs

After activation, your webhook URLs will be:

- **Bland AI calls:** `https://your-n8n.app.n8n.cloud/webhook/bland-call-complete`
- **Stripe billing:** `https://your-n8n.app.n8n.cloud/webhook/stripe-events`
- **Slack notify:** `https://your-n8n.app.n8n.cloud/webhook/slack-notify` (internal only)

## Setup Order

1. Start with **Workflow 01** (Call Post-Processing) — it's the core
2. Then **Workflow 05** (Slack) — so other workflows can notify
3. Then **Workflow 04** (Stripe) — billing events
4. Then **Workflow 03** (Reminders) — appointment automation
5. Finally **Workflow 02** (CRM Sync) — requires CRM OAuth tokens

## Full Guide

See `docs/N8N_SETUP_GUIDE.md` for the complete setup guide with architecture, credential configuration, testing instructions, and migration checklist.
