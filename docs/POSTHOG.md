# PostHog — Documentación Completa de Implementación

> Documento maestro de la integración de PostHog en Callengo.
> Última actualización: Marzo 2026

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [¿Por Qué PostHog + GA4?](#por-qué-posthog--ga4)
3. [Arquitectura General](#arquitectura-general)
4. [Setup Guide — Configuración Inicial](#setup-guide--configuración-inicial)
5. [Variables de Entorno](#variables-de-entorno)
6. [Dependencias npm](#dependencias-npm)
7. [Componentes del Sistema](#componentes-del-sistema)
8. [Identificación de Usuarios y Group Analytics](#identificación-de-usuarios-y-group-analytics)
9. [Catálogo Completo de Eventos](#catálogo-completo-de-eventos)
10. [Server-Side Tracking](#server-side-tracking)
11. [Feature Flags](#feature-flags)
12. [Session Replay](#session-replay)
13. [Integración por Componente](#integración-por-componente)
14. [Flujo de Inicialización](#flujo-de-inicialización)
15. [Configuración de Funnels, Retención y Cohorts](#configuración-de-funnels-retención-y-cohorts)
16. [Integración Nativa con Stripe](#integración-nativa-con-stripe)
17. [Debugging y Desarrollo Local](#debugging-y-desarrollo-local)
18. [Convenciones y Buenas Prácticas](#convenciones-y-buenas-prácticas)
19. [Referencia Rápida de Archivos](#referencia-rápida-de-archivos)
20. [Checklist de Verificación Post-Deploy](#checklist-de-verificación-post-deploy)

---

## Resumen Ejecutivo

Callengo implementa **PostHog** como su plataforma de **product analytics**, complementando a GA4 que se usa para marketing attribution. PostHog provee:

- **130+ eventos** trackeados en paralelo con GA4 (mismos puntos de instrumentación)
- **Group Analytics** — análisis a nivel de empresa (company), no solo usuario
- **Session Replay** — grabación de sesiones reales de usuario para debugging y UX research
- **Feature Flags** — activación/desactivación de features por usuario, empresa, plan
- **Funnels** — análisis de conversión paso a paso (signup → onboarding → first agent → first campaign)
- **Retention** — cohorts de retención por semana/mes
- **Integración nativa Stripe** — MRR, churn, LTV directamente en el dashboard (sin código)
- **Tracking server-side** — eventos desde API routes y webhooks via `posthog-node`
- **1M eventos/mes gratis + 5K session replays gratis**

### PostHog vs GA4 — Roles Diferenciados

| Aspecto | GA4 | PostHog |
|---|---|---|
| **Propósito** | Marketing attribution & acquisition | Product behavior & retention |
| **Funnels** | Limitados, enfocados en conversión | Granulares, cualquier secuencia de eventos |
| **Session Replay** | No | Sí (5K gratis/mes) |
| **Feature Flags** | No | Sí (nativo) |
| **Group Analytics** | No | Sí (análisis por empresa) |
| **Revenue Analytics** | Manual | Nativo via Stripe integration |
| **Data Ownership** | Google | Exportable, o self-hosted |
| **Identify** | User ID anónimo | Identify completo con merge de anónimo a autenticado |
| **Cohorts** | Limitados | Avanzados con behavioral properties |

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                         │
│                                                                 │
│  ┌──────────────────┐   ┌────────────────────┐                  │
│  │ PostHogProvider    │   │ PostHogPageTracker  │                  │
│  │ (App Layout)       │   │ (Each Page)         │                  │
│  │                    │   │                    │                  │
│  │ initPostHog()     │   │ $pageview events   │                  │
│  │ identifyUser()    │   │ per section        │                  │
│  │ posthog.group()   │   │                    │                  │
│  └────────┬──────────┘   └────────┬───────────┘                  │
│           │                       │                              │
│           ▼                       ▼                              │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │               src/lib/posthog.ts                          │    │
│  │                                                          │    │
│  │  capture(event, props) → posthog.capture()               │    │
│  │  identifyUser()       → posthog.identify() + .group()    │    │
│  │  incrementUserProperty() → posthog.people.increment()    │    │
│  │  tagSession()         → session replay tagging           │    │
│  │  isFeatureEnabled()   → posthog.isFeatureEnabled()       │    │
│  │                                                          │    │
│  │  20 export objects: phAuthEvents, phBillingEvents, ...   │    │
│  └──────────────────────────┬───────────────────────────────┘    │
│                             │                                    │
│                             ▼                                    │
│                    PostHog Cloud (us.i.posthog.com)               │
│                    SDK batches & sends events                     │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                        SERVER (API Routes)                        │
│                                                                  │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │ Stripe Webhook  │  │ Bland AI Webhook  │  │ Contact Routes  │  │
│  └───────┬────────┘  └────────┬──────────┘  └───────┬─────────┘  │
│          │                    │                     │            │
│          ▼                    ▼                     ▼            │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │    captureServerEvent(distinctId, event, props, groups)   │    │
│  │                                                          │    │
│  │    Uses posthog-node SDK                                 │    │
│  │    POST → PostHog Cloud                                  │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    PostHog Cloud Dashboard                        │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────────┐  │
│  │  Funnels  │  │ Retention│  │  Replays   │  │ Feature Flags│  │
│  └──────────┘  └──────────┘  └────────────┘  └──────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────────┐  │
│  │  Cohorts  │  │  Trends  │  │  Paths     │  │ Stripe Rev.  │  │
│  └──────────┘  └──────────┘  └────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Setup Guide — Configuración Inicial

### Paso 1: Crear Cuenta en PostHog

1. Ve a [posthog.com](https://posthog.com) → **Get started — free**
2. Registra tu cuenta (email o Google)
3. Crea un nuevo proyecto: `Callengo Production`
4. Selecciona región: **US** (`us.i.posthog.com`) o **EU** (`eu.i.posthog.com`)
5. Copia el **Project API Key** (formato: `phc_XXXXXXXXXXXXXXXXX`)

### Paso 2: Configurar Variables de Entorno

#### En Vercel (Producción)

```bash
# Dashboard de Vercel → Settings → Environment Variables

NEXT_PUBLIC_POSTHOG_KEY=phc_XXXXXXXXXXXXXXXXX      # Project API Key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com   # O https://eu.i.posthog.com
```

#### En `.env.local` (Desarrollo — opcional)

```bash
# PostHog en desarrollo dispara debug mode automáticamente
# Solo configura si quieres enviar eventos reales a un proyecto de testing:

# NEXT_PUBLIC_POSTHOG_KEY=phc_TEST_KEY_HERE
# NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

> Sin `NEXT_PUBLIC_POSTHOG_KEY`, todos los eventos se loguean en `console.debug()`.

### Paso 3: Conectar Stripe (Revenue Analytics — 3 clics)

Esta es la killer feature gratuita de PostHog: MRR, churn, LTV sin escribir código.

1. En PostHog dashboard → **Data pipeline** → **Sources** → **Stripe**
2. Click **Connect Stripe**
3. Autoriza tu cuenta de Stripe
4. PostHog importa automáticamente: suscripciones, facturas, clientes
5. Dashboard de revenue se genera automáticamente con:
   - **MRR** (Monthly Recurring Revenue)
   - **Churn rate** mensual
   - **LTV** (Lifetime Value) por cohorte
   - **Revenue por plan** (free, starter, growth, business, teams, enterprise)
   - **Trial → Paid conversion rate**
   - **Expansion revenue** (upgrades)
   - **Contraction revenue** (downgrades)

> **Importante:** La integración Stripe de PostHog es read-only. No modifica nada en tu cuenta de Stripe.

### Paso 4: Configurar Group Analytics

Para habilitar análisis a nivel de empresa:

1. PostHog → **Settings** → **Project settings** → **Group analytics**
2. Agrega un grupo tipo: `company`
3. Display name: `Company`
4. Esto permite analizar métricas como:
   - "¿Cuántas campañas crea en promedio una empresa enterprise?"
   - "¿Cuál es la retención de empresas del sector salud?"
   - "¿Qué integraciones usan las empresas con mayor retención?"

### Paso 5: Configurar Session Replay

1. PostHog → **Session replay** → **Settings**
2. **Sample rate:** Empieza con 100% (5K replays gratis/mes)
3. **Minimum session duration:** 3 segundos (evita bots)
4. **Privacy controls:**
   - Inputs de password y email se enmascaran automáticamente (configurado en SDK)
   - Puedes agregar más selectores: `[data-posthog-mask]`
5. **Network recording:** Habilitar para ver requests XHR/fetch en replays
6. **Console log recording:** Habilitar para ver errores de consola

### Paso 6: Crear Feature Flags Iniciales (Opcional)

1. PostHog → **Feature flags** → **New feature flag**
2. Flags sugeridas para Callengo:

| Flag Key | Tipo | Descripción |
|---|---|---|
| `show-ai-chat` | Boolean | Habilitar chat con IA en la app |
| `new-onboarding-flow` | Boolean | A/B test nuevo flujo de onboarding |
| `advanced-analytics` | Boolean | Dashboard de analytics V2 |
| `bulk-campaign-actions` | Boolean | Acciones masivas en campañas |

3. Asignar por propiedad: `plan_slug = enterprise` → flag habilitado

### Paso 7: Configurar Data Pipeline (Opcional)

Para exportar datos a tu data warehouse:

1. PostHog → **Data pipeline** → **Destinations**
2. Opciones: BigQuery, Snowflake, Redshift, S3, Postgres
3. Configura el export batch (cada 1h o real-time)

---

## Variables de Entorno

| Variable | Tipo | Requerida | Exposición | Descripción |
|---|---|---|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | `string` | Sí | Client + Server | Project API Key de PostHog (formato: `phc_XXX`) |
| `NEXT_PUBLIC_POSTHOG_HOST` | `string` | No | Client + Server | Host de PostHog. Default: `https://us.i.posthog.com` |

**Comportamiento sin variables:**
- Sin `NEXT_PUBLIC_POSTHOG_KEY`: El SDK no se inicializa. Todos los eventos van a `console.debug()`. La app funciona normalmente.
- Sin `NEXT_PUBLIC_POSTHOG_HOST`: Se usa el default US (`https://us.i.posthog.com`).

---

## Dependencias npm

| Package | Versión | Uso |
|---|---|---|
| `posthog-js` | Latest | SDK client-side para browser. Tracking, identify, feature flags, session replay. |
| `posthog-node` | Latest | SDK server-side para API routes y webhooks. Dynamic import para no cargar en client. |

Instalación:
```bash
npm install posthog-js posthog-node
```

---

## Componentes del Sistema

### 1. Core Module: `src/lib/posthog.ts` (~850 líneas)

Módulo central que exporta toda la lógica de PostHog. Contiene:

#### Funciones de Infraestructura

| Función | Descripción |
|---|---|
| `initPostHog()` | Inicializa el SDK. Llamada una vez en PostHogProvider. |
| `getPostHog()` | Retorna la instancia posthog o null. |
| `capture(event, props)` | Función interna para enviar eventos. Limpia null/undefined. |
| `identifyUser(props)` | Identifica usuario + crea grupo empresa. |
| `updateUserProperties(props)` | Actualiza propiedades sin re-identificar. |
| `incrementUserProperty(prop, value)` | Incrementa propiedad numérica (counters). |
| `resetUser()` | Limpia identidad en logout. Genera nuevo anonymousId. |
| `isFeatureEnabled(key)` | Verifica si un feature flag está activo. |
| `getFeatureFlagPayload(key)` | Obtiene payload de flag multivariate. |
| `reloadFeatureFlags()` | Recarga flags (post plan change). |
| `tagSession(tag)` | Etiqueta session replay para filtrado. |
| `captureServerEvent(...)` | Tracking server-side via posthog-node. |

#### Objetos de Eventos (20 categorías)

Todos los objetos siguen el prefijo `ph` para distinguirlos de los GA4:

| Export | GA4 Equivalente | Descripción |
|---|---|---|
| `phAuthEvents` | `authEvents` | Signup, login, logout, password reset |
| `phOnboardingEvents` | `onboardingEvents` | Flujo de onboarding |
| `phBillingEvents` | `billingEvents` | Suscripciones, upgrades, addons, overage |
| `phAgentEvents` | `agentEvents` | Configuración y creación de agentes |
| `phCampaignEvents` | `campaignEvents` | Campañas: crear, iniciar, pausar, completar |
| `phCallEvents` | `callEvents` | Llamadas: detalle, recording, transcript |
| `phContactEvents` | `contactEvents` | Contactos: CRUD, import, export, segmentación |
| `phIntegrationEvents` | `integrationEvents` | CRM integrations: connect, sync, disconnect |
| `phCalendarEvents` | `calendarEvents` | Calendario: eventos, vistas, sync |
| `phFollowUpEvents` | `followUpEvents` | Follow-ups: filtrar, buscar, ver detalle |
| `phVoicemailEvents` | `voicemailEvents` | Voicemails: reproducir, filtrar |
| `phTeamEvents` | `teamEvents` | Team: invitar, remover, cambiar roles |
| `phNavigationEvents` | `navigationEvents` | Sidebar, notificaciones, idioma |
| `phSettingsEvents` | `settingsEvents` | Settings: perfil, voz, preferencias |
| `phDashboardEvents` | `dashboardEvents` | Dashboard: quick start, usage meter |
| `phAnalyticsPageEvents` | `analyticsPageEvents` | Analytics: período, export, charts |
| `phAiChatEvents` | `aiChatEvents` | AI chat: mensajes, conversaciones |
| `phErrorEvents` | `errorEvents` | Errores: API, client, payment |
| `phEngagementEvents` | `engagementEvents` | Feature discovery, tooltips, empty states |
| `captureServerEvent` | `trackServerEvent` | Server-side tracking (API routes) |

### 2. PostHogProvider: `src/components/analytics/PostHogProvider.tsx`

Componente React client-side que:
- Se monta en `src/app/(app)/layout.tsx` junto al GA4 `AnalyticsProvider`
- Inicializa el SDK PostHog via `initPostHog()`
- Identifica al usuario con `identifyUser()` incluyendo grupo `company`
- Escucha `SIGNED_OUT` de Supabase Auth para `resetUser()`
- Renderiza `null`

**Props:**
```typescript
interface PostHogProviderProps {
  userId: string          // UUID
  planSlug?: string       // Plan activo
  billingCycle?: string   // monthly | annual
  companyId?: string      // UUID de la empresa (para group analytics)
  companyName?: string    // Nombre de la empresa (display en PostHog)
  companyIndustry?: string
  teamSize?: number
  countryCode?: string
  currency?: string
  createdAt?: string      // Fecha de creación del usuario (ISO)
}
```

### 3. PostHogPageTracker: `src/components/analytics/PostHogPageTracker.tsx`

Componente que dispara `$pageview` de PostHog para cada sección. Funciona en paralelo con el `PageTracker` de GA4.

**Páginas trackeadas:**
`dashboard`, `agents`, `campaigns`, `calls`, `contacts`, `integrations`, `calendar`, `follow-ups`, `voicemails`, `team`, `settings`, `analytics`, `reports`, `pricing`

**Uso:**
```tsx
<PageTracker page="agents" />          {/* GA4 */}
<PostHogPageTracker page="agents" />   {/* PostHog */}
```

---

## Identificación de Usuarios y Group Analytics

### User Identification

PostHog merge automáticamente los eventos anónimos previos al login con el perfil autenticado.

```
Visita anónima → eventos se asocian a anonymous_id
     ↓
Login/Signup  → posthog.identify(userId)
     ↓
PostHog merge → todos los eventos del anonymous_id se asocian al userId
```

**Person Properties configuradas:**

| Property | Tipo | Descripción |
|---|---|---|
| `plan_slug` | `string` | Plan activo |
| `billing_cycle` | `string` | monthly/annual |
| `company_id` | `string` | UUID de la empresa |
| `company_industry` | `string` | Industria |
| `team_size` | `number` | Miembros del equipo |
| `country_code` | `string` | País ISO |
| `currency` | `string` | Moneda |
| `integrations_count` | `number` | Integraciones activas |
| `contacts_count` | `number` | Contactos totales |
| `created_at` | `string` | Fecha de creación |
| `onboarding_completed` | `boolean` | Si completó el onboarding |
| `total_agents_created` | `number` | Counter incremental |
| `total_campaigns_created` | `number` | Counter incremental |
| `total_contacts_created` | `number` | Counter incremental |
| `total_contacts_imported` | `number` | Counter incremental |
| `total_integrations_connected` | `number` | Counter incremental |

### Group Analytics (Company-Level)

PostHog agrupa todos los usuarios de una empresa bajo un grupo `company`. Esto permite análisis como:

```
"De las empresas en plan Business, ¿cuántas crearon más de 5 campañas?"
"¿Cuál es la retención semanal de empresas del sector tech?"
"¿Qué features usan las empresas con mayor LTV?"
```

**Group Properties configuradas:**

| Property | Tipo | Descripción |
|---|---|---|
| `name` | `string` | Nombre de la empresa |
| `industry` | `string` | Industria |
| `plan` | `string` | Plan activo |
| `billing_cycle` | `string` | monthly/annual |
| `team_size` | `number` | Miembros |
| `country` | `string` | País |
| `currency` | `string` | Moneda |
| `integrations_count` | `number` | Integraciones activas |
| `contacts_count` | `number` | Contactos totales |

---

## Catálogo Completo de Eventos

### 1. Authentication Events (`phAuthEvents`)

| Método | Evento PostHog | Propiedades | Extras PostHog |
|---|---|---|---|
| `signUp(method)` | `user_signed_up` | `method` | `incrementUserProperty('total_signups')` |
| `login(method)` | `user_logged_in` | `method` | — |
| `logout()` | `user_logged_out` | — | `resetUser()` (genera nuevo anonymousId) |
| `passwordResetRequested()` | `password_reset_requested` | — | — |
| `passwordResetCompleted()` | `password_reset_completed` | — | — |
| `emailVerified()` | `email_verified` | — | — |
| `verificationEmailResent()` | `verification_email_resent` | — | — |
| `socialAuthClicked(provider)` | `social_auth_clicked` | `provider` | — |

### 2. Onboarding Events (`phOnboardingEvents`)

| Método | Evento PostHog | Propiedades | Extras PostHog |
|---|---|---|---|
| `started()` | `onboarding_started` | — | — |
| `stepCompleted(step, num)` | `onboarding_step_completed` | `step_name`, `step_number` | — |
| `companyCreated(industry)` | `onboarding_company_created` | `industry` | — |
| `completed(industry)` | `onboarding_completed` | `industry` | `updateUserProperties({ onboarding_completed: true })` |
| `skipped(atStep)` | `onboarding_skipped` | `at_step` | — |

### 3. Billing & Subscription Events (`phBillingEvents`)

| Método | Evento PostHog | Propiedades | Extras PostHog |
|---|---|---|---|
| `pricingPageViewed(source)` | `pricing_page_viewed` | `source` | — |
| `planComparisonViewed()` | `plan_comparison_viewed` | — | — |
| `checkoutStarted(plan, cycle, value)` | `checkout_started` | `plan`, `billing_cycle`, `value`, `currency` | — |
| `subscriptionStarted(plan, cycle, value)` | `subscription_started` | `plan`, `billing_cycle`, `value`, `currency` | `updateUserProperties()` + `reloadFeatureFlags()` |
| `subscriptionUpgraded(from, to, value)` | `subscription_upgraded` | `from_plan`, `to_plan`, `value`, `currency` | `updateUserProperties()` + `reloadFeatureFlags()` |
| `subscriptionDowngraded(from, to)` | `subscription_downgraded` | `from_plan`, `to_plan` | `updateUserProperties()` + `reloadFeatureFlags()` |
| `subscriptionCancelled(plan, reason, months)` | `subscription_cancelled` | `plan`, `reason`, `months_subscribed` | `tagSession('churned_user')` |
| `subscriptionReactivated(plan)` | `subscription_reactivated` | `plan` | `updateUserProperties()` |
| `billingPortalOpened()` | `billing_portal_opened` | — | — |
| `addonPurchased(type, value)` | `addon_purchased` | `addon_type`, `value`, `currency` | — |
| `addonCancelled(type)` | `addon_cancelled` | `addon_type` | — |
| `overageEnabled(budget)` | `overage_enabled` | `budget_amount` | — |
| `overageDisabled()` | `overage_disabled` | — | — |
| `overageBudgetUpdated(budget)` | `overage_budget_updated` | `budget_amount` | — |
| `retentionOfferShown(plan, months)` | `retention_offer_shown` | `plan`, `months_subscribed` | `tagSession('retention_flow')` |
| `retentionOfferAccepted(plan, discount)` | `retention_offer_accepted` | `plan`, `discount_type` | — |
| `retentionOfferDeclined(plan)` | `retention_offer_declined` | `plan` | — |
| `upgradeCtaClicked(location, current, target)` | `upgrade_cta_clicked` | `location`, `current_plan`, `target_plan` | — |
| `extraSeatPurchased(seats)` | `extra_seat_purchased` | `total_seats`, `value`, `currency` | — |
| `billingCycleToggled(cycle)` | `billing_cycle_toggled` | `billing_cycle` | — |
| `invoiceViewed()` | `invoice_viewed` | — | — |

### 4. Agent Events (`phAgentEvents`)

| Método | Evento PostHog | Propiedades | Extras PostHog |
|---|---|---|---|
| `pageViewed()` | `$pageview` | `page: 'agents'` | — |
| `cardClicked(type)` | `agent_card_clicked` | `agent_type` | — |
| `configModalOpened(type)` | `agent_config_modal_opened` | `agent_type` | — |
| `configStepCompleted(type, step, num)` | `agent_config_step_completed` | `agent_type`, `step_name`, `step_number` | — |
| `configModalClosed(type, steps)` | `agent_config_modal_closed` | `agent_type`, `completed_steps` | — |
| `created(type, name)` | `agent_created` | `agent_type`, `agent_name` | `incrementUserProperty('total_agents_created')` |
| `deleted(type)` | `agent_deleted` | `agent_type` | — |
| `switched(from, to)` | `agent_switched` | `from_type`, `to_type` | — |
| `voiceSelected(id, name, gender)` | `agent_voice_selected` | `voice_id`, `voice_name`, `voice_gender` | — |
| `voicePreviewed(id)` | `agent_voice_previewed` | `voice_id` | — |
| `voiceFavorited(id)` | `agent_voice_favorited` | `voice_id` | — |
| `testCallInitiated(type)` | `test_call_initiated` | `agent_type` | — |
| `testCallCompleted(type, dur, status)` | `test_call_completed` | `agent_type`, `duration_seconds`, `call_status` | — |
| `settingsUpdated(type, setting)` | `agent_settings_updated` | `agent_type`, `setting_name` | — |
| `integrationConnected(type, provider)` | `agent_integration_connected` | `agent_type`, `integration_provider` | — |

### 5. Campaign Events (`phCampaignEvents`)

| Método | Evento PostHog | Propiedades | Extras PostHog |
|---|---|---|---|
| `pageViewed()` | `$pageview` | `page: 'campaigns'` | — |
| `newCampaignClicked()` | `new_campaign_clicked` | — | — |
| `aiRecommendationRequested(len)` | `ai_agent_recommendation_requested` | `description_length` | — |
| `aiRecommendationSelected(rec, sel)` | `ai_agent_recommendation_selected` | `recommended_type`, `selected_type`, `matched` | — |
| `created(params)` | `campaign_created` | `agent_type`, `contact_count`, `follow_up_enabled`, `voicemail_enabled`, `calendar_enabled` | `incrementUserProperty('total_campaigns_created')` |
| `started(type, count)` | `campaign_started` | `agent_type`, `contact_count` | — |
| `paused(type, done, total)` | `campaign_paused` | `agent_type`, `calls_completed`, `total_contacts`, `progress_percent` | — |
| `resumed(type)` | `campaign_resumed` | `agent_type` | — |
| `completed(params)` | `campaign_completed` | `agent_type`, `total_contacts`, `completed_calls`, `successful_calls`, `failed_calls`, `success_rate` | — |
| `deleted(type)` | `campaign_deleted` | `agent_type` | — |
| `detailViewed(type, status)` | `campaign_detail_viewed` | `agent_type`, `campaign_status` | — |
| `filtered(type, value)` | `campaigns_filtered` | `filter_type`, `filter_value` | — |
| `searched(len)` | `campaigns_searched` | `query_length` | — |

### 6. Call Events (`phCallEvents`)

| Método | Evento PostHog | Propiedades |
|---|---|---|
| `pageViewed()` | `$pageview` | `page: 'calls'` |
| `detailOpened(status, type)` | `call_detail_opened` | `call_status`, `agent_type` |
| `recordingPlayed(type, dur)` | `call_recording_played` | `agent_type`, `duration_seconds` |
| `transcriptViewed(type)` | `call_transcript_viewed` | `agent_type` |
| `analysisViewed(type, sent, int)` | `call_analysis_viewed` | `agent_type`, `sentiment`, `interest_level` |
| `filtered(type, value)` | `calls_filtered` | `filter_type`, `filter_value` |
| `searched(len, count)` | `calls_searched` | `query_length`, `results_count` |
| `exportRequested(format)` | `calls_export_requested` | `format` |

### 7. Contact Events (`phContactEvents`)

| Método | Evento PostHog | Propiedades | Extras PostHog |
|---|---|---|---|
| `pageViewed()` | `$pageview` | `page: 'contacts'` | — |
| `created(source)` | `contact_created` | `source` | `incrementUserProperty('total_contacts_created')` |
| `imported(source, count, method)` | `contacts_imported` | `source`, `count`, `method` | `incrementUserProperty('total_contacts_imported', count)` |
| `exported(format, count)` | `contacts_exported` | `format`, `count` | — |
| `listCreated()` | `contact_list_created` | — | — |
| `listDeleted()` | `contact_list_deleted` | — | — |
| `edited(fields)` | `contact_edited` | `fields_changed` | — |
| `deleted(count)` | `contacts_deleted` | `count` | — |
| `bulkDeleted(count)` | `contacts_bulk_deleted` | `count` | — |
| `searched(len, count)` | `contacts_searched` | `query_length`, `results_count` | — |
| `filtered(type)` | `contacts_filtered` | `filter_type` | — |
| `sorted(field, dir)` | `contacts_sorted` | `sort_field`, `sort_direction` | — |
| `detailViewed()` | `contact_detail_viewed` | — | — |
| `aiSegmentationUsed(count)` | `ai_segmentation_used` | `contact_count` | — |
| `csvImportStarted()` | `csv_import_started` | — | — |
| `csvImportCompleted(rows, cols)` | `csv_import_completed` | `row_count`, `columns_matched` | — |
| `csvImportFailed(error)` | `csv_import_failed` | `error_type` | `tagSession('import_error')` |
| `googleSheetsImportStarted()` | `google_sheets_import_started` | — | — |
| `googleSheetsImportCompleted(rows)` | `google_sheets_import_completed` | `row_count` | — |
| `crmSubpageViewed(provider)` | `crm_contacts_subpage_viewed` | `provider` | — |
| `crmContactsImported(provider, count)` | `crm_contacts_imported` | `provider`, `count` | — |

### 8. Integration Events (`phIntegrationEvents`)

| Método | Evento PostHog | Propiedades | Extras PostHog |
|---|---|---|---|
| `pageViewed()` | `$pageview` | `page: 'integrations'` | — |
| `connectStarted(provider, type)` | `integration_connect_started` | `provider`, `integration_type` | — |
| `connected(provider, type)` | `integration_connected` | `provider`, `integration_type` | `incrementUserProperty('total_integrations_connected')` |
| `disconnected(provider, type)` | `integration_disconnected` | `provider`, `integration_type` | — |
| `syncStarted(provider)` | `integration_sync_started` | `provider` | — |
| `syncCompleted(provider, cr, up)` | `integration_sync_completed` | `provider`, `records_created`, `records_updated`, `total_records` | — |
| `syncFailed(provider, error)` | `integration_sync_failed` | `provider`, `error_type` | `tagSession('sync_error')` |
| `slackNotificationsConfigured(ch)` | `slack_notifications_configured` | `channels_count` | — |
| `webhookCreated()` | `webhook_endpoint_created` | — | — |
| `webhookDeleted()` | `webhook_endpoint_deleted` | — | — |
| `feedbackSubmitted(type)` | `integration_feedback_submitted` | `feedback_type` | — |

### 9-19. Remaining Event Categories

Los eventos de las categorías 9-19 (Calendar, Follow-ups, Voicemails, Team, Navigation, Settings, Dashboard, Analytics, AI Chat, Errors, Engagement) siguen el **mismo patrón exacto** que sus equivalentes GA4 documentados en `docs/GOOGLE_ANALYTICS.md`, con los siguientes extras PostHog:

| Categoría | Extras PostHog |
|---|---|
| Calendar | — |
| Follow-ups | — |
| Voicemails | — |
| Team | — |
| Navigation | — |
| Settings | — |
| Dashboard | — |
| Analytics | — |
| AI Chat | — |
| Errors | `tagSession('api_error')`, `tagSession('client_error')`, `tagSession('payment_error')` |
| Engagement | — |

### 20. Server-Side Events (`captureServerEvent`)

| API Route | Evento PostHog | Propiedades | Group |
|---|---|---|---|
| `/api/webhooks/stripe` | `server_subscription_started` | `plan`, `value`, `currency` | `company: companyId` |
| `/api/webhooks/stripe` | `server_subscription_cancelled` | `plan` | `company: companyId` |
| `/api/bland/webhook` | `server_call_completed` | `agent_type`, `duration_seconds`, `status` | `company: companyId` |
| `/api/contacts/import` | `contact_import_completed` | `count`, `source` | `company: companyId` |
| `/api/contacts/export` | `contact_export_completed` | `format`, `count` | `company: companyId` |
| `/api/contacts/ai-segment` | `contact_ai_segment_created` | `contact_count` | `company: companyId` |
| `/api/contacts/ai-analyze` | `contact_ai_analysis` | varies | `company: companyId` |

---

## Server-Side Tracking

### Función

```typescript
async function captureServerEvent(
  distinctId: string,
  eventName: string,
  properties: Record<string, string | number | boolean> = {},
  groups?: { company?: string }
)
```

### Implementación

Usa **dynamic import** de `posthog-node` para:
- No incluir el SDK server en el bundle client-side
- Crear una instancia efímera por request (flush inmediato)
- Soportar grupos para company-level analytics

```typescript
const { PostHog } = await import('posthog-node')
const client = new PostHog(key, {
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  flushAt: 1,       // Enviar inmediatamente
  flushInterval: 0, // Sin batch delay
})
client.capture({ distinctId, event: eventName, properties, groups })
await client.shutdown()
```

---

## Feature Flags

PostHog feature flags están integrados y disponibles para usar en cualquier componente:

### Client-Side

```typescript
import { isFeatureEnabled, getFeatureFlagPayload } from '@/lib/posthog'

// Boolean flag
if (isFeatureEnabled('show-ai-chat')) {
  // Mostrar el chat de IA
}

// Multivariate flag
const variant = getFeatureFlagPayload('onboarding-flow')
// variant = { version: 'v2', steps: ['welcome', 'industry', 'agent'] }
```

### Auto-Reload en Plan Changes

Cuando un usuario cambia de plan (upgrade/downgrade), `reloadFeatureFlags()` se llama automáticamente para re-evaluar flags que dependan del plan:

```typescript
// En phBillingEvents.subscriptionStarted:
updateUserProperties({ plan_slug: plan })
reloadFeatureFlags()  // ← Re-evalúa todos los flags
```

### Crear Flags por Plan

En PostHog dashboard:
1. Feature flags → New flag
2. Key: `advanced-analytics`
3. Release condition: `plan_slug` is one of `business`, `teams`, `enterprise`
4. 100% rollout para esos planes

---

## Session Replay

### Configuración en SDK

```typescript
posthog.init(key, {
  session_recording: {
    maskTextSelector: 'input[type="password"], input[type="email"], input[name="phone"]',
  },
})
```

### Session Tagging

Eventos críticos etiquetan automáticamente la sesión para filtrado posterior:

| Tag | Disparado por | Uso |
|---|---|---|
| `churned_user` | `subscriptionCancelled` | Ver replays de usuarios que cancelaron |
| `retention_flow` | `retentionOfferShown` | Ver cómo interactúan con la oferta de retención |
| `import_error` | `csvImportFailed` | Debugging de errores de importación |
| `sync_error` | `integrationSyncFailed` | Debugging de errores de sync CRM |
| `api_error` | `errorEvents.apiError` | Debugging de errores de API |
| `client_error` | `errorEvents.clientError` | Debugging de errores de UI |
| `payment_error` | `errorEvents.paymentFailed` | Ver replays de pagos fallidos |

### Filtrar Replays en Dashboard

1. PostHog → **Session replay** → **Filters**
2. Filtrar por tag: `churned_user` → ver qué hicieron antes de cancelar
3. Filtrar por person property: `plan_slug = enterprise` → ver cómo usan empresas grandes
4. Filtrar por evento: `performed event: checkout_started` → ver flow de checkout

---

## Integración por Componente

Mapa completo de archivos modificados con PostHog tracking:

### Layout & Providers

| Archivo | PostHog Import | Función |
|---|---|---|
| `src/app/(app)/layout.tsx` | `PostHogProvider` | Monta el provider con identify + group |

### Page Files (13 archivos)

Todos incluyen `<PostHogPageTracker page="..." />` junto al `<PageTracker>` de GA4:

| Archivo | Page |
|---|---|
| `src/app/(app)/dashboard/page.tsx` | `dashboard` |
| `src/app/(app)/agents/page.tsx` | `agents` |
| `src/app/(app)/campaigns/page.tsx` | `campaigns` |
| `src/app/(app)/calls/page.tsx` | `calls` |
| `src/app/(app)/contacts/page.tsx` | `contacts` |
| `src/app/(app)/integrations/page.tsx` | `integrations` |
| `src/app/(app)/calendar/page.tsx` | `calendar` |
| `src/app/(app)/follow-ups/page.tsx` | `follow-ups` |
| `src/app/(app)/voicemails/page.tsx` | `voicemails` |
| `src/app/(app)/team/page.tsx` | `team` (2 instancias) |
| `src/app/(app)/settings/page.tsx` | `settings` |
| `src/app/(app)/analytics/page.tsx` | `analytics` |
| `src/app/(app)/reports/page.tsx` | `reports` |

### Auth & Onboarding (8 archivos)

| Archivo | Import | Eventos |
|---|---|---|
| `src/app/auth/login/page.tsx` | `phAuthEvents` | `login` |
| `src/app/auth/signup/page.tsx` | `phAuthEvents` | `signUp` |
| `src/app/auth/forgot-password/page.tsx` | `phAuthEvents` | `passwordResetRequested` |
| `src/app/auth/reset-password/page.tsx` | `phAuthEvents` | `passwordResetCompleted` |
| `src/app/auth/verify-email/page.tsx` | `phAuthEvents` | `verificationEmailResent` |
| `src/components/auth/SocialAuthButtons.tsx` | `phAuthEvents` | `socialAuthClicked` |
| `src/contexts/AuthContext.tsx` | `phAuthEvents` | `logout` |
| `src/app/onboarding/page.tsx` | `phOnboardingEvents` | `started`, `stepCompleted`, `completed`, `skipped` |

### Major Components (10 archivos)

| Archivo | Import | Eventos Clave |
|---|---|---|
| `src/components/agents/AgentConfigModal.tsx` | `phAgentEvents` | config modal, steps, voice, test call, settings |
| `src/components/campaigns/CampaignsOverview.tsx` | `phCampaignEvents` | page view, new campaign |
| `src/components/contacts/ContactsManager.tsx` | `phContactEvents` | CRUD, import, export, search, filter |
| `src/components/settings/BillingSettings.tsx` | `phBillingEvents` | checkout, cancel, addon, overage, retention |
| `src/components/settings/TeamSettings.tsx` | `phTeamEvents` | invite, remove, role change |
| `src/components/settings/SettingsManager.tsx` | `phSettingsEvents`, `phNavigationEvents` | tab change, language |
| `src/components/integrations/IntegrationsPage.tsx` | `phIntegrationEvents` | connect, sync, disconnect, webhook |
| `src/components/calendar/CalendarPage.tsx` | `phCalendarEvents` | view, navigate, events, sync |
| `src/components/layout/Sidebar.tsx` | `phNavigationEvents` | sidebar clicks, notifications |
| `src/hooks/useStripe.ts` | `phBillingEvents` | checkout, subscription, portal |

### API Routes (6 archivos)

| Archivo | Import | Eventos |
|---|---|---|
| `src/app/api/webhooks/stripe/route.ts` | `captureServerEvent` | subscription started/cancelled |
| `src/app/api/bland/webhook/route.ts` | `captureServerEvent` | call completed |
| `src/app/api/contacts/import/route.ts` | `captureServerEvent` | import completed |
| `src/app/api/contacts/export/route.ts` | `captureServerEvent` | export completed |
| `src/app/api/contacts/ai-segment/route.ts` | `captureServerEvent` | segment created |
| `src/app/api/contacts/ai-analyze/route.ts` | `captureServerEvent` | analysis completed |

---

## Flujo de Inicialización

```
1. Usuario abre la app
   │
   ▼
2. App Layout (src/app/(app)/layout.tsx)
   ├── Renderiza <PostHogProvider userId=... companyId=... planSlug=... />
   │
   ▼
3. PostHogProvider useEffect
   ├── initPostHog() → posthog.init(key, { ... })
   │   ├── Carga SDK, habilita autocapture
   │   ├── Habilita session recording
   │   └── En dev: habilita debug mode
   │
   ├── identifyUser() →
   │   ├── posthog.identify(userId, personProperties)
   │   │   └── Merge anonymous_id → userId
   │   └── posthog.group('company', companyId, groupProperties)
   │       └── Company-level analytics habilitado
   │
   └── Escucha SIGNED_OUT → resetUser()
       └── posthog.reset() → nuevo anonymous_id
   │
   ▼
4. Page Component
   ├── <PostHogPageTracker page="agents" />
   │   └── posthog.capture('$pageview', { page: 'agents' })
   │
   ▼
5. User Interactions
   ├── phAgentEvents.created('lead_qualification', 'My Agent')
   │   ├── posthog.capture('agent_created', { ... })
   │   └── posthog.people.increment('total_agents_created', 1)
   │
   ▼
6. Server-Side (API Routes)
   ├── captureServerEvent(userId, 'contact_import_completed', { count: 500 })
   │   ├── import('posthog-node')
   │   ├── client.capture({ distinctId, event, properties, groups })
   │   └── client.shutdown()
```

---

## Configuración de Funnels, Retención y Cohorts

### Funnels Recomendados

Configura estos funnels en PostHog → **Insights** → **New insight** → **Funnel**:

#### Funnel 1: Signup → Activation

```
Step 1: user_signed_up
Step 2: onboarding_completed
Step 3: agent_created
Step 4: campaign_started
```

#### Funnel 2: Agent Configuration

```
Step 1: agent_config_modal_opened
Step 2: agent_config_step_completed (step_number = 1)
Step 3: agent_config_step_completed (step_number = 2)
Step 4: agent_config_step_completed (step_number = 3)
Step 5: agent_created
```
> Detecta dónde abandonan los usuarios la configuración del agente.

#### Funnel 3: Checkout Conversion

```
Step 1: pricing_page_viewed
Step 2: checkout_started
Step 3: subscription_started
```

#### Funnel 4: Integration Activation

```
Step 1: integrations_page_viewed (via $pageview)
Step 2: integration_connect_started
Step 3: integration_connected
Step 4: integration_sync_completed
```

#### Funnel 5: Contact Import → Campaign

```
Step 1: contacts_imported OR csv_import_completed
Step 2: campaign_created
Step 3: campaign_started
Step 4: campaign_completed
```

### Retention Analysis

PostHog → **Insights** → **Retention**:

| Config | Valor |
|---|---|
| **Cohort event** | `user_signed_up` |
| **Retention event** | `$pageview` (cualquier visita) |
| **Period** | Weekly |
| **Breakdown** | `plan_slug` |

Esto muestra: "De los usuarios que se registraron en la semana X, ¿qué % vuelve en semana 1, 2, 3...?"

### Cohorts

PostHog → **Cohorts** → **New cohort**:

| Cohort | Definición |
|---|---|
| Power Users | Performed `campaign_started` ≥ 3 times in last 30 days |
| At Risk | Did `$pageview` ≥ 5 times in days 1-14, but 0 times in last 7 days |
| Integration Adopters | Performed `integration_connected` ≥ 1 time ever |
| Free Stagnant | `plan_slug` = `free` AND did `campaign_started` 0 times in last 30 days |
| Enterprise Active | `plan_slug` = `enterprise` AND did `$pageview` ≥ 10 times in last 7 days |

---

## Integración Nativa con Stripe

### Lo que obtienes sin código adicional

Al conectar Stripe en PostHog (Paso 3 del setup), obtienes automáticamente:

#### Revenue Dashboard
- **MRR total** y tendencia mensual
- **MRR por plan** (free, starter, growth, business, teams, enterprise)
- **New MRR** (nuevas suscripciones)
- **Expansion MRR** (upgrades)
- **Contraction MRR** (downgrades)
- **Churned MRR** (cancelaciones)
- **Net New MRR** (new + expansion - contraction - churned)

#### Customer Metrics
- **LTV** (Lifetime Value) por cohorte de signup
- **LTV por plan** — ¿Cuál plan genera más valor?
- **Churn rate** mensual por plan
- **Trial → Paid conversion** rate
- **Time to first payment** (mediana y distribución)

#### Correlación Producto-Revenue
- "Los usuarios que crean ≥ 3 campañas en la primera semana tienen 4x más probabilidad de pagar"
- "Los usuarios que conectan una integración CRM tienen 60% menos churn"
- PostHog correlaciona automáticamente eventos de producto con datos de revenue de Stripe

---

## Debugging y Desarrollo Local

### Comportamiento en Desarrollo

- **Sin `NEXT_PUBLIC_POSTHOG_KEY`:** Todos los eventos van a `console.debug('[PostHog Debug] ...')`
- **Con key de testing:** PostHog se inicializa en debug mode (`ph.debug()`) — muestra logs detallados
- Los eventos aparecen en la consola del browser con este formato:

```
[PostHog Debug] user_logged_in {method: "email"}
[PostHog Debug] agents_page_viewed {page: "agents"}
[PostHog Debug] agent_config_modal_opened {agent_type: "lead_qualification"}
```

### Verificar en Producción

1. **PostHog → Live events:** Ve eventos en tiempo real conforme llegan
2. **PostHog → Session replay:** Ve la sesión grabada del usuario
3. **PostHog → Persons:** Busca un usuario específico y ve todos sus eventos
4. **PostHog toolbar:** Instala la toolbar de PostHog para ver heatmaps en tu sitio

### PostHog Toolbar

1. PostHog → **Toolbar** → **Launch**
2. Se abre tu app con una barra flotante de PostHog
3. Puedes ver: heatmaps, autocapture elements, feature flag overrides
4. Útil para validar que los eventos se disparan correctamente

---

## Convenciones y Buenas Prácticas

### Naming Convention

- Objetos de eventos: Prefijo `ph` (ej: `phAuthEvents`, `phBillingEvents`)
- Nombres de eventos: `snake_case` — mismos nombres que GA4 para consistencia
- Propiedades: `snake_case` — mismos nombres que GA4
- Page views: Usan `$pageview` nativo de PostHog con propiedad `page`

### Diferencias vs GA4

| Aspecto | GA4 | PostHog |
|---|---|---|
| Función interna | `track()` | `capture()` |
| Signup evento | `sign_up` | `user_signed_up` |
| Login evento | `login` | `user_logged_in` |
| Logout | Solo evento | Evento + `resetUser()` |
| Plan change | Solo evento | Evento + `updateUserProperties()` + `reloadFeatureFlags()` |
| Cancelación | Solo evento | Evento + `tagSession('churned_user')` |
| Errores | Solo evento | Evento + `tagSession(...)` para replay |
| Counters | No | `incrementUserProperty()` para totals acumulados |
| Groups | No | `posthog.group('company', ...)` |

### Agregar Nuevos Eventos

1. Define el método en `src/lib/posthog.ts` dentro de la categoría `ph*Events` apropiada
2. Usa `capture(eventName, properties)` internamente
3. Si el evento indica un milestone, agrega `incrementUserProperty()`
4. Si el evento indica un error/problema, agrega `tagSession(tag)`
5. Importa en el componente: `import { phXxxEvents } from '@/lib/posthog'`
6. Llama al método DESPUÉS del equivalente GA4
7. Documenta aquí

### Reglas de Oro

1. **Nunca trackear PII** — no emails, nombres, teléfonos
2. **Usar UUIDs** — para distinctId, companyId
3. **No bloquear la app** — `captureServerEvent` usa try/catch silencioso
4. **Dual tracking** — Siempre agregar PostHog junto a GA4, nunca reemplazar
5. **Session tags** — Usar `tagSession()` para errores y flujos críticos
6. **incrementUserProperty** — Para counters acumulados (total_agents, total_campaigns)
7. **reloadFeatureFlags** — Siempre después de cambiar el plan del usuario
8. **posthog.reset()** — Siempre en logout para generar nuevo anonymousId

---

## Referencia Rápida de Archivos

### Archivos Nuevos Creados

| Archivo | Líneas | Descripción |
|---|---|---|
| `src/lib/posthog.ts` | ~850 | Core module: init, capture, identify, groups, feature flags, 20 categorías de eventos |
| `src/components/analytics/PostHogProvider.tsx` | ~85 | Provider: init SDK + identify user + group company |
| `src/components/analytics/PostHogPageTracker.tsx` | ~65 | Page view tracker: $pageview por sección |

### Archivos Modificados

| Archivo | Cambio |
|---|---|
| `src/app/(app)/layout.tsx` | Agregado `<PostHogProvider>` |
| 13 page files en `src/app/(app)/*/page.tsx` | Agregado `<PostHogPageTracker>` |
| 7 archivos auth/onboarding | Agregado `phAuthEvents` / `phOnboardingEvents` |
| 10 componentes principales | Agregado tracking PostHog paralelo a GA4 |
| 6 API routes | Agregado `captureServerEvent` paralelo a `trackServerEvent` |

### Dependencias

| Package | Tipo | Uso |
|---|---|---|
| `posthog-js` | Client | SDK browser: tracking, identify, feature flags, session replay |
| `posthog-node` | Server | SDK Node.js: tracking server-side (dynamic import) |

---

## Checklist de Verificación Post-Deploy

### Configuración en PostHog Dashboard

- [ ] Cuenta creada en [posthog.com](https://posthog.com)
- [ ] Proyecto creado (`Callengo Production`)
- [ ] Project API Key copiado

### Variables de Entorno

- [ ] `NEXT_PUBLIC_POSTHOG_KEY` configurado en Vercel
- [ ] `NEXT_PUBLIC_POSTHOG_HOST` configurado en Vercel (si usas EU: `https://eu.i.posthog.com`)

### Integración Stripe

- [ ] Stripe conectado en PostHog → Data pipeline → Sources
- [ ] Revenue dashboard visible con datos de suscripciones
- [ ] MRR, churn, LTV calculándose correctamente

### Group Analytics

- [ ] Grupo `company` configurado en Settings → Project settings
- [ ] Eventos mostrando `$group_company` en live events

### Session Replay

- [ ] Session replay habilitado
- [ ] Sample rate configurado (100% recomendado inicialmente)
- [ ] Privacy controls verificados (passwords/emails enmascarados)
- [ ] Network recording habilitado
- [ ] Console log recording habilitado

### Feature Flags (Opcional)

- [ ] Flags iniciales creados (si aplica)
- [ ] Condiciones de release configuradas por plan/propiedad

### Verificación Funcional

- [ ] Live events muestra eventos al navegar la app
- [ ] `user_signed_up` aparece al crear cuenta
- [ ] `$pageview` con `page` property aparece al cambiar de sección
- [ ] Identify funciona: usuario tiene person profile en PostHog → Persons
- [ ] Group analytics funciona: empresa aparece en PostHog → Groups → company
- [ ] Session replay graba sesiones
- [ ] Server-side events aparecen (subscription_started, call_completed)

### Funnels & Retention

- [ ] Funnel Signup → Activation configurado
- [ ] Funnel Agent Configuration configurado
- [ ] Funnel Checkout Conversion configurado
- [ ] Retention weekly por plan configurado
- [ ] Cohorts iniciales creados (Power Users, At Risk, etc.)

### Data Pipeline (Opcional)

- [ ] BigQuery/Snowflake/S3 export configurado
- [ ] Datos fluyendo correctamente al warehouse
