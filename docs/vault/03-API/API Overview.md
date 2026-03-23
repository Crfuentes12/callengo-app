---
tags: [api, endpoints, backend]
---

# API Overview

142 API routes implemented as Next.js API Routes (serverless) in `src/app/api/`.

## Endpoint Groups

| Group | Routes | Description | See |
|-------|--------|-------------|-----|
| Billing | 13 | Plans, checkout, portal, usage, overage | [[Billing API]] |
| Bland AI | 4 | Webhooks, send-call, status, phone-numbers | [[Bland AI API]] |
| Calendar | 10 | Events, integrations, sync, availability | [[Calendar API]] |
| Admin | 8 | Command center, monitor, cleanup, finances | [[Admin API]] |
| Integrations | 60+ | OAuth flows + CRUD for 7 CRMs + Google Sheets | [[Integrations API]] |
| Contacts | 4-8 | CRUD, import, export | [[Contacts API]] |
| Team/Auth | 7 | Invitations, members, verify, roles | [[Auth API]] |
| Company | 3 | Settings, company info | |
| Campaigns | 1 | Campaign CRUD | |
| OpenAI | 3 | Analysis, intent, chat | |
| Webhooks | 5 | Stripe + outbound webhook management | |
| Queue | 2 | Campaign/call queue processing | |
| AI Chat | 1 | AI assistant | |
| Misc | 5 | Seed, geolocation, voices, health | |

## Common Patterns

### Authentication
All protected endpoints use `createServerSupabaseClient()` and verify `auth.getUser()`:
```typescript
const supabase = await createServerSupabaseClient();
const { data: { user }, error } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

### Company Resolution
After auth, resolve user's company:
```typescript
const { data: userData } = await supabase
  .from('users')
  .select('company_id, role')
  .eq('id', user.id)
  .single();
```

### Validation
Input validation via Zod schemas:
```typescript
const schema = z.object({
  phone_number: z.string().min(1),
  agent_id: z.string().uuid(),
});
const body = schema.parse(await request.json());
```

### Error Handling
Standard error response pattern:
```typescript
return NextResponse.json(
  { error: 'Description' },
  { status: 400|401|403|404|500 }
);
```

## Known Issues

- **Rate limiting not applied** — `src/lib/rate-limit.ts` exists but is not used on any endpoint
- **No test coverage** — No test runner configured

## Related Notes

- [[Architecture Overview]]
- [[RLS Patterns]]
