# Callengo - Email Templates Setup Guide

## Templates Included

| Template File | Supabase Auth Template | Purpose |
|---|---|---|
| `confirm-signup.html` | **Confirm signup** | Sent when a new user registers |
| `reset-password.html` | **Reset password** | Sent when user requests password reset |
| `magic-link.html` | **Magic link** | Sent for passwordless sign-in |
| `invite-user.html` | **Invite user** | Sent when inviting a user to your team |
| `change-email.html` | **Change email address** | Sent when user changes their email |

## How to Configure in Supabase

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** > **Email Templates**
3. For each template type:
   - Select the template type from the dropdown
   - Set the **Subject** as listed below
   - Paste the HTML content from the corresponding file
   - Click **Save**

### Email Subjects

| Template | Subject Line |
|---|---|
| Confirm signup | `Verify your email address - Callengo` |
| Reset password | `Reset your password - Callengo` |
| Magic link | `Sign in to Callengo` |
| Invite user | `You're invited to join Callengo` |
| Change email | `Confirm your new email - Callengo` |

### Option 2: Supabase Config (config.toml)

Add to your `supabase/config.toml`:

```toml
[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = true

[auth.email.template.confirmation]
subject = "Verify your email address - Callengo"
content_path = "./supabase/email-templates/confirm-signup.html"

[auth.email.template.recovery]
subject = "Reset your password - Callengo"
content_path = "./supabase/email-templates/reset-password.html"

[auth.email.template.magic_link]
subject = "Sign in to Callengo"
content_path = "./supabase/email-templates/magic-link.html"

[auth.email.template.invite]
subject = "You're invited to join Callengo"
content_path = "./supabase/email-templates/invite-user.html"

[auth.email.template.email_change]
subject = "Confirm your new email - Callengo"
content_path = "./supabase/email-templates/change-email.html"
```

## Template Variables (Supabase)

These Go template variables are used and automatically filled by Supabase:

| Variable | Description |
|---|---|
| `{{ .SiteURL }}` | Your site URL (e.g., `https://app.callengo.com`) |
| `{{ .ConfirmationURL }}` | The action link (verify, reset, sign-in, etc.) |
| `{{ .Token }}` | The raw token (if needed) |
| `{{ .TokenHash }}` | The hashed token |
| `{{ .Data }}` | User metadata from sign-up |
| `{{ .Email }}` | The user's email address |
| `{{ .CurrentYear }}` | Current year (note: not built-in, see below) |

> **Note on `{{ .CurrentYear }}`:** Supabase does not provide a built-in `CurrentYear` variable. You can either:
> - Replace `{{ .CurrentYear }}` with a hardcoded year (e.g., `2026`)
> - Or remove the year line from the footer

## Design System

All templates follow the Callengo brand:

- **Primary gradient:** `#173657` → `#2e3a76` → `#8938b0`
- **Background:** `#f0f1f8` (primary-50)
- **Card:** White with 16px border-radius, subtle shadow
- **Top bar:** 4px gradient accent
- **Logo:** `callengo-fill.png` at 56x56 with 14px border-radius
- **Font:** Inter (falls back to system fonts)
- **Button:** Gradient background, 12px border-radius, subtle shadow

## Email Client Compatibility

These templates are tested for:

- Gmail (web + mobile)
- Apple Mail (macOS + iOS)
- Outlook (2016+, web, mobile)
- Yahoo Mail
- Samsung Email
- Thunderbird

Key compatibility techniques used:
- Table-based layout (no flexbox/grid)
- Inline CSS only (no external stylesheets)
- MSO conditional comments for Outlook VML buttons
- `role="presentation"` on all layout tables
- Responsive `@media` queries for mobile
- Preheader text for inbox previews
- `x-apple-disable-message-reformatting` meta tag
