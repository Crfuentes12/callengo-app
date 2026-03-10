# CLAUDE.md — Contexto del Proyecto Callengo

> Documento de contexto para Claude Code. Léelo antes de cada sesión de trabajo.
> Última actualización: Marzo 2026

---

## ¿Qué es Callengo?

Callengo es una plataforma B2B SaaS de llamadas outbound automatizadas con IA. Reemplaza llamadas manuales y repetitivas (calificación de leads, validación de datos, confirmación de citas) con agentes de voz inteligentes que llaman, conversan, analizan y hacen seguimiento de forma autónoma.

**Pitch de una línea:** "Agentes de IA que llaman a tus contactos, califican tus leads, verifican tus datos y confirman tus citas — para que tu equipo nunca tenga que hacerlo."

---

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Frontend** | Next.js 16.1.1 (App Router), React 19.2.1, TypeScript 5.9.3, Tailwind CSS 4, shadcn/ui |
| **Backend** | Next.js API Routes (90+ endpoints serverless) |
| **Base de datos** | Supabase (PostgreSQL) con Row Level Security (RLS), 56 tablas |
| **Auth** | Supabase Auth (email/password + OAuth: Google, GitHub) |
| **Pagos** | Stripe 20.1.0 (suscripciones, metered billing para overage, add-ons) |
| **Llamadas** | Bland AI (voz + transcripción) con arquitectura de sub-cuentas por empresa |
| **Análisis IA** | OpenAI GPT-4o-mini (temperature 0.1, JSON mode, post-call intelligence) |
| **Charts** | Recharts 2.10.3 |
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
│   ├── api/                # 90+ endpoints
│   │   ├── billing/        # 13 endpoints
│   │   ├── bland/          # Webhooks + API Bland AI
│   │   ├── integrations/   # 60+ endpoints OAuth y sync CRMs
│   │   ├── contacts/       # 8 endpoints
│   │   ├── calendar/       # 4 endpoints
│   │   ├── openai/         # 3 endpoints análisis IA
│   │   ├── team/           # 5 endpoints
│   │   ├── queue/          # Procesamiento asíncrono
│   │   └── webhooks/       # Stripe webhooks
│   └── pricing/            # Página pública
├── components/             # 25 directorios
│   ├── agents/             # AgentConfigModal (~2,300 líneas — componente grande)
│   ├── integrations/       # IntegrationsPage (~2,300 líneas — componente grande)
│   ├── dashboard/
│   ├── settings/           # BillingSettings (~1,000 líneas)
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
│   ├── billing/            # Usage tracker, overage manager
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

## Arquitectura Bland AI — Sub-cuentas

Cada empresa tiene una **sub-cuenta aislada en Bland AI** creada al registrarse:
- API key propia (`bland_subaccount_id` en tabla `company_settings`)
- Balance de créditos independiente (se financia desde la cuenta padre)
- Historial de llamadas y analíticas aislados
- Sin concurrencia compartida entre empresas

**Flujo de créditos:**
1. Empresa se suscribe → Stripe cobra mensualmente
2. Webhook dispara → créditos asignados a la sub-cuenta Bland
3. Bland descuenta créditos en tiempo real por minuto usado
4. Overage: Stripe metered billing cobra al final del período

> ⚠️ Twilio BYOP NO está disponible — incompatible con arquitectura multi-tenant de sub-cuentas Bland.

---

## Base de Datos (Supabase)

- **56 tablas** con RLS habilitado
- Tablas clave: `companies`, `company_settings`, `company_subscriptions`, `subscription_plans`, `call_logs`, `contacts`, `campaigns`, `agents`, `follow_ups`, `voicemails`, `integrations_*`
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

Todos en la carpeta `/docs/`:

| Documento | Descripción |
|-----------|-------------|
| `CALLENGO_MASTER_DOCUMENT.md` | Referencia completa del producto (negocio + técnica) |
| `PRICING_MODEL.md` | Modelo de precios V4, unit economics, feature matrix |
| `FULL-ARCHITECTURE-ANALYSIS.md` | Análisis arquitectónico profundo (Marzo 2026) |
| `COMPREHENSIVE_SOFTWARE_AUDIT.md` | Auditoría completa con bugs y recomendaciones |
| `CRM_INTEGRATIONS.md` | Guía de todas las integraciones CRM |
| `HUBSPOT_INTEGRATION_SETUP.md` | Setup específico HubSpot |
| `PIPEDRIVE_INTEGRATION_SETUP.md` | Setup específico Pipedrive |
| `ZOHO_CRM_INTEGRATION.md` | Setup específico Zoho |
| `SIMPLYBOOK_INTEGRATION.md` | Setup específico SimplyBook |

---

## Bugs Conocidos (Auditoría Marzo 2026)

### Alta Prioridad
1. **Rate limiting no aplicado** — `rate-limit.ts` definido pero no usado en endpoints
2. **Free plan sin expiración forzada** — lógica de bloqueo post-trial incompleta
3. **Exchange rates estáticos** — EUR/GBP hardcodeados, no se actualizan dinámicamente
4. **Billing period edge cases** — overage tracking al cambiar de plan en mitad del período

### Media Prioridad
- Datos demo (seed) presentes en producción: 50 contactos, 6 campañas demo
- Componentes muy grandes que dificultan el mantenimiento (AgentConfigModal, IntegrationsPage)
- Falta de tests automatizados

---

## Reglas para Trabajar en Este Proyecto

1. **Siempre leer el archivo antes de modificarlo** — no asumir su contenido
2. **No refactorizar código no solicitado** — los componentes grandes existen intencionalmente por ahora
3. **Respetar el sistema de i18n** — no hardcodear strings en inglés en componentes
4. **Plan features:** La fuente de verdad es `src/config/plan-features.ts` — no duplicar lógica de planes en otros lugares
5. **Bland AI sub-cuentas:** Cada empresa tiene su propio `bland_subaccount_id` — siempre usarlo en llamadas a Bland API, nunca usar la API key maestra
6. **Stripe:** Usar el wrapper `src/lib/stripe.ts`, no instanciar Stripe directamente en otros archivos
7. **Supabase:** Usar `createServerSupabaseClient()` en server-side, `createBrowserSupabaseClient()` en client-side
8. **No commitear a `main` directamente** — trabajar en branches feature
