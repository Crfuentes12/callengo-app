---
tags: [workflow, ux]
---

# Onboarding Flow

New user registration and initial setup.

## Flow

```
1. User signs up (/auth/signup)
   ├── Email/password or OAuth (Google, GitHub)
   └── Supabase Auth creates auth.users entry

2. Post-signup hook creates:
   ├── companies entry (new company)
   ├── users entry (role: owner, linked to company)
   └── company_settings entry (defaults)

3. Redirect to /onboarding
   ├── Company details (name, industry, size)
   ├── Agent selection (which agent types to use)
   └── Optional: connect first integration

4. Free plan auto-assigned
   ├── company_subscriptions entry (status: active, plan: free)
   └── usage_tracking entry (15 one-time minutes)

5. Redirect to /home
```

## Post-Onboarding

- User sees dashboard with guided setup steps
- Geolocation auto-detected for i18n and currency
- Demo data may be present (known issue: seed data in production)

## Related Notes

- [[User]]
- [[Company]]
- [[Subscription]]
