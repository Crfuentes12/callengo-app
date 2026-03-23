---
tags: [entity, core, auth]
aliases: [Team Member]
---

# User

A person with access to the platform. Users belong to exactly one [[Company]].

## Database Table: `users`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK → auth.users | CASCADE |
| company_id | UUID FK → companies | |
| email | TEXT | Protected by trigger |
| role | TEXT | owner, admin, member, invited_member |
| currency | VARCHAR(3) | Default 'USD' |
| country_code | VARCHAR(2) | Via geolocation |
| country_name | VARCHAR(100) | |
| city | VARCHAR(100) | |
| region | VARCHAR(100) | |
| timezone | VARCHAR(50) | |
| ip_address | VARCHAR(45) | |
| location_logs | JSONB | Historical locations |
| location_updated_at | TIMESTAMPTZ | |
| fav_voices | JSONB | Saved Bland AI voices |
| notifications_enabled | BOOLEAN | Default true |

## Roles

| Role | Capabilities |
|------|-------------|
| **owner** | Full access, billing management, admin panel |
| **admin** | Full access, team management, billing |
| **member** | Standard access, no billing or team management |
| **invited_member** | Pre-acceptance state |

## Security Triggers

1. **`prevent_role_self_escalation`** — Users cannot change their own `role` column
2. **`prevent_sensitive_field_changes`** — Users cannot change their own `company_id` or `email`

## RLS Policies

- SELECT/INSERT/UPDATE: `id = auth.uid()` (self-only)
- Service role bypass for API operations

## Geolocation

- Auto-detected via `useAutoGeolocation` hook
- Stored fields: country_code, country_name, city, region, timezone, ip_address
- Location history in `location_logs` JSONB array
- Used for i18n language detection and currency defaults

## Related Notes

- [[Company]]
- [[Team Invitation]]
- [[RLS Patterns]]
