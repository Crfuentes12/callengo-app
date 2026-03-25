# CLAUDE.md — Contexto del Proyecto Callengo

> Documento de contexto para Claude Code. Léelo antes de cada sesión de trabajo.
> Última actualización: 25 Marzo 2026 (OpenAI usage tracking, per-feature API keys, Cali AI documentado, analytics PII fix, AI Costs tab en Command Center)

---

## ¿Qué es Callengo?

Callengo es una plataforma B2B SaaS de llamadas outbound automatizadas con IA. Reemplaza llamadas manuales y repetitivas (calificación de leads, validación de datos, confirmación de citas) con agentes de voz inteligentes que llaman, conversan, analizan y hacen seguimiento de forma autónoma.

**Pitch de una línea:** "Agentes de IA que llaman a tus contactos, califican tus leads, verifican tus datos y confirman tus citas — para que tu equipo nunca tenga que hacerlo."

---

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Frontend** | Next.js 16.1.1 (App Router), React 19.2.1, TypeScript 5.9.3, Tailwind CSS 4, shadcn/ui |
| **Backend** | Next.js API Routes (142+ endpoints serverless) |
| **Base de datos** | Supabase (PostgreSQL) con Row Level Security (RLS), 57 tablas |
| **Auth** | Supabase Auth (email/password + OAuth: Google, GitHub) |
| **Pagos** | Stripe 20.1.0 (suscripciones, metered billing para overage, add-ons) |
| **Llamadas** | Bland AI (voz + transcripción) con arquitectura de master key única |
| **Concurrencia** | Upstash Redis (rate limiting, concurrency tracking, call slots) |
| **Análisis IA** | OpenAI GPT-4o-mini / GPT-4o (8 áreas: análisis post-llamada, contact intelligence, Cali AI assistant, onboarding; API keys por feature; uso trackeado en `openai_usage_logs`) |
| **Analytics** | Google Analytics 4 (130+ eventos, Measurement Protocol) + PostHog (session replay, feature flags, group analytics) |
| **Charts** | Recharts 3.8.0 |
| **Email** | Resend (invitaciones de equipo, notificaciones transaccionales) |
| **i18n** | 7 idiomas: en, es, fr, de, it, nl, pt (detección por geolocalización) |
| **Deploy** | Vercel |

---

## Estructura del Proyecto

```
src/
├── app/
│   ├── (app)/              # Rutas protegidas (37 rutas)
│   │   ├── dashboard/
│   │   ├── agents/
│   │   ├── contacts/       # + sub-rutas por CRM (salesforce, hubspot, etc.)
│   │   ├── campaigns/
│   │   ├── calls/
│   │   ├── calendar/
│   │   ├── analytics/
│   │   ├── reports/
│   │   ├── voicemails/
│   │   ├── follow-ups/
│   │   ├── settings/       # billing está en settings?tab=billing
│   │   ├── team/
│   │   └── integrations/
│   ├── auth/               # Login, signup, OAuth callbacks
│   ├── admin/              # Vista financiera interna
│   ├── onboarding/
│   ├── api/                # 92+ endpoints
│   │   ├── admin/          # Command Center, clients, finances, reconcile, monitor, cleanup-orphans, openai-usage
│   │   ├── billing/        # 13 endpoints
│   │   ├── bland/          # Webhooks + API Bland AI
│   │   ├── integrations/   # 60+ endpoints OAuth y sync CRMs
│   │   ├── contacts/       # 8 endpoints
│   │   ├── calendar/       # 4 endpoints
│   │   ├── openai/         # 4 endpoints análisis IA + webhook
│   │   ├── team/           # 5 endpoints
│   │   ├── queue/          # Procesamiento asíncrono
│   │   └── webhooks/       # Stripe webhooks
│   └── pricing/            # Página pública
├── components/             # 25 directorios
│   ├── agents/             # AgentConfigModal (~2,300 líneas — componente grande)
│   ├── integrations/       # IntegrationsPage (~2,300 líneas — componente grande)
│   ├── dashboard/
│   ├── settings/           # BillingSettings (~1,000 líneas)
│   ├── admin/              # AdminCommandCenter (~1,200 líneas — 6 tabs)
│   └── ui/                 # shadcn/ui components
├── config/
│   └── plan-features.ts    # Fuente de verdad de features por plan (254 líneas)
├── contexts/
│   └── AuthContext.tsx
├── hooks/
│   ├── useStripe.ts
│   └── useAutoGeolocation.ts
├── i18n/                   # Traducciones por idioma
├── lib/                    # Lógica de negocio
│   ├── ai/                 # Intent analyzer (GPT-4o-mini)
│   ├── openai/             # tracker.ts (client factory, usage logger, cost calculator, model env helpers)
│   ├── bland/              # master-client.ts (plan limits, dispatch), phone-numbers.ts
│   ├── billing/            # Usage tracker, overage manager, call-throttle.ts
│   ├── redis/              # concurrency-manager.ts (Upstash Redis, call slots, gauges)
│   ├── calendar/           # Google, Outlook, Zoom, sync, availability
│   ├── clio/               # Clio CRM (auth, sync)
│   ├── dynamics/           # MS Dynamics (auth, sync)
│   ├── hubspot/            # HubSpot (auth, sync)
│   ├── pipedrive/          # Pipedrive (auth, sync)
│   ├── salesforce/         # Salesforce (auth, sync)
│   ├── simplybook/         # SimplyBook (auth, sync)
│   ├── zoho/               # Zoho CRM (auth, sync)
│   ├── supabase/           # client.ts, server.ts, service.ts
│   ├── voices/             # Bland.ai voice catalog + utils
│   ├── encryption.ts       # AES-256-GCM token encryption (encryptToken/decryptToken)
│   ├── stripe.ts           # Stripe SDK wrapper (380 líneas)
│   ├── rate-limit.ts       # Rate limiting (definido pero NO aplicado globalmente aún)
│   ├── mock-data.ts        # Datos demo (687 líneas)
│   └── webhooks.ts         # Webhook signature verification
├── types/                  # TypeScript types por integración
└── middleware.ts            # Protección de rutas (Edge)
```

---

## Los 3 Agentes de IA

### 1. Lead Qualification Agent
Llama leads, aplica framework BANT (Budget, Authority, Need, Timeline), los clasifica como hot/warm/cold, agenda reuniones con el equipo de ventas.

### 2. Data Validation Agent
Llama contactos para verificar email, teléfono, dirección, cargo, empresa. Actualiza el CRM con datos limpios. Marca números desconectados o contactos desactualizados.

### 3. Appointment Confirmation Agent
Llama 24-48h antes de una cita. Confirma asistencia, gestiona reprogramaciones, detecta no-shows y programa reintentos. Sincroniza resultados al calendario.

---

## Planes y Precios (V4 — Marzo 2026)

| Plan | Precio/mes | Llamadas/mes | Minutos | Concurrentes | Usuarios | Overage |
|------|-----------|-------------|---------|-------------|---------|---------|
| **Free** | $0 | ~10 (one-time) | 15 | 1 | 1 | ❌ bloqueado |
| **Starter** | $99 | ~200 | 300 | 2 | 1 | $0.29/min |
| **Growth** | $179 | ~400 | 600 | 3 | 1 | $0.26/min |
| **Business** | $299 | ~800 | 1,200 | 5 | 3 | $0.23/min |
| **Teams** | $649 | ~1,500 | 2,250 | 10 | 5 | $0.20/min |
| **Enterprise** | $1,499 | ~4,000+ | 6,000 | ∞ | ∞ | $0.17/min |

- **Facturación anual:** 12% de descuento (2 meses gratis)
- **Extra seat:** $49/mes en Business y Teams
- **Add-ons:** Dedicated Number ($15), Recording Vault ($12), Calls Booster ($35)
- **Métrica interna:** minutos. Frontend muestra `llamadas = minutos / 1.5`
- **Costo Bland AI:** $0.11/min (escala). Todos los overages están por encima de este piso.

### Slugs en DB
`free`, `starter`, `growth`, `business`, `teams`, `enterprise`

### Integraciones por Plan
- **Free/Starter/Growth:** Google Calendar, Google Meet, Zoom, Slack, SimplyBook, Webhooks (Zapier/Make/n8n)
- **Business+:** + Microsoft Outlook, Teams, HubSpot, Pipedrive, Zoho, Clio
- **Teams+:** + Salesforce, Microsoft Dynamics 365

---

## Arquitectura Bland AI — Master Key Única

Todas las llamadas pasan por **una sola API key master de Bland AI**. No hay sub-cuentas.
- La aislación por empresa se maneja en Supabase (`company_id` en cada registro)
- Bland ve un pool plano de llamadas — la correlación es por UUIDs en metadata
- El campo `bland_subaccount_id` en `company_settings` se usa como `'master'` para la cuenta admin

**Planes de Bland AI (configurables en Command Center):**

| Plan | $/min | Concurrent | Daily | Hourly | Voice Clones |
|------|-------|-----------|-------|--------|-------------|
| **Start** | $0.14 | 10 | 100 | 100 | 1 |
| **Build** | $0.12 | 50 | 2,000 | 1,000 | 5 |
| **Scale** | $0.11 | 100 | 5,000 | 1,000 | 15 |
| **Enterprise** | $0.09 | ∞ | ∞ | ∞ | 999 |

- El plan activo se selecciona via dropdown en el Command Center admin
- Los límites se cachean en **Redis** (TTL 1h) y se aplican con 90% safety margin
- Fuente de verdad: `BLAND_PLAN_LIMITS` en `src/lib/bland/master-client.ts`
- `BLAND_COST_PER_MINUTE` env var overridea el costo por defecto

**Concurrencia (Redis / Upstash):**
- Contadores globales: concurrent, daily, hourly
- Contadores per-company: concurrent, daily, hourly
- Call slots activos: `callengo:active_call:{callId}` con TTL 30min
- Contact cooldown: 5min entre llamadas al mismo contacto
- Implementación: `src/lib/redis/concurrency-manager.ts`

**Flujo operativo:**
1. El owner carga créditos en su cuenta de Bland (auto-recharge o manual)
2. Campaña dispatched → `checkCallAllowed()` valida límites Callengo + Bland
3. Redis `acquireCallSlot()` reserva slot atómico
4. Llamada enviada via master API key con metadata de company_id
5. Webhook `/api/bland/webhook` procesa resultado, libera slot
6. Usage tracked en `usage_tracking` para Stripe metered billing

**Implementación:** `src/lib/bland/master-client.ts` (plan detection, dispatch, limits)

---

## Base de Datos (Supabase)

- **57 tablas** con RLS habilitado
- Tablas clave: `companies`, `company_settings`, `company_subscriptions`, `subscription_plans`, `call_logs`, `contacts`, `campaigns`, `agents`, `follow_ups`, `voicemails`, `integrations_*`, `openai_usage_logs`
- RLS protege todos los datos por `company_id`
- Fuente de verdad de features: `src/config/plan-features.ts`

---

## Scripts Importantes

```bash
npm run dev                    # Desarrollo local
npm run build                  # Build de producción
npm run lint                   # ESLint
npm run stripe:sync            # Sincronizar productos/precios con Stripe (test)
npm run stripe:sync:live       # Sincronizar con Stripe producción
npm run stripe:sync:dry        # Dry-run para ver qué cambiaría
```

---

## Convenciones y Patrones de Código

- **TypeScript estricto** en todo el proyecto
- **API Routes en `/src/app/api/`** — patrón `route.ts` por carpeta
- **Supabase server client** para API routes: `createServerSupabaseClient()` de `src/lib/supabase/server.ts`
- **Supabase browser client** para components: `src/lib/supabase/client.ts`
- **Zod** para validación de inputs en API routes
- **shadcn/ui** como base de componentes UI
- **Tailwind CSS v4** — sintaxis sin `@layer` antiguo, usa variantes directamente
- Los componentes grandes (>1,000 líneas) existen: `AgentConfigModal`, `IntegrationsPage`, `BillingSettings`. No refactorizar sin solicitud explícita.
- **i18n:** Todas las strings visibles al usuario deben usar el sistema de traducción. Archivos en `src/i18n/`.

---

## Seguridad — Puntos a Tener en Cuenta

- RLS activo en Supabase — siempre filtrar por `company_id`
- `rate-limit.ts` existe pero NO está aplicado globalmente — endpoints críticos de billing y auth son vulnerables
- Stripe webhooks validados con firma (`webhooks.ts`)
- Variables de entorno sensibles: nunca hardcodear keys en código
- Middleware en Edge protege rutas autenticadas (`middleware.ts`)
- **Encriptación de tokens OAuth:** AES-256-GCM via `src/lib/encryption.ts`. Todos los tokens de integración (11 proveedores) se encriptan al guardar y desencriptan al usar. Requiere `TOKEN_ENCRYPTION_KEY` (64 hex chars). `decryptToken()` es backward-compatible con datos plaintext existentes.
- **RLS reforzado:** Trigger `trg_prevent_sensitive_field_changes` bloquea auto-cambios de `company_id` y `email` en tabla `users`. Subscriptions solo editables por `owner`/`admin`.
- **CHECK constraints:** Status columns en 8 tablas validadas con CHECK constraints en DB (no solo aplicación).
- **Soft-delete:** Tabla `companies` tiene columna `deleted_at` con 30 días de recuperación. RLS excluye compañías soft-deleted.

---

## Admin Command Center (`/admin/command-center`)

Panel de monitoreo en tiempo real para el owner de la plataforma. 7 tabs:

| Tab | Contenido |
|-----|-----------|
| **Health** | KPIs de llamadas, Bland AI plan selector (dropdown), Redis concurrency panel (gauges + active calls + per-company), usage gauge, charts 24h/30d, plan distribution |
| **Operations** | MRR/ARR, Stripe revenue 30d, subscription health (active/trialing/canceled/past_due), churn rate, trial conversion, Bland burn rate + runway, failed calls analysis, unit economics (gross margin, ARPC, cost per call) |
| **Clients** | Lista de empresas con usage, profit, Bland cost, add-ons, sortable/searchable |
| **Billing Events** | Log paginado de eventos billing (pagos, overages, créditos, cancelaciones) |
| **Reconciliation** | Comparación minutos reales vs tracked, detección de discrepancias |
| **Finances** | P&L con revenue, costs (Bland, OpenAI, Supabase), gross margin, Bland master account info; OpenAI usage panel (cost by feature, daily trend, model breakdown, recent API call logs) |
| **AI Costs** | Totales 30d (costo, requests, tokens, avg costo/request), desglose por feature, chart de tendencia diaria, desglose por modelo, log de últimas 50 llamadas a OpenAI API |

**API:** `GET /api/admin/command-center` (read) + `POST /api/admin/command-center` (save Bland plan)
**Componente:** `src/components/admin/AdminCommandCenter.tsx` (~1,200 líneas — 7 tabs)
**AI Costs API:** `GET /api/admin/openai-usage` (totales 30d, por feature, por modelo, chart diario, últimos 50 logs)
**Acceso:** Solo roles `admin` y `owner`

---

## Navegación por Defecto

- **Root (`/`)** → redirige a `/home`
- **Post-login** → `/home` (regular users) o `/admin/command-center` (admins)
- **Post-onboarding** → `/home`
- **Team join** → `/home?team_joined=true`

---

## Integraciones CRM

| CRM | Carpeta lib | Tipo de Auth |
|-----|-------------|-------------|
| HubSpot | `src/lib/hubspot/` | OAuth 2.0 |
| Pipedrive | `src/lib/pipedrive/` | OAuth 2.0 |
| Zoho CRM | `src/lib/zoho/` | OAuth 2.0 |
| Salesforce | `src/lib/salesforce/` | OAuth 2.0 |
| Microsoft Dynamics 365 | `src/lib/dynamics/` | OAuth 2.0 (Azure) |
| Clio (legal) | `src/lib/clio/` | OAuth 2.0 |
| SimplyBook.me | `src/lib/simplybook/` | API Key + Secret |

---

## Documentos de Referencia

### Obsidian Knowledge Base (`docs/vault/`) — 60 notas, 13,800+ líneas

Base de conocimiento completa e interconectada con [[wikilinks]]. Abrir con Obsidian para navegación visual.

| Sección | Notas | Contenido |
|---------|-------|-----------|
| `00-Overview/` | 3 | App Identity, Architecture Overview, ICP & Positioning |
| `01-Entities/` | 14 | Company, User, Contact, Agent, Campaign, Call, Follow-Up, Voicemail, Calendar Event, Subscription, Add-on, Notification, Team Invitation, Webhook |
| `02-Database/` | 4 | Schema Overview (56 tablas), RLS Patterns, Triggers & Functions, Migrations Timeline |
| `03-API/` | 8 | API Overview (142+ endpoints), Admin, Auth, Billing, Bland AI, Calendar, Contacts, Integrations |
| `04-Integrations/` | 14 | Bland AI, Stripe, OpenAI, Redis, 7 CRMs, Google Calendar, Outlook, Video Providers |
| `05-Billing/` | 3 | Pricing Model V4, Plan Features, Usage Tracking |
| `06-Workflows/` | 6 | Lead Qualification, Data Validation, Appointment Confirmation, Campaign Dispatch, Call Processing, Onboarding |
| `07-Admin/` | 3 | Command Center, Platform Config, Audit Log |
| `08-Analytics/` | 3 | Google Analytics 4, PostHog, Google Sheets |
| `09-Security/` | 3 | Security & Encryption, Known Issues & Audit, Environment Variables |

### Otros Documentos (`/docs/`)

| Documento | Descripción |
|-----------|-------------|
| `CALLENGO_MASTER_DOCUMENT.md` | Referencia completa del producto (negocio + técnica) |
| `PRICING_MODEL.md` | Modelo de precios V4, unit economics, feature matrix |
| `FULL-ARCHITECTURE-ANALYSIS.md` | Análisis arquitectónico profundo (Marzo 2026) |
| `COMPREHENSIVE_SOFTWARE_AUDIT.md` | Auditoría completa con bugs y recomendaciones (v1, Marzo 5) |
| `CRM_INTEGRATIONS.md` | Guía de todas las integraciones CRM |
| `GOOGLE_ANALYTICS.md` | Setup y catálogo de eventos GA4 |
| `POSTHOG.md` | Setup y catálogo de eventos PostHog |
| `HUBSPOT_INTEGRATION_SETUP.md` | Setup específico HubSpot |
| `PIPEDRIVE_INTEGRATION_SETUP.md` | Setup específico Pipedrive |
| `ZOHO_CRM_INTEGRATION.md` | Setup específico Zoho |
| `SIMPLYBOOK_INTEGRATION.md` | Setup específico SimplyBook |

### Raíz del Proyecto

| Documento | Descripción |
|-----------|-------------|
| `.env.example` | Referencia completa de 53 variables de entorno con documentación |
| `AUDIT_LOG.md` | Log de auditoría de producción (23 Marzo 2026) — 15 fixes, scorecard |

---

## Bugs Conocidos (Auditoría Marzo 2026)

### Alta Prioridad
1. **Rate limiting no aplicado** — `rate-limit.ts` definido pero no usado en endpoints
2. **Free plan sin expiración forzada** — lógica de bloqueo post-trial incompleta
3. **Exchange rates estáticos** — EUR/GBP hardcodeados, no se actualizan dinámicamente

### Media Prioridad
- Datos demo (seed) presentes en producción: 50 contactos, 6 campañas demo
- Componentes muy grandes que dificultan el mantenimiento (AgentConfigModal, IntegrationsPage)
- Falta de tests automatizados (no hay test runner configurado)

### Corregidos (25 Marzo 2026)
- ~~**Email en GA4/PostHog como PII**~~ — Email reemplazado por UUID de Supabase en `AnalyticsProvider`, `PostHogProvider`, `analytics.ts`, `posthog.ts` y `(app)/layout.tsx` (25 Marzo 2026)

### Corregidos (23 Marzo 2026 — auditoría producción completa, 15 fixes)
- ~~**Tokens OAuth en plaintext**~~ — Encriptados con AES-256-GCM (`src/lib/encryption.ts`), 11 proveedores cubiertos
- ~~**users RLS permitía auto-cambio de company_id/email**~~ — Trigger `trg_prevent_sensitive_field_changes` bloquea cambios
- ~~**company_subscriptions editable por cualquier rol**~~ — RLS restringido a `owner`/`admin`
- ~~**Status columns sin validación en DB**~~ — CHECK constraints en 8 tablas
- ~~**Admin Command Center excluía rol owner**~~ — GET y POST ahora aceptan `admin` o `owner`
- ~~**verify-session sin validación de session_id**~~ — Validación de prefijo `cs_`
- ~~**Stripe webhook addon_type sin validación**~~ — Whitelist `VALID_ADDON_TYPES`
- ~~**Seed DELETE inconsistente**~~ — Usa misma auth `SEED_ENDPOINT_SECRET` que POST
- ~~**send-call metadata.contact_id sin validación UUID**~~ — Zod `.refine()` valida formato UUID
- ~~**Command Center queries secuenciales**~~ — hourly + daily ahora en `Promise.all()` paralelo
- ~~**N+1 en admin/monitor**~~ — `getCompanyBreakdown()` refactorizado a 5 queries batch paralelos
- ~~**Cleanup-orphans secuencial**~~ — Usa `Promise.allSettled()` para loops Bland y archival
- ~~**Compañías sin soft-delete**~~ — Columna `deleted_at` + RLS + partial index

#### Corregidos previamente (sesión auditoría billing)
- ~~**Billing period edge cases**~~ — overage tracking al cambiar de plan: corregido
- ~~**Dispatch loop cleanup sin try-catch**~~ — operaciones delete envueltas en try-catch non-fatal
- ~~**billing_cycle sin validación**~~ — `verify-session/route.ts` sanitiza a `'monthly'` o `'annual'`
- ~~**Health data mapping roto**~~ — `AdminCommandCenter.tsx` mapea correctamente la respuesta nested
- ~~**Bland plan "unknown"**~~ — Command Center con dropdown de 4 planes reales de Bland
- ~~**Redis/concurrency invisible**~~ — Panel completo de Redis con gauges, active calls, per-company
- ~~**Landing page default /dashboard**~~ — Cambiado a `/home` en root, login y OAuth callback

---

## Variables de Entorno (59 vars)

Referencia completa en `.env.example` (raíz del proyecto). Copiar a `.env.local` para desarrollo local. En producción, configurar en Vercel → Environment Variables.

### Variables Críticas (siempre requeridas)

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (respeta RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (bypasea RLS — NUNCA exponer al cliente) |
| `NEXT_PUBLIC_APP_URL` | URL base de la app (`http://localhost:3000` en dev) |
| `STRIPE_SECRET_KEY` | Stripe API key (`sk_test_...` o `sk_live_...`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_test_...` o `pk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `BLAND_API_KEY` | Master API key de Bland AI (una sola para todas las empresas) |
| `BLAND_WEBHOOK_SECRET` | HMAC-SHA256 para verificación de webhooks Bland |
| `OPENAI_API_KEY` | OpenAI API key base (fallback para todos los features si no hay key específica) |
| `OPENAI_API_KEY_CALL_ANALYSIS` | OpenAI key para análisis de transcripciones de llamadas (fallback: `OPENAI_API_KEY`) |
| `OPENAI_API_KEY_CONTACT_ANALYSIS` | OpenAI key para contact quality, agent suggestions, web scraper y onboarding (fallback: `OPENAI_API_KEY`) |
| `OPENAI_API_KEY_CALI_AI` | OpenAI key para Cali AI assistant (fallback: `OPENAI_API_KEY`) |
| `OPENAI_WEBHOOK_SECRET` | HMAC-SHA256 secret para verificación de webhooks OpenAI |
| `OPENAI_MODEL` | Override del modelo por defecto (default: `gpt-4o-mini`) |
| `OPENAI_MODEL_PREMIUM` | Modelo premium para análisis profundo de llamadas (default: `gpt-4o`) |
| `UPSTASH_REDIS_REST_URL` | URL REST de Upstash Redis |
| `UPSTASH_REDIS_REST_TOKEN` | Token REST de Upstash Redis |
| `TOKEN_ENCRYPTION_KEY` | Clave AES-256-GCM para encriptar tokens OAuth. **Exactamente 64 caracteres hex** (32 bytes). Generar: `openssl rand -hex 32` |

### Variables de Seguridad Interna

| Variable | Descripción |
|----------|-------------|
| `INTERNAL_API_SECRET` | Auth servicio-a-servicio |
| `QUEUE_PROCESSING_SECRET` | Auth para procesadores de cola |
| `CRON_SECRET` | Auth para Vercel Cron jobs |
| `OAUTH_STATE_SECRET` | HMAC para parámetros de estado OAuth (previene CSRF) |

### Variables de Analytics (opcionales — degradación graceful)

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 measurement ID (`G-XXXXXXXXXX`) |
| `GA_API_SECRET` | GA4 Measurement Protocol secret (eventos server-side) |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project key (`phc_XXX`) |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host (default: `https://us.i.posthog.com`) |

### Variables de Integraciones CRM (17 vars)

Credenciales OAuth de cada CRM. Tokens de usuario se encriptan con AES-256-GCM al guardar en DB.

| CRM | Variables | Plan |
|-----|-----------|------|
| HubSpot | `HUBSPOT_APP_ID`, `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`, `HUBSPOT_PRIVATE_APP_TOKEN` | Business+ |
| HubSpot Marketing | `NEXT_PUBLIC_HUBSPOT_PORTAL_ID`, `NEXT_PUBLIC_HUBSPOT_CONTACT_FORM_ID` | — |
| Salesforce | `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `SALESFORCE_LOGIN_URL` | Teams+ |
| Pipedrive | `PIPEDRIVE_CLIENT_ID`, `PIPEDRIVE_CLIENT_SECRET` | Business+ |
| Zoho | `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET` | Business+ |
| Dynamics 365 | `DYNAMICS_CLIENT_ID`, `DYNAMICS_CLIENT_SECRET`, `DYNAMICS_TENANT_ID` | Teams+ |
| Clio | `CLIO_CLIENT_ID`, `CLIO_CLIENT_SECRET` | Business+ |

### Variables de Calendario y Video (8 vars)

| Integración | Variables | Plan |
|-------------|-----------|------|
| Google (Calendar + Sheets) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Free+ |
| Microsoft (Outlook) | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` | Business+ |
| Zoom | `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` | Free+ |

### Otras Variables

| Variable | Descripción |
|----------|-------------|
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` | Slack integration |
| `RESEND_API_KEY` | Email transaccional (invitaciones, notificaciones) |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY` | reCAPTCHA v3 (protección de formularios auth) |
| `BLAND_COST_PER_MINUTE` | Override del costo/min de Bland (default: `0.14`). Para cálculos de P&L. |
| `AI_ANALYSIS_MODE` | `sync` (default, inline en webhook) o `async` (via `analysis_queue`) |

---

## Reglas para Trabajar en Este Proyecto

1. **Siempre leer el archivo antes de modificarlo** — no asumir su contenido
2. **No refactorizar código no solicitado** — los componentes grandes existen intencionalmente por ahora
3. **Respetar el sistema de i18n** — no hardcodear strings en inglés en componentes
4. **Plan features:** La fuente de verdad es `src/config/plan-features.ts` — no duplicar lógica de planes en otros lugares
5. **Bland AI master key:** Todas las llamadas usan la API key master (`BLAND_API_KEY`). No hay sub-cuentas. Aislación por `company_id` en Supabase. Los límites del plan se configuran en Command Center y se cachean en Redis.
6. **Stripe:** Usar el wrapper `src/lib/stripe.ts`, no instanciar Stripe directamente en otros archivos
7. **Supabase:** Usar `createServerSupabaseClient()` en server-side, `createBrowserSupabaseClient()` en client-side
8. **No commitear a `main` directamente** — trabajar en branches feature
9. **Encriptación de tokens:** Usar `encryptToken()` / `decryptToken()` de `src/lib/encryption.ts` para cualquier token OAuth o API key que se guarde en DB. Requiere env var `TOKEN_ENCRYPTION_KEY`.
10. **Migraciones DB:** 46 migraciones en `supabase/migrations/`. Última: `20260325000001_openai_usage_tracking.sql`. Usar prefijo timestamp para nuevas migraciones.
11. **Variables de entorno:** Referencia completa en `.env.example`. Si se agrega una nueva env var, actualizar también `.env.example` con documentación.
12. **OpenAI client:** Usar `getOpenAIClient(featureKey)` de `src/lib/openai/tracker.ts` para instanciar OpenAI. No instanciar directamente. Usar `getDefaultModel()` / `getPremiumModel()` en lugar de hardcodear nombres de modelo.

---

## Reglas de Actualización de Documentación

Cada vez que se hagan cambios significativos al código, **actualizar la documentación correspondiente**:

### Cuándo actualizar `CLAUDE.md`
- Cuando se agregan/eliminan **API endpoints** → actualizar conteo en "Stack Tecnológico" y "Estructura del Proyecto"
- Cuando se agregan/eliminan **tablas de DB** → actualizar conteo en "Base de Datos" y "Migraciones DB"
- Cuando se agregan/eliminan **variables de entorno** → actualizar sección "Variables de Entorno" y `.env.example`
- Cuando se corrigen **bugs conocidos** → mover de "Alta/Media Prioridad" a "Corregidos" con fecha
- Cuando cambian **precios o planes** → actualizar tabla "Planes y Precios"
- Cuando se agregan **integraciones CRM** → actualizar tabla "Integraciones CRM"
- Cuando cambian **reglas de seguridad** → actualizar sección "Seguridad"
- Cuando se agregan **nuevas migraciones** → actualizar número de migraciones y "Última migración"

### Cuándo actualizar el Vault de Obsidian (`docs/vault/`)
- Cuando se modifica una **entidad** (nueva columna, nuevo índice, nueva FK) → actualizar la nota correspondiente en `01-Entities/`
- Cuando se agrega un **nuevo endpoint API** → actualizar la nota correspondiente en `03-API/`
- Cuando se modifica una **integración** (nueva tabla, nuevo campo, cambio de auth) → actualizar en `04-Integrations/`
- Cuando cambian **planes/precios/features** → actualizar `05-Billing/`
- Cuando se modifica un **workflow** (nuevo paso, cambio de lógica) → actualizar en `06-Workflows/`
- Cuando se agregan **nuevas migraciones** → actualizar `02-Database/Migrations Timeline.md`
- Cuando se corrigen **bugs de seguridad** → actualizar `09-Security/Known Issues & Audit.md`
- Cuando se agregan **nuevas env vars** → actualizar `09-Security/Environment Variables.md`
- Cuando se agregan **nuevos eventos analytics** → actualizar `08-Analytics/`

### Formato del Vault de Obsidian
- Usar **frontmatter YAML** con tags en cada archivo
- Usar **[[wikilinks]]** para interconectar notas
- Incluir **tablas completas** con todas las columnas de DB (tipo, default, nullable, descripción)
- Documentar **todos los índices, RLS policies, triggers, y FK** relevantes
- Escribir en **prosa detallada** (no solo bullet points sueltos)
- Mantener **consistencia** en formato entre archivos del mismo directorio

### Cuándo actualizar `.env.example`
- Cuando se agrega **cualquier nueva variable de entorno** en el código
- Incluir: nombre, valor de ejemplo, comentario explicativo, indicar si es Public o Server-only
- Agrupar por categoría (Core, Payments, Voice, AI, etc.)
