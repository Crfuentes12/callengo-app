# CALLENGO - AUDITORÍA COMPLETA DEL SOFTWARE

**Fecha:** 5 de Marzo de 2026
**Versión analizada:** V3 (Marzo 2026)
**Alcance:** Frontend + Backend + Base de datos + Integraciones + Seguridad + Simulaciones

---

## TABLA DE CONTENIDOS

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura General](#2-arquitectura-general)
3. [Análisis de Base de Datos](#3-análisis-de-base-de-datos)
4. [Sistema de Planes y Precios](#4-sistema-de-planes-y-precios)
5. [Sistema de Agentes](#5-sistema-de-agentes)
6. [Integraciones CRM](#6-integraciones-crm)
7. [Sistema de Calendario](#7-sistema-de-calendario)
8. [Sistema de Billing y Stripe](#8-sistema-de-billing-y-stripe)
9. [Auditoría de Seguridad](#9-auditoría-de-seguridad)
10. [Bugs, Errores e Inconsistencias](#10-bugs-errores-e-inconsistencias)
11. [Simulación 1: Empresa de Procesamiento de Pagos](#11-simulación-1-empresa-de-procesamiento-de-pagos)
12. [Simulación 2: Clínica Médica - Reducir No-Shows](#12-simulación-2-clínica-médica---reducir-no-shows)
13. [Simulación 3: Empresa de Cold Outreach - Cualificación de Leads](#13-simulación-3-empresa-de-cold-outreach---cualificación-de-leads)
14. [Viabilidad del Producto](#14-viabilidad-del-producto)
15. [Recomendaciones Prioritarias](#15-recomendaciones-prioritarias)

---

## 1. RESUMEN EJECUTIVO

### Qué es Callengo
Callengo es una plataforma SaaS de llamadas automatizadas con IA que permite a empresas ejecutar campañas de llamadas outbound usando agentes de voz inteligentes. Los tres casos de uso principales son:

1. **Validación de Datos** - Verificar información de contactos
2. **Confirmación de Citas** - Confirmar/reagendar citas y reducir no-shows
3. **Cualificación de Leads** - Evaluar prospectos usando framework BANT

### Stack Tecnológico
- **Frontend:** Next.js 16.1.1 (App Router), React 19.2.1, TypeScript 5.9.3, Tailwind CSS 4, shadcn/ui
- **Backend:** Next.js API Routes (90+ endpoints, NO Edge Functions de Supabase)
- **Base de datos:** PostgreSQL via Supabase (con RLS, 56 tablas)
- **Pagos:** Stripe 20.1.0 (checkout, suscripciones, metered billing)
- **Llamadas:** Bland AI (API de voz)
- **Análisis IA:** OpenAI GPT-4o-mini (temperature 0.1, JSON mode)
- **Charts:** Recharts 2.10.3
- **i18n:** 7 idiomas (en, es, fr, de, it, nl, pt) con detección por geolocalización
- **Deploy:** Vercel

### Veredicto General

| Categoría | Estado | Nota |
|-----------|--------|------|
| Arquitectura | ✅ Sólida (7.5/10) | Next.js 16.1.1, 90+ endpoints, 37 rutas, 25 dirs componentes |
| Base de datos | ✅ Bien diseñada | 56 tablas, RLS robusto, FK coherentes |
| Planes/Precios | ⚠️ 3 inconsistencias | $69/$79 seats, tipos de cambio estáticos, free plan 10 años |
| Seguridad | ⚠️ Aceptable con gaps | 0 críticos, 4 altos (RLS, rate limiting, billing period, FX) |
| Integraciones | ✅ Funcionales | 8 CRMs + Calendar + Google Sheets + Twilio |
| Valor del producto | ✅ Viable | Propuesta clara y diferenciada |
| Frontend | ⚠️ Componentes grandes | AgentConfigModal 2,298 líneas, IntegrationsPage 2,326 líneas |
| Datos demo | ⚠️ Presentes | 50 contactos seed, 6 campañas demo |
| **Total bugs encontrados** | **17** | 4 ALTA, 7 MEDIA, 6 BAJA |
| Coherencia general | ✅ Alta | Frontend y backend sincronizados |

---

## 2. ARQUITECTURA GENERAL

### 2.1 Estructura del Frontend

```
src/
├── app/                          # Next.js 16.1.1 App Router
│   ├── (app)/                   # Rutas protegidas (37 rutas)
│   │   ├── dashboard/           # Dashboard principal
│   │   ├── agents/              # Gestión de agentes
│   │   ├── contacts/            # Gestión de contactos
│   │   │   ├── salesforce/      # Import desde Salesforce
│   │   │   ├── hubspot/         # Import desde HubSpot
│   │   │   ├── pipedrive/       # Import desde Pipedrive
│   │   │   ├── clio/            # Import desde Clio
│   │   │   ├── zoho/            # Import desde Zoho
│   │   │   ├── microsoft-dynamics/ # Import desde Dynamics
│   │   │   └── simplybook/      # Import desde SimplyBook
│   │   ├── campaigns/           # Campañas de llamadas
│   │   ├── calls/               # Historial de llamadas
│   │   ├── calendar/            # Calendario
│   │   ├── analytics/           # Analíticas
│   │   ├── reports/             # Reportes detallados
│   │   ├── voicemails/          # Transcripciones de voicemail
│   │   ├── follow-ups/          # Cola de seguimiento
│   │   ├── billing/             # Facturación (→ settings?tab=billing)
│   │   ├── settings/            # Configuración
│   │   ├── team/                # Gestión de equipo
│   │   └── integrations/        # Integraciones CRM
│   ├── auth/                    # Rutas de autenticación
│   │   ├── login/               # Email + OAuth sign-in
│   │   ├── signup/              # Registro
│   │   ├── forgot-password/     # Solicitud de reset
│   │   ├── reset-password/      # Cambio de contraseña
│   │   ├── verify-email/        # Verificación requerida
│   │   └── [provider]/callback/ # OAuth callbacks (dinámico)
│   ├── admin/                   # Rutas de administrador
│   │   └── finances/            # Vista financiera
│   ├── onboarding/              # Onboarding de nuevos usuarios
│   ├── api/                     # API Routes - 90+ endpoints
│   │   ├── billing/             # 13 endpoints de billing
│   │   ├── bland/               # Webhooks + API Bland AI
│   │   ├── integrations/        # 60+ endpoints OAuth y sync CRMs
│   │   ├── contacts/            # 8 endpoints de contactos
│   │   ├── calendar/            # 4 endpoints de calendario
│   │   ├── openai/              # 3 endpoints de análisis IA
│   │   ├── team/                # 5 endpoints de equipo
│   │   ├── voices/              # Catálogo de voces
│   │   ├── queue/               # Procesamiento asíncrono
│   │   ├── admin/               # Endpoints de admin
│   │   ├── seed/                # Datos demo
│   │   └── webhooks/            # Stripe webhooks
│   └── pricing/                 # Página pública de precios
├── components/                  # 25 directorios de componentes
│   ├── agents/                  # AgentConfigModal (2,298 líneas)
│   ├── integrations/            # IntegrationsPage (2,326 líneas)
│   ├── dashboard/               # DashboardOverview (1,200+ líneas)
│   ├── settings/                # BillingSettings (1,000+ líneas)
│   ├── ui/                      # Componentes base (shadcn/ui)
│   └── ...                      # 20 directorios más
├── config/                      # plan-features.ts (254 líneas)
├── contexts/                    # AuthContext.tsx
├── hooks/                       # useStripe, useAutoGeolocation
├── i18n/                        # 7 idiomas (en, es, fr, de, it, nl, pt)
├── lib/                         # Lógica de negocio
│   ├── ai/                      # Intent analyzer (GPT-4o-mini)
│   ├── billing/                 # Usage tracker, overage manager
│   ├── calendar/                # Google, Outlook, Zoom, sync, availability
│   ├── clio/                    # Clio CRM (auth, sync)
│   ├── dynamics/                # MS Dynamics (auth, sync)
│   ├── hubspot/                 # HubSpot (auth, sync)
│   ├── pipedrive/               # Pipedrive (auth, sync)
│   ├── salesforce/              # Salesforce (auth, sync)
│   ├── simplybook/              # SimplyBook (auth, sync)
│   ├── zoho/                    # Zoho CRM (auth, sync)
│   ├── supabase/                # client.ts, server.ts, service.ts
│   ├── voices/                  # Bland.ai voice catalog + utils
│   ├── stripe.ts                # Stripe SDK wrapper (380 líneas)
│   ├── rate-limit.ts            # Rate limiting (⚠️ definido pero NO usado)
│   ├── mock-data.ts             # Datos demo (687 líneas)
│   └── webhooks.ts              # Webhook signature verification
├── types/                       # TypeScript type definitions
└── middleware.ts                # Protección de rutas (Edge)
```

### 2.1.1 Diagrama de Arquitectura por Capas

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA CLIENTE (Browser)                    │
│  React 19.2.1 + Tailwind CSS 4 + shadcn/ui                │
│  37 rutas, 25 dirs componentes, AuthContext, i18n           │
├─────────────────────────────────────────────────────────────┤
│                    CAPA MIDDLEWARE (Edge)                    │
│  Protección de rutas, validación de sesión, redirects       │
│  Email verification → Onboarding → Dashboard                │
├─────────────────────────────────────────────────────────────┤
│                  CAPA API (Node.js, 90+ endpoints)          │
│  /billing/* │ /integrations/* │ /contacts/* │ /bland/*      │
│  /calendar/* │ /openai/* │ /team/* │ /webhooks/*            │
├─────────────────────────────────────────────────────────────┤
│                    CAPA BASE DE DATOS                        │
│  Supabase PostgreSQL │ 56 tablas │ RLS │ WebSocket          │
├─────────────────────────────────────────────────────────────┤
│                  SERVICIOS EXTERNOS                          │
│  Stripe │ Bland.ai │ OpenAI │ Google APIs │ Microsoft Graph │
│  Salesforce │ HubSpot │ Pipedrive │ Clio │ Zoho │ Twilio   │
└─────────────────────────────────────────────────────────────┘
```

### 2.1.2 Componentes Más Grandes (Candidatos a Refactorización)

| Componente | Tamaño | Líneas | Responsabilidad |
|-----------|--------|--------|-----------------|
| AgentConfigModal.tsx | 125 KB | 2,298 | Wizard de configuración de agente (6 pasos) |
| IntegrationsPage.tsx | 129 KB | 2,326 | Hub de todas las integraciones + setup |
| DashboardOverview.tsx | 40 KB | 1,200+ | Stats, llamadas recientes, gráficos |
| BillingSettings.tsx | 35 KB | 1,000+ | Planes, uso, cancelación (5 pasos) |

**Recomendación:** Dividir cada componente grande en sub-componentes por paso/sección y usar `React.lazy()` para carga bajo demanda de modales.

### 2.1.3 Gestión de Estado

| Nivel | Mecanismo | Uso |
|-------|-----------|-----|
| Global (Auth) | React Context API | AuthContext (user, session, signOut) |
| Global (i18n) | React Context API | Idioma actual, función `t()` |
| Server | Server Components | Data fetching en page.tsx, props a client |
| Local | useState/useCallback | Formularios, UI state, loading states |
| Caché | useMemo/useCallback | Cálculos costosos (stats de billing) |

**Nota:** No se usa Redux, Zustand ni React Query. Prop drilling es el patrón dominante para comunicación entre componentes. Se recomienda Zustand o SWR para mejorar rendimiento y reducir prop drilling.

### 2.2 Estructura del Backend (Base de Datos)

**56 tablas en total**, organizadas por dominio:

| Dominio | Tablas | Descripción |
|---------|--------|-------------|
| Core | companies, users, contacts, contact_lists | Entidades base |
| Agentes | agent_templates, company_agents, agent_runs | Sistema de agentes |
| Llamadas | call_logs, call_queue, voicemail_logs | Gestión de llamadas |
| Seguimiento | follow_up_queue, analysis_queue | Automatización |
| Billing | subscription_plans, company_subscriptions, usage_tracking, billing_history, billing_events | Facturación |
| Calendario | calendar_events, calendar_integrations, calendar_sync_log, team_calendar_assignments | Calendario |
| CRM | salesforce_*, hubspot_*, pipedrive_*, clio_*, zoho_*, dynamics_*, simplybook_* | 7 integraciones CRM |
| Google Sheets | google_sheets_integrations, google_sheets_linked_sheets | Importación |
| Webhooks | webhook_endpoints, webhook_deliveries | Webhooks outbound |
| Notificaciones | notifications | Sistema de alertas |
| AI Chat | ai_conversations, ai_messages | Chat con IA |
| Admin | admin_finances, stripe_events | Administración |
| Equipo | team_invitations | Gestión de equipo |
| Retención | retention_offers, retention_offer_log, cancellation_feedback | Anti-churn |

### 2.3 Flujo de Datos Principal

```
Usuario configura campaña → Selecciona agente + contactos → Inicia ejecución
    ↓
Sistema llama a Bland AI por cada contacto
    ↓
Bland AI ejecuta la llamada con el agente de voz
    ↓
Al completar, Bland envía webhook a /api/bland/webhook
    ↓
Webhook procesa en 9 fases:
  1. Persistencia (call_logs)
  2. Lock de contacto
  3. Análisis IA (GPT-4o-mini)
  4. Acciones específicas del agente
  5. Calendario (crear/actualizar eventos)
  6. Sync CRM (Pipedrive, Clio, etc.)
  7. Follow-up queue
  8. Voicemail logging
  9. Webhooks outbound + Unlock contacto
```

---

## 3. ANÁLISIS DE BASE DE DATOS

### 3.1 Foreign Keys - Análisis Completo

**Total de Foreign Keys:** 95+

**Evaluación de ON DELETE:**

| Política | Conteo | Ejemplo |
|----------|--------|---------|
| CASCADE | ~45 | companies → users, contacts, call_logs |
| SET NULL | ~30 | contacts → call_queue.contact_id |
| No especificado (RESTRICT) | ~20 | subscription_plans → company_subscriptions |

**Hallazgos positivos:**
- ✅ Todas las tablas dependientes de `companies` usan `ON DELETE CASCADE` correctamente
- ✅ Las referencias a `contacts` usan `SET NULL` (no pierdes datos de llamadas si borras contacto)
- ✅ Los CRM mappings tienen cascade a integración (borrar integración limpia mappings)

**Hallazgos negativos:**
- ⚠️ `company_subscriptions.plan_id → subscription_plans.id` NO tiene ON DELETE definido - si desactivas un plan, las suscripciones quedan con referencia rota
- ⚠️ `agent_runs.agent_template_id → agent_templates.id` sin ON DELETE - si borras template, los runs quedan huérfanos
- ⚠️ `call_logs.agent_template_id → agent_templates.id` sin ON DELETE - mismo problema

### 3.2 Índices - Análisis de Cobertura

**Total de índices:** 120+

**Evaluación:**
- ✅ Todos los `company_id` tienen índice (esencial para multi-tenancy)
- ✅ Índices compuestos para queries frecuentes (company_id + status, company_id + active)
- ✅ Índices parciales para queries con WHERE clause (status = 'pending', is_active = true)
- ✅ Índices únicos para prevenir duplicados (email, slug, stripe_subscription_id)
- ✅ GIN index en JSONB columns (location_logs, fav_voices)

**Posibles mejoras:**
- ⚠️ `calendar_events` tiene 20+ índices - posible sobre-indexación que ralentiza writes
- ⚠️ Índices duplicados: `idx_calendar_events_company` y `idx_cal_events_company` hacen lo mismo
- ⚠️ Índices duplicados: `idx_calendar_events_source` y `idx_cal_events_source`

### 3.3 Unique Constraints

| Tabla | Constraint | Evaluación |
|-------|-----------|------------|
| subscription_plans | name, slug | ✅ Correcto |
| company_subscriptions | company_id | ✅ Solo 1 suscripción por empresa |
| company_subscriptions | stripe_subscription_id | ✅ Previene duplicados |
| users | email | ✅ Correcto |
| agent_templates | slug | ✅ Correcto |
| call_logs | call_id | ✅ Previene duplicados de Bland |
| calendar_integrations | company_id, provider | ✅ 1 integración por proveedor |
| team_calendar_assignments | company_id, user_id | ✅ 1 asignación por usuario |

### 3.4 Triggers - Análisis

**Total de triggers:** 50+

**Tipos:**
1. **Timestamp updates (40+)** - `updated_at` automático en cada tabla
2. **Notificaciones (3)** - campaign_completion, high_failure_rate, minutes_limit
3. **Automatización (1)** - auto_create_followup en call_logs
4. **Timestamp genéricos (6)** - handle_updated_at para companies, users, etc.

**Problemas detectados:**
- ⚠️ **Triggers duplicados en contacts:** `set_updated_at` (handle_updated_at) y `update_contacts_updated_at` (update_updated_at_column) - ambos hacen lo mismo
- ⚠️ **Triggers duplicados en company_settings:** `set_updated_at` y `update_company_settings_updated_at`
- ⚠️ **notify_high_failure_rate** puede generar spam de notificaciones si la tasa se mantiene >50%
- ⚠️ **auto_create_followup** no tiene check de idempotencia - puede crear follow-ups duplicados

### 3.5 RLS (Row Level Security) - Evaluación

**Tablas con RLS correctamente configurado:** 40+

**Patrón consistente usado:**
```sql
-- Lectura: usuario ve datos de su empresa
company_id IN (SELECT users.company_id FROM users WHERE users.id = auth.uid())

-- Service role: bypass completo para operaciones del sistema
auth.role() = 'service_role'
```

**Hallazgos críticos:**
- ✅ Todas las tablas sensibles tienen RLS
- ✅ `admin_finances` solo accesible por role='admin'
- ✅ `stripe_events` solo accesible por service_role
- ⚠️ `companies` tiene política `authenticated_can_view_companies` con `USING (true)` - CUALQUIER usuario autenticado puede ver TODAS las empresas
- ⚠️ `company_settings` tiene `authenticated_can_view_settings` con `USING (true)` - cualquier usuario ve settings de todas las empresas
- ⚠️ Políticas RLS duplicadas en varias tablas (selectiva redundante con ALL)
- ⚠️ `claim_analysis_job()` es SECURITY DEFINER - podría permitir a un usuario reclamar jobs de otra empresa

### 3.6 Funciones de Base de Datos

| Función | Propósito | Riesgo |
|---------|-----------|--------|
| `handle_updated_at()` | Timestamp automático | BAJO |
| `update_updated_at_column()` | Timestamp automático (variante) | BAJO |
| `notify_campaign_completion()` | Notificación al completar campaña | MEDIO |
| `notify_high_failure_rate()` | Alerta si >50% llamadas fallan | MEDIO |
| `notify_minutes_limit()` | Alerta en 80%, 90%, 100% uso | MEDIO |
| `auto_create_followup()` | Crear follow-up automático | MEDIO |
| `claim_analysis_job()` | Reclamar job de análisis (SECURITY DEFINER) | ALTO |

---

## 4. SISTEMA DE PLANES Y PRECIOS

### 4.1 Estructura de Planes (V3 - Marzo 2026)

| Plan | Mensual | Anual (por mes) | Minutos | Usuarios | Agentes | Overage/min |
|------|---------|-----------------|---------|----------|---------|-------------|
| **Free** | $0 | - | 15 | 1 | 1 (locked) | N/A |
| **Starter** | $99 | $87 (12% desc) | 300 | 1 | 1 (switchable) | $0.55 |
| **Business** | $299 | $269 (10% desc) | 1,200 | 3 | Ilimitados | $0.39 |
| **Teams** | $649 | $579 (11% desc) | 2,500 | 5 base | Ilimitados | $0.29 |
| **Enterprise** | $1,499 | $1,349 (10% desc) | 6,000 | Ilimitados | Ilimitados | $0.25 |

### 4.2 Feature Gating por Plan

| Feature | Free | Starter | Business | Teams | Enterprise |
|---------|------|---------|----------|-------|------------|
| Voicemail Detection | - | ✅ | ✅ | ✅ | ✅ |
| Follow-ups | - | 2 max | 5 max (smart) | 10 max (smart) | Ilimitados |
| Slack | - | ✅ | ✅ | ✅ | ✅ |
| Zoom/Meet | - | ✅ | ✅ | ✅ | ✅ |
| Outlook/Teams | - | - | ✅ | ✅ | ✅ |
| HubSpot/Pipedrive/Zoho | - | - | ✅ | ✅ | ✅ |
| Clio (Legal) | - | - | ✅ | ✅ | ✅ |
| Salesforce | - | - | - | ✅ | ✅ |
| Dynamics 365 | - | - | - | ✅ | ✅ |
| Webhooks | - | ✅ | ✅ | ✅ | ✅ |
| No-Show Auto-Retry | - | - | ✅ | ✅ | ✅ |
| Extra Seats | - | - | - | $69-79/mes | Incluidos |

### 4.3 INCONSISTENCIA CRÍTICA: Precio Extra Seat Teams

**Base de datos (migration):** `extra_seat_price = 79.00`
```sql
UPDATE subscription_plans SET extra_seat_price = 79.00 WHERE slug = 'teams';
```

**Frontend (BillingSettings.tsx):** `teams: 69`
```typescript
const EXTRA_SEAT_PRICE = { free: null, starter: null, business: null, teams: 69, enterprise: null };
```

**Config (plan-features.ts header):** `$69/extra seat`

**Impacto:** El usuario ve $69 en la UI pero el backend podría cobrar $79. Esto es una discrepancia de billing que puede generar disputas de facturación.

**Recomendación:** Unificar en $69 en la migración de BD.

### 4.4 Almacenamiento de Precios Anuales

El campo `price_annual` almacena el **equivalente mensual**, no el total anual:
- Starter: $87/mes (no $1,044/año)
- Business: $269/mes (no $3,228/año)

Esto es intencional pero puede confundir a desarrolladores nuevos.

### 4.5 Soporte Multi-Moneda

Implementación de multiplicadores en el frontend:
- USD: 1.00x (base)
- EUR: 0.92x
- GBP: 0.79x

**Nota:** No es conversión real de moneda, son multiplicadores fijos hardcodeados.

---

## 5. SISTEMA DE AGENTES

### 5.1 Tres Agentes Core

#### Data Validation Agent (slug: `data-validation`)
- **Propósito:** Verificar y actualizar información de contactos
- **Template:** Llama al contacto, confirma email/teléfono/dirección
- **Análisis IA:** Clasifica en `data_confirmed`, `data_updated`, `callback_requested`, `refused`, `partial`
- **Campos extraídos:** nombre, email, teléfono, dirección, ciudad, estado, código postal, empresa, cargo

#### Appointment Confirmation Agent (slug: `appointment-confirmation`)
- **Propósito:** Confirmar citas y reducir no-shows
- **Template:** Llama para confirmar cita, ofrece reagendar si no puede asistir
- **Análisis IA:** Clasifica en `confirmed`, `reschedule`, `cancel`, `no_show`, `unclear`, `callback_requested`
- **Campos extraídos:** nueva hora de cita, razón de cambio, sentimiento del paciente

#### Lead Qualification Agent (slug: `lead-qualification`)
- **Propósito:** Cualificar prospectos usando BANT (Budget, Authority, Need, Timeline)
- **Template:** Evalúa presupuesto, autoridad, necesidad y timeline
- **Análisis IA:** Clasifica en `qualified`, `not_qualified`, `needs_nurturing`, `meeting_requested`, `callback_requested`
- **Score:** 1-10 (1-4 cold, 5-7 warm, 8-10 hot)

### 5.2 Configuración de Campañas (agent_runs)

Cada campaña permite configurar:

| Categoría | Opciones |
|-----------|----------|
| **Voz** | nat, maya, josh, matt |
| **Duración** | 1-15 minutos por llamada |
| **Intervalo** | 1-5 minutos entre llamadas |
| **Voicemail** | Habilitado/deshabilitado, mensaje personalizado |
| **Follow-ups** | Habilitado, max intentos, intervalo en horas, condiciones |
| **Calendario** | Timezone, horario laboral, días hábiles, excluir festivos |
| **Video** | Zoom, Google Meet, Microsoft Teams, ninguno |
| **Integraciones** | CRMs conectados para sincronización |

### 5.3 Pipeline de Procesamiento (Webhook - 889 líneas)

El webhook de Bland AI procesa en 9 fases:

1. **Persistencia** - Guardar call_log con transcripción, grabación, precio
2. **Lock contacto** - Prevenir ediciones concurrentes
3. **Análisis IA** - GPT-4o-mini analiza transcripción semánticamente
4. **Acciones del agente** - Confirmar cita, actualizar datos, cualificar lead
5. **Calendario** - Crear/actualizar eventos, programar callbacks
6. **Sync CRM** - Push resultados a Pipedrive, Clio, etc.
7. **Follow-up queue** - Programar reintentos automáticos
8. **Voicemail logging** - Registrar buzones de voz detectados
9. **Webhooks outbound + Unlock** - Notificar endpoints externos

### 5.4 Análisis IA con GPT-4o-mini

- **Modelo:** GPT-4o-mini (no GPT-4, optimizado para costo/velocidad)
- **Temperature:** 0.1 (alta consistencia, respuestas predecibles)
- **Formato:** JSON estructurado
- **Modos:** Síncrono (default, 200-500ms) o Asíncrono (queue)
- **Campo `analysis_questions`:** Existe en el schema pero está NULL - no se usa, el análisis es totalmente dinámico

---

## 6. INTEGRACIONES CRM

### 6.1 Mapa de Integraciones

| CRM | Plan Mínimo | OAuth | Sync Inbound | Sync Outbound | Tablas |
|-----|------------|-------|--------------|---------------|--------|
| HubSpot | Business | ✅ | ✅ Contactos | ✅ Notas | hubspot_integrations, hubspot_contact_mappings, hubspot_sync_logs |
| Pipedrive | Business | ✅ | ✅ Personas | ✅ Deals/Activities | pipedrive_integrations, pipedrive_contact_mappings, pipedrive_sync_logs |
| Zoho CRM | Business | ✅ | ✅ Contactos | ✅ | zoho_integrations, zoho_contact_mappings, zoho_sync_logs |
| Clio | Business | ✅ | ✅ Contactos | ✅ Matters/Tasks | clio_integrations, clio_contact_mappings, clio_sync_logs |
| Salesforce | Teams | ✅ | ✅ Leads/Contacts | ✅ | salesforce_integrations, salesforce_contact_mappings, salesforce_sync_logs |
| Dynamics 365 | Teams | ✅ | ✅ Contactos | ✅ | dynamics_integrations, dynamics_contact_mappings, dynamics_sync_logs |
| SimplyBook | Business | Credenciales | ✅ Citas | ✅ | simplybook_integrations, simplybook_contact_mappings, simplybook_sync_logs, simplybook_webhook_logs |
| Google Sheets | Business | ✅ | ✅ Importar | - | google_sheets_integrations, google_sheets_linked_sheets |

### 6.2 Patrón de Integración Consistente

Cada integración CRM sigue el mismo patrón:

1. **Tabla de integración** (`*_integrations`) - Tokens OAuth, metadata del CRM
2. **Tabla de mappings** (`*_contact_mappings`) - Relación contacto Callengo ↔ contacto CRM
3. **Tabla de logs** (`*_sync_logs`) - Historial de sincronización

**Campos comunes en todas las integraciones:**
- `access_token`, `refresh_token`, `token_expires_at`
- `is_active`, `last_synced_at`, `sync_token`
- `created_at`, `updated_at`

### 6.3 Evaluación de Integraciones

**Bien implementado:**
- ✅ Patrón consistente en todas las integraciones
- ✅ Tokens de refresco para todas las OAuth flows
- ✅ Sync logs para auditoría
- ✅ RLS en todas las tablas de integración
- ✅ Mappings bidireccionales con unique constraints

**Áreas de mejora:**
- ⚠️ Tokens OAuth almacenados en texto plano en la BD (no encriptados)
- ⚠️ Google Sheets solo importa, no exporta resultados de llamadas
- ⚠️ SimplyBook usa credenciales (login/password) en lugar de OAuth

---

## 7. SISTEMA DE CALENDARIO

### 7.1 Proveedores Soportados

| Proveedor | Sync | Auto-crear eventos | Video links |
|-----------|------|-------------------|-------------|
| Google Calendar | ✅ Bidireccional | ✅ | Google Meet |
| Microsoft Outlook | ✅ Bidireccional | ✅ | Microsoft Teams |
| SimplyBook | ✅ Inbound | ✅ | - |

### 7.2 Funcionalidades del Calendario

- **Creación automática de eventos** tras completar llamadas
- **Reagendamiento** cuando el contacto pide cambiar cita
- **Callbacks programados** cuando el contacto está ocupado
- **No-show auto-retry** reprogramar automáticamente si no contesta
- **Video links** generación automática de links de Zoom/Meet/Teams
- **Team assignments** asignación automática a miembros del equipo
- **Recurrence rules** soporte para eventos recurrentes

### 7.3 Team Calendar Assignments

La tabla `team_calendar_assignments` permite:
- Asignar miembros del equipo a calendarios específicos
- Auto-asignar eventos según especialidad (campo `specialties`)
- Limitar citas diarias por miembro (`max_daily_appointments`)
- Soporte para múltiples proveedores por miembro (Google + Microsoft + SimplyBook)

---

## 8. SISTEMA DE BILLING Y STRIPE

### 8.1 Flujo de Suscripción

```
Usuario → Selecciona plan → Stripe Checkout → Webhook → Activar suscripción
                                                  ↓
                        company_subscriptions actualizado
                                                  ↓
                        usage_tracking inicializado
```

### 8.2 Metered Billing (Overage)

1. Cada llamada consume minutos → `usage_tracking.minutes_used` incrementa
2. Si `minutes_used > minutes_included` → calcula overage
3. Si `overage_enabled = true` → reporta a Stripe metered billing
4. Alertas en 50%, 75%, 90% del presupuesto
5. Hard block al 100% del presupuesto

**Plan Free:** Hard block total a los 15 minutos, sin overage posible.

### 8.3 API Deprecation Warning

La función `reportUsage()` usa `subscription_items/{id}/usage_records` que está **deprecada** en Stripe API v2025-03-31. La versión actual usada es `2025-12-15.clover` (post-deprecation).

**Riesgo:** Puede dejar de funcionar en futuras actualizaciones de Stripe.

### 8.4 Flujo de Cancelación (5 pasos)

1. **Confirm** - "¿Seguro que quieres cancelar?"
2. **Feedback** - Razón de cancelación (8 opciones)
3. **Retention** - Oferta de retención si elegible
4. **Final** - Confirmación definitiva

**Elegibilidad de retención:**
- Primera vez: 3+ meses pagados
- Segunda vez: 6+ meses desde última
- Tercera+: 12+ meses

### 8.5 Stripe Sync Script

Script de sincronización universal (`stripe-sync.ts` v3.0):
- Crea/actualiza productos y precios en Stripe
- Soporta USD, EUR, GBP
- Archiva precios incorrectos automáticamente
- Crea cupones de retención
- Idempotente (seguro de ejecutar múltiples veces)

---

## 9. AUDITORÍA DE SEGURIDAD

### 9.1 Resumen de Seguridad

| Categoría | Hallazgos |
|-----------|-----------|
| **Críticos** | 0 |
| **Altos** | 1 (rate limiting definido pero NO aplicado) |
| **Medios** | 5 (tokens sin encriptar, OAuth state sin firma, validación inconsistente, Bland webhook opcional, open redirect) |
| **Bajos** | 3 (contact lock no atómico, CSP unsafe-eval/unsafe-inline, falta .env.example) |
| **Excelentes** | SQL injection (riesgo nulo), Stripe Webhooks, HMAC timing-safe, RLS 40+ políticas, HTTP-only cookies |

### 9.2 Vulnerabilidades Identificadas

#### ALTO: No hay Rate Limiting en API Routes
- **Descripción:** Las API routes no implementan rate limiting
- **Impacto:** Un atacante podría hacer miles de requests/segundo
- **Recomendación:** Implementar rate limiting con upstash/ratelimit o similar
- **Esfuerzo:** 6 horas

#### MEDIO: Tokens OAuth en Texto Plano
- **Descripción:** access_token y refresh_token de CRMs almacenados sin encriptar en Supabase
- **Impacto:** Si la BD es comprometida, todos los tokens de CRM quedan expuestos
- **Recomendación:** Encriptar con AES-256-GCM usando clave de entorno
- **Esfuerzo:** 8 horas

#### MEDIO: OAuth State sin Firma
- **Descripción:** El parámetro `state` en OAuth flows no está firmado criptográficamente
- **Impacto:** Posible CSRF en flujos OAuth de CRM
- **Recomendación:** Firmar state con HMAC-SHA256
- **Esfuerzo:** 4 horas

#### MEDIO: Validación de Input Inconsistente
- **Descripción:** Algunos endpoints no validan inputs con Zod u otro schema
- **Impacto:** Datos malformados podrían entrar en la BD
- **Recomendación:** Implementar validación con Zod en todos los endpoints
- **Esfuerzo:** 12 horas

#### MEDIO: Bland Webhook - Verificación de Firma OPCIONAL
- **Descripción:** La verificación de firma HMAC-SHA256 del webhook de Bland AI es **opcional**. Si la variable de entorno `BLAND_WEBHOOK_SECRET` no está configurada, el webhook se procesa sin ninguna verificación de firma. Cualquier atacante que conozca el endpoint podría enviar webhooks falsos que se procesarían como legítimos.
- **Impacto:** Un atacante podría fabricar resultados de llamadas, modificar contactos, crear eventos de calendario falsos, y manipular datos de CRM
- **Recomendación:** Hacer `BLAND_WEBHOOK_SECRET` **obligatorio** - rechazar webhooks si no hay secret configurado
- **Esfuerzo:** 2 horas

#### MEDIO: Open Redirect en OAuth Callbacks
- **Descripción:** El parámetro `return_to` en el state de OAuth se usa para redirigir al usuario después del callback, pero no se valida que sea del mismo origen
- **Impacto:** Posible phishing vía redirección a sitio malicioso
- **Recomendación:** Whitelist de URLs permitidas para `return_to`
- **Esfuerzo:** 2 horas

#### BAJO: Contact Lock no Atómico
- **Descripción:** El mecanismo de bloqueo de contactos durante el procesamiento de webhooks usa flags en `custom_fields` (JSONB), no locks de base de datos atómicos. Si el webhook falla a mitad de procesamiento, el contacto podría quedar bloqueado permanentemente.
- **Impacto:** Contactos inaccesibles hasta intervención manual
- **Recomendación:** Implementar timeout de lock (auto-desbloquear después de 5 minutos) o usar database-level advisory locks
- **Esfuerzo:** 4 horas

### 9.3 RLS - Problemas Detectados

#### PROBLEMA: `companies` - Política demasiado permisiva
```sql
-- Esta política permite que CUALQUIER usuario autenticado vea TODAS las empresas
SELECT ON companies USING (true) -- authenticated_can_view_companies
```
**Impacto:** Información de empresas expuesta a todos los usuarios.
**Recomendación:** Restringir a la propia empresa del usuario.

#### PROBLEMA: `company_settings` - Lectura abierta
```sql
-- Cualquier usuario autenticado ve settings de todas las empresas
SELECT ON company_settings USING (true) -- authenticated_can_view_settings
```
**Impacto:** Configuraciones (incluyendo API keys de Bland) podrían ser leídas por otros usuarios.
**Recomendación:** Restringir inmediatamente.

#### PROBLEMA: `claim_analysis_job()` - SECURITY DEFINER
```sql
-- Función RPC que ejecuta con privilegios elevados
CREATE FUNCTION claim_analysis_job() RETURNS SETOF analysis_queue
LANGUAGE plpgsql SECURITY DEFINER
```
**Impacto:** Un usuario autenticado podría reclamar jobs de análisis de otra empresa.
**Recomendación:** Agregar check de company_id dentro de la función.

### 9.4 Análisis Detallado por Categoría de Seguridad

#### 9.4.1 Autenticación y Sesiones
- **Estado: BUENO**
- Supabase Auth con OAuth (Google, Azure, Slack) + email/password
- Cookies HTTP-only via `@supabase/ssr` para gestión de sesiones
- Verificación de email requerida antes de acceder a rutas protegidas
- Middleware protege todas las API routes excepto webhooks/OAuth callbacks
- Estado de onboarding verificado para prevenir bypass de setup

#### 9.4.2 Gestión de API Keys
- **Estado: EXCELENTE - No se detectaron keys hardcodeadas**
- Todas las secrets en `process.env` solo en server-side
- Prefijo `NEXT_PUBLIC_*` usado correctamente solo para valores públicos (Supabase ANON_KEY, App URL)
- No se encontraron secrets en código client-side
- **Falta:** No existe archivo `.env.example` para documentar variables requeridas

#### 9.4.3 SQL Injection
- **Estado: EXCELENTE - Riesgo nulo**
- No se encontraron queries SQL directas en la app
- Todas las consultas usan Supabase SDK con queries parametrizadas
- No hay concatenación de strings en queries

#### 9.4.4 XSS (Cross-Site Scripting)
- **Estado: BUENO con advertencia**
- No se encontró `dangerouslySetInnerHTML` ni `innerHTML` en código cliente
- CSP headers restringen fuentes de scripts
- **Advertencia:** `react-markdown` importado pero sin plugins de sanitización (`remark-html-sanitize`). Si se renderiza markdown de fuentes externas, podría ser un vector XSS
- **Recomendación:** Agregar `DOMPurify` o plugins de sanitización de remark

#### 9.4.5 CSRF Protection
- **Estado: BUENO**
- Cookies HTTP-only con SameSite
- OAuth flows usan parámetro state con userId/companyId
- **Nota:** State no está firmado criptográficamente (ver vulnerabilidad 9.2)

#### 9.4.6 Rate Limiting
- **Estado: DEFINIDO PERO NO IMPLEMENTADO**
- `lib/rate-limit.ts` define rate limiters:
  ```typescript
  apiLimiter: { interval: 60_000, uniqueTokenPerInterval: 500 }
  authLimiter: { interval: 60_000, uniqueTokenPerInterval: 300 }
  ```
- **PROBLEMA CRÍTICO:** Los limiters están definidos pero **nunca se aplican** en ningún route handler
- Son in-memory (se resetean al reiniciar, no persisten entre réplicas)
- **Impacto:** Login, signup, endpoints de OpenAI y webhooks están completamente sin protección contra abuso
- **Recomendación:** Aplicar rate limiting inmediatamente a: auth endpoints (5/min), OpenAI endpoints (10/min/user), webhook endpoints

#### 9.4.7 CORS
- **Estado: BUENO (same-origin por defecto)**
- Next.js headers configurados correctamente:
  - `X-Frame-Options: DENY` (previene clickjacking)
  - `X-Content-Type-Options: nosniff`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- CSP incluye `unsafe-eval` y `unsafe-inline` en script-src (necesario para frameworks pero reduce efectividad)
- No hay CORS explícito configurado - usa same-origin default

#### 9.4.8 Token Storage (OAuth CRM)
- Tokens almacenados en DB Supabase en texto plano:
  - HubSpot: `hubspot_integrations` → `access_token`, `refresh_token`, `expires_at`
  - Pipedrive: `pipedrive_integrations` → tokens similares
  - Slack: `company_settings` JSON → `slack_access_token`
  - Clio: tabla dedicada con tokens
- **Refresh logic correcto:** HubSpot refresca 5 min antes de expiración
- **Problemas:** No hay limpieza de tokens viejos, no hay rotación de tokens, no hay encriptación at-rest

#### 9.4.9 Admin Finances - Control de Acceso
- **Estado: BUENO - Doble capa de protección**
- RLS: `EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') OR auth.role() = 'service_role'`
- API: Verificación de `role = 'admin' OR role = 'owner'`
- Period validation con enum (`current`, `last_30`, `last_90`)
- **Falta:** Audit logging de quién accedió a admin_finances

### 9.5 Puntos Positivos de Seguridad

- ✅ **Stripe Webhook verification** - Firma verificada correctamente con `constructEvent()`
- ✅ **Bland Webhook timing-safe** - Usa `crypto.timingSafeEqual()` para prevenir timing attacks
- ✅ **RLS en todas las tablas sensibles** - 40+ políticas
- ✅ **Service role separation** - Operaciones del sistema usan service_role
- ✅ **Search path security** - Todas las funciones tienen `SET search_path = ''`
- ✅ **Contact locking** - Previene ediciones concurrentes durante webhook processing
- ✅ **Team invitations** - Solo admin/owner pueden crear invitaciones con roles validados
- ✅ **HMAC-SHA256** - Para webhooks de Bland AI (cuando se usa)
- ✅ **Variables de entorno** - Keys en .env, no hardcodeadas en código
- ✅ **Idempotencia en Stripe** - INSERT con unique constraint previene procesamiento duplicado
- ✅ **No SQL injection posible** - 100% queries parametrizadas via Supabase SDK
- ✅ **HTTP-only cookies** - Tokens de sesión no accesibles a JavaScript
- ✅ **Email verification** - Requerida antes de activación de cuenta

---

## 10. BUGS, ERRORES E INCONSISTENCIAS

### 10.1 Bugs Confirmados

| # | Bug | Severidad | Ubicación |
|---|-----|-----------|-----------|
| 1 | **Extra seat price $69 vs $79** | ALTA | BillingSettings.tsx vs migration |
| 2 | **Índices duplicados en calendar_events** | BAJA | 20+ índices, varios redundantes |
| 3 | **Triggers duplicados en contacts** | BAJA | set_updated_at + update_contacts_updated_at |
| 4 | **Triggers duplicados en company_settings** | BAJA | set_updated_at + update_company_settings_updated_at |
| 5 | **RLS abierto en companies** | ALTA | USING (true) permite ver todas las empresas |
| 6 | **RLS abierto en company_settings** | ALTA | USING (true) permite ver todos los settings |
| 7 | **Stripe metered API deprecada** | MEDIA | reportUsage() usa endpoint legacy |
| 8 | **claim_analysis_job sin filtro company** | MEDIA | Puede reclamar jobs de otra empresa |
| 9 | **Bland webhook secret opcional** | MEDIA | Webhook se procesa sin firma si env var no existe |
| 10 | **Open redirect en OAuth callbacks** | MEDIA | `return_to` no validado como mismo origen |
| 11 | **Contact lock no atómico** | BAJA | Puede quedar bloqueado permanentemente si webhook falla |
| 12 | **Tipos de cambio EUR/GBP hardcodeados e incorrectos** | ALTA | BillingSettings.tsx líneas 49-53 |
| 13 | **Overage usa Math.round() en vez de Math.ceil()** | MEDIA | BillingSettings.tsx cálculo de overage |
| 14 | **Free plan billing period = 10 años** | ALTA | DB/seed - usuarios retienen minutos gratis indefinidamente |
| 15 | **Rate limiters definidos pero NUNCA aplicados** | ALTA | lib/rate-limit.ts (importado, nunca usado en routes) |
| 16 | **Geolocalización mapea países no-EUR a EUR** | MEDIA | geolocation.ts (Dinamarca, Hungría, Polonia → EUR) |
| 17 | **react-markdown sin sanitización** | MEDIA | Si renderiza markdown externo → vector XSS |

### 10.1.1 Detalle de Bugs Nuevos Identificados

#### Bug #12: Tipos de Cambio Hardcodeados e Incorrectos
```typescript
// BillingSettings.tsx - ACTUAL (INCORRECTO)
const CURRENCY_RATES = {
  USD: { symbol: '$', multiplier: 1 },
  EUR: { symbol: '€', multiplier: 0.92 },  // ⚠️ EUR realmente ~1.08 USD
  GBP: { symbol: '£', multiplier: 0.79 },  // ⚠️ GBP realmente ~1.27 USD
};
```
**Impacto financiero:** Las tasas están invertidas/desactualizadas. Con EUR a 0.92 cuando debería ser ~1.08, un plan de $299 se muestra como €275 cuando debería ser ~€277. Pero el problema real es que **las tasas nunca se actualizan** - son estáticas en código. Un cambio significativo en el tipo de cambio resultaría en pérdida de ingresos o precios incorrectos para clientes europeos.
**Recomendación:** Usar API de tipos de cambio en tiempo real (exchangerate-api.com, Open Exchange Rates).

#### Bug #13: Redondeo de Overage hacia Abajo
```typescript
// ACTUAL - puede redondear HACIA ABAJO
const overageCost = Math.round(overageMinutes * pricePerMinute);

// CORRECTO - siempre redondear hacia ARRIBA en billing
const overageCost = Math.ceil(overageMinutes * pricePerMinute);
```
**Impacto:** Pérdida de centavos por cada cálculo de overage. Acumulado sobre miles de transacciones, puede ser significativo.

#### Bug #14: Free Plan con Período de 10 Años
El período de billing del plan Free está configurado como 10 años en lugar de 1 mes. Los usuarios Free retienen sus 15 minutos de forma indefinida sin reseteo mensual, permitiendo acumulación ilimitada de uso si nunca se resetea el período.

#### Bug #15: Rate Limiters Fantasma
```typescript
// lib/rate-limit.ts - DEFINIDO
const apiLimiter = createRateLimiter({ interval: 60_000, uniqueTokenPerInterval: 500 });
const authLimiter = createRateLimiter({ interval: 60_000, uniqueTokenPerInterval: 300 });

// PERO: Ningún route handler importa ni usa estos limiters
// Resultado: CERO protección contra brute-force o abuso de API
```

#### Bug #16: Geolocalización de Moneda Incorrecta
El mapeo de país → moneda asigna EUR a países que NO usan EUR: Dinamarca (DKK), Hungría (HUF), Polonia (PLN), Suecia (SEK), República Checa (CZK), Rumanía (RON), Bulgaria (BGN). Esto causa que clientes en estos países vean precios en EUR cuando su moneda local es diferente.

### 10.2 Valores Demo/Placeholder

| Item | Descripción | Ubicación |
|------|-------------|-----------|
| 50 contactos seeded | Tech Startups, Healthcare, Real Estate, etc. | mock-data.ts |
| 6 campañas demo | 3 completed, 2 running, 1 paused | mock-data.ts |
| 10 transcripts ejemplo | Conversaciones simuladas | mock-data.ts |
| Stats de agentes | Accuracy: 98, Communication: 85, etc. | AgentConfigModal.tsx |
| User demo | crfuentes12@gmail.com | seed route |

**Nota:** Estos datos demo se insertan vía `/api/seed` (POST) y se limpian con DELETE. No están en producción a menos que se ejecute el seed manualmente.

### 10.3 Cosas que no Aportan o son Redundantes

1. **`analysis_questions` en agent_templates** - Columna NULL, nunca usada. El análisis es dinámico via OpenAI
2. **Índices duplicados** - ~5 pares de índices que hacen lo mismo en calendar_events
3. **Triggers duplicados** - 2 tablas con triggers duplicados para updated_at
4. **`price_per_extra_user` en subscription_plans** - Redundante con `extra_seat_price` (añadido después)
5. **`max_users` vs `max_seats`** - Dos columnas que representan lo mismo

---

## 11. SIMULACIÓN 1: EMPRESA DE PROCESAMIENTO DE PAGOS

### Escenario
**PayCorp Inc.** - Procesadora de pagos con 5,000 contactos en un CRM viejo. Necesitan validar emails, teléfonos y direcciones de su base de datos antes de migrar a un nuevo sistema.

### Plan Seleccionado: Business ($299/mes)
- 1,200 minutos incluidos
- Necesita CRM integration (HubSpot)
- 3 usuarios (Director IT, Data Manager, Compliance Officer)

### Configuración del Agente

**Agente:** Data Validation Agent
**Nombre personalizado:** "PayCorp Data Verifier"

**Settings de la campaña:**
```json
{
  "voice": "nat",
  "maxDuration": 3,
  "intervalMinutes": 1,
  "customContext": "You are calling to verify payment processing account holder information for PayCorp. Verify their email, phone, and mailing address. Also confirm their business type and EIN if available."
}
```

### Flujo Paso a Paso

#### Fase 1: Onboarding
1. PayCorp se registra → Plan Free (15 minutos)
2. Sube CSV de 100 contactos de prueba → Tabla `contacts` con company_id
3. Crea agente "PayCorp Data Verifier" → `company_agents`
4. Ejecuta campaña de prueba con 5 contactos → `agent_runs` (status: draft → running)
5. Valida que las llamadas funcionan → Revisa transcripciones en `call_logs`

**Tuercas que toca:**
- `contacts.company_id` → FK a `companies`
- `contacts.status` → 'Pending'
- `contacts.phone_number` → Normalizado
- `company_agents.agent_template_id` → FK a `agent_templates` (data-validation)
- `agent_runs.total_contacts` = 5
- `usage_tracking.minutes_used` incrementa

#### Fase 2: Upgrade a Business
1. Checkout via Stripe → `company_subscriptions.plan_id` cambia
2. `usage_tracking` se reinicia
3. 1,200 minutos disponibles
4. Conecta HubSpot → `hubspot_integrations` creada con tokens OAuth
5. Sincroniza contactos de HubSpot → `hubspot_contact_mappings` + `hubspot_sync_logs`

**Tuercas que toca:**
- `company_subscriptions.stripe_subscription_id` asignado
- `company_subscriptions.billing_cycle` = 'monthly'
- `billing_history` → Primer cobro de $299
- `hubspot_integrations.access_token` / `refresh_token` almacenados
- `hubspot_sync_logs` → records_created = X, status = 'completed'

#### Fase 3: Campaña de Validación Masiva
1. Importa 5,000 contactos desde HubSpot
2. Crea campaña "Q1 Data Validation" con 500 contactos
3. Configura voicemail habilitado, follow-ups 2 intentos, intervalo 24h
4. Lanza campaña → Bland AI llama secuencialmente

**Por cada llamada completada:**
- `call_logs` → transcript, summary, price, recording_url
- `contacts` → status actualizado ('Fully Verified' o 'Partially Verified')
- `contacts.custom_fields` → nuevos datos extraídos (email actualizado, etc.)
- `analysis_queue` → job de análisis IA (si modo async)
- `hubspot_contact_mappings` → sync de cambios a HubSpot

**Si no contesta:**
- `voicemail_logs` → voicemail detectado, mensaje dejado
- `follow_up_queue` → reintento programado en 24h
- `agent_runs.voicemails_detected` += 1

#### Fase 4: Uso y Overage
1. Cada llamada dura ~2 minutos en promedio
2. 500 contactos × 2 min = ~1,000 minutos base
3. + Follow-ups (~100 reintentos × 2 min) = ~200 minutos adicionales
4. Total: ~1,200 minutos → Justo en el límite

**Si activa overage:**
- `company_subscriptions.overage_enabled` = true
- `company_subscriptions.overage_budget` = 100 (cap de $100)
- Cada minuto extra: $0.39
- `usage_tracking.overage_minutes` incrementa
- `billing_events` → overage_alert al 50% ($50), 75% ($75), 90% ($90)
- `notifications` → Alertas enviadas

#### Fase 5: Resultados
- Dashboard muestra: 500 llamados, 380 verificados, 80 actualizados, 40 no alcanzados
- Reportes exportables a CSV
- Datos actualizados sincronizados a HubSpot
- Historial completo en `billing_history`

### Problemas Potenciales en este Escenario

1. **Rate limiting de Bland AI:** Con 500 contactos y intervalo de 1 min, son 8+ horas de campaña. ¿Qué pasa si Bland limita?
2. **HubSpot sync lag:** Si HubSpot rate limita las actualizaciones, los cambios podrían no reflejarse inmediatamente
3. **Overage budget precision:** El presupuesto es en USD pero el cálculo depende de la duración exacta de cada llamada
4. **Follow-up duplicates:** El trigger `auto_create_followup` podría crear duplicados si se actualiza el call_log múltiples veces

---

## 12. SIMULACIÓN 2: CLÍNICA MÉDICA - REDUCIR NO-SHOWS

### Escenario
**MedFirst Clinic** - Clínica dental con 200 citas semanales. Tiene un 25% de no-shows. Quiere llamar a todos los pacientes 24-48h antes de su cita para confirmar, reagendar o cancelar.

### Plan Seleccionado: Teams ($649/mes)
- 2,500 minutos (suficiente para 200 citas × 4 semanas × ~2 min)
- 5 usuarios base (Recepcionista, 2 dentistas, Office Manager, Admin)
- Necesita Google Calendar + SimplyBook
- Salesforce para CRM de pacientes

### Configuración del Agente

**Agente:** Appointment Confirmation Agent
**Nombre personalizado:** "MedFirst Appointment Caller"

**Settings de la campaña:**
```json
{
  "voice": "maya",
  "maxDuration": 4,
  "intervalMinutes": 2,
  "customContext": "You are calling to confirm dental appointments at MedFirst Clinic. Always remind patients to bring their insurance card and arrive 15 minutes early for paperwork. If rescheduling, only offer slots within the next 2 weeks.",
  "calendarConfig": {
    "timezone": "America/Chicago",
    "workingHoursStart": "08:00",
    "workingHoursEnd": "17:00",
    "workingDays": ["monday", "tuesday", "wednesday", "thursday", "friday"],
    "excludeUSHolidays": true,
    "defaultMeetingDuration": 30,
    "preferredVideoProvider": "none"
  }
}
```

### Flujo Paso a Paso

#### Fase 1: Setup
1. MedFirst se registra → Plan Free → Prueba con 5 pacientes
2. Configura Google Calendar → `calendar_integrations` (provider: 'google')
3. Conecta SimplyBook → `simplybook_integrations` con credenciales
4. Importa citas de SimplyBook → `contacts` con `appointment_date` poblado

**Tuercas que toca:**
- `contacts.appointment_date` = fecha de la cita
- `contacts.appointment_confirmed` = false (pendiente)
- `calendar_integrations.connected` = true
- `calendar_integrations.google_calendar_id` = 'primary'
- `simplybook_integrations.sb_company_login`, `sb_token`

#### Fase 2: Upgrade a Teams
1. Checkout con Stripe → $649/mes
2. Configura 5 usuarios del equipo
3. Conecta Salesforce → `salesforce_integrations`
4. Configura team_calendar_assignments:
   - Dr. Smith → Google Calendar + max 8 citas/día
   - Dr. Johnson → Google Calendar + max 6 citas/día
   - Recepcionista → SimplyBook provider

**Tuercas que toca:**
- `team_calendar_assignments` → 3 registros creados
- `team_calendar_assignments.specialties` = ['general_dentistry']
- `team_calendar_assignments.max_daily_appointments` = 8
- `team_invitations` → Invitaciones enviadas por email
- `users` → Nuevos usuarios con role='member'

#### Fase 3: Campaña Semanal de Confirmación

**Cada lunes, crear campaña para la semana:**
1. Filtrar contactos con `appointment_date` entre martes-viernes
2. ~50 pacientes por día × 4 días = 200 contactos
3. Campaña "Weekly Confirmation - Mar 10-14"

**Configuración avanzada:**
- Voicemail habilitado, acción: leave_message
- Follow-ups: 2 intentos, intervalo 6 horas
- No-show auto-retry: habilitado, delay 24 horas
- Calendar context enabled: true

**Por cada llamada:**

**Si confirma (intent: 'confirmed'):**
- `contacts.appointment_confirmed` = true
- `calendar_events.confirmation_status` = 'confirmed'
- `calendar_events.confirmation_attempts` += 1
- `calendar_events.last_confirmation_at` = now()
- Webhook dispatch: `appointment.confirmed`
- Salesforce sync: actualizar Lead/Contact

**Si reagenda (intent: 'reschedule'):**
- `contacts.appointment_date` = nueva fecha
- `contacts.appointment_rescheduled` = true
- `calendar_events` → Evento original actualizado
- `calendar_events.rescheduled_count` += 1
- `calendar_events.rescheduled_reason` = "trabajo"
- `calendar_events.original_start_time` = hora original
- Webhook dispatch: `appointment.rescheduled`
- SimplyBook sync: actualizar booking

**Si no contesta (no_show):**
- `contacts.no_show_count` += 1
- `voicemail_logs` → Mensaje dejado
- `follow_up_queue` → Reintento en 6 horas
- `calendar_events.confirmation_status` = 'no_response'
- Webhook dispatch: `appointment.no_show`

**Si cancela (intent: 'cancel'):**
- `contacts.appointment_confirmed` = false
- `contacts.status` = 'Cancelled'
- `calendar_events.status` = 'cancelled'
- Slot liberado en Google Calendar
- Webhook dispatch: `appointment.cancelled`

#### Fase 4: Auto-Assign y Equipo

Cuando un paciente confirma con un dentista específico:
- `calendar_events.assigned_to` = team_calendar_assignments.id del dentista
- `calendar_events.assigned_to_name` = "Dr. Smith"
- Auto-detect via `contacts.custom_fields.doctor_assigned`

#### Fase 5: Métricas Semanales

Después de la campaña:
- `agent_runs.completed_calls` = 200
- `agent_runs.successful_calls` = 160 (80% confirmados)
- `agent_runs.voicemails_detected` = 25
- `agent_runs.follow_ups_scheduled` = 40
- `agent_runs.follow_ups_completed` = 30

**Dashboard muestra:**
- Tasa de confirmación: 80%
- Reagendados: 10%
- Cancelados: 5%
- No alcanzados: 5%
- No-shows reducidos de 25% a ~5%

### Problemas Potenciales en este Escenario

1. **Extra seat pricing discrepancy:** Si MedFirst añade un 6to usuario, ¿paga $69 o $79?
2. **SimplyBook webhook reliability:** Los webhook logs no tienen retry mechanism
3. **Calendar sync conflicts:** Si dos fuentes actualizan la misma cita simultáneamente
4. **Holiday exclusion:** Solo excluye feriados de US - ¿qué pasa con feriados locales?
5. **No-show auto-retry + Follow-up:** Podrían crearse reintentos duplicados (uno por no-show y otro por follow-up)
6. **Timezone handling:** Si el paciente está en otro timezone que la clínica, el agente podría llamar fuera de horario

---

## 13. SIMULACIÓN 3: EMPRESA DE COLD OUTREACH - CUALIFICACIÓN DE LEADS

### Escenario
**GrowthForce AI** - Startup B2B SaaS que vende herramientas de IA para marketing. Tiene una base de datos de 10,000 leads de webinars, descargas de whitepapers y eventos. Necesita cualificar cuáles están listos para comprar.

### Plan Seleccionado: Business ($299/mes) → Upgrade a Teams ($649/mes)
- Empieza con Business: 1,200 minutos
- Si necesita más, upgrade a Teams: 2,500 minutos + Salesforce

### Configuración del Agente

**Agente:** Lead Qualification Agent
**Nombre personalizado:** "GrowthForce Lead Qualifier"

**Settings de la campaña:**
```json
{
  "voice": "josh",
  "maxDuration": 5,
  "intervalMinutes": 2,
  "customContext": "You are qualifying leads for GrowthForce AI's marketing automation platform. Our product starts at $500/month and scales up to $5,000/month for enterprise. Key differentiators: AI-powered content generation, multichannel campaign orchestration, and predictive analytics. Ask about their current marketing stack, team size, monthly budget, and decision timeline.",
  "calendarConfig": {
    "timezone": "America/New_York",
    "workingHoursStart": "09:00",
    "workingHoursEnd": "18:00",
    "preferredVideoProvider": "zoom",
    "defaultMeetingDuration": 30,
    "connectedIntegrations": ["google_calendar", "pipedrive"]
  }
}
```

### Flujo Paso a Paso

#### Fase 1: Segmentación de Leads
1. GrowthForce importa 10,000 leads via CSV
2. Crea listas de contactos:
   - "Webinar Attendees" (3,000 leads)
   - "Whitepaper Downloads" (4,000 leads)
   - "Event Contacts" (3,000 leads)
3. Cada lista tiene `contact_lists.color` diferente para visual tracking

**Tuercas que toca:**
- `contact_lists` → 3 registros con company_id
- `contacts.list_id` → FK a contact_lists
- `contacts.source` = 'csv_import'
- `contacts.custom_fields` → { "lead_source": "webinar", "event_name": "AI Summit 2026" }

#### Fase 2: Campaña Piloto (Business Plan)
1. Selecciona 200 leads del "Webinar Attendees"
2. Crea campaña "Webinar Follow-up - Batch 1"
3. Configura: voicemail + 3 follow-ups + Pipedrive sync

**Por cada llamada exitosa:**

**Si lead cualificado (score 8-10):**
- Intent: `meeting_requested`
- `contacts.custom_fields.budget` = "$2,000/month"
- `contacts.custom_fields.authority` = "VP Marketing, decision maker"
- `contacts.custom_fields.need` = "Need AI content generation"
- `contacts.custom_fields.timeline` = "Next quarter"
- `contacts.meeting_scheduled` = true
- `contacts.video_link` = "https://zoom.us/j/..."
- `calendar_events` → Meeting con sales team creado
- `calendar_events.video_provider` = 'zoom'
- `calendar_events.video_link` = link generado
- Pipedrive: Deal creado con valor estimado

**Si lead tibio (score 5-7):**
- Intent: `needs_nurturing`
- `contacts.custom_fields.budget` = "Evaluating options"
- `contacts.custom_fields.timeline` = "6+ months"
- `contacts.status` = 'Nurturing'
- Follow-up programado en 2 semanas
- Pipedrive: Persona actualizada con notas

**Si lead frío (score 1-4):**
- Intent: `not_qualified`
- `contacts.custom_fields.disqualify_reason` = "Already using competitor"
- `contacts.status` = 'Not Qualified'
- `contacts.call_outcome` = 'Not Interested'
- No follow-up programado

**Si no contesta:**
- `voicemail_logs` → Mensaje dejado sobre el webinar
- `follow_up_queue` → Reintento en 24h
- `agent_runs.voicemails_detected` += 1

#### Fase 3: Escalamiento
1. Batch 1 results: 200 leads → 40 hot, 80 warm, 50 cold, 30 no answer
2. 1,200 minutos usados en ~600 llamadas (incl. follow-ups)
3. Upgrade a Teams ($649) para más minutos + Salesforce

**Tuercas del upgrade:**
- `company_subscriptions` → plan_id cambia a teams
- `billing_history` → Proration charge registrado
- `usage_tracking.minutes_included` = 2,500
- Conecta Salesforce → `salesforce_integrations`
- Mapea leads existentes → `salesforce_contact_mappings`

#### Fase 4: Campañas Masivas (Teams Plan)
1. Lanza 3 campañas simultáneas:
   - "Whitepaper Leads - Batch 1" (300 leads)
   - "Event Contacts - Priority" (200 leads)
   - "Webinar Re-engage" (100 warm leads del batch anterior)

**Configuración diferenciada por campaña:**
- Whitepaper: maxDuration 4 min, follow-up 2 intentos
- Event: maxDuration 5 min, smart follow-up habilitado
- Re-engage: maxDuration 3 min, contexto personalizado de nurturing

#### Fase 5: CRM Sync y Pipeline
1. Leads cualificados → Salesforce como Opportunities
2. Meetings programados → Google Calendar del sales team
3. Notas de llamada → Pipedrive activities
4. Webhook a Slack → `#qualified-leads` channel notificado

**Flujo de datos completo:**
```
Lead contesta → Agente cualifica → GPT-4o-mini analiza
    ↓
Score 8+ → Meeting scheduled → Zoom link generado
    ↓
Calendar event creado → Salesforce opportunity creada
    ↓
Pipedrive activity logged → Slack notification sent
    ↓
Webhook dispatched → External systems notified
```

#### Fase 6: Reporting
- `agent_runs` muestra métricas por campaña
- Dashboard: Funnel Webinar → Qualified → Meeting → Closed
- Export CSV de leads cualificados
- Billing: $649 + overage si excede 2,500 min

### Problemas Potenciales en este Escenario

1. **Concurrent campaigns:** 3 campañas simultáneas pueden saturar el rate limit de Bland AI
2. **Salesforce + Pipedrive overlap:** Dos CRMs sincronizando el mismo contacto podrían crear duplicados
3. **Score consistency:** GPT-4o-mini con temperature 0.1 debería ser consistente, pero variaciones naturales del lenguaje podrían dar scores diferentes para leads similares
4. **Video link generation:** ¿Se genera realmente el link de Zoom o solo se indica la preferencia?
5. **Follow-up de leads tibios:** El sistema programa follow-ups automáticos pero ¿hay lógica de nurture diferenciada?
6. **Budget tracking:** Con 3 campañas simultáneas, el tracking de minutos podría tener race conditions
7. **Meeting duration vs plan:** El default_meeting_duration es 30 min pero las llamadas son max 5 min - estos son conceptos diferentes, pero podrían confundir al usuario

---

## 14. VIABILIDAD DEL PRODUCTO

### 14.1 Propuesta de Valor

**¿Se entiende a primera vista?** SÍ.

Callengo resuelve tres problemas claros:
1. "Tengo datos viejos y necesito validarlos sin contratar call center"
2. "Tengo muchos no-shows y quiero confirmar citas automáticamente"
3. "Tengo una lista de leads y necesito cualificarlos rápido"

### 14.2 Fortalezas del Producto

1. **Diferenciación clara:** No es solo un auto-dialer, es un agente de IA conversacional
2. **Verticales específicas:** Healthcare (citas), Legal (Clio), SaaS (BANT), Real Estate (datos)
3. **Pricing escalonado coherente:** Free → Starter → Business → Teams → Enterprise
4. **Integraciones robustas:** 8 CRMs + 2 Calendars + Google Sheets + Webhooks
5. **Automatización end-to-end:** Llamada → Análisis → Calendario → CRM → Notificación
6. **Follow-up inteligente:** No solo reintenta, programa según condiciones
7. **Multi-tenant correcto:** RLS, company_id en toda la BD
8. **Stripe integration madura:** Checkout, metered billing, retention, cancellation flow

### 14.3 Debilidades del Producto

1. **Dependencia de Bland AI:** Todo el valor depende de un único proveedor de voz
2. **No hay plan self-hosted:** Empresas con requisitos de data residency no pueden usar Callengo
3. **Multi-moneda básica:** Solo multiplicadores fijos (USD×0.92=EUR), no conversión real
4. **Sin A/B testing de agentes:** No puedes comparar templates de agentes
5. **Sin integración nativa con email:** Solo llamadas, no email follow-up
6. **Google Sheets es import-only:** No exporta resultados a Sheets
7. **Admin dashboard limitado:** `admin_finances` tiene datos manuales, no auto-calculados

### 14.4 Mercado y Competencia

| Categoría | Competidores | Diferenciador de Callengo |
|-----------|-------------|---------------------------|
| Auto-dialers | Orum, ConnectAndSell | IA conversacional, no solo marcado |
| Voice AI | Air AI, Bland AI directo | Multi-agente, CRM integrado, calendario |
| Call center AI | Dialpad AI, Five9 | Self-service, sin hardware |
| Outreach | Salesloft, Outreach.io | Especializado en voz, no email |

### 14.5 Métricas de Producto Sugeridas

| Métrica | Cómo calcular |
|---------|---------------|
| **Tasa de conversión** | successful_calls / completed_calls |
| **Costo por lead cualificado** | total_cost / qualified_leads |
| **ROI de agente** | (revenue_from_meetings - call_cost) / call_cost |
| **Reducción de no-shows** | (no_shows_before - no_shows_after) / no_shows_before |
| **Tasa de verificación** | verified_contacts / total_contacts |
| **MRR/ARR** | Suma de company_subscriptions activas |
| **Churn rate** | Cancelaciones / Total suscripciones activas |

---

## 15. RECOMENDACIONES PRIORITARIAS

### Fase 1: URGENTE (Semana 1) - ~18 horas

| # | Tarea | Impacto | Esfuerzo |
|---|-------|---------|----------|
| 1 | **Corregir $69 vs $79 en Teams extra seat** | Alto | 30 min |
| 2 | **Eliminar RLS `USING (true)` en companies** | Crítico | 1h |
| 3 | **Eliminar RLS `USING (true)` en company_settings** | Crítico | 1h |
| 4 | **Aplicar rate limiting en route handlers** (ya definido en rate-limit.ts) | Alto | 4h |
| 5 | **Verificar firma Bland webhook siempre** (hacer BLAND_WEBHOOK_SECRET obligatorio) | Alto | 2h |
| 6 | **Agregar filtro company_id en claim_analysis_job()** | Medio | 1h |
| 7 | **Corregir free plan billing period** (de 10 años a 1 mes) | Alto | 1h |
| 8 | **Cambiar Math.round() a Math.ceil() en overage** | Medio | 30 min |
| 9 | **Implementar tipos de cambio dinámicos** (reemplazar hardcoded EUR/GBP) | Alto | 4h |
| 10 | **Corregir mapeo geolocalización → moneda** (países no-EUR asignados a EUR) | Medio | 2h |

### Fase 2: IMPORTANTE (Semanas 2-3) - ~32 horas

| # | Tarea | Impacto | Esfuerzo |
|---|-------|---------|----------|
| 11 | Encriptar tokens OAuth en BD (AES-256-GCM) | Medio | 8h |
| 12 | Firmar OAuth state con HMAC-SHA256 | Medio | 4h |
| 13 | Validar `return_to` en OAuth callbacks (whitelist) | Medio | 2h |
| 14 | Validación de input con Zod en todos los endpoints | Medio | 12h |
| 15 | Agregar sanitización a react-markdown (DOMPurify/remark-html-sanitize) | Medio | 2h |
| 16 | Eliminar índices y triggers duplicados | Bajo | 4h |

### Fase 3: MEJORAS (Mes 2) - ~40 horas

| # | Tarea | Impacto | Esfuerzo |
|---|-------|---------|----------|
| 17 | Migrar Stripe metered billing a nueva API | Medio | 12h |
| 18 | **Dividir componentes grandes** (AgentConfigModal, IntegrationsPage) | Medio | 8h |
| 19 | **Implementar SWR/React Query** para caché de datos | Medio | 8h |
| 20 | Implementar audit logging (admin_finances, cambios de rol) | Medio | 8h |
| 21 | Eliminar columna analysis_questions (no usada) | Bajo | 1h |
| 22 | Consolidar max_users y max_seats | Bajo | 4h |
| 23 | Crear `.env.example` documentando todas las variables | Bajo | 1h |

### Fase 4: ESCALAMIENTO (Mes 3+) - Variable

| # | Tarea | Impacto | Esfuerzo |
|---|-------|---------|----------|
| 24 | Implementar Zustand para state management global | Medio | 16h |
| 25 | Implementar MFA opcional | Medio | 8h |
| 26 | Lazy loading de modales con React.lazy() | Medio | 4h |
| 27 | Google Sheets bidireccional | Medio | 16h |
| 28 | Email follow-up integration | Alto | 24h |
| 29 | A/B testing de agentes | Medio | 20h |
| 30 | Multi-moneda real con Stripe | Medio | 12h |
| 31 | Admin dashboard auto-calculado | Alto | 16h |
| 32 | Monitoring stack (Sentry + LogRocket o Datadog) | Alto | 12h |

---

## CONCLUSIÓN

Callengo es un producto **viable, bien arquitecturado y con propuesta de valor clara**. Calificación general: **7.5/10**. La base de datos está bien diseñada con 56 tablas, RLS robusto (con 2 excepciones a corregir urgentemente), y un sistema de integraciones CRM consistente. El sistema de agentes con análisis IA semántico es sofisticado y funcional.

### Resumen de Hallazgos

| Categoría | Cantidad |
|-----------|----------|
| **Bugs totales identificados** | 17 |
| → Severidad ALTA | 4 (RLS, pricing, free plan period, FX rates) |
| → Severidad MEDIA | 7 (Stripe API, webhook, overage, geolocation, markdown, rate limiters, open redirect) |
| → Severidad BAJA | 6 (índices, triggers, columnas redundantes, contact lock) |
| **Vulnerabilidades de seguridad** | 9 (0 críticas, 1 alta, 5 medias, 3 bajas) |
| **Puntos positivos de seguridad** | 13 |
| **Recomendaciones totales** | 32 (10 urgentes, 6 importantes, 7 mejoras, 9 escalamiento) |

### Principales Problemas a Resolver

1. **Seguridad:** 2 políticas RLS demasiado permisivas (`companies`, `company_settings`) y rate limiters definidos pero nunca aplicados
2. **Billing:** Precio de extra seat discrepante ($69 vs $79), tipos de cambio hardcodeados, overage con redondeo hacia abajo, free plan con período de 10 años
3. **Frontend:** 4 componentes monolíticos (>1,000 líneas cada uno), sin caché de datos, prop drilling excesivo
4. **Futuro:** API de Stripe metered billing deprecada, sin monitoring/observability

### Fortalezas Destacables

- ✅ Arquitectura multi-tenant sólida con company_id en todas las tablas
- ✅ 0 riesgo de SQL injection (100% queries parametrizadas)
- ✅ Webhook verification con timing-safe comparison (Bland + Stripe)
- ✅ 8 integraciones CRM completas con OAuth y sincronización
- ✅ Sistema de agentes IA sofisticado con análisis semántico GPT-4o-mini
- ✅ 7 idiomas con detección automática por geolocalización
- ✅ Pipeline de webhooks de 9 fases bien estructurado
- ✅ Sistema de retención anti-churn de 5 pasos

Con las correcciones de la Fase 1 (~18 horas de trabajo), el software está listo para producción con riesgo aceptable.

---

*Auditoría generada el 5 de Marzo de 2026*
*Herramientas: Análisis estático de código, revisión de esquema de BD, simulación de escenarios*
*Archivos analizados: 200+ archivos fuente, 56 tablas de BD, 90+ endpoints API, 15 migraciones SQL*
