# CALLENGO - Analisis Completo de Arquitectura de Software

**Fecha:** 6 de marzo de 2026
**Scope:** Frontend (Next.js), Backend (API Routes), Base de Datos (Supabase/PostgreSQL), Stripe, Bland AI, OpenAI, Integraciones CRM
**329 archivos TypeScript analizados | 56 tablas de base de datos | 120+ rutas API | 9 integraciones CRM/calendario**

---

## TABLA DE CONTENIDOS

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura General](#2-arquitectura-general)
3. [Analisis de Base de Datos](#3-analisis-de-base-de-datos)
4. [Analisis de Planes y Precios](#4-analisis-de-planes-y-precios)
5. [Analisis de Agentes AI](#5-analisis-de-agentes-ai)
6. [Analisis de Integraciones](#6-analisis-de-integraciones)
7. [Analisis de Seguridad](#7-analisis-de-seguridad)
8. [Bugs, Errores y Problemas Encontrados](#8-bugs-errores-y-problemas-encontrados)
9. [Escenario 1: Empresa de Procesamiento de Pagos](#9-escenario-1-empresa-de-procesamiento-de-pagos)
10. [Escenario 2: Clinica Reduciendo No-Shows](#10-escenario-2-clinica-reduciendo-no-shows)
11. [Escenario 3: Empresa de Cold Outreach](#11-escenario-3-empresa-de-cold-outreach)
12. [Valor del Producto y Viabilidad](#12-valor-del-producto-y-viabilidad)
13. [Recomendaciones Priorizadas](#13-recomendaciones-priorizadas)

---

## 1. RESUMEN EJECUTIVO

Callengo es una plataforma SaaS de llamadas AI outbound construida sobre Next.js 15 + Supabase + Bland AI + OpenAI. El software permite a empresas configurar agentes AI que realizan llamadas automatizadas para tres casos de uso principales: validacion de datos, confirmacion de citas, y cualificacion de leads.

### Veredicto General
**El producto es viable y esta bien construido a nivel arquitectonico.** La base de datos esta bien normalizada, las politicas RLS son consistentes, la integracion con Stripe es solida, y el flujo de llamadas (agente -> cola -> Bland AI -> webhook -> analisis AI -> acciones) esta bien orquestado. Sin embargo, hay problemas concretos que necesitan atencion antes de produccion.

### Puntuaciones
| Area | Puntuacion | Notas |
|------|-----------|-------|
| Arquitectura DB | 8.5/10 | Bien normalizada, FKs correctos, RLS consistente |
| Coherencia de Precios | 7/10 | Incoherencias entre scripts y migracion |
| Backend API | 8/10 | Bien estructurado, rate limiting, validacion Zod |
| Seguridad | 7/10 | RLS bueno, pero hay gaps en webhook auth |
| Integraciones CRM | 7.5/10 | Patron consistente, OAuth funcional |
| Agentes AI | 8.5/10 | Intent analysis robusto, buen fallback |
| Frontend UX | 7.5/10 | Funcional, necesita pulido |
| Viabilidad Comercial | 8/10 | Propuesta de valor clara, pricing competitivo |

---

## 2. ARQUITECTURA GENERAL

### Stack Tecnologico
```
Frontend:  Next.js 15 (App Router) + React + TypeScript + Tailwind CSS + shadcn/ui
Backend:   Next.js API Routes (serverless)
Database:  Supabase (PostgreSQL) con RLS
Auth:      Supabase Auth (email/password)
Llamadas:  Bland AI (v1 API)
AI/NLP:    OpenAI GPT-4o-mini (intent analysis)
Pagos:     Stripe (Checkout, Subscriptions, Webhooks)
Hosting:   Vercel (inferido de vercel.json)
```

### Flujo de Datos Principal
```
Usuario -> Dashboard -> Configura Agente -> Sube Contactos -> Lanza Campana
     |
     v
call_queue -> Bland AI API -> Llamada en progreso -> Webhook callback
     |
     v
call_logs -> OpenAI Analysis -> Actualiza contacto -> Calendar Event
     |                                    |
     v                                    v
follow_up_queue (si no contesto)    CRM Sync (Pipedrive, Clio)
                                    Outbound Webhooks (Zapier, Make)
```

### Estructura de Archivos (329 archivos .ts/.tsx)
```
src/
  app/                    # Pages y rutas
    api/                  # 120+ API routes
      billing/            # 14 rutas de billing
      bland/              # send-call, webhook, get-call, analyze-call
      integrations/       # 50+ rutas para 9 integraciones
      contacts/           # CRUD, import, export, AI analyze
      calendar/           # events, availability, team
      team/               # invites, members
      openai/             # analyze-call, context-suggestions, recommend-agent
      queue/              # process (analysis worker)
      webhooks/           # stripe webhook
    dashboard/            # Dashboard principal
    contacts/             # Gestion de contactos
    agents/               # Configuracion de agentes
    onboarding/           # Flujo de onboarding
    settings/             # Configuracion
    billing/              # Facturacion
  lib/                    # Logica de negocio
    supabase/             # Cliente Supabase (server, service, client)
    ai/                   # intent-analyzer.ts
    billing/              # Logica de billing
    calendar/             # sync.ts, campaign-sync.ts, resource-routing.ts
    queue/                # analysis-queue.ts
    voices/               # Voces de AI
    hubspot/              # Integracion HubSpot
    salesforce/           # Integracion Salesforce
    pipedrive/            # Integracion Pipedrive
    clio/                 # Integracion Clio
    zoho/                 # Integracion Zoho
    dynamics/             # Integracion Dynamics 365
    simplybook/           # Integracion SimplyBook
  config/
    plan-features.ts      # Configuracion central de features por plan
scripts/
  sync-stripe-advanced.ts # Sync con Stripe (v2.0)
  sync-stripe-plans.ts    # Sync legacy (v1)
  stripe-sync.ts          # Sync de Stripe (v4.0 - el que se ejecuto)
supabase/
  migrations/             # 20+ migraciones SQL
```

---

## 3. ANALISIS DE BASE DE DATOS

### 3.1 Tablas (56 tablas en total)

**Nucleo del negocio:**
- `companies` - Organizaciones cliente
- `users` - Usuarios (vinculados a companies via company_id)
- `subscription_plans` - Planes de suscripcion (6 activos)
- `company_subscriptions` - Suscripciones activas (UNIQUE en company_id)
- `company_addons` - Add-ons (dedicated number, recording vault, calls booster)
- `company_settings` - Config por empresa (PK = company_id)
- `agent_templates` - Templates de agentes AI (3 principales)
- `company_agents` - Agentes configurados por empresa
- `contacts` - Contactos/leads (tabla central)
- `contact_lists` - Listas para organizar contactos
- `agent_runs` - Campanas/ejecuciones de agentes
- `call_queue` - Cola de llamadas pendientes
- `call_logs` - Registro de llamadas realizadas
- `follow_up_queue` - Cola de follow-ups automaticos
- `voicemail_logs` - Registro de voicemails detectados
- `calendar_events` - Eventos de calendario
- `calendar_integrations` - Integraciones de calendario
- `analysis_queue` - Cola de analisis AI asincrono

**Billing:**
- `usage_tracking` - Tracking de minutos usados
- `billing_history` - Historial de pagos
- `billing_events` - Eventos de billing (audit trail)
- `stripe_events` - Idempotencia de webhooks Stripe
- `cancellation_feedback` - Feedback de cancelaciones
- `retention_offers` - Ofertas de retencion
- `retention_offer_log` - Log de ofertas

**Integraciones (patrón x3 por CRM: integrations, contact_mappings, sync_logs):**
- Salesforce (3 tablas)
- HubSpot (3 tablas)
- Pipedrive (3 tablas)
- Clio (3 tablas)
- Zoho (3 tablas)
- Dynamics 365 (3 tablas)
- SimplyBook (4 tablas - incluye webhook_logs)
- Google Sheets (2 tablas - integrations + linked_sheets)

**Otros:**
- `ai_conversations` / `ai_messages` - Chat AI interno
- `notifications` - Sistema de notificaciones
- `team_invitations` - Invitaciones de equipo
- `team_calendar_assignments` - Asignaciones de calendario por equipo
- `webhook_endpoints` / `webhook_deliveries` - Webhooks outbound
- `integration_feedback` - Feedback de integraciones
- `admin_finances` - Dashboard financiero admin

### 3.2 Integridad Referencial - CORRECTA

Todas las Foreign Keys estan bien definidas:
- ON DELETE CASCADE para relaciones padres (company_id -> companies)
- ON DELETE SET NULL para relaciones opcionales (contact_id, subscription_id, agent_run_id)
- Patron consistente en todas las tablas

### 3.3 Row Level Security (RLS) - BIEN IMPLEMENTADO

**Patron consistente en la mayoria de tablas:**
```sql
-- SELECT: usuario puede ver datos de su propia compania
USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))

-- INSERT/UPDATE/DELETE: mismo patron
CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))

-- Service role: bypass para operaciones del sistema
USING (auth.role() = 'service_role'::text)
```

**Problemas encontrados en RLS:**

1. **`company_settings` - SELECT permite TODO a usuarios autenticados:**
   ```sql
   -- VULNERABILIDAD: Cualquier usuario autenticado puede ver settings de CUALQUIER empresa
   policy: "authenticated_can_view_settings"
   USING (true)
   ```
   Esto potencialmente expone `bland_api_key` y `openai_api_key` de otras empresas. Aunque tambien hay una politica mas restrictiva (`users_can_view_company_settings`), la politica permisiva `USING (true)` podria tomar precedencia dependiendo de la evaluacion.

2. **`companies` - SELECT permite TODO a usuarios autenticados:**
   ```sql
   policy: "authenticated_can_view_companies"
   USING (true)
   ```
   Permite ver nombre, website, logo de todas las empresas. Riesgo bajo pero innecesario.

3. **`company_addons` - Solo tiene SELECT, falta INSERT/UPDATE/DELETE para service_role:**
   Solo hay una politica de SELECT para miembros de la compania. Las operaciones de escritura solo son posibles via service_role bypass (implicito al no tener RLS habilitado para esas operaciones... pero si tiene RLS habilitado). **BUG: No se pueden crear addons desde la API si no es service_role.**

4. **Politicas duplicadas en varias tablas:**
   - `call_logs`: Tiene "Company members can manage call logs" (ALL) Y politicas separadas de INSERT/SELECT
   - `contacts`: Tiene "Company members can manage contacts" (ALL) Y politicas separadas
   - `agent_runs`: Mismo patron duplicado
   No es un bug per se, pero agrega complejidad innecesaria.

### 3.4 Indices - EXCELENTES

Los indices estan bien pensados:
- Indices compuestos para queries frecuentes (`company_id, status`)
- Indices parciales para datos activos (`WHERE status = 'pending'`)
- Indices en FKs para evitar full scans en JOINs
- Indices en campos de busqueda (phone_number, email, call_id)
- Indices GIN para JSONB (location_logs, fav_voices)

### 3.5 Triggers - CORRECTOS

Todos los triggers de `updated_at` estan bien configurados. Los triggers de notificacion (campaign_completion, high_failure_rate, minutes_limit) son un buen patron para alertas automaticas.

**Nota:** Hay triggers duplicados en `contacts` (`set_updated_at` y `update_contacts_updated_at`) y `company_settings` (dos triggers diferentes). No causan errores pero ejecutan la misma logica dos veces.

---

## 4. ANALISIS DE PLANES Y PRECIOS

### 4.1 Planes Definidos (Migracion V4)

| Plan | Monthly | Annual (total) | Calls/mo | Minutes | Max Duration | Concurrent | Agents | Users | Overage/min |
|------|---------|---------------|----------|---------|-------------|------------|--------|-------|-------------|
| Free | $0 | $0 | 10 | 15 | 3 min | 1 | 1 | 1 | N/A |
| Starter | $99 | $1,044 | 200 | 300 | 3 min | 2 | 1 | 1 | $0.29 |
| Growth | $179 | $1,908 | 400 | 600 | 4 min | 3 | Unlimited | 1 | $0.26 |
| Business | $299 | $3,228 | 800 | 1,200 | 5 min | 5 | Unlimited | 3 | $0.23 |
| Teams | $649 | $6,948 | 1,500 | 2,250 | 6 min | 10 | Unlimited | 5 | $0.20 |
| Enterprise | $1,499 | $16,188 | 4,000 | 6,000 | Unlimited | Unlimited | Unlimited | Unlimited | $0.17 |

### 4.2 Incoherencias Detectadas

**CRITICO: Discrepancia en `price_annual` entre migracion SQL y la logica de Stripe sync**

La migracion SQL (la fuente de verdad) guarda `price_annual` como el **total anual**:
```sql
-- Starter
price_annual = 1044  -- $1,044 total al ano = $87/mes
```

Pero el script `sync-stripe-advanced.ts` calcula el precio anual como:
```typescript
const annualTotal = Math.round(plan.price_annual * 12 * 100);
// Si price_annual = 1044, esto calcula: 1044 * 12 * 100 = $12,528,000 centavos = $125,280!!
```

Esto explica los errores que vimos en el log de Stripe sync:
```
Incorrect annual price detected: $12528 (expected $1044)
```

**Sin embargo**, el script `stripe-sync.ts` (v4.0, el que realmente se ejecuto) parece haber corregido esto, porque el output muestra que:
- Detecto los precios incorrectos
- Los archivo
- Creo nuevos precios correctos: "$1044/yr"

**Pero el script `sync-stripe-advanced.ts` (v2.0) NO fue corregido** y sigue con la formula incorrecta. Si alguien ejecuta el script equivocado, los precios se rompen.

**PROBLEMA: Campo `price_annual` es ambiguo**
- En la migracion: es el total anual ($1,044)
- En el script v2.0: se multiplica por 12 (asume que es el precio mensual con descuento)
- En el script v4.0: se usa directamente (correcto)

**Recomendacion:** Renombrar el campo a `price_annual_total` o agregar un comentario claro en la tabla, y eliminar o archivar `sync-stripe-advanced.ts` (v2.0) para evitar confusiones.

**CRITICO: Los descuentos anuales son INCONSISTENTES**

Calculando los descuentos reales:
| Plan | Monthly*12 | Annual Total | Descuento Real | Descuento Mostrado en Stripe |
|------|-----------|-------------|---------------|------------------------------|
| Starter | $1,188 | $1,044 | 12.1% | 12% |
| Growth | $2,148 | $1,908 | 11.2% | 11% |
| Business | $3,588 | $3,228 | 10.0% | 10% |
| Teams | $7,788 | $6,948 | 10.8% | 11% |
| Enterprise | $17,988 | $16,188 | 10.0% | 10% |

Los descuentos varian entre 10-12%. Esto es aceptable pero **confuso para el marketing** - no hay un descuento unificado ("ahorra 20% con anual"). Los descuentos son modestos y podrian no ser suficientes para incentivar planes anuales.

**PROBLEMA: Precios EUR/GBP en Stripe vs. conversion real**

Del log de sync v4.0:
```
EUR Monthly: €91.08/mo (Starter, $99 USD)
GBP Monthly: £78.21/mo
```

Esto usa tasas de conversion fijas embebidas en el script. Si las tasas cambian, los precios quedan desactualizados. No hay mecanismo de actualizacion automatica.

### 4.3 Add-ons

| Add-on | Precio | Disponible desde |
|--------|--------|-----------------|
| Dedicated Phone Number | $15/mo | Starter+ |
| Recording Vault | $12/mo (12 meses retention) | Starter+ |
| Calls Booster | $35/mo (+150 calls/+225 min) | Starter+ |

Los add-ons estan correctamente modelados en `company_addons` con CHECK constraint para los tipos. La tabla tiene RLS habilitado pero **solo politica SELECT** - necesita politicas de INSERT/UPDATE via service_role para que funcione el checkout de addons.

### 4.4 Metered Billing (Overages) - INCOMPLETO

El script de sync nota explicitamente:
```
Metered pricing skipped... Stripe API 2025-03-31+ requires billing meters
```

**El overage billing NO esta implementado en Stripe.** Los overages se trackean internamente en `usage_tracking.overage_minutes` y `company_subscriptions.overage_spent`, pero **no hay cobro automatico**. La funcion `reportUsage()` en `stripe.ts` existe pero no se llama desde ninguna ruta de API.

Esto significa que si un usuario usa mas minutos de los incluidos, **no se le cobra automaticamente**. El sistema puede bloquear llamadas via `check-usage-limit`, pero el cobro de overages es manual.

### 4.5 Cupones en Stripe

Los cupones estan bien configurados pero hay discrepancia entre los dos scripts:
- `sync-stripe-advanced.ts` define 4 cupones (TOTAL100, LAUNCH50, EARLY25, ANNUAL20)
- El log de v4.0 muestra 9 cupones (ADMIN100, TESTER_100, LAUNCH50, EARLY25, ANNUAL20, CALLENGO30, WELCOME15, PARTNER40, LEGAL20)

Los cupones extras (CALLENGO30, WELCOME15, PARTNER40, LEGAL20) no estan definidos en ningun script del repo, lo que sugiere que fueron creados manualmente en el dashboard de Stripe o por otro script no versionado.

---

## 5. ANALISIS DE AGENTES AI

### 5.1 Agent Templates (3 agentes principales)

Los templates se almacenan en `agent_templates` con:
- `slug`: identificador unico
- `task_template`: prompt para Bland AI
- `first_sentence_template`: frase de apertura
- `voicemail_template`: mensaje de voicemail
- `analysis_questions`: preguntas de analisis post-llamada (JSONB)

**Los tres slugs usados en el codigo:**
1. `data-validation` - Validacion de datos
2. `appointment-confirmation` - Confirmacion de citas
3. `lead-qualification` - Cualificacion de leads

**PROBLEMA:** Los templates se seedean via SQL en migraciones, pero **no encontre la migracion SQL que los inserta** en el repo. El seed API (`/api/seed`) asume que ya existen:
```typescript
const dataValidation = templates.find(t => t.slug === 'data-validation');
```
Si no existen, el seed falla. Esto podria ser un problema para nuevos deployments.

### 5.2 Flujo de Llamada Completo

```
1. Usuario configura agent_run (settings, follow-up, voicemail, calendar)
2. Contactos se encolan en call_queue
3. /api/queue/process o worker procesa la cola
4. /api/bland/send-call envia llamada a Bland AI
5. Bland AI realiza la llamada
6. Bland AI envia webhook a /api/bland/webhook
7. Webhook:
   a. Inserta call_log
   b. Lock del contacto durante procesamiento
   c. Actualiza contacto con resultado
   d. Crea calendar_events (callback, follow-up, completed)
   e. AI Intent Analysis (sync o async via analysis_queue)
   f. Acciones especificas por template:
      - appointment-confirmation: confirma/reagenda/no-show
      - lead-qualification: BANT scoring, agenda meeting
      - data-validation: actualiza campos del contacto
   g. CRM Sync (Pipedrive, Clio)
   h. Outbound Webhooks (Zapier, Make)
   i. Unlock del contacto
8. Return 200 al webhook
```

### 5.3 AI Intent Analyzer

**Muy bien implementado.** Usa GPT-4o-mini con:
- `temperature: 0.1` (baja para consistencia)
- `response_format: { type: 'json_object' }` (output estructurado)
- Prompts especificos y detallados por tipo de agente
- Confidence thresholds para evitar falsos positivos (0.6 para acciones criticas)
- Fallback seguro: retorna 'unclear'/'partial' si falla el analisis
- Modo dual: sincrono (default) o asincrono via analysis_queue

### 5.4 Analysis Queue

Bien disenada con:
- `claim_analysis_job()` - funcion PostgreSQL SECURITY DEFINER para atomic claim
- Max 3 intentos por job
- Worker protegido por secret (QUEUE_PROCESSING_SECRET)
- Batch processing configurable (max 50)

---

## 6. ANALISIS DE INTEGRACIONES

### 6.1 Patron Consistente

Todas las integraciones CRM siguen el mismo patron:
```
/api/integrations/{provider}/connect     -> Inicia OAuth flow
/api/integrations/{provider}/callback    -> Maneja OAuth callback
/api/integrations/{provider}/disconnect  -> Desconecta
/api/integrations/{provider}/sync        -> Sincroniza contactos
/api/integrations/{provider}/contacts    -> Lista contactos del CRM
/api/integrations/{provider}/users       -> Lista usuarios del CRM
```

### 6.2 Estado de cada Integracion

| Integracion | OAuth | Sync Inbound | Sync Outbound | Estado |
|-------------|-------|-------------|--------------|--------|
| Salesforce | Si | Si | No directo* | Completa |
| HubSpot | Si | Si | No directo* | Completa |
| Pipedrive | Si | Si | Si (webhook) | Completa |
| Clio | Si | Si | Si (webhook) | Completa |
| Zoho | Si | Si | No | Parcial |
| Dynamics 365 | Si | Si | No | Parcial |
| SimplyBook | Login/token | Si | Si (webhook) | Completa |
| Google Sheets | Si | Si (import) | No | Import-only |
| Google Calendar | Si | Bidireccional | Bidireccional | Completa |
| Microsoft Outlook | Si | Bidireccional | Bidireccional | Completa |
| Slack | Si | N/A | Notificaciones | Completa |
| Zoom | Si | N/A | Crear meetings | Parcial |

*No hay push automatico de resultados de llamada a Salesforce/HubSpot/Zoho/Dynamics desde el webhook de Bland. Solo Pipedrive y Clio tienen push outbound implementado.

### 6.3 Problemas en Integraciones

1. **Tokens OAuth almacenados en texto plano** en las tablas de integraciones. `access_token` y `refresh_token` estan como TEXT sin encriptacion. Si la DB se compromete, todos los tokens OAuth de todos los clientes quedan expuestos. **Esto es critico para produccion.**

2. **No hay token refresh automatico** visible en el codigo. Si un access_token expira, la integracion dejara de funcionar hasta que el usuario reconecte manualmente. Deberia haber un middleware de refresh.

3. **Salesforce y HubSpot no pushean resultados de llamada** desde el webhook de Bland. Solo Pipedrive y Clio lo hacen. Esto limita la utilidad de la integracion.

4. **Google Sheets es import-only** - no sincroniza resultados de vuelta. Esto esta documentado pero podria confundir a usuarios que esperan sync bidireccional.

---

## 7. ANALISIS DE SEGURIDAD

### 7.1 Lo que esta BIEN

- **Middleware de autenticacion** (`middleware.ts`): Protege rutas correctamente, separa rutas publicas de protegidas, verifica email confirmation
- **Webhooks de Stripe**: Verificacion de firma implementada (`verifyWebhookSignature`)
- **Webhooks de Bland**: Verificacion HMAC-SHA256 con timing-safe compare (pero opcional si no hay secret)
- **Rate limiting**: Implementado en send-call (10/min) y checkout (5/min) usando `expensiveLimiter`
- **Zod validation**: Input validation en `/api/bland/send-call` con esquemas estrictos
- **Idempotencia Stripe**: Patron INSERT + unique constraint (atomico, sin race conditions)
- **RLS en todas las tablas criticas**: Patron consistente de company_id isolation
- **Email verification required** antes de acceder al dashboard
- **Onboarding flow** asegura que todos los usuarios tienen company_id

### 7.2 VULNERABILIDADES Y PROBLEMAS

**ALTA SEVERIDAD:**

1. **API Routes de integraciones estan en la lista publica del middleware:**
   ```typescript
   const publicApiRoutes = [
     '/api/integrations/',  // OAuth callbacks — handle their own auth flows
   ];
   ```
   Esto significa que **TODAS** las rutas bajo `/api/integrations/` bypasean la autenticacion del middleware. Aunque los callbacks OAuth necesitan ser publicos, las rutas de `sync`, `contacts`, `users`, `disconnect` tambien quedan sin proteccion a nivel middleware. Cada ruta individual SI verifica auth internamente, pero es un patron fragil - cualquier nueva ruta que se agregue bajo `/api/integrations/` quedaria sin auth por defecto.

   **Recomendacion:** Cambiar a whitelist especifica:
   ```typescript
   const publicApiRoutes = [
     '/api/integrations/*/callback',  // Solo callbacks OAuth
     '/api/integrations/simplybook/webhook',  // Webhook de SimplyBook
   ];
   ```

2. **`company_settings` expone API keys a otros usuarios autenticados:**
   La politica RLS `authenticated_can_view_settings` con `USING (true)` permite que cualquier usuario autenticado lea settings de cualquier empresa, incluyendo `bland_api_key` y `openai_api_key`.

3. **Bland webhook sin signature es aceptado con warning:**
   ```typescript
   if (webhookSecret) {
     // Verifica firma
   } else {
     body = await request.json();
     console.warn('BLAND_WEBHOOK_SECRET not configured...');
   }
   ```
   Si `BLAND_WEBHOOK_SECRET` no esta configurado, cualquier persona puede enviar webhooks falsos y alterar datos de contactos, crear call_logs falsos, y disparar acciones en calendarios y CRMs.

4. **Tokens OAuth sin encriptar en la base de datos** (mencionado en seccion 6.3)

**MEDIA SEVERIDAD:**

5. **Seed endpoint disponible en non-production:**
   ```typescript
   if (process.env.NODE_ENV === 'production') {
     return NextResponse.json({ error: 'Seed endpoint is disabled in production' }, { status: 403 });
   }
   ```
   En staging/development, `/api/seed` puede borrar y recrear todos los datos de la cuenta demo. Si el staging es accesible publicamente y `NODE_ENV` no es `production`, esto es un riesgo.

6. **Queue processing sin auth robusta:**
   ```typescript
   const authorized =
     vercelCron === '1' || // Vercel Cron (cualquiera puede enviar este header)
     (QUEUE_SECRET && authHeader === `Bearer ${QUEUE_SECRET}`) ||
     (QUEUE_SECRET && cronHeader === QUEUE_SECRET);

   if (!authorized && QUEUE_SECRET) { // Si QUEUE_SECRET no esta definido, PASA sin auth
   ```
   Si `QUEUE_PROCESSING_SECRET` no esta configurado, **cualquiera** puede triggear el procesamiento de la cola.

7. **Informacion de error expuesta en responses:**
   Multiples rutas API retornan `error.message` en el response body, lo que puede filtrar informacion interna.

**BAJA SEVERIDAD:**

8. **No hay CORS configuracion explicita** - Next.js maneja esto por defecto, pero para webhooks podria ser relevante.

9. **No hay CSP (Content Security Policy) headers** configurados en `next.config.ts`.

10. **`users` RLS tiene politicas duplicadas** (insert_own_user Y users_can_insert_own_record hacen lo mismo).

---

## 8. BUGS, ERRORES Y PROBLEMAS ENCONTRADOS

### 8.1 Bugs Funcionales

1. **BUG: `price_annual` interpretado diferente en dos scripts**
   - `sync-stripe-advanced.ts`: `plan.price_annual * 12 * 100` (INCORRECTO - multiplica por 12 un valor que ya es anual)
   - `stripe-sync.ts` (v4.0): Usa correctamente el valor como total anual
   - **Impacto:** Si alguien ejecuta el script equivocado, los precios anuales en Stripe seran 12x el precio real

2. **BUG: `usage_tracking` reset en checkout no es robusto**
   En el webhook de Stripe `handleCheckoutSessionCompleted`:
   ```typescript
   const subId = updatedSub?.id || subscriptionId;
   ```
   Si `updatedSub` es null (porque el update fallo), `subId` sera el Stripe subscription ID, no el UUID de Supabase. Esto podria fallar al insertar en `usage_tracking`.

3. **BUG POTENCIAL: Race condition en webhook de Bland**
   El webhook hace SELECT -> UPDATE en multiples pasos sin transacciones. Si dos webhooks llegan simultaneamente para el mismo contacto, pueden sobrescribirse mutuamente.

4. **BUG: `calendar_integrations` tiene UNIQUE en (company_id, provider) Y (company_id, user_id, provider)**
   ```sql
   UNIQUE (company_id, provider)
   UNIQUE (company_id, user_id, provider)  -- via index
   ```
   La primera constraint impide que dos usuarios de la misma empresa conecten el mismo proveedor de calendario. Esto es un problema para Teams/Enterprise donde multiples usuarios podrian querer conectar su propio Google Calendar.

5. **BUG: Mock data usa `crfuentes12@gmail.com` hardcodeado**
   ```typescript
   const DEMO_EMAIL = process.env.DEMO_USER_EMAIL || 'demo@callengo.ai';
   ```
   Pero en el seed route:
   ```typescript
   import { DEMO_USER_EMAIL } from '@/lib/mock-data';
   ```
   Si `DEMO_USER_EMAIL` no se exporta como la misma variable, podria haber conflicto.

### 8.2 Valores de Demostracion / Placeholder

1. **Mock data (`lib/mock-data.ts`):** 800+ lineas de datos de demostracion con:
   - Contactos ficticios con telefono +1555... (no reales)
   - Agent runs simulados con metricas inventadas
   - Call logs con transcripts hardcodeados
   - Voicemail logs simulados
   - Usage tracking inventado

   **Todo esto esta correctamente aislado** al endpoint `/api/seed` y solo funciona para el demo user. No se mezcla con datos reales. Bien hecho.

2. **Bland API `background_track: 'office'`** hardcodeado en send-call. No es configurable por usuario.

3. **`temperature: 0.7`** hardcodeado en send-call para Bland AI. Podria ser configurable.

4. **`model: 'enhanced'`** hardcodeado para Bland AI. No permite seleccionar modelo.

### 8.3 Cosas que NO funcionan completamente

1. **Overage billing con Stripe** - Trackeado internamente pero no cobrado
2. **Metered pricing en Stripe** - Skipped por cambio de API
3. **Salesforce/HubSpot/Zoho/Dynamics outbound push** - Solo Pipedrive y Clio pushean
4. **Token refresh automatico** para integraciones OAuth
5. **Recording Vault** - La tabla y logica existe pero la integracion con Supabase Storage esta solo a nivel de bucket creation, sin API para subir/descargar
6. **Dedicated Phone Number** - El modelo de datos existe pero la logica de comprar un numero via Bland API no esta implementada
7. **Calls Booster** - El checkout existe pero la logica de aplicar los minutos extra al limite no es clara

---

## 9. ESCENARIO 1: EMPRESA DE PROCESAMIENTO DE PAGOS

### Perfil
**"PaymentSync Corp"** - Procesadora de pagos con 50,000 registros en un CRM viejo (datos de 5+ anos, muchos desactualizados). Necesitan validar: nombres de contacto, emails, direcciones, telefonos, decision makers.

### Simulacion Paso a Paso

**PASO 1: Signup y Onboarding**
- Se registra en Callengo via `/auth/signup`
- Verifica email via Supabase Auth
- Completa onboarding: crea empresa "PaymentSync Corp", selecciona industria "Financial Services"
- Se le asigna plan Free automaticamente (10 calls, 15 min)

**PASO 2: Seleccion de Plan**
- Con 50,000 registros, necesitan MINIMO el plan Teams ($649/mo, 1,500 calls)
- Pero 50,000 contactos requeririan ~33 meses en el plan Teams sin overages
- Opcion realista: Enterprise ($1,499/mo, 4,000 calls) + overages a $0.17/min
- O Teams + Calls Booster addons: $649 + ($35 * 10 boosters = $350) = $999/mo para 3,000 calls

**PASO 3: Importacion de Contactos**
- Sube CSV via `/api/contacts/import` o conecta Google Sheets
- Los contactos se normalizan: telefono a E.164, deduplicacion
- Crea listas: "Batch 1 - Northeast", "Batch 2 - West Coast", etc.
- **Nota:** Con 50K contactos, la importacion podria ser lenta - no hay procesamiento en batch para uploads grandes

**PASO 4: Configuracion del Agente de Data Validation**
- Selecciona template `data-validation`
- Personaliza el task/prompt con contexto de PaymentSync
- Configura voicemail: "leave_message" con mensaje personalizado
- Configura follow-ups: 3 intentos, 24h entre intentos
- Configura working hours: 9am-5pm Eastern, Mon-Fri

**PASO 5: Lanza Campana**
- Crea agent_run con 500 contactos iniciales (test batch)
- Contactos se encolan en call_queue
- Con Teams plan: 10 concurrent calls, cada llamada ~1.5 min promedio
- Throughput teorico: ~400 calls/hora = 500 contactos en ~1.25 horas

**PASO 6: Webhook Procesamiento**
- Bland AI llama, webhook retorna a `/api/bland/webhook`
- AI Intent Analyzer clasifica cada llamada:
  - `data_confirmed`: Actualiza contact.status = "Fully Verified"
  - `data_updated`: Actualiza campos del contacto con datos nuevos (email, address, etc.)
  - `callback_requested`: Crea follow-up en la cola
  - `refused`: Marca contacto como "Refused"
  - `partial`: Marca como parcialmente verificado

**PASO 7: Resultados**
- Dashboard muestra metricas en tiempo real via agent_run counters
- Contactos actualizados con datos validados en `custom_fields`
- Calendar events creados para callbacks pendientes
- CRM sync (si conectaron Pipedrive/Clio) pushea actualizaciones

### Que Funciona Bien
- El flujo de data validation es el mas maduro de los tres agentes
- AI extracts y actualiza campos automaticamente
- Follow-ups automaticos para no-answer y voicemail
- El patron de lock/unlock del contacto evita ediciones concurrentes

### Problemas que Encontrarian
1. **No hay bulk import optimizado** - 50K contactos via CSV podria timeout
2. **No hay scheduling de llamadas por zona horaria** del contacto - solo working hours del agent_run
3. **Overages no se cobran** automaticamente - se podrian quedar sin minutos sin darse cuenta
4. **No hay DNC (Do Not Call) list management** - critico para procesadoras de pagos por compliance
5. **No hay opt-out/consent tracking** - requerido por TCPA en USA
6. **Los resultados de validacion no se sincronizan a Salesforce/HubSpot** - solo Pipedrive/Clio

---

## 10. ESCENARIO 2: CLINICA REDUCIENDO NO-SHOWS

### Perfil
**"HealthFirst Medical"** - Clinica con 200 citas semanales, tasa de no-show del 25%. Usan SimplyBook.me para reservas. Quieren confirmar citas por telefono automaticamente.

### Simulacion Paso a Paso

**PASO 1: Signup y Plan**
- Plan recomendado: Growth ($179/mo, 400 calls/mo)
- 200 citas/semana = ~800/mes = exacto el limite del plan Business
- Pero Growth con 400 calls podria ser suficiente si solo llaman 1-2 dias antes
- Decision: Business ($299/mo) para tener margen y 5 concurrent calls

**PASO 2: Integracion SimplyBook.me**
- Conecta via `/api/integrations/simplybook/connect` (login + password, no OAuth)
- Importa providers (doctores) via `/api/integrations/simplybook/providers`
- Sincroniza clientes/pacientes via `/api/integrations/simplybook/sync`
- Configura webhook de SimplyBook para nuevas reservas

**PASO 3: Integracion Google Calendar**
- Conecta via OAuth en `/api/integrations/google-calendar/connect`
- Sincroniza citas existentes bidireccional
- Los doctores ven confirmaciones/reagendamientos en su Google Calendar

**PASO 4: Team Calendar Setup**
- Crea `team_calendar_assignments` para cada doctor
- Asigna `simplybook_provider_id` a cada miembro del equipo
- Configura `max_daily_appointments` por doctor
- El sistema de `resource-routing` auto-asigna eventos al doctor correcto

**PASO 5: Configuracion del Agente Appointment Confirmation**
- Template: `appointment-confirmation`
- Personaliza: "Hi, this is calling from HealthFirst Medical regarding your appointment with Dr. [DOCTOR] on [DATE] at [TIME]..."
- Voicemail: Deja mensaje pidiendo confirmar
- Follow-ups: 2 intentos si no contesta
- No-show auto-retry: Habilitado (reintenta 24h despues del no-show)
- Allow rescheduling: Si
- Default meeting duration: 30 min
- Video provider: Zoom (para teleconsultas)

**PASO 6: Campana de Confirmacion**
- Selecciona contactos con `appointment_date` en los proximos 2 dias
- Agent run con calendar_context_enabled = true
- El agente usa el calendario para proponer slots alternativos si reagendan

**PASO 7: AI Intent Processing**
- **Confirmed (confidence >= 0.6):**
  - calendar_events.confirmation_status = 'confirmed'
  - Titulo: "Confirmed: [Patient Name]"
  - Webhook outbound: `appointment.confirmed`
  - Extrae datos adicionales (preferencias, alergias mencionadas)

- **Reschedule (confidence >= 0.6):**
  - AI extrae nueva fecha/hora mencionada en la conversacion
  - `syncRescheduleAppointment()` actualiza el evento
  - Genera video link si video_provider = 'zoom'
  - Webhook: `appointment.rescheduled`

- **No-Show:**
  - `syncHandleNoShow()` marca el evento
  - Incrementa `contact.no_show_count`
  - Si `no_show_auto_retry` habilitado, programa nuevo intento en 24h
  - Webhook: `appointment.no_show`

- **Callback Requested:**
  - `syncScheduleCallback()` crea evento de callback
  - Se encola en follow-up para llamar despues

### Que Funciona Bien
- La integracion SimplyBook es completa (import, sync, webhook)
- El AI intent analysis para citas es muy detallado (6 intents posibles)
- El auto-assign a miembros del equipo funciona via resource-routing
- Rescheduling con AI-extracted time es potente
- No-show tracking con auto-retry es exactamente lo que clinicas necesitan
- Zoom video link generation para teleconsultas

### Problemas que Encontrarian
1. **No hay SMS de confirmacion** - Solo llamadas. Muchos pacientes prefieren SMS
2. **No hay recordatorio por email** - Solo llamadas
3. **El calendario de SimplyBook y Google Calendar podrian desincronizarse** si hay escrituras concurrentes
4. **HIPAA compliance no esta implementado** - No hay encriptacion de datos de salud, no hay audit trail medico, no hay BAA
5. **La extraccion de fecha/hora de lenguaje natural** (ej: "next Tuesday at 2pm") depende de la calidad del transcript de Bland y de GPT-4o-mini - puede fallar con acentos o lenguaje informal
6. **No hay timezone handling robusto** para pacientes en diferentes zonas horarias que la clinica
7. **El campo `appointment_date`** en contacts es singular - no soporta pacientes con multiples citas futuras
8. **max_call_duration de 5 min** en Business podria ser insuficiente para pacientes que quieren discutir opciones de reagendamiento

---

## 11. ESCENARIO 3: EMPRESA DE COLD OUTREACH

### Perfil
**"ScaleUp Solutions"** - Startup B2B SaaS que necesita cualificar 2,000 leads/mes de su base de datos. Usan HubSpot CRM. Necesitan scoring BANT (Budget, Authority, Need, Timeline).

### Simulacion Paso a Paso

**PASO 1: Signup y Plan**
- 2,000 calls/mes requiere plan Teams ($649/mo, 1,500 calls) + Calls Booster ($35)
- O Business ($299/mo, 800 calls) + 8 Calls Boosters ($280) = $579/mo para 2,000 calls
- Business es mas economico pero tiene menos concurrent calls (5 vs 10)

**PASO 2: Conectar HubSpot**
- OAuth via `/api/integrations/hubspot/connect`
- Sincroniza contactos inbound via `/api/integrations/hubspot/sync`
- Mapea fields: HubSpot Contact -> Callengo Contact via `hubspot_contact_mappings`
- **Problema:** Solo sync inbound (HubSpot -> Callengo). Los resultados de llamada NO se pushean de vuelta a HubSpot automaticamente.

**PASO 3: Importar Leads**
- Sincroniza leads de HubSpot (o importa CSV adicional)
- Segmenta por lista: "Tech Companies $1M+ ARR", "Healthcare Decision Makers", etc.
- Tags para tracking: industry, company_size, source

**PASO 4: Configuracion del Agente Lead Qualification**
- Template: `lead-qualification`
- Personaliza prompt BANT: "I'm calling from ScaleUp Solutions regarding [COMPANY]. We help SaaS companies automate their outbound process..."
- Follow-ups: 5 intentos (Growth+)
- Smart follow-up: Habilitado (ajusta timing segun resultado previo)
- Calendar context: Habilitado para agendar demos
- Video provider: Zoom
- Default meeting duration: 30 min

**PASO 5: Lanza Campana por Batches**
- Batch 1: 200 leads del segmento "High Value"
- 10 concurrent calls (Teams plan)
- Working hours: 9am-5pm en timezone del lead (si disponible)
- Throughput: ~400 calls/hora = 200 contactos en 30 min

**PASO 6: AI Lead Qualification Processing**
- **Qualified (score >= 7/10):**
  - Contact se marca con qualification_score en custom_fields
  - BANT data almacenado: budget, authority, need, timeline
  - Si pidio meeting, `syncScheduleMeeting()` crea evento con Zoom link
  - Webhook: `appointment.scheduled`

- **Not Qualified (score < 4):**
  - Contact marcado, BANT data guardado para referencia
  - No follow-up programado

- **Needs Nurturing (score 4-6):**
  - Programado para follow-up en 1-2 semanas
  - Contact queda en pipeline para nurturing

- **Meeting Requested:**
  - AI extrae fecha/hora del meeting
  - Calendar event creado con Zoom link
  - Contact marcado con `meeting_scheduled = true`

**PASO 7: Analisis y Reporting**
- Dashboard muestra: total calls, conversion rate, avg qualification score
- Export de datos calificados para cargar de vuelta en HubSpot (manual!)
- Calendar muestra demos agendadas para la proxima semana

### Que Funciona Bien
- BANT scoring es automatico y detallado
- Meeting scheduling con Zoom link es fluido
- Follow-up inteligente basado en resultado previo
- Qualification score almacenado en custom_fields permite segmentacion posterior
- Multiple batches permiten A/B testing de prompts

### Problemas que Encontrarian
1. **HubSpot sync es solo inbound** - Los resultados de cualificacion NO van de vuelta a HubSpot automaticamente. Tendrian que exportar CSV y reimportar, lo que anula gran parte del valor de la integracion
2. **No hay lead scoring nativo visible en la UI** - El score se guarda en custom_fields pero no hay visualizacion de pipeline/funnel
3. **No hay automated drip campaigns** - Cada batch es manual
4. **No hay A/B testing de scripts/prompts** integrado
5. **No hay blacklisting de dominios/companias** que ya son clientes
6. **Cold calling compliance (TCPA, GDPR)** no esta implementado:
   - No hay consent management
   - No hay opt-out handling automatico
   - No hay DNC list
   - No hay recording disclosure automatico
7. **El campo `meeting_scheduled: boolean`** en contacts no trackea multiples meetings
8. **No hay integration con herramientas de email** para follow-up multicanal post-llamada

---

## 12. VALOR DEL PRODUCTO Y VIABILIDAD

### 12.1 Propuesta de Valor
Callengo resuelve un problema real: automatizar llamadas outbound con AI es costoso y complejo de implementar in-house. La plataforma ofrece:
- Setup rapido (minutos, no semanas)
- AI intent analysis sofisticado
- Integraciones con CRMs populares
- Calendario inteligente con auto-scheduling
- Tres casos de uso bien definidos

### 12.2 Competencia
- **Bland AI directo:** API cruda, sin UI, sin CRM, sin calendar, sin analytics. Callengo agrega toda la capa de valor.
- **Vapi / Retell AI:** Similares a Bland pero requieren integracion custom.
- **Orum / Nooks / Koncert:** Power dialers humanos, no AI. Diferente mercado.
- **Air AI / Synthflow:** Competidores directos pero sin la profundidad de integraciones CRM.

### 12.3 Pricing vs Valor
| Plan | Precio | Costo Bland estimado* | Margen Bruto Estimado |
|------|--------|----------------------|----------------------|
| Starter $99/mo | $99 | ~$30 (300 min * $0.10/min) | ~$69 (70%) |
| Growth $179/mo | $179 | ~$60 | ~$119 (66%) |
| Business $299/mo | $299 | ~$120 | ~$179 (60%) |
| Teams $649/mo | $649 | ~$225 | ~$424 (65%) |
| Enterprise $1,499/mo | $1,499 | ~$600 | ~$899 (60%) |

*Estimado: Bland AI cobra ~$0.09-0.12/min dependiendo del plan.

**Los margenes son saludables (60-70%).** El overage pricing ($0.17-0.29/min vs costo ~$0.10/min) tambien tiene buen margen.

### 12.4 Viabilidad - ALTA

**Factores positivos:**
- Margenes saludables
- TAM grande (cualquier empresa que haga llamadas outbound)
- Integraciones CRM reducen friction de adopcion
- Free trial sin tarjeta permite growth loop
- Tres use cases bien definidos reducen confusion

**Riesgos:**
- Dependencia total de Bland AI (single vendor risk)
- Compliance regulatorio (TCPA/GDPR) no implementado
- Overage billing no automatizado (revenue leakage)
- Tokens OAuth sin encriptar (riesgo de seguridad)
- No hay multi-tenancy verdadero a nivel de infraestructura (todos comparten la misma instancia de Supabase)

---

## 13. RECOMENDACIONES PRIORIZADAS

### P0 - CRITICOS (antes de ir a produccion)

1. **Eliminar la politica RLS `authenticated_can_view_settings` de company_settings** que expone API keys
2. **Configurar BLAND_WEBHOOK_SECRET como requerido** (no opcional) en produccion
3. **Encriptar tokens OAuth** en la base de datos (usar Supabase Vault o encriptacion a nivel de aplicacion)
4. **Restringir `/api/integrations/` en middleware** a solo callbacks OAuth
5. **Implementar DNC (Do Not Call) list** y consent tracking para compliance TCPA
6. **Exigir QUEUE_PROCESSING_SECRET** para el endpoint de procesamiento

### P1 - IMPORTANTES (primeros 30 dias)

7. **Implementar overage billing automatico** con Stripe Billing Meters
8. **Agregar token refresh automatico** para integraciones OAuth
9. **Eliminar/archivar scripts de Stripe duplicados** (mantener solo v4.0)
10. **Implementar HubSpot/Salesforce outbound push** de resultados de llamada
11. **Resolver constraint UNIQUE en calendar_integrations** que impide multi-user
12. **Agregar CSP headers** en next.config.ts

### P2 - MEJORAS (siguientes 90 dias)

13. **Implementar SMS/email para confirmacion de citas** (multicanal)
14. **Agregar lead scoring visual** en la UI (pipeline/funnel view)
15. **Implementar Dedicated Phone Number** provisioning via Bland API
16. **Implementar Recording Vault** upload/download via Supabase Storage
17. **Bulk import optimizado** para 50K+ contactos (batch processing)
18. **Timezone-aware calling** basado en timezone del contacto
19. **A/B testing de prompts** integrado
20. **Multi-appointment support** (reemplazar campo boolean por relacion a tabla)

---

*Este analisis fue generado mediante revision exhaustiva de 329 archivos de codigo fuente, 56 tablas de base de datos, 20+ migraciones SQL, 3 scripts de Stripe, y toda la logica de negocio del backend.*
