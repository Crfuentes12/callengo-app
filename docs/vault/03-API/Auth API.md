---
tags: [api, auth, team]
---

# Auth API

Authentication and team management endpoints.

## Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Register new user + create company |
| POST | `/api/auth/login` | Email/password login |
| GET | `/api/auth/callback` | OAuth callback (Google, GitHub) |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/auth/session` | Get current session |

## Team Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/team/members` | List team members |
| POST | `/api/team/invite` | Send team invitation |
| POST | `/api/team/accept-invite` | Accept invitation by token |
| PUT | `/api/team/members/[id]/role` | Update member role |
| DELETE | `/api/team/members/[id]` | Remove team member |

## Auth Flow

1. Supabase Auth handles email/password + OAuth (Google, GitHub)
2. `middleware.ts` protects routes at Edge level
3. `AuthContext.tsx` provides client-side auth state
4. API routes use `createServerSupabaseClient()` for server-side auth

## Related Notes

- [[User]]
- [[Team Invitation]]
- [[Company]]
