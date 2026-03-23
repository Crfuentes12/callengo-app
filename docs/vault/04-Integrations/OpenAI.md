---
tags: [integration, ai, analysis]
---

# OpenAI

Used for post-call AI analysis. Model: **GPT-4o-mini** (temperature 0.1, JSON mode).

## Use Cases

1. **Call Analysis** — Summarize call, extract sentiment, classify lead quality, identify next steps
2. **Intent Detection** — Determine caller's intent from transcript
3. **AI Chat Assistant** — In-app conversational AI

## Analysis Queue

Post-call analysis is processed asynchronously via the `analysis_queue` table:
1. Call completes → entry added to `analysis_queue`
2. Worker claims job via `claim_analysis_job()` RPC (FOR UPDATE SKIP LOCKED)
3. Transcript sent to GPT-4o-mini for analysis
4. Results stored in `call_logs.call_analysis` JSONB field
5. Max 3 retry attempts

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/openai/analyze` | Analyze call transcript |
| POST | `/api/openai/intent` | Detect intent from transcript |
| POST | `/api/openai/chat` | AI assistant conversation |

## Source Files

- Intent analyzer: `src/lib/ai/`
- API routes: `src/app/api/openai/`

## Cost Tracking

OpenAI costs tracked in `admin_finances` table for P&L reporting in [[Command Center]].

## Related Notes

- [[Call]]
- [[Agent]]
- [[Command Center]]
