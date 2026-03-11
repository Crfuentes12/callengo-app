# Google Analytics 4 (GA4) — Documentación Completa de Implementación

> Documento maestro de la implementación de analytics en Callengo.
> Última actualización: Marzo 2026

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura General](#arquitectura-general)
3. [Setup Guide — Configuración Inicial](#setup-guide)
4. [Variables de Entorno](#variables-de-entorno)
5. [Componentes del Sistema](#componentes-del-sistema)
6. [Catálogo Completo de Eventos](#catálogo-completo-de-eventos)
7. [User Properties (Segmentación de Audiencias)](#user-properties)
8. [Server-Side Tracking (Measurement Protocol)](#server-side-tracking)
9. [Integración por Componente](#integración-por-componente)
10. [Flujo de Inicialización](#flujo-de-inicialización)
11. [Configuración Recomendada en GA4](#configuración-recomendada-en-ga4)
12. [Debugging y Desarrollo Local](#debugging-y-desarrollo-local)
13. [Convenciones y Buenas Prácticas](#convenciones-y-buenas-prácticas)
14. [Referencia Rápida de Archivos](#referencia-rápida-de-archivos)

---

## Resumen Ejecutivo

Callengo implementa un sistema de analytics completo basado en **Google Analytics 4 (GA4)** que rastrea todo el comportamiento de usuario en la plataforma. La implementación cubre:

- **20 categorías de eventos** que abarcan todo el journey del usuario
- **130+ eventos únicos** desde signup hasta churn
- **Tracking client-side** via `@next/third-parties/google` (gtag.js)
- **Tracking server-side** via GA4 Measurement Protocol (API routes y webhooks)
- **9 user properties** para segmentación avanzada de audiencias
- **Tracking de page views** automático por sección vía componente `PageTracker`
- **Identificación de usuarios** autenticados con anonimización (UUID, nunca email)

### ¿Qué NO trackea?

- Información personal identificable (PII): emails, nombres, teléfonos
- Contenido de llamadas, transcripciones o análisis
- Datos financieros sensibles (números de tarjeta, etc.)
- Eventos en desarrollo/staging (solo producción)

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                         │
│                                                                 │
│  ┌──────────────┐   ┌──────────────────┐   ┌────────────────┐  │
│  │ GoogleAnalytics│   │ AnalyticsProvider │   │  PageTracker   │  │
│  │  (Root Layout) │   │  (App Layout)     │   │ (Each Page)    │  │
│  │               │   │                  │   │                │  │
│  │  Carga gtag.js│   │  setUserProps()  │   │  pageViewed()  │  │
│  └──────┬───────┘   └────────┬─────────┘   └───────┬────────┘  │
│         │                    │                      │           │
│         ▼                    ▼                      ▼           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              src/lib/analytics.ts                         │   │
│  │                                                          │   │
│  │  track(eventName, params)  →  sendGAEvent()  →  gtag()   │   │
│  │                                                          │   │
│  │  20 export objects:                                      │   │
│  │  authEvents, billingEvents, agentEvents, campaignEvents, │   │
│  │  callEvents, contactEvents, integrationEvents, ...       │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                   │
│                             ▼                                   │
│                    Google Analytics 4                            │
│                    (gtag.js → GA4)                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        SERVER (API Routes)                       │
│                                                                 │
│  ┌────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │ Stripe Webhook  │  │ Bland AI Webhook  │  │ Contact Import │  │
│  │ /api/webhooks/  │  │ /api/bland/       │  │ /api/contacts/ │  │
│  │ stripe          │  │ webhook           │  │ import         │  │
│  └───────┬────────┘  └────────┬─────────┘  └───────┬────────┘  │
│          │                    │                     │           │
│          ▼                    ▼                     ▼           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         trackServerEvent(clientId, userId, event, params) │   │
│  │                                                          │   │
│  │   POST https://google-analytics.com/mp/collect           │   │
│  │   ?measurement_id=G-XXXXXXXXXX                           │   │
│  │   &api_secret=XXXXXXXXXX                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Setup Guide

### Paso 1: Crear una Propiedad GA4

1. Ve a [Google Analytics](https://analytics.google.com/)
2. Click **Admin** (⚙️) → **Create Property**
3. Nombre: `Callengo - Production` (o `Callengo - Staging`)
4. Zona horaria y moneda según tu operación
5. Selecciona **Web** como plataforma
6. Ingresa tu dominio (ej: `app.callengo.com`)
7. Copia el **Measurement ID** (formato: `G-XXXXXXXXXX`)

### Paso 2: Crear un API Secret (Measurement Protocol)

Necesario para el tracking server-side (webhooks de Stripe, Bland AI, etc.):

1. En GA4, ve a **Admin** → **Data Streams** → selecciona tu stream web
2. Scroll a **Measurement Protocol API secrets**
3. Click **Create** → Nombre: `Callengo Server` → **Create**
4. Copia el **API Secret** generado

### Paso 3: Configurar Variables de Entorno

Agrega estas variables en tu plataforma de deploy:

#### En Vercel (Producción)

```bash
# Dashboard de Vercel → Settings → Environment Variables

NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX    # Tu Measurement ID de GA4
GA_API_SECRET=XXXXXXXXXXXXXXXX                 # API Secret del Measurement Protocol
```

#### En `.env.local` (Desarrollo)

```bash
# NO configurar en desarrollo — los eventos se loguean en console.debug()
# Si necesitas probar la integración real, usa el Measurement ID de una propiedad de testing:

# NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TESTING1234
# GA_API_SECRET=test_secret_here
```

> **Importante:** `NEXT_PUBLIC_` hace que la variable esté disponible en el browser. `GA_API_SECRET` solo está disponible server-side, lo cual es correcto por seguridad.

### Paso 4: Configurar Custom Dimensions en GA4

Para que los user properties y event parameters sean utilizables en reportes, debes registrarlos como **Custom Dimensions** en GA4:

#### User-Scoped Custom Dimensions

| Nombre Display | Event Parameter | Scope |
|---|---|---|
| Plan Slug | `plan_slug` | User |
| Billing Cycle | `billing_cycle` | User |
| Company Industry | `company_industry` | User |
| Team Size | `team_size` | User |
| Country Code | `country_code` | User |
| Currency | `currency` | User |
| Integrations Count | `integrations_count` | User |
| Contacts Count | `contacts_count` | User |

**Cómo crear:**
1. GA4 → **Admin** → **Custom definitions** → **Custom dimensions**
2. Click **Create custom dimension**
3. Dimension name: (ej. `Plan Slug`)
4. Scope: **User**
5. User property: (ej. `plan_slug`)
6. Repetir para cada propiedad

#### Event-Scoped Custom Dimensions (Recomendadas)

| Nombre Display | Event Parameter |
|---|---|
| Agent Type | `agent_type` |
| Provider | `provider` |
| Filter Type | `filter_type` |
| Source | `source` |
| Plan | `plan` |
| Billing Cycle (Event) | `billing_cycle` |
| Addon Type | `addon_type` |
| Integration Type | `integration_type` |
| Error Type | `error_type` |
| Section | `section` |

**Cómo crear:**
1. GA4 → **Admin** → **Custom definitions** → **Custom dimensions**
2. Click **Create custom dimension**
3. Scope: **Event**
4. Event parameter: (ej. `agent_type`)
5. Repetir para cada parámetro que quieras usar en reportes

#### Custom Metrics (Recomendadas)

| Nombre Display | Event Parameter | Unit |
|---|---|---|
| Value | `value` | Currency (USD) |
| Duration Seconds | `duration_seconds` | Standard |
| Contact Count | `contact_count` | Standard |
| Usage Percent | `usage_percent` | Standard |
| Row Count | `row_count` | Standard |
| Records Created | `records_created` | Standard |

### Paso 5: Configurar Conversiones en GA4

Marca estos eventos como **Key Events** (conversiones) en GA4:

1. GA4 → **Admin** → **Events** → **Mark as key event**

| Evento | Prioridad | Descripción |
|---|---|---|
| `sign_up` | Alta | Registro de nuevo usuario |
| `subscription_started` | Alta | Nueva suscripción de pago |
| `purchase` | Alta | Evento ecommerce (duplicado de subscription_started) |
| `checkout_started` | Alta | Inicio de checkout |
| `subscription_upgraded` | Alta | Upgrade de plan |
| `agent_created` | Media | Creación de agente de IA |
| `campaign_created` | Media | Creación de campaña |
| `campaign_started` | Media | Inicio de campaña |
| `onboarding_completed` | Media | Onboarding completado |
| `integration_connected` | Media | Integración conectada |
| `contacts_imported` | Baja | Importación de contactos |

### Paso 6: Vincular con Google Ads (Opcional)

Si usas Google Ads para adquisición:

1. GA4 → **Admin** → **Product links** → **Google Ads links**
2. Vincula tu cuenta de Google Ads
3. Habilita **Auto-tagging** en Google Ads
4. Los key events se importarán automáticamente como conversiones en Ads

### Paso 7: Configurar BigQuery Export (Recomendado)

Para análisis avanzado con SQL:

1. GA4 → **Admin** → **BigQuery links**
2. Vincula un proyecto de Google Cloud
3. Selecciona **Daily** export (gratis) o **Streaming** ($$$)
4. Dataset: `analytics_PROPERTY_ID`

---

## Variables de Entorno

| Variable | Tipo | Requerida | Descripción |
|---|---|---|---|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `string` | Sí | Measurement ID de GA4 (formato: `G-XXXXXXXXXX`). Pública (visible en el browser). |
| `GA_API_SECRET` | `string` | Solo server-side | API Secret del Measurement Protocol. Privada (solo server). Necesaria para tracking en API routes y webhooks. |

**Comportamiento sin variables:**
- Sin `NEXT_PUBLIC_GA_MEASUREMENT_ID`: No se carga gtag.js, no se trackea nada client-side ni server-side
- Sin `GA_API_SECRET`: El tracking client-side funciona normalmente; el server-side (`trackServerEvent`) no se ejecuta

---

## Componentes del Sistema

### 1. Core: `src/lib/analytics.ts` (1,022 líneas)

Módulo central que exporta toda la lógica de tracking. Contiene:

- **`track(eventName, params)`** — Función interna que envía eventos client-side via `sendGAEvent()` de `@next/third-parties/google`. Solo se ejecuta en producción; en desarrollo loguea a `console.debug()`.
- **`setUserProperties(props)`** — Configura propiedades de usuario en GA4 usando `window.gtag('config', ...)`. Llamada una vez por sesión.
- **`clearUserProperties()`** — Limpia la identidad del usuario al hacer logout.
- **`trackServerEvent(clientId, userId, eventName, params)`** — Envía eventos server-side usando el GA4 Measurement Protocol (HTTP POST).
- **20 objetos de eventos exportados** — Cada uno agrupa eventos por dominio funcional.

### 2. Provider: `src/components/analytics/AnalyticsProvider.tsx` (69 líneas)

Componente React client-side que:
- Se monta en el layout protegido `src/app/(app)/layout.tsx`
- Recibe props del usuario autenticado (userId, plan, billing cycle, industry, etc.)
- Llama `setUserProperties()` para identificar al usuario en GA4
- Escucha `SIGNED_OUT` de Supabase Auth para limpiar la identidad
- Renderiza `null` — componente de efecto puro

**Props que recibe:**
```typescript
interface AnalyticsProviderProps {
  userId: string           // UUID de Supabase, nunca email
  planSlug?: string        // free | starter | growth | business | teams | enterprise
  billingCycle?: string    // monthly | annual
  companyIndustry?: string // Industria de la empresa
  teamSize?: number        // Número de miembros del equipo
  countryCode?: string     // Código ISO del país
  currency?: string        // USD | EUR | GBP
}
```

### 3. Page Tracker: `src/components/analytics/PageTracker.tsx` (68 líneas)

Componente React que dispara el evento `pageViewed()` correspondiente a cada sección:

```typescript
type TrackedPage =
  | 'dashboard' | 'agents' | 'campaigns' | 'calls'
  | 'contacts' | 'integrations' | 'calendar' | 'follow-ups'
  | 'voicemails' | 'team' | 'settings' | 'analytics'
  | 'reports' | 'pricing'
```

**Uso:**
```tsx
// En cualquier página protegida:
<PageTracker page="agents" />
```

Usa `useRef` para garantizar que el evento solo se dispare una vez por mount.

### 4. GA4 Script: Root Layout (`src/app/layout.tsx`)

```tsx
import { GoogleAnalytics } from '@next/third-parties/google'

// En el <body>:
{process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
  <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
)}
```

Inyecta el script `gtag.js` de Google condicionalmente solo si la variable de entorno existe.

---

## Catálogo Completo de Eventos

### 1. Authentication Events (`authEvents`)

| Método | Evento GA4 | Parámetros | Disparado en |
|---|---|---|---|
| `signUp(method)` | `sign_up` | `method`: email\|google\|azure\|slack | Signup page |
| `login(method)` | `login` | `method`: email\|google\|azure\|slack | Login page |
| `logout()` | `logout` | — | AuthContext |
| `passwordResetRequested()` | `password_reset_requested` | — | Forgot password |
| `passwordResetCompleted()` | `password_reset_completed` | — | Reset password |
| `emailVerified()` | `email_verified` | — | Verify email |
| `verificationEmailResent()` | `verification_email_resent` | — | Verify email |
| `socialAuthClicked(provider)` | `social_auth_clicked` | `provider`: google\|azure\|slack | SocialAuthButtons |

### 2. Onboarding Events (`onboardingEvents`)

| Método | Evento GA4 | Parámetros |
|---|---|---|
| `started()` | `onboarding_started` | — |
| `stepCompleted(stepName, stepNumber)` | `onboarding_step_completed` | `step_name`, `step_number` |
| `companyCreated(industry?)` | `onboarding_company_created` | `industry` |
| `completed(industry?)` | `onboarding_completed` | `industry` |
| `skipped(atStep)` | `onboarding_skipped` | `at_step` |

### 3. Billing & Subscription Events (`billingEvents`)

| Método | Evento GA4 | Parámetros |
|---|---|---|
| `pricingPageViewed(source?)` | `pricing_page_viewed` | `source` |
| `planComparisonViewed()` | `plan_comparison_viewed` | — |
| `checkoutStarted(plan, billingCycle, value)` | `checkout_started` | `plan`, `billing_cycle`, `value`, `currency` |
| `subscriptionStarted(plan, billingCycle, value)` | `subscription_started` + `purchase` | `plan`, `billing_cycle`, `value`, `currency`, `transaction_id` |
| `subscriptionUpgraded(fromPlan, toPlan, newValue)` | `subscription_upgraded` | `from_plan`, `to_plan`, `value`, `currency` |
| `subscriptionDowngraded(fromPlan, toPlan)` | `subscription_downgraded` | `from_plan`, `to_plan` |
| `subscriptionCancelled(plan, reason?, months?)` | `subscription_cancelled` | `plan`, `reason`, `months_subscribed` |
| `subscriptionReactivated(plan)` | `subscription_reactivated` | `plan` |
| `billingPortalOpened()` | `billing_portal_opened` | — |
| `addonPurchased(addonType, value)` | `addon_purchased` | `addon_type`, `value`, `currency` |
| `addonCancelled(addonType)` | `addon_cancelled` | `addon_type` |
| `overageEnabled(budgetAmount)` | `overage_enabled` | `budget_amount` |
| `overageDisabled()` | `overage_disabled` | — |
| `overageBudgetUpdated(budgetAmount)` | `overage_budget_updated` | `budget_amount` |
| `retentionOfferShown(plan, months)` | `retention_offer_shown` | `plan`, `months_subscribed` |
| `retentionOfferAccepted(plan, discountType)` | `retention_offer_accepted` | `plan`, `discount_type` |
| `retentionOfferDeclined(plan)` | `retention_offer_declined` | `plan` |
| `upgradeCtaClicked(location, currentPlan?, targetPlan?)` | `upgrade_cta_clicked` | `location`, `current_plan`, `target_plan` |
| `extraSeatPurchased(totalSeats)` | `extra_seat_purchased` | `total_seats`, `value` (49), `currency` |
| `billingCycleToggled(cycle)` | `billing_cycle_toggled` | `billing_cycle`: monthly\|annual |
| `invoiceViewed()` | `invoice_viewed` | — |

> **Nota:** `subscriptionStarted` dispara **dos** eventos: `subscription_started` (custom) y `purchase` (evento ecommerce estándar de GA4).

### 4. Agent Events (`agentEvents`)

| Método | Evento GA4 | Parámetros |
|---|---|---|
| `pageViewed()` | `agents_page_viewed` | — |
| `cardClicked(agentType)` | `agent_card_clicked` | `agent_type` |
| `configModalOpened(agentType)` | `agent_config_modal_opened` | `agent_type` |
| `configStepCompleted(agentType, stepName, stepNumber)` | `agent_config_step_completed` | `agent_type`, `step_name`, `step_number` |
| `configModalClosed(agentType, completedSteps)` | `agent_config_modal_closed` | `agent_type`, `completed_steps` |
| `created(agentType, name)` | `agent_created` | `agent_type`, `agent_name` |
| `deleted(agentType)` | `agent_deleted` | `agent_type` |
| `switched(fromType, toType)` | `agent_switched` | `from_type`, `to_type` |
| `voiceSelected(voiceId, voiceName, gender)` | `agent_voice_selected` | `voice_id`, `voice_name`, `voice_gender` |
| `voicePreviewed(voiceId)` | `agent_voice_previewed` | `voice_id` |
| `voiceFavorited(voiceId)` | `agent_voice_favorited` | `voice_id` |
| `testCallInitiated(agentType)` | `test_call_initiated` | `agent_type` |
| `testCallCompleted(agentType, duration, status)` | `test_call_completed` | `agent_type`, `duration_seconds`, `call_status` |
| `settingsUpdated(agentType, settingName)` | `agent_settings_updated` | `agent_type`, `setting_name` |
| `integrationConnected(agentType, provider)` | `agent_integration_connected` | `agent_type`, `integration_provider` |

### 5. Campaign Events (`campaignEvents`)

| Método | Evento GA4 | Parámetros |
|---|---|---|
| `pageViewed()` | `campaigns_page_viewed` | — |
| `newCampaignClicked()` | `new_campaign_clicked` | — |
| `aiRecommendationRequested(descriptionLength)` | `ai_agent_recommendation_requested` | `description_length` |
| `aiRecommendationSelected(recommended, selected)` | `ai_agent_recommendation_selected` | `recommended_type`, `selected_type`, `matched` |
| `created(params)` | `campaign_created` | `agent_type`, `contact_count`, `follow_up_enabled`, `voicemail_enabled`, `calendar_enabled` |
| `started(agentType, contactCount)` | `campaign_started` | `agent_type`, `contact_count` |
| `paused(agentType, completed, total)` | `campaign_paused` | `agent_type`, `calls_completed`, `total_contacts`, `progress_percent` |
| `resumed(agentType)` | `campaign_resumed` | `agent_type` |
| `completed(params)` | `campaign_completed` | `agent_type`, `total_contacts`, `completed_calls`, `successful_calls`, `failed_calls`, `success_rate` |
| `deleted(agentType)` | `campaign_deleted` | `agent_type` |
| `detailViewed(agentType, status)` | `campaign_detail_viewed` | `agent_type`, `campaign_status` |
| `filtered(filterType, filterValue)` | `campaigns_filtered` | `filter_type`, `filter_value` |
| `searched(queryLength)` | `campaigns_searched` | `query_length` |

### 6. Call Events (`callEvents`)

| Método | Evento GA4 | Parámetros |
|---|---|---|
| `pageViewed()` | `calls_page_viewed` | — |
| `detailOpened(callStatus, agentType?)` | `call_detail_opened` | `call_status`, `agent_type` |
| `recordingPlayed(agentType, duration)` | `call_recording_played` | `agent_type`, `duration_seconds` |
| `transcriptViewed(agentType)` | `call_transcript_viewed` | `agent_type` |
| `analysisViewed(agentType, sentiment?, interest?)` | `call_analysis_viewed` | `agent_type`, `sentiment`, `interest_level` |
| `filtered(filterType, filterValue)` | `calls_filtered` | `filter_type`, `filter_value` |
| `searched(queryLength, resultsCount)` | `calls_searched` | `query_length`, `results_count` |
| `exportRequested(format)` | `calls_export_requested` | `format` |

### 7. Contact Events (`contactEvents`)

| Método | Evento GA4 | Parámetros |
|---|---|---|
| `pageViewed()` | `contacts_page_viewed` | — |
| `created(source)` | `contact_created` | `source` |
| `imported(source, count, method)` | `contacts_imported` | `source`, `count`, `method` |
| `exported(format, count)` | `contacts_exported` | `format`, `count` |
| `listCreated()` | `contact_list_created` | — |
| `listDeleted()` | `contact_list_deleted` | — |
| `edited(fieldsChanged)` | `contact_edited` | `fields_changed` |
| `deleted(count)` | `contacts_deleted` | `count` |
| `bulkDeleted(count)` | `contacts_bulk_deleted` | `count` |
| `searched(queryLength, resultsCount)` | `contacts_searched` | `query_length`, `results_count` |
| `filtered(filterType)` | `contacts_filtered` | `filter_type` |
| `sorted(sortField, sortDirection)` | `contacts_sorted` | `sort_field`, `sort_direction` |
| `detailViewed()` | `contact_detail_viewed` | — |
| `aiSegmentationUsed(contactCount)` | `ai_segmentation_used` | `contact_count` |
| `csvImportStarted()` | `csv_import_started` | — |
| `csvImportCompleted(rowCount, columnsMatched)` | `csv_import_completed` | `row_count`, `columns_matched` |
| `csvImportFailed(errorType)` | `csv_import_failed` | `error_type` |
| `googleSheetsImportStarted()` | `google_sheets_import_started` | — |
| `googleSheetsImportCompleted(rowCount)` | `google_sheets_import_completed` | `row_count` |
| `crmSubpageViewed(provider)` | `crm_contacts_subpage_viewed` | `provider` |
| `crmContactsImported(provider, count)` | `crm_contacts_imported` | `provider`, `count` |

### 8. Integration Events (`integrationEvents`)

| Método | Evento GA4 | Parámetros |
|---|---|---|
| `pageViewed()` | `integrations_page_viewed` | — |
| `connectStarted(provider, type)` | `integration_connect_started` | `provider`, `integration_type` |
| `connected(provider, type)` | `integration_connected` | `provider`, `integration_type` |
| `disconnected(provider, type)` | `integration_disconnected` | `provider`, `integration_type` |
| `syncStarted(provider)` | `integration_sync_started` | `provider` |
| `syncCompleted(provider, created, updated)` | `integration_sync_completed` | `provider`, `records_created`, `records_updated`, `total_records` |
| `syncFailed(provider, errorType)` | `integration_sync_failed` | `provider`, `error_type` |
| `slackNotificationsConfigured(channels)` | `slack_notifications_configured` | `channels_count` |
| `webhookCreated()` | `webhook_endpoint_created` | — |
| `webhookDeleted()` | `webhook_endpoint_deleted` | — |
| `feedbackSubmitted(feedbackType)` | `integration_feedback_submitted` | `feedback_type` |

### 9. Calendar Events (`calendarEvents`)

| Método | Evento GA4 | Parámetros |
|---|---|---|
| `pageViewed()` | `calendar_page_viewed` | — |
| `viewChanged(view)` | `calendar_view_changed` | `view` |
| `dateNavigated(direction)` | `calendar_date_navigated` | `direction` |
| `eventCreated(eventType, source)` | `calendar_event_created` | `event_type`, `source` |
| `eventRescheduled(eventType)` | `calendar_event_rescheduled` | `event_type` |
| `eventCancelled(eventType)` | `calendar_event_cancelled` | `event_type` |
| `eventClicked(eventType)` | `calendar_event_clicked` | `event_type` |
| `filterApplied(filterType)` | `calendar_filter_applied` | `filter_type` |
| `timezoneChanged(timezone)` | `calendar_timezone_changed` | `timezone` |
| `workingHoursUpdated(start, end)` | `calendar_working_hours_updated` | `start`, `end` |
| `syncTriggered(provider)` | `calendar_sync_triggered` | `provider` |
| `teamMemberAssigned()` | `calendar_team_member_assigned` | — |

### 10. Follow-Up Events (`followUpEvents`)

| Método | Evento GA4 | Parámetros |
|---|---|---|
| `pageViewed()` | `follow_ups_page_viewed` | — |
| `filtered(status)` | `follow_ups_filtered` | `status` |
| `searched(queryLength)` | `follow_ups_searched` | `query_length` |
| `detailViewed(reason, attemptNumber)` | `follow_up_detail_viewed` | `reason`, `attempt_number` |

### 11. Voicemail Events (`voicemailEvents`)

| Método | Evento GA4 | Parámetros |
|---|---|---|
| `pageViewed()` | `voicemails_page_viewed` | — |
| `played(durationSeconds)` | `voicemail_played` | `duration_seconds` |
| `filtered(filterType)` | `voicemails_filtered` | `filter_type` |
| `searched(queryLength)` | `voicemails_searched` | `query_length` |

### 12. Team Events (`teamEvents`)

| Método | Evento GA4 | Parámetros |
|---|---|---|
| `pageViewed()` | `team_page_viewed` | — |
| `memberInvited(role, method)` | `team_member_invited` | `role`, `method` |
| `memberRemoved()` | `team_member_removed` | — |
| `memberRoleChanged(fromRole, toRole)` | `team_member_role_changed` | `from_role`, `to_role` |
| `bulkInviteSent(count, source)` | `team_bulk_invite_sent` | `count`, `source` |
| `inviteResent()` | `team_invite_resent` | — |
| `inviteCancelled()` | `team_invite_cancelled` | — |

### 13. Navigation Events (`navigationEvents`)

| Método | Evento GA4 | Parámetros |
|---|---|---|
| `sidebarClicked(destination)` | `sidebar_navigation_clicked` | `destination` |
| `notificationClicked(type)` | `notification_clicked` | `notification_type` |
| `notificationDismissed()` | `notification_dismissed` | — |
| `notificationsBellClicked(unreadCount)` | `notifications_bell_clicked` | `unread_count` |
| `allNotificationsMarkedRead()` | `all_notifications_marked_read` | — |
| `languageChanged(fromLang, toLang)` | `language_changed` | `from_lang`, `to_lang` |
| `searchPerformed(section, queryLength)` | `search_performed` | `section`, `query_length` |

### 14. Settings Events (`settingsEvents`)

| Método | Evento GA4 | Parámetros |
|---|---|---|
| `pageViewed()` | `settings_page_viewed` | — |
| `tabChanged(tabName)` | `settings_tab_changed` | `tab_name` |
| `companyProfileUpdated()` | `company_profile_updated` | — |
| `defaultVoiceChanged(voiceId)` | `default_voice_changed` | `voice_id` |
| `testPhoneUpdated()` | `test_phone_updated` | — |
| `notificationPreferencesUpdated(enabled)` | `notification_preferences_updated` | `enabled` |

### 15. Dashboard Events (`dashboardEvents`)

| Método | Evento GA4 | Parámetros |
|---|---|---|
| `pageViewed()` | `dashboard_page_viewed` | — |
| `quickStartAgentClicked(agentType)` | `dashboard_quick_start_clicked` | `agent_type` |
| `recentCallClicked()` | `dashboard_recent_call_clicked` | — |
| `recentCampaignClicked()` | `dashboard_recent_campaign_clicked` | — |
| `usageMeterViewed(usagePercent)` | `dashboard_usage_meter_viewed` | `usage_percent` |

### 16. Analytics & Reports Events (`analyticsPageEvents`)

| Método | Evento GA4 | Parámetros |
|---|---|---|
| `pageViewed()` | `analytics_page_viewed` | — |
| `periodChanged(period)` | `analytics_period_changed` | `period` |
| `reportExported(format)` | `report_exported` | `format` |
| `reportsPageViewed()` | `reports_page_viewed` | — |
| `chartInteracted(chartType)` | `chart_interacted` | `chart_type` |

### 17. AI Chat Events (`aiChatEvents`)

| Método | Evento GA4 | Parámetros |
|---|---|---|
| `started()` | `ai_chat_started` | — |
| `messageSent(messageLength)` | `ai_chat_message_sent` | `message_length` |
| `conversationCreated()` | `ai_chat_conversation_created` | — |
| `conversationDeleted()` | `ai_chat_conversation_deleted` | — |

### 18. Error & Performance Events (`errorEvents`)

| Método | Evento GA4 | Parámetros |
|---|---|---|
| `apiError(endpoint, statusCode)` | `api_error` | `endpoint`, `status_code` |
| `clientError(errorType, component)` | `client_error` | `error_type`, `component` |
| `paymentFailed(plan, errorType)` | `payment_failed` | `plan`, `error_type` |

### 19. Engagement & Feature Discovery Events (`engagementEvents`)

| Método | Evento GA4 | Parámetros |
|---|---|---|
| `featureDiscovered(featureName)` | `feature_discovered` | `feature_name` |
| `tooltipViewed(tooltipId)` | `tooltip_viewed` | `tooltip_id` |
| `emptyStateViewed(section)` | `empty_state_viewed` | `section` |
| `emptyStateCtaClicked(section, ctaType)` | `empty_state_cta_clicked` | `section`, `cta_type` |
| `sessionDuration(durationMinutes)` | `session_duration` | `duration_minutes` |

### 20. Server-Side Events (`trackServerEvent`)

| Disparado en | Evento GA4 | Parámetros |
|---|---|---|
| Stripe Webhook | `server_subscription_started` | `plan`, `value`, `currency` |
| Stripe Webhook | `server_subscription_cancelled` | `plan` |
| Bland AI Webhook | Call completion events | `agent_type`, `duration_seconds`, `status` |
| `/api/contacts/import` | `contact_import_completed` | `count`, `source` |
| `/api/contacts/export` | `contacts_exported` | `format`, `count` |
| `/api/contacts/ai-segment` | `ai_segment_used` | `contact_count` |
| `/api/contacts/ai-analyze` | Contact analysis events | Varies |

---

## User Properties

User properties se configuran una vez por sesión autenticada y se usan para segmentar audiencias en GA4.

| Property | Tipo | Valores | Descripción |
|---|---|---|---|
| `user_id` | `string` | UUID | ID de Supabase Auth. Nunca es el email. |
| `plan_slug` | `string` | free, starter, growth, business, teams, enterprise | Plan activo |
| `billing_cycle` | `string` | monthly, annual | Ciclo de facturación |
| `company_industry` | `string` | Variable | Industria de la empresa |
| `team_size` | `number` | 1+ | Número de miembros |
| `country_code` | `string` | ISO 3166-1 | País del usuario |
| `currency` | `string` | USD, EUR, GBP | Moneda preferida |
| `integrations_count` | `number` | 0+ | Integraciones activas |
| `contacts_count` | `number` | 0+ | Contactos en la cuenta |

### Segmentos de Audiencia Sugeridos

Con estas propiedades puedes crear audiencias como:

| Audiencia | Condición |
|---|---|
| Usuarios Free | `plan_slug` = `free` |
| Usuarios de pago | `plan_slug` ≠ `free` |
| Enterprise | `plan_slug` = `enterprise` |
| Equipos grandes | `team_size` ≥ 5 |
| LATAM | `country_code` IN (MX, CO, AR, CL, PE, BR) |
| Sin integraciones | `integrations_count` = 0 |
| Power users | `contacts_count` ≥ 500 |

---

## Server-Side Tracking

El server-side tracking usa el **GA4 Measurement Protocol** para enviar eventos desde API routes y webhooks donde no hay un browser.

### Función

```typescript
async function trackServerEvent(
  clientId: string,   // Identificador de sesión (puede ser company_id)
  userId: string | null,  // UUID del usuario o null
  eventName: string,
  params: Record<string, string | number | boolean> = {}
)
```

### Endpoint

```
POST https://www.google-analytics.com/mp/collect
  ?measurement_id={NEXT_PUBLIC_GA_MEASUREMENT_ID}
  &api_secret={GA_API_SECRET}
```

### Payload

```json
{
  "client_id": "company-uuid-here",
  "user_id": "user-uuid-here",
  "events": [
    {
      "name": "server_subscription_started",
      "params": {
        "plan": "business",
        "value": 299,
        "currency": "USD",
        "engagement_time_msec": 1
      }
    }
  ]
}
```

> **Nota:** `engagement_time_msec: 1` es requerido por el Measurement Protocol para que GA4 procese el evento correctamente.

### API Routes que usan server-side tracking

| Route | Eventos |
|---|---|
| `/api/webhooks/stripe/route.ts` | `server_subscription_started`, `server_subscription_cancelled` |
| `/api/bland/webhook/route.ts` | Call completion tracking |
| `/api/contacts/import/route.ts` | `contact_import_completed` |
| `/api/contacts/export/route.ts` | `contacts_exported` |
| `/api/contacts/ai-segment/route.ts` | `ai_segment_used` |
| `/api/contacts/ai-analyze/route.ts` | Contact analysis events |

---

## Integración por Componente

Mapa completo de qué componentes importan y usan analytics:

| Componente | Import | Eventos Clave |
|---|---|---|
| `components/auth/SocialAuthButtons.tsx` | `authEvents` | `socialAuthClicked` |
| `app/auth/login/page.tsx` | `authEvents` | `login` |
| `app/auth/signup/page.tsx` | `authEvents` | `signUp` |
| `app/auth/forgot-password/page.tsx` | `authEvents` | `passwordResetRequested` |
| `app/auth/reset-password/page.tsx` | `authEvents` | `passwordResetCompleted` |
| `app/auth/verify-email/page.tsx` | `authEvents` | `emailVerified`, `verificationEmailResent` |
| `contexts/AuthContext.tsx` | `authEvents` | `logout` |
| `app/onboarding/page.tsx` | `onboardingEvents` | `started`, `stepCompleted`, `companyCreated`, `completed`, `skipped` |
| `components/agents/AgentConfigModal.tsx` | `agentEvents` | `configModalOpened`, `configStepCompleted`, `configModalClosed`, `created`, `voiceSelected`, `voicePreviewed`, `testCallInitiated`, `settingsUpdated` |
| `components/campaigns/CampaignsOverview.tsx` | `campaignEvents` | `pageViewed`, `newCampaignClicked` |
| `components/contacts/ContactsManager.tsx` | `contactEvents` | `created`, `imported`, `exported`, `deleted`, `searched`, `filtered`, `sorted`, `csvImport*`, `crmSubpageViewed`, `crmContactsImported` |
| `components/settings/BillingSettings.tsx` | `billingEvents` | `checkoutStarted`, `subscriptionCancelled`, `addonPurchased`, `overageEnabled`, `retentionOffer*`, `upgradeCtaClicked`, `extraSeatPurchased`, `billingCycleToggled` |
| `components/settings/TeamSettings.tsx` | `teamEvents` | `memberInvited`, `memberRemoved`, `memberRoleChanged`, `bulkInviteSent`, `inviteResent` |
| `components/settings/SettingsManager.tsx` | `settingsEvents`, `navigationEvents` | `tabChanged`, `languageChanged` |
| `components/integrations/IntegrationsPage.tsx` | `integrationEvents` | `connectStarted`, `connected`, `disconnected`, `syncStarted`, `syncCompleted`, `syncFailed`, `slackNotificationsConfigured`, `webhookCreated`, `webhookDeleted`, `feedbackSubmitted` |
| `components/calendar/CalendarPage.tsx` | `calendarEvents` | `viewChanged`, `dateNavigated`, `eventCreated`, `eventCancelled` |
| `components/layout/Sidebar.tsx` | `navigationEvents` | `sidebarClicked`, `notificationsBellClicked` |
| `hooks/useStripe.ts` | `billingEvents` | `checkoutStarted`, `subscriptionStarted`, `billingPortalOpened` |

---

## Flujo de Inicialización

```
1. Usuario abre la app
   │
   ▼
2. Root Layout (src/app/layout.tsx)
   ├── Renderiza <GoogleAnalytics gaId="G-XXX" />
   │   └── Carga gtag.js de Google (async, no bloquea)
   │
   ▼
3. Middleware (src/middleware.ts)
   ├── Verifica autenticación (Edge)
   ├── Redirige a /auth/login si no autenticado
   │
   ▼
4. App Layout (src/app/(app)/layout.tsx)
   ├── Obtiene datos del usuario de Supabase
   ├── Renderiza <AnalyticsProvider userId=... planSlug=... />
   │   └── useEffect → setUserProperties() → window.gtag('config', ...)
   │       └── GA4 ahora identifica al usuario con UUID + propiedades
   │
   ▼
5. Page Component (ej: src/app/(app)/agents/page.tsx)
   ├── Renderiza <PageTracker page="agents" />
   │   └── useEffect → agentEvents.pageViewed() → track('agents_page_viewed')
   │       └── sendGAEvent('event', 'agents_page_viewed', {})
   │
   ▼
6. User Interactions
   ├── Click en botón → agentEvents.created('lead_qualification', 'My Agent')
   │   └── track('agent_created', { agent_type: 'lead_qualification', agent_name: 'My Agent' })
   │       └── sendGAEvent() → gtag() → GA4
   │
   ▼
7. Logout
   ├── AuthContext detecta SIGNED_OUT
   ├── AnalyticsProvider → clearUserProperties() → gtag('config', { user_id: null })
```

---

## Configuración Recomendada en GA4

### Data Retention

- GA4 → Admin → Data Settings → Data Retention
- Cambia a **14 months** (máximo gratuito)

### Enhanced Measurement

Habilita en Data Streams:
- ✅ Page views (automático)
- ✅ Scrolls
- ✅ Outbound clicks
- ✅ Site search
- ❌ Video engagement (no aplica)
- ❌ File downloads (no aplica)
- ✅ Form interactions

### Internal Traffic Filter

Para excluir tráfico del equipo de desarrollo:

1. GA4 → Admin → Data Streams → Configure tag settings → Define internal traffic
2. Agrega IPs de tu oficina/equipo
3. GA4 → Admin → Data Settings → Data Filters → Internal Traffic → Activate

### Referral Exclusion

Excluye redirects de OAuth que cortan la atribución:

1. GA4 → Admin → Data Streams → Configure tag settings → List unwanted referrals
2. Agrega: `accounts.google.com`, `login.microsoftonline.com`, `app.hubspot.com`, `accounts.zoho.com`, `oauth.pipedrive.com`

### Debug Mode

Para debuggear eventos en DebugView de GA4:

```bash
# En el browser, abre Chrome DevTools → Console:
# Los eventos en desarrollo ya se loguean via console.debug()

# Para ver en GA4 DebugView, instala la extensión:
# "Google Analytics Debugger" para Chrome
```

---

## Debugging y Desarrollo Local

### Comportamiento en Desarrollo

- `NODE_ENV !== 'production'` → Todos los eventos se loguean en `console.debug()` con el prefijo `[GA4 Debug]`
- No se envían datos reales a GA4
- Puedes ver qué eventos se disparan en la consola del browser

### Ejemplo de output en consola

```
[GA4 Debug] agents_page_viewed {}
[GA4 Debug] agent_config_modal_opened {agent_type: "lead_qualification"}
[GA4 Debug] agent_voice_selected {voice_id: "v123", voice_name: "Sarah", voice_gender: "female"}
[GA4 Debug] agent_config_step_completed {agent_type: "lead_qualification", step_name: "contacts", step_number: 2}
```

### Verificar en Producción

1. **Realtime Report:** GA4 → Reports → Realtime → Ver eventos en vivo
2. **DebugView:** GA4 → Admin → DebugView → Ver eventos de dispositivos en modo debug
3. **Tag Assistant:** [tagassistant.google.com](https://tagassistant.google.com) → Conectar a tu sitio

### Verificar Server-Side Events

Los eventos del Measurement Protocol tardan hasta 24-48h en aparecer en GA4 standard reports, pero aparecen inmediatamente en:
- **GA4 Realtime** (parcial)
- **BigQuery export** (si está configurado)

Para validar el payload antes de enviar:

```bash
# Validation endpoint (no envía datos reales):
curl -X POST "https://www.google-analytics.com/debug/mp/collect?measurement_id=G-XXXXXXXXXX&api_secret=YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "test-client",
    "events": [{
      "name": "test_event",
      "params": { "engagement_time_msec": 1 }
    }]
  }'
```

---

## Convenciones y Buenas Prácticas

### Naming Convention

- Eventos: `snake_case` (ej: `agent_config_modal_opened`)
- Parámetros: `snake_case` (ej: `agent_type`, `billing_cycle`)
- No usar prefijo `callengo_` en los nombres (el comment en el código es legacy)

### Agregar Nuevos Eventos

1. Define el evento en `src/lib/analytics.ts` dentro de la categoría apropiada
2. Usa tipos TypeScript para los parámetros (no `string` genérico cuando hay valores finitos)
3. Importa el objeto de eventos en el componente correspondiente
4. Llama al método en el handler/callback apropiado
5. Registra el nuevo custom dimension en GA4 si usas parámetros nuevos
6. Documenta el evento en este archivo

### Reglas de Oro

1. **Nunca trackear PII** — no emails, nombres, teléfonos, direcciones
2. **Usar UUIDs** — para user_id y cualquier identificador
3. **No bloquear la app** — `trackServerEvent` usa try/catch silencioso
4. **Solo producción** — client-side solo dispara en `NODE_ENV === 'production'`
5. **Parámetros limpios** — `null` y `undefined` se filtran automáticamente
6. **No duplicar** — un evento por acción, no multiples eventos para la misma cosa (excepto `subscriptionStarted` que dispara `purchase` adicionalmente por diseño)

---

## Referencia Rápida de Archivos

| Archivo | Líneas | Descripción |
|---|---|---|
| `src/lib/analytics.ts` | 1,022 | Core module: 20 categorías, track(), trackServerEvent(), user properties |
| `src/components/analytics/AnalyticsProvider.tsx` | 69 | Identificación de usuario autenticado en GA4 |
| `src/components/analytics/PageTracker.tsx` | 68 | Tracking automático de page views por sección |
| `src/components/analytics/AnalyticsDashboard.tsx` | ~1,400 | Dashboard interno de analytics (UI) |
| `src/app/layout.tsx` | — | `<GoogleAnalytics>` script injection |
| `src/app/(app)/layout.tsx` | — | `<AnalyticsProvider>` mount point |

### Dependencias npm

| Package | Uso |
|---|---|
| `@next/third-parties` | `GoogleAnalytics` component + `sendGAEvent()` para dispatch de eventos |

No se requiere instalar `gtag.js` manualmente ni ningún otro package de analytics.

---

## Checklist de Verificación Post-Deploy

- [ ] `NEXT_PUBLIC_GA_MEASUREMENT_ID` configurado en Vercel
- [ ] `GA_API_SECRET` configurado en Vercel
- [ ] Custom dimensions de usuario creadas en GA4 (8 propiedades)
- [ ] Custom dimensions de eventos creadas en GA4 (~10 parámetros clave)
- [ ] Key events (conversiones) marcados en GA4
- [ ] Internal traffic filter activado
- [ ] Referral exclusions configuradas para OAuth providers
- [ ] Data retention configurado a 14 meses
- [ ] Realtime report muestra eventos al navegar la app
- [ ] BigQuery export configurado (opcional pero recomendado)
- [ ] Google Ads vinculado (si aplica)
