---
tags: [workflow, technical, calls]
---

# Call Processing Flow

What happens when a call completes and [[Bland AI]] sends the webhook.

## Flow

```
1. Bland AI webhook → POST /api/bland/webhook
   ├── Verify webhook signature
   └── Extract: call_id, status, duration, transcript, metadata

2. Look up call in call_logs by call_id
   ├── If not found → log error, return
   └── Extract company_id, contact_id, agent_run_id

3. Update call_logs
   ├── status (completed, no-answer, busy, failed, etc.)
   ├── duration_seconds
   ├── transcript
   ├── voicemail_detected, voicemail_left
   └── metadata

4. Release Redis call slot
   ├── releaseCallSlot(callId)
   ├── Decrement company concurrent counter
   └── Decrement global concurrent counter

5. Track usage
   ├── atomic_increment_usage(company_id, minutes)
   ├── Update company_subscriptions.minutes_used
   └── Check overage threshold → report to Stripe if exceeded

6. Queue AI analysis
   ├── Insert into analysis_queue
   └── Worker claims via claim_analysis_job() RPC
       ├── Send transcript to GPT-4o-mini
       ├── Get structured analysis (JSON mode)
       └── Store in call_logs.call_analysis

7. DB Triggers fire:
   ├── auto_create_followup → Follow-up queue (if configured)
   ├── notify_high_failure_rate → Notification (if >50% failures)
   └── notify_minutes_limit → Notification (if 80/90/100%)

8. Update campaign_queue status → completed/failed

9. Update agent_runs metrics
   ├── completed_calls++
   ├── successful_calls++ or failed_calls++
   └── voicemails_detected++, follow_ups_scheduled++

10. Fire outbound webhooks (if configured)
    ├── Look up active webhook_endpoints for company
    ├── Construct payload with call data
    ├── POST with HMAC-SHA256 signature
    └── Record in webhook_deliveries
```

## Error Handling

- Webhook processing is idempotent (check call_id existence)
- Redis slot has 30min TTL (auto-cleanup if webhook never arrives)
- Analysis queue retries up to 3 times

## Related Notes

- [[Campaign Dispatch Flow]]
- [[Bland AI]]
- [[OpenAI]]
- [[Usage Tracking]]
- [[Follow-Up]]
- [[Webhook]]
