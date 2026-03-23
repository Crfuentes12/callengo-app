---
tags: [entity, team]
---

# Team Invitation

Invitations for new members to join a [[Company]].

## Database Table: `team_invitations`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| company_id | UUID FK → companies | CASCADE |
| invited_by | UUID FK → users | CASCADE |
| email | TEXT | Invitee email |
| role | TEXT CHECK | member, admin |
| status | TEXT CHECK | pending, accepted, expired, cancelled, declined, revoked |
| token | UUID | Auto-generated, used for accept link |
| expires_at | TIMESTAMPTZ | Default NOW() + 7 days |
| accepted_at | TIMESTAMPTZ | |

## Constraints

- **UNIQUE:** `(company_id, email, status)` — prevents duplicate pending invites
- **RLS:** Only admin/owner roles can SELECT/INSERT/UPDATE/DELETE

## Seat Limits by Plan

| Plan | Max Users |
|------|-----------|
| Free / Starter / Growth | 1 |
| Business | 3 |
| Teams | 5 |
| Enterprise | Unlimited |

Extra seats available at $49/mo for Business and Teams plans.

## Related Notes

- [[User]]
- [[Company]]
- [[Subscription]]
