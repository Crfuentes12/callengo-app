# CALLENGO: Modelo de Negocio, Pricing & Estrategia Definitiva

**Version:** 3.0 FINAL (Documento Unico Definitivo)
**Fecha:** Marzo 2026
**Reemplaza:** `CALLENGO_BUSINESS_MODEL_V2.md` y `COMPETITOR_ANALYSIS.md`

---

# TABLA DE CONTENIDOS

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Auditoria Completa del Estado Actual](#2-auditoria-completa-del-estado-actual)
3. [Analisis de Costos de Infraestructura (Bland AI)](#3-analisis-de-costos-de-infraestructura-bland-ai)
4. [Panorama Competitivo](#4-panorama-competitivo)
5. [Unit Economics & Analisis de Margenes](#5-unit-economics--analisis-de-margenes)
6. [Arquitectura de Precios DEFINITIVA](#6-arquitectura-de-precios-definitiva)
7. [Estrategia de Feature Gating (Campanas para Todos)](#7-estrategia-de-feature-gating)
8. [Matriz de Acceso a Integraciones](#8-matriz-de-acceso-a-integraciones)
9. [Estrategia de Agentes (1 Activo para Free/Starter)](#9-estrategia-de-agentes)
10. [Estrategia de Maximizacion de Revenue](#10-estrategia-de-maximizacion-de-revenue)
11. [Mi Opinion Personal & Conclusiones](#11-mi-opinion-personal--conclusiones)
12. [Recomendaciones & Gap Analysis](#12-recomendaciones--gap-analysis)
13. [Apendice A: SQL Migration Completo](#apendice-a-sql-migration)
14. [Apendice B: Stripe Sync Script Completo](#apendice-b-stripe-sync-script)
15. [Apendice C: Cambios en el Codigo del App](#apendice-c-cambios-codigo)

---

# 1. RESUMEN EJECUTIVO

## 1.1 Que es Callengo

Callengo es una **plataforma plug-and-play de llamadas con IA** construida sobre la infraestructura de Bland AI. Permite a empresas desplegar agentes de IA para llamadas telefonicas (Lead Qualifier, Appointment Confirmation, Data Validation) sin escribir codigo, sin gestionar infraestructura, sin APIs. La propuesta de valor: **"Call and Go"** -- selecciona un agente, sube contactos, click en iniciar. La IA maneja llamadas, voicemails, follow-ups, re-agendamiento, actualizaciones CRM, y bookings de calendario automaticamente.

## 1.2 Cambios Clave vs Documento Anterior

| Aspecto | V2 (Anterior) | V3 (DEFINITIVO) |
|---------|--------------|-----------------|
| Campanas | Solo Business+ | **TODOS los tiers** (con sub-features bloqueadas) |
| Agentes activos | Arbitrario | Free/Starter: **1 activo**, Business+: **todos simultaneos** |
| Custom dialing pools | Teams+ | **ELIMINADO** (no existe en el codebase) |
| SIP integration | Enterprise | **ELIMINADO** (no existe en el codebase) |
| Governance & logs | Teams+ | **ELIMINADO** (no existe en el codebase) |
| Security & compliance | Enterprise | **ELIMINADO** (no existe en el codebase) |
| Roadmap influence | Enterprise | **ELIMINADO** (marketing humo) |
| Priority infrastructure | Enterprise | **ELIMINADO** (todos usan la misma infra Bland AI) |
| Documentos | 2 separados | **1 unico definitivo** |

## 1.3 Filosofia de Feature Gating

**PRINCIPIO FUNDAMENTAL**: Todos los usuarios, desde Free hasta Enterprise, ven el potencial completo de la plataforma. Nadie pierde acceso a campanas. Nadie pierde acceso al wizard de configuracion. Lo que cambia son las **sub-features** dentro de la experiencia:

- **Free/Starter**: Crean campanas completas, pero con voicemail, smart follow-ups, integraciones de calendario avanzadas, y Slack **visiblemente bloqueadas** con upgrade prompts
- **Free/Starter**: Solo **1 agente activo** a la vez (pueden cambiar, pero no tener 2 simultaneos)
- **Business+**: Todo desbloqueado, todos los agentes simultaneos

Esto es estrategicamente correcto porque:
1. El usuario VE todo el valor antes de pagar
2. La configuracion de campana es la experiencia core -- quitarla mata la conversion
3. Los upgrade prompts dentro del wizard son los mejores conversion triggers
4. Cada ICP elige un agente distinto en onboarding, lo que permite outreach segmentado

---

# 2. AUDITORIA COMPLETA DEL ESTADO ACTUAL

## 2.1 Paginas del App (26 paginas confirmadas)

| Pagina | Ruta | Descripcion | Gating Actual |
|--------|------|-------------|---------------|
| Dashboard | `/dashboard` | Stats, llamadas recientes, agentes, campanas | Auto-asigna Free |
| Analytics | `/analytics` | KPIs, tendencias, rendimiento | Sin gating |
| Reports | `/reports` | Reportes por campana/llamada/contacto | Sin gating |
| Team | `/team` | Miembros, invitaciones, seats | Business+ |
| Agents | `/agents` | Templates de agentes (3 core) | Plan-based |
| Contacts | `/contacts` | Lista de contactos, importacion, stats | Sin gating |
| Salesforce Contacts | `/contacts/salesforce` | Contactos sincronizados Salesforce | Business+ |
| HubSpot Contacts | `/contacts/hubspot` | Contactos sincronizados HubSpot | Business+ |
| Pipedrive Contacts | `/contacts/pipedrive` | Contactos sincronizados Pipedrive | Business+ |
| Clio Contacts | `/contacts/clio` | Contactos sincronizados Clio | Business+ |
| Zoho Contacts | `/contacts/zoho` | Contactos sincronizados Zoho | Business+ |
| Dynamics Contacts | `/contacts/microsoft-dynamics` | Contactos sincronizados Dynamics | Teams+ |
| SimplyBook Contacts | `/contacts/simplybook` | Contactos sincronizados SimplyBook | Starter+ |
| Campaigns | `/campaigns` | Todas las campanas con stats | Sin gating |
| Campaign Detail | `/campaigns/[id]` | Detalle de campana individual | Sin gating |
| Calls | `/calls` | Historial de llamadas | Sin gating |
| Follow-ups | `/follow-ups` | Cola de follow-ups | Sin gating |
| Voicemails | `/voicemails` | Logs de voicemails | Sin gating |
| Calendar | `/calendar` | Eventos, disponibilidad, scheduling | Sin gating |
| Integrations | `/integrations` | Estado de todas las integraciones | Plan-based |
| Settings | `/settings` | Company, calling, billing, notificaciones | Plan-based |
| Billing | `/billing` | Redirect a settings?tab=billing | N/A |
| Subscription Success | `/subscription/success` | Confirmacion post-compra | N/A |

## 2.2 Los 3 Agentes Core (REALES, en el codebase)

| Agente | Slug | Categoria | Tarea |
|--------|------|-----------|-------|
| Data Validation Agent | `data-validation` | verification | Verificar y actualizar informacion de contactos |
| Appointment Confirmation Agent | `appointment-confirmation` | appointment | Confirmar citas, reducir no-shows, re-agendar |
| Lead Qualification Agent | `lead-qualification` | sales | Pre-cualificar leads con preguntas BANT |

Cada agente tiene:
- Template de primera frase con variables `{{contact_name}}`, `{{agent_name}}`, `{{company_name}}`
- Template de voicemail personalizado
- Preguntas de analisis configurables
- Voz seleccionable de la libreria BLAND_VOICES

## 2.3 El Wizard de Creacion de Campana (4 pasos)

### Paso 1: Agent Preview & Identity
- Seleccion de agente (de los 3 core)
- Seleccion de voz (50+ voces de Bland AI)
- Nombre y titulo del agente personalizables
- Toggle de auto-identificacion como IA (compliance)
- Max duracion de llamada (1-15 min segun plan)
- Intervalo entre llamadas (1-60 min)
- Max llamadas por dia (1-1000+ segun plan)
- Boton de test call

### Paso 2: Campaign & Contacts
- Toggle de auto-overage billing
- Seleccion de listas de contactos (multi-select)
- Preview de contactos (primeros 5)
- Instruccion custom para el agente (textarea)
- Sugerencias IA de contexto (OpenAI)
- Informacion de empresa (nombre, descripcion, website)

### Paso 3: Calendar & Advanced Settings
- Timezone (19 opciones)
- Horario laboral (inicio/fin)
- Dias laborales (checkboxes Lun-Dom)
- Excluir feriados US (toggle)
- **Voicemail detection** (toggle)
- **Follow-ups** (toggle + max intentos + intervalo)
- **Smart follow-up** (toggle - Business+)
- **Google Calendar** (conectar)
- **Microsoft Outlook** (conectar - Business+)
- **Slack notifications** (toggle + canal + triggers - Starter+)
- **Zoom** (seleccion - Starter+)
- **Google Meet** (seleccion - Free+)
- **Microsoft Teams** (seleccion - Business+)
- Duracion default de meeting
- Toggle re-agendamiento
- Toggle no-show auto-retry

### Paso 4: Launch & Confirmation
- Review de todas las configuraciones
- Crear agent_run (status: draft)
- Guardar settings como JSONB
- Redirect a pagina de detalle de campana

## 2.4 Integraciones Existentes (REALES, en el codebase)

| Integracion | Tipo | Estado | Metodo de Conexion |
|-------------|------|--------|-------------------|
| Google Calendar | Calendar | Funcional | OAuth redirect |
| Microsoft Outlook | Calendar | Funcional | OAuth redirect |
| Zoom | Video | Funcional (Server-to-Server) | Auto-habilitado |
| Google Meet | Video | Funcional | Auto con Google Calendar |
| Microsoft Teams | Video | Funcional | Auto con Outlook |
| Slack | Communication | Funcional | OAuth redirect |
| Twilio | Communication (BYOP) | Funcional | Inline config |
| Salesforce | CRM | Funcional | OAuth redirect |
| HubSpot | CRM | Funcional | OAuth redirect |
| Pipedrive | CRM | Funcional | OAuth redirect |
| Clio | CRM (Legal) | Funcional | OAuth redirect |
| Zoho | CRM | Funcional | OAuth redirect |
| Microsoft Dynamics 365 | CRM | Funcional | OAuth redirect |
| SimplyBook.me | CRM (Bookings) | Funcional | Inline config |
| Google Sheets | Data | Funcional | OAuth redirect |
| Webhooks | Outbound | Funcional | Inline config (HMAC-signed) |

**Total: 16 integraciones reales y funcionales.**

## 2.5 Features que NO EXISTEN y Fueron Eliminadas

Las siguientes features estaban listadas en el plan anterior pero **no existen en el codebase**:

| Feature Falsa | Plan donde estaba | Razon de eliminacion |
|--------------|-------------------|---------------------|
| "Governance & audit logs" | Teams | No existe sistema de gobernanza ni logs de auditoria |
| "Security & compliance" | Enterprise | No hay modulo de compliance ni certificaciones |
| "Custom dialing pools" | Teams/Enterprise | No hay sistema de pools de numeros propios (solo auto-rotation) |
| "SIP integration" | Enterprise | No existe integracion SIP en el codebase |
| "Geospatial dialing" | Enterprise | No existe |
| "Roadmap influence" | Enterprise | Marketing humo, no es una feature |
| "Priority infrastructure" | Enterprise | Todos usan la misma infra de Bland AI |
| "Custom integrations" | Enterprise | No existe sistema de integraciones custom |
| "REST API access" | Enterprise | No hay API publica documentada |
| "Advanced retry logic" | Teams | El retry logic es el mismo para todos (follow-up queue) |

**Sobre "Custom Dialing Pools"**: Esto se refieria a la idea de que los usuarios de tiers altos podrian traer un pool de numeros telefonicos propios rotatorios. En la practica, Callengo usa auto-rotation de numeros del pool compartido para todos los planes, y Twilio BYOP para Business+ (un numero propio). No hay sistema de "pools" de multiples numeros propios con rotacion inteligente. Es una feature que se podria construir en el futuro, pero HOY no existe.

## 2.6 Precios Actuales (Base de Datos)

```
| Plan       | Monthly | Annual/mo | Minutes | Max Duration | Overage/min | Users | Agents | Concurrent |
|------------|---------|-----------|---------|-------------|-------------|-------|--------|------------|
| Free       | $0      | $0        | 15      | 3 min       | $0.80       | 1     | 1      | 1          |
| Starter    | $99     | $89       | 300     | 3 min       | $0.60       | 1     | 1      | 2          |
| Business   | $279    | $249      | 1,200   | 5 min       | $0.35       | 3     | -1     | 5          |
| Teams      | $599    | $529      | 2,400   | 8 min       | $0.22       | 5     | -1     | 10         |
| Enterprise | $1,500  | $1,350    | 6,000   | 15 min      | $0.18       | -1    | -1     | 25         |
```

(-1 = ilimitado)

---

# 3. ANALISIS DE COSTOS DE INFRAESTRUCTURA (BLAND AI)

## 3.1 Pricing de Bland AI (Post-Diciembre 2025)

| Plan Bland AI | Fee Mensual | Costo/min | Descuento |
|--------------|------------|-----------|-----------|
| Start (Free) | $0 | $0.14/min | - |
| Build | $299/mo | $0.12/min | 14% off |
| Scale | $499/mo | $0.11/min | 21% off |
| Enterprise | Custom | ~$0.09/min | ~36% off |

**Callengo deberia estar en el plan Scale o Enterprise de Bland AI** para maximizar margenes. Asumimos $0.11/min como COGS base.

## 3.2 Costos Ocultos Adicionales

| Concepto | Costo | Notas |
|----------|-------|-------|
| Bland AI por minuto | $0.11 | Plan Scale |
| Fee por intento de llamada | ~$0.001 | Incluso llamadas fallidas |
| OpenAI (analisis post-llamada) | ~$0.005/llamada | gpt-4o-mini para analisis de transcripcion |
| Supabase overhead | ~$0.002/llamada | Storage, RLS queries, realtime |
| Stripe fees (transaccion) | 2.9% + $0.30 | Por cobro de suscripcion |
| Twilio (si BYOP) | Variable | El cliente paga su propio Twilio |

## 3.3 COGS Total por Minuto

**COGS estimado por minuto de llamada: ~$0.122**

Calculo:
- Bland AI: $0.110
- OpenAI analisis: $0.005 / 3min avg = $0.0017/min
- Fee intento: $0.001 / 3min avg = $0.0003/min
- Supabase: $0.002 / 3min avg = $0.0007/min
- **Total: ~$0.1127/min** (redondeamos a $0.122 con buffer de seguridad)

## 3.4 COGS por Suscripcion Mensual (Solo minutos incluidos)

| Plan | Minutos | COGS Minutos | % del Precio |
|------|---------|-------------|-------------|
| Free | 15 | $1.83 | N/A (gratis) |
| Starter | 300 | $36.60 | 37% de $99 |
| Business | 1,200 | $146.40 | 49% de $299 |
| Teams | 2,500 | $305.00 | 47% de $649 |
| Enterprise | 6,000 | $732.00 | 49% de $1,499 |

---

# 4. PANORAMA COMPETITIVO

## 4.1 Competidores Directos (Plataformas No-Code de Voice AI)

### Synthflow AI
- **Modelo**: Plataforma no-code similar a Callengo
- **Pricing (2026)**:
  - Pro: $375/mo (2,000 min) = $0.19/min
  - Growth: $750/mo (4,000 min) = $0.19/min
  - Agency: $1,250/mo (6,000 min) = $0.21/min
- **Integraciones**: 15+ CRMs (HubSpot, Salesforce, Zoho, etc.)
- **Fortaleza**: Buen branding, integraciones solidas
- **Debilidad**: Caro por minuto, no tiene wizard tan pulido

### Bland AI Direct
- **Modelo**: API-first (requiere codigo)
- **Pricing**: $0.09-$0.14/min dependiendo del plan
- **Fortaleza**: Lo mas barato posible (sin intermediarios)
- **Debilidad**: Requiere desarrolladores, no tiene UI/dashboard/CRM

### Vapi AI
- **Modelo**: API developer-friendly
- **Pricing**: $0.05/min plataforma + proveedores (~$0.13-$0.31/min all-in)
- **Fortaleza**: Flexibilidad tecnica extrema
- **Debilidad**: Complejo, requiere devs, pricing impredecible

### Retell AI
- **Modelo**: API con dashboard basico
- **Pricing**: $0.07/min base + proveedores (~$0.13-$0.31/min all-in)
- **Fortaleza**: Baja latencia, buena calidad
- **Debilidad**: Sin CRM integrado, requiere desarrollo

### Air AI
- **Modelo**: Enterprise sales-heavy
- **Pricing**: $25K-$100K upfront + $0.11/min (reportado inactivo/problematico)
- **Fortaleza**: Concepto ambicioso
- **Debilidad**: Reportedly no funcional, caro, opaco

## 4.2 Tabla Comparativa de Pricing

```
| Plataforma     | Plan Basico  | $/min efectivo | CRMs | No-Code | Target |
|----------------|-------------|---------------|------|---------|--------|
| Callengo       | $99/mo      | $0.33         | 7    | Si      | SMB    |
| Synthflow      | $375/mo     | $0.19         | 15+  | Si      | SMB/Mid|
| Bland AI       | $0 + usage  | $0.11-0.14    | 0    | No      | Dev    |
| Vapi           | $0 + usage  | $0.13-0.31    | 0    | No      | Dev    |
| Retell         | $0 + usage  | $0.13-0.31    | 0    | No      | Dev    |
| Air AI         | $25K+       | $0.11         | ?    | Si?     | Ent    |
```

## 4.3 Posicionamiento de Callengo

Callengo ocupa un **nicho unico**: es la **unica plataforma truly no-code con CRMs integrados a un precio accesible**. Synthflow es el competidor mas directo pero es 3.8x mas caro en el tier basico ($375 vs $99).

La ventaja competitiva real:
1. **Precio de entrada bajo**: $99 vs $375 (Synthflow)
2. **No requiere codigo**: vs Bland AI, Vapi, Retell que necesitan devs
3. **CRMs integrados**: 7 CRMs vs 0 de Vapi/Retell/Bland
4. **Wizard completo**: Configuracion guiada paso a paso
5. **Full post-call pipeline**: Follow-ups, voicemails, calendar, CRM sync automatico

---

# 5. UNIT ECONOMICS & ANALISIS DE MARGENES

## 5.1 Margenes por Plan (NUEVOS PRECIOS)

| Plan | Precio | COGS Min. | Margen Bruto | % Margen |
|------|--------|----------|-------------|----------|
| Free | $0 | $1.83 | -$1.83 | N/A (acquisition) |
| Starter | $99 | $36.60 | $62.40 | **63%** |
| Business | $299 | $146.40 | $152.60 | **51%** |
| Teams | $649 | $305.00 | $344.00 | **53%** |
| Enterprise | $1,499 | $732.00 | $767.00 | **51%** |

## 5.2 Margenes en Overage (NUEVOS PRECIOS)

| Plan | Overage/min | COGS/min | Margen/min | % Margen |
|------|------------|----------|-----------|----------|
| Starter | $0.55 | $0.122 | $0.428 | **78%** |
| Business | $0.39 | $0.122 | $0.268 | **69%** |
| Teams | $0.29 | $0.122 | $0.168 | **58%** |
| Enterprise | $0.25 | $0.122 | $0.128 | **51%** |

**CRITICO**: Los precios anteriores de overage para Teams ($0.22) y Enterprise ($0.18) daban margenes de 45% y 32% respectivamente, lo cual es peligrosamente bajo para SaaS. Los nuevos precios corrigen esto a 58% y 51%.

## 5.3 Revenue por 100 Clientes (Mix Proyectado)

```
Distribucion asumida:
- Free: 50 usuarios (funnel de conversion)
- Starter: 25 clientes
- Business: 15 clientes
- Teams: 7 clientes
- Enterprise: 3 clientes

MRR Calculado:
- Free: $0
- Starter: 25 x $99 = $2,475
- Business: 15 x $299 = $4,485
- Teams: 7 x $649 = $4,543
- Enterprise: 3 x $1,499 = $4,497

Total MRR: $15,500
Total ARR: $186,000

+ Overage estimado (30% de clientes pagados usan ~20% extra):
  - Starter: 8 x 60min x $0.55 = $264/mo
  - Business: 5 x 240min x $0.39 = $468/mo
  - Teams: 2 x 500min x $0.29 = $290/mo
  - Enterprise: 1 x 1200min x $0.25 = $300/mo

  Overage MRR: $1,322

Total MRR con overage: $16,822
Total ARR con overage: $201,864
```

---

# 6. ARQUITECTURA DE PRECIOS DEFINITIVA

## 6.1 Tabla de Precios Final

| | FREE | STARTER | BUSINESS | TEAMS | ENTERPRISE |
|--|------|---------|----------|-------|------------|
| **Precio Mensual** | $0 | $99 | $299 | $649 | $1,499 |
| **Precio Anual/mes** | $0 | $89 | $269 | $579 | $1,349 |
| **Precio Anual total** | $0 | $1,068 | $3,228 | $6,948 | $16,188 |
| **Descuento anual** | - | 10% | 10% | 11% | 10% |
| **Minutos incluidos** | 15 (unica vez) | 300/mes | 1,200/mes | 2,500/mes | 6,000/mes |
| **Max duracion llamada** | 3 min | 3 min | 5 min | 8 min | 15 min |
| **Overage/min** | Bloqueado | $0.55 | $0.39 | $0.29 | $0.25 |
| **Usuarios** | 1 | 1 | 3 | 5 ($69/extra) | Ilimitado |
| **Agentes activos** | 1 (bloqueado) | 1 (intercambiable) | Ilimitado | Ilimitado | Ilimitado |
| **Llamadas concurrentes** | 1 | 2 | 5 | 10 | 25 |
| **Max follow-up intentos** | 0 | 2 | 5 | 10 | Ilimitado |

## 6.2 Cambios vs Precios Actuales

| Concepto | Antes | Ahora | Razon |
|----------|-------|-------|-------|
| Business mensual | $279 | **$299** | +7%, alinea con Bland AI Scale ($499) como valor |
| Business anual/mes | $249 | **$269** | Mantiene 10% descuento |
| Teams mensual | $599 | **$649** | +8%, margen mas saludable |
| Teams anual/mes | $529 | **$579** | Mantiene 11% descuento |
| Teams minutos | 2,400 | **2,500** | Numero mas redondo, percepcion de mas valor |
| Teams overage | $0.22 | **$0.29** | Margen sube de 45% a 58% |
| Enterprise mensual | $1,500 | **$1,499** | Psicologico: "menos de $1,500" |
| Enterprise anual/mes | $1,350 | **$1,349** | Psicologico consistente |
| Enterprise overage | $0.18 | **$0.25** | Margen sube de 32% a 51% |
| Extra seat (Teams) | $79 | **$69** | Mas atractivo para expansion |
| Starter overage | $0.60 | **$0.55** | Ligeramente mas competitivo |
| Business overage | $0.35 | **$0.39** | +11%, margen mas consistente |
| Free overage | $0.80 | **Bloqueado** | Ya era asi en el codigo, ahora tambien en la tabla |

## 6.3 Detalles del Plan FREE

- **Proposito**: Trial/acquisition funnel
- **15 minutos unica vez** (no se renuevan)
- 1 agente activo (seleccionado en onboarding, bloqueado)
- Puede crear campanas completas (con sub-features bloqueadas)
- Sin overage (hard block al llegar a 15 min)
- Sin follow-ups
- Sin voicemail detection
- Sin Slack
- Google Calendar + Google Meet disponibles
- Auto-rotated phone numbers
- Al agotar minutos: pantalla de upgrade forzada

## 6.4 Detalles del Plan STARTER ($99/mo)

- **Proposito**: Solo founders, freelancers, primer pago
- 300 minutos/mes (~100 llamadas de 3 min)
- 1 agente activo (intercambiable, pero solo 1 a la vez)
- Campanas completas con:
  - Voicemail detection activable
  - Follow-ups basicos (max 2 intentos)
  - Google Calendar + Google Meet
  - Slack notifications
  - Zoom meetings
  - Webhooks (Zapier, Make, n8n)
  - SimplyBook.me
- Sin: Microsoft Outlook, Teams, Smart follow-ups, CRMs avanzados
- Soporte: Async email basico

## 6.5 Detalles del Plan BUSINESS ($299/mo)

- **Proposito**: Pequenas empresas en crecimiento
- 1,200 minutos/mes (~240 llamadas de 5 min)
- **Todos los agentes simultaneos** (sin limite)
- 3 usuarios incluidos
- Campanas completas con TODO desbloqueado:
  - Smart follow-ups (max 5 intentos)
  - Microsoft Outlook + Teams
  - Twilio BYOP (numero propio)
  - HubSpot CRM
  - Pipedrive CRM
  - Zoho CRM
  - Clio (legal practice management)
- Soporte: Email prioritario

## 6.6 Detalles del Plan TEAMS ($649/mo)

- **Proposito**: Equipos que necesitan colaboracion y CRMs enterprise
- 2,500 minutos/mes (~312 llamadas de 8 min)
- Todos los agentes simultaneos
- 5 usuarios incluidos + $69/extra
- Permisos de usuario (admin/member)
- Todo de Business PLUS:
  - Follow-ups avanzados (max 10 intentos)
  - Salesforce CRM
  - Microsoft Dynamics 365
- Soporte: Prioritario

## 6.7 Detalles del Plan ENTERPRISE ($1,499/mo)

- **Proposito**: Organizaciones grandes con operaciones criticas
- 6,000 minutos/mes (~400 llamadas de 15 min)
- Todos los agentes simultaneos
- **Usuarios ilimitados**
- Follow-ups ilimitados
- Todo de Teams PLUS:
  - SLA garantizado
  - Account manager dedicado
  - Contrato anual
  - Todas las integraciones actuales y futuras
- Soporte: Dedicado + SLA

---

# 7. ESTRATEGIA DE FEATURE GATING

## 7.1 Principio: Campanas para Todos, Sub-Features Bloqueadas

**TODAS las tiers tienen acceso al wizard completo de creacion de campanas.** La diferencia esta en que features DENTRO del wizard estan disponibles vs bloqueadas visualmente.

## 7.2 Matriz de Features en el Campaign Wizard

| Feature del Wizard | FREE | STARTER | BUSINESS | TEAMS | ENTERPRISE |
|-------------------|------|---------|----------|-------|------------|
| Seleccion de agente | 1 (bloqueado) | 1 (intercambiable) | Todos | Todos | Todos |
| Seleccion de voz | Si | Si | Si | Si | Si |
| Nombre/titulo custom | Si | Si | Si | Si | Si |
| Auto-identificacion IA | Si | Si | Si | Si | Si |
| Test call | Si | Si | Si | Si | Si |
| Seleccion de contactos | Si | Si | Si | Si | Si |
| Instruccion custom IA | Si | Si | Si | Si | Si |
| Sugerencias IA contexto | Si | Si | Si | Si | Si |
| Info empresa | Si | Si | Si | Si | Si |
| Timezone/horarios | Si | Si | Si | Si | Si |
| Dias laborales | Si | Si | Si | Si | Si |
| Excluir feriados | Si | Si | Si | Si | Si |
| **Voicemail detection** | LOCKED | Si | Si | Si | Si |
| **Follow-ups** | LOCKED | Si (max 2) | Si (max 5) | Si (max 10) | Si (ilimitado) |
| **Smart follow-up** | LOCKED | LOCKED | Si | Si | Si |
| **Google Calendar** | Si | Si | Si | Si | Si |
| **Microsoft Outlook** | LOCKED | LOCKED | Si | Si | Si |
| **Slack notifications** | LOCKED | Si | Si | Si | Si |
| **Zoom meetings** | LOCKED | Si | Si | Si | Si |
| **Google Meet** | Si | Si | Si | Si | Si |
| **Microsoft Teams** | LOCKED | LOCKED | Si | Si | Si |
| **Re-agendamiento** | LOCKED | Si | Si | Si | Si |
| **No-show auto-retry** | LOCKED | LOCKED | Si | Si | Si |
| Auto-overage toggle | N/A | Si | Si | Si | Si |

**"LOCKED"** significa: el toggle/campo se muestra visible pero en estado deshabilitado con un icono de candado y un tooltip/badge que dice "Upgrade to [tier] to unlock" o "Available from [tier]+". El usuario VE que existe, VE el valor, pero no puede activarlo.

## 7.3 Matriz de Features por Pagina

### Dashboard
| Feature | FREE | STARTER | BUSINESS | TEAMS | ENTERPRISE |
|---------|------|---------|----------|-------|------------|
| Stats overview | Si | Si | Si | Si | Si |
| Recent calls | Si | Si | Si | Si | Si |
| Agent activity | Si | Si | Si | Si | Si |
| Usage tracking | Si | Si | Si | Si | Si |
| Campaign overview | Si | Si | Si | Si | Si |

### Agents
| Feature | FREE | STARTER | BUSINESS | TEAMS | ENTERPRISE |
|---------|------|---------|----------|-------|------------|
| Ver todos los agentes | Si | Si | Si | Si | Si |
| Configurar agente | 1 | 1 | Todos | Todos | Todos |
| Lanzar campana | 1 | 1 | Todos | Todos | Todos |
| Agentes simultaneos | 1 | 1 | Ilimitado | Ilimitado | Ilimitado |

### Team
| Feature | FREE | STARTER | BUSINESS | TEAMS | ENTERPRISE |
|---------|------|---------|----------|-------|------------|
| Acceso a pagina | LOCKED | LOCKED | Si (3 seats) | Si (5 + $69/extra) | Si (ilimitado) |
| Invitar miembros | - | - | Si | Si | Si |
| Roles (admin/member) | - | - | Si | Si | Si |
| Import from CRM | - | - | Si | Si | Si |
| CSV bulk import | - | - | Si | Si | Si |

### Analytics & Reports
| Feature | FREE | STARTER | BUSINESS | TEAMS | ENTERPRISE |
|---------|------|---------|----------|-------|------------|
| KPIs basicos | Si | Si | Si | Si | Si |
| Tendencias | Si | Si | Si | Si | Si |
| Filtro por periodo | Si | Si | Si | Si | Si |
| Export datos | LOCKED | Si | Si | Si | Si |
| Reportes por campana | Si | Si | Si | Si | Si |

### Calendar
| Feature | FREE | STARTER | BUSINESS | TEAMS | ENTERPRISE |
|---------|------|---------|----------|-------|------------|
| Vista calendario | Si | Si | Si | Si | Si |
| Google Calendar | Si | Si | Si | Si | Si |
| Microsoft Outlook | LOCKED | LOCKED | Si | Si | Si |
| Zoom | LOCKED | Si | Si | Si | Si |
| Google Meet | Si | Si | Si | Si | Si |
| Microsoft Teams | LOCKED | LOCKED | Si | Si | Si |

---

# 8. MATRIZ DE ACCESO A INTEGRACIONES

## 8.1 Tabla Definitiva

| Integracion | FREE | STARTER | BUSINESS | TEAMS | ENTERPRISE |
|-------------|------|---------|----------|-------|------------|
| **Calendar** | | | | | |
| Google Calendar | Si | Si | Si | Si | Si |
| Microsoft Outlook | - | - | Si | Si | Si |
| **Video** | | | | | |
| Google Meet | Si | Si | Si | Si | Si |
| Zoom | - | Si | Si | Si | Si |
| Microsoft Teams | - | - | Si | Si | Si |
| **Communication** | | | | | |
| Slack | - | Si | Si | Si | Si |
| Twilio BYOP | - | - | Si | Si | Si |
| Webhooks | - | Si | Si | Si | Si |
| **CRM** | | | | | |
| SimplyBook.me | - | Si | Si | Si | Si |
| HubSpot | - | - | Si | Si | Si |
| Pipedrive | - | - | Si | Si | Si |
| Zoho | - | - | Si | Si | Si |
| Clio | - | - | Si | Si | Si |
| Salesforce | - | - | - | Si | Si |
| Microsoft Dynamics | - | - | - | Si | Si |
| **Data** | | | | | |
| Google Sheets | Si | Si | Si | Si | Si |

## 8.2 Logica de Gating en Integraciones

- **Integraciones bloqueadas**: Se muestran en la pagina de integraciones con un candado y badge "Requires [tier]+ plan"
- **El usuario puede VER** todas las integraciones disponibles desde Free
- **Al clickear** una integracion bloqueada: modal de upgrade con beneficios del tier requerido
- **Backend enforcement**: Las rutas API de OAuth para integraciones bloqueadas deben verificar el plan antes de proceder

---

# 9. ESTRATEGIA DE AGENTES (1 Activo para Free/Starter)

## 9.1 Concepto

- **Free**: El usuario selecciona 1 agente durante el onboarding (ligado a su pain point). Queda **bloqueado**. No puede cambiar.
- **Starter**: El usuario puede tener **1 agente activo** a la vez. Puede cambiar de agente (desactivar uno, activar otro), pero nunca tener 2 simultaneos.
- **Business+**: **Todos los agentes** disponibles simultaneamente. Sin limites.

## 9.2 Por que esta estrategia es correcta

1. **Onboarding focalizado**: El usuario elige su pain point principal y se enfoca en resolver ESO
2. **Segmentacion de outreach**: Cada ICP selecciona un agente distinto segun el mensaje de marketing
3. **Upgrade natural**: Cuando el usuario quiere usar un segundo agente simultaneo, tiene que subir a Business
4. **Full experience**: Aun con 1 agente, el usuario experimenta el wizard completo, la campana, los resultados

## 9.3 Implementacion

- En la pagina de Agents: Los 3 agentes se muestran siempre
- Free: Solo se puede clickear el agente seleccionado en onboarding. Los otros muestran candado + "Upgrade to Starter to switch agents" o "Upgrade to Business for all agents"
- Starter: Se puede clickear cualquier agente, pero al seleccionar uno nuevo aparece un modal: "This will deactivate [current agent]. You can only have 1 active agent on Starter plan. Upgrade to Business for unlimited agents."
- Business+: Click en cualquier agente, sin restricciones

---

# 10. ESTRATEGIA DE MAXIMIZACION DE REVENUE

## 10.1 Palancas de Revenue

1. **Conversion Free -> Starter**: Trial de 15 min es agresivamente corto. 5 llamadas de 3 min y listo. Si la experiencia es buena, la conversion deberia ser >15%.
2. **Conversion Starter -> Business**: El limite de 1 agente activo obliga a elegir. Cuando el negocio crece y necesita 2+ agentes o CRMs, la subida es inevitable.
3. **Overage revenue**: Los clientes que se pasan de minutos generan revenue de alta margen (58-78%).
4. **Seat expansion (Teams)**: $69/seat adicional es revenue puro (no hay COGS asociado a un seat).
5. **Annual contracts**: 10-11% descuento a cambio de cash flow anticipado y reduccion de churn.

## 10.2 Pricing Psychology

- **$99**: Numero magico en SaaS. Punto de entrada "profesional" sin ser caro
- **$299**: Percepcion de "serio pero alcanzable" para pequena empresa
- **$649**: "Inversion de equipo" - justificable si 5 personas lo usan ($130/persona)
- **$1,499**: "Menos de $1,500" - psicologicamente mas facil que $1,500

## 10.3 Anti-Churn Features

- **Overage budget con alertas**: 50%, 75%, 90% de budget -> no cortan abruptamente
- **Cancellation flow**: Feedback + retention offer (1 mes gratis para "too_expensive")
- **Annual lock-in**: 10-11% descuento motiva contratos anuales

---

# 11. MI OPINION PERSONAL & CONCLUSIONES

## 11.1 Lo que esta BIEN

1. **La plataforma es genuinamente impresionante**. 16 integraciones reales, un wizard de creacion de campanas de 4 pasos completo, follow-ups, voicemails, calendar sync bidireccional, CRM sync automatico. Esto NO es un MVP -- es un producto serio.

2. **El pricing de entrada ($99) es un arma estrategica**. Synthflow cobra $375 por algo comparable. Callengo a $99 es un no-brainer para alguien que quiere probar AI calling sin comprometer un presupuesto grande.

3. **La propuesta "Call and Go" es real y diferenciadora**. He visto el codigo. Realmente un usuario puede subir contactos, elegir un agente, configurar en 4 pasos, y las llamadas salen solas. No hay otro producto en el mercado que sea tan facil Y tenga tantas integraciones.

4. **Los 3 agentes core cubren los use cases mas comunes**. Lead qualification, appointment confirmation, y data validation son exactamente lo que las SMBs necesitan. No se necesitan 20 agentes -- se necesitan 3 que funcionen bien.

5. **El sistema de billing es robusto**. Overage con Stripe metered billing, budget caps, alertas escalonadas, cancellation flow con retention -- esto es infraestructura de billing de nivel avanzado.

## 11.2 Lo que NECESITA MEJORA

1. **No hay enforcement backend de muchas cosas**:
   - Las integraciones no tienen middleware que verifique el plan antes del OAuth. Un usuario Free podria potencialmente llamar al endpoint de HubSpot OAuth directamente.
   - El max_concurrent_calls esta en la DB pero no se valida server-side antes de iniciar una llamada.
   - El max_call_duration se envia desde el frontend al API de Bland, pero no se valida server-side (un usuario podria modificar el request).

2. **El feature gating actual es inconsistente**:
   - `plan-features.ts` lista features que no existen ("Governance & logs", "Custom dialing pools")
   - La pagina de calendario tiene buen gating (`getCalendarFeatureAccess`) pero no tiene el tier "teams" (salta de business a enterprise)
   - La pagina de integraciones muestra plan requirements pero el backend no enforce el bloqueo

3. **No hay limite de agentes activos implementado**. Actualmente todos los planes pueden usar los 3 agentes simultaneamente. El sistema de `company_agents` existe pero no enforce un limite.

4. **Los precios actuales de overage para Teams/Enterprise son peligrosamente bajos**. $0.22 y $0.18/min con un COGS de $0.122 dejan margenes de 45% y 32%, muy por debajo del estandar SaaS de 55-70%.

## 11.3 Vamos por el Camino Correcto?

**Si, 100%.** La estructura de precios propuesta es solida:

- Los margenes estan ahora en el rango correcto (51-63% en base, 51-78% en overage)
- Los precios de entrada son competitivos ($99 vs $375 de Synthflow)
- La propuesta de valor es real (no es marketing humo)
- La estrategia de 1 agente para Free/Starter es elegante y motiva la expansion
- La decision de mostrar campanas a todos los tiers es correcta -- esconder el core product es un error clasico de SaaS

**Lo que cambiaria si pudiera**: El tier Enterprise a $1,499 es correcto para SMBs grandes pero si hay aspiraciones de enterprise real (Fortune 500), deberia haber un tier "Custom" que sea 100% cotizado. Los $1,499 funcionan como "top tier self-serve".

## 11.4 Riesgos a Considerar

1. **Dependencia total de Bland AI**: Si Bland AI sube precios o tiene downtime, Callengo esta expuesto. Considerar en el futuro tener un proveedor alternativo (Retell, Vapi) como fallback.

2. **El plan Free de 15 minutos es muy corto**: Esto es bueno para conversion pero malo si el usuario no entiende el producto en 5 llamadas. Considerar aumentar a 20-25 min si las metricas de conversion son bajas.

3. **Los CRMs enterprise (Salesforce, Dynamics) estan en Teams ($649)**: Esto puede ser un friction point para empresas que usan Salesforce pero son pequenas. Considerar bajar Salesforce a Business si los datos muestran demanda.

---

# 12. RECOMENDACIONES & GAP ANALYSIS

## 12.1 Implementacion Inmediata (Este Sprint)

| # | Accion | Prioridad | Impacto |
|---|--------|-----------|---------|
| 1 | Actualizar `subscription_plans` en DB | CRITICA | Precios correctos |
| 2 | Actualizar `plan-features.ts` | CRITICA | Feature gating correcto |
| 3 | Actualizar Stripe (products, prices, features) | CRITICA | Billing funcional |
| 4 | Actualizar `getCalendarFeatureAccess` para "teams" | ALTA | Calendar gating correcto |
| 5 | Implementar limite de agentes activos | ALTA | Diferenciacion Free/Starter vs Business+ |
| 6 | Actualizar wizard de campana con locks visuales | ALTA | UX de upgrade |
| 7 | Actualizar pagina de integraciones | ALTA | Consistencia |
| 8 | Actualizar pagina de billing | ALTA | Precios correctos en UI |

## 12.2 Implementacion Siguiente Sprint

| # | Accion | Prioridad |
|---|--------|-----------|
| 1 | Middleware de plan para rutas de integracion OAuth | ALTA |
| 2 | Validacion server-side de max_concurrent_calls | MEDIA |
| 3 | Validacion server-side de max_call_duration | MEDIA |
| 4 | Limite de follow-up attempts por plan | MEDIA |
| 5 | Export de datos gated (LOCKED para Free) | BAJA |

## 12.3 Features a Construir en el Futuro

| Feature | Tier | Justificacion |
|---------|------|---------------|
| API publica REST | Enterprise | Revenue adicional, stickiness |
| Nuevos agentes (Customer Satisfaction, Debt Collection) | Todos | Mas casos de uso = mas conversion |
| Dashboard de equipo con metricas por usuario | Teams+ | Justifica el precio de Teams |
| Call recording storage extendido | Business+ | Valor de retención |
| Webhooks bidireccionales | Starter+ | Flexibilidad para power users |
| Multi-idioma | Todos | Expansion a mercados no-English |

---

# APENDICE A: SQL MIGRATION

```sql
-- ============================================================================
-- MIGRATION: Update subscription plans to V3 pricing (March 2026)
-- ============================================================================
-- This migration updates:
-- 1. Pricing for Business, Teams, Enterprise plans
-- 2. Overage rates to maintain healthy margins
-- 3. Minutes included for Teams (2400 -> 2500)
-- 4. Extra seat price for Teams ($79 -> $69)
-- 5. Max agents enforcement (1 for Free/Starter)
-- 6. Plan features (remove fake features, add real ones)
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Update subscription_plans pricing
-- ============================================================================

-- Free plan: No price changes, clarify no overage
UPDATE subscription_plans SET
  price_per_extra_minute = 0,
  max_agents = 1,
  description = 'Try AI calling with 15 one-time minutes',
  features = '[
    "15 one-time minutes (no renewal)",
    "1 AI agent (locked after selection)",
    "Full campaign wizard experience",
    "Google Calendar + Google Meet",
    "Google Sheets import",
    "Call analytics & transcriptions",
    "Auto-rotated phone numbers"
  ]'::jsonb
WHERE slug = 'free';

-- Starter plan: No price changes, clarify 1 active agent
UPDATE subscription_plans SET
  max_agents = 1,
  description = 'For solo founders and freelancers getting started',
  features = '[
    "300 minutes per month",
    "1 active agent (switchable)",
    "Voicemail detection",
    "Follow-ups (max 2 attempts)",
    "Google Calendar + Google Meet",
    "Slack notifications",
    "Zoom meetings",
    "SimplyBook.me integration",
    "Webhooks (Zapier, Make, n8n)",
    "Google Sheets import",
    "Call analytics & transcriptions",
    "Auto-rotated phone numbers",
    "Async email support"
  ]'::jsonb
WHERE slug = 'starter';

-- Business plan: $279 -> $299 (price_annual = monthly equiv for annual billing)
UPDATE subscription_plans SET
  price_monthly = 299,
  price_annual = 269,
  price_per_extra_minute = 0.39,
  max_agents = -1,
  description = 'For growing businesses ready to scale',
  features = '[
    "1,200 minutes per month",
    "All agents simultaneously",
    "3 users included",
    "Smart follow-ups (max 5 attempts)",
    "Voicemail detection & smart handling",
    "Google Calendar + Microsoft Outlook",
    "Google Meet + Zoom + Microsoft Teams",
    "Slack notifications",
    "Twilio BYOP (own phone number)",
    "HubSpot CRM integration",
    "Pipedrive CRM integration",
    "Zoho CRM integration",
    "Clio (legal practice management)",
    "Webhooks (Zapier, Make, n8n)",
    "Google Sheets import",
    "Call analytics & transcriptions",
    "Auto-rotated phone numbers",
    "Priority email support"
  ]'::jsonb
WHERE slug = 'business';

-- Teams plan: $599 -> $649, 2400 -> 2500 min
UPDATE subscription_plans SET
  price_monthly = 649,
  price_annual = 579,
  minutes_included = 2500,
  price_per_extra_minute = 0.29,
  max_agents = -1,
  description = 'For teams that need collaboration and enterprise CRMs',
  features = '[
    "2,500 minutes per month",
    "All agents simultaneously",
    "5 users included ($69/extra seat)",
    "User permissions (admin/member)",
    "Advanced follow-ups (max 10 attempts)",
    "Voicemail detection & smart handling",
    "Google Calendar + Microsoft Outlook",
    "Google Meet + Zoom + Microsoft Teams",
    "Slack notifications",
    "Twilio BYOP (own phone number)",
    "Salesforce CRM integration",
    "Microsoft Dynamics 365 integration",
    "All Business integrations (Clio, HubSpot, Pipedrive, Zoho)",
    "Webhooks (Zapier, Make, n8n)",
    "Google Sheets import",
    "Call analytics & transcriptions",
    "Auto-rotated phone numbers",
    "Priority support"
  ]'::jsonb
WHERE slug = 'teams';

-- Enterprise plan: $1500 -> $1499
UPDATE subscription_plans SET
  price_monthly = 1499,
  price_annual = 1349,
  price_per_extra_minute = 0.25,
  max_agents = -1,
  description = 'For large organizations with critical operations',
  features = '[
    "6,000 minutes per month",
    "All agents simultaneously",
    "Unlimited users",
    "Unlimited follow-up attempts",
    "Voicemail detection & smart handling",
    "All calendar integrations",
    "All video integrations",
    "All communication integrations",
    "All CRM integrations (current + future)",
    "Twilio BYOP (own phone number)",
    "Webhooks (Zapier, Make, n8n)",
    "Google Sheets import",
    "Call analytics & transcriptions",
    "Auto-rotated phone numbers",
    "SLA guarantee",
    "Dedicated account manager",
    "Annual contract"
  ]'::jsonb
WHERE slug = 'enterprise';

-- ============================================================================
-- STEP 2: Add extra_seat_price column if not exists
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'extra_seat_price'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN extra_seat_price NUMERIC(10,2) DEFAULT 0;
  END IF;
END $$;

-- Set extra seat prices
UPDATE subscription_plans SET extra_seat_price = 0 WHERE slug IN ('free', 'starter');
UPDATE subscription_plans SET extra_seat_price = 0 WHERE slug = 'business'; -- Not available, 3 fixed
UPDATE subscription_plans SET extra_seat_price = 69 WHERE slug = 'teams';
UPDATE subscription_plans SET extra_seat_price = 0 WHERE slug = 'enterprise'; -- Unlimited

-- ============================================================================
-- STEP 3: Add max_follow_up_attempts column if not exists
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'max_follow_up_attempts'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN max_follow_up_attempts INTEGER DEFAULT 0;
  END IF;
END $$;

-- Set follow-up limits per plan
UPDATE subscription_plans SET max_follow_up_attempts = 0 WHERE slug = 'free';
UPDATE subscription_plans SET max_follow_up_attempts = 2 WHERE slug = 'starter';
UPDATE subscription_plans SET max_follow_up_attempts = 5 WHERE slug = 'business';
UPDATE subscription_plans SET max_follow_up_attempts = 10 WHERE slug = 'teams';
UPDATE subscription_plans SET max_follow_up_attempts = -1 WHERE slug = 'enterprise'; -- Unlimited

COMMIT;
```

---

# APENDICE B: STRIPE SYNC SCRIPT

El script existente en `scripts/stripe-sync.ts` necesita los siguientes cambios:

## Cambios en PLAN_FEATURES:

```typescript
const PLAN_FEATURES = {
  free: [
    ...COMMON_FEATURES,
    '15 one-time minutes',
    '3 min per call',
    '1 concurrent call',
    '1 active agent (locked)',
    '1 user',
    'No overage (upgrade required)',
    'Google Calendar + Meet',
    'Auto-rotated phone numbers',
  ],

  starter: [
    ...COMMON_FEATURES,
    '300 minutes per month',
    '3 min per call',
    '2 concurrent calls',
    '1 active agent (switchable)',
    '1 user',
    '$0.55/min overage',
    'Voicemail detection',
    'Follow-ups (max 2 attempts)',
    'Google Calendar + Meet + Zoom',
    'Slack notifications',
    'SimplyBook.me integration',
    'Webhooks (Zapier, Make, n8n)',
    'Async email support',
    'Auto-rotated phone numbers',
  ],

  business: [
    ...COMMON_FEATURES,
    '1,200 minutes per month',
    '5 min per call',
    '5 concurrent calls',
    'Unlimited agents',
    '3 users',
    '$0.39/min overage',
    'Smart follow-ups (max 5 attempts)',
    'Google Calendar + Outlook',
    'Meet + Zoom + Teams',
    'Slack notifications',
    'Twilio BYOP',
    'HubSpot CRM',
    'Pipedrive CRM',
    'Zoho CRM',
    'Clio (legal)',
    'Priority email support',
  ],

  teams: [
    ...COMMON_FEATURES,
    '2,500 minutes per month',
    '8 min per call',
    '10 concurrent calls',
    'Unlimited agents',
    '5 users ($69/extra)',
    '$0.29/min overage',
    'User permissions',
    'Advanced follow-ups (max 10)',
    'Salesforce CRM',
    'Dynamics 365',
    'All Business integrations',
    'Priority support',
  ],

  enterprise: [
    ...COMMON_FEATURES,
    '6,000+ minutes per month',
    '15 min per call',
    '25+ concurrent calls',
    'Unlimited agents & users',
    '$0.25/min overage',
    'Unlimited follow-ups',
    'All integrations (current + future)',
    'SLA guarantee',
    'Dedicated account manager',
    'Annual contract',
  ],
};
```

## Cambios en PRODUCT_DESCRIPTIONS:

```typescript
const PRODUCT_DESCRIPTIONS = {
  free: {
    short: 'Try AI calling - 15 one-time minutes',
    long: 'Try Callengo with 15 one-time minutes. Experience the full platform with 1 AI agent.',
    statement_descriptor: 'CALLENGO FREE',
  },
  starter: {
    short: 'Solo use - 300 minutes/month',
    long: 'Perfect for solo founders and freelancers. 300 minutes/month with voicemail, follow-ups, Slack, and Zoom.',
    statement_descriptor: 'CALLENGO STARTER',
  },
  business: {
    short: 'Growing teams - 1,200 minutes/month',
    long: 'For growing businesses. Unlimited agents, 3 users, smart follow-ups, CRM integrations (HubSpot, Pipedrive, Zoho).',
    statement_descriptor: 'CALLENGO BUSINESS',
  },
  teams: {
    short: 'Collaboration - 2,500 minutes/month',
    long: 'For collaborative teams. 5 users, user permissions, enterprise CRMs (Salesforce, Dynamics 365), all Business integrations.',
    statement_descriptor: 'CALLENGO TEAMS',
  },
  enterprise: {
    short: 'Enterprise - 6,000+ minutes/month',
    long: 'For large organizations. Unlimited users, SLA guarantee, dedicated account manager, all integrations.',
    statement_descriptor: 'CALLENGO ENTERPRISE',
  },
};
```

## Precios que el script debe crear:

| Plan | USD Monthly | USD Annual | EUR Monthly | EUR Annual | GBP Monthly | GBP Annual |
|------|-----------|----------|-----------|----------|-----------|----------|
| Starter | $99 | $1,068 | EUR91 | EUR983 | GBP78 | GBP844 |
| Business | $299 | $3,228 | EUR275 | EUR2,970 | GBP236 | GBP2,550 |
| Teams | $649 | $6,948 | EUR597 | EUR6,392 | GBP513 | GBP5,489 |
| Enterprise | $1,499 | $16,188 | EUR1,379 | EUR14,893 | GBP1,184 | GBP12,789 |

## Coupons (sin cambios):

| Codigo | Descuento | Duracion | Max Usos |
|--------|-----------|----------|----------|
| TOTAL100 | 100% | Forever | 5 |
| LAUNCH50 | 50% | 3 meses | 100 |
| EARLY25 | 25% | 1 vez | 500 |
| ANNUAL20 | 20% | Forever | Sin limite (annual only) |

---

# APENDICE C: CAMBIOS EN EL CODIGO DEL APP

## C.1 `src/config/plan-features.ts` (Completo)

Reescritura completa eliminando features falsas y alineando con la nueva estructura.

## C.2 `src/types/calendar.ts` - `getCalendarFeatureAccess()`

Agregar case 'teams' (actualmente salta de 'business' a 'enterprise').

## C.3 `src/components/agents/CalendarConfigStep.tsx`

Agregar locks visuales para features bloqueadas por plan.

## C.4 `src/components/settings/BillingSettings.tsx`

Actualizar plan cards con nuevos precios y features.

## C.5 `src/components/integrations/IntegrationsPage.tsx`

Actualizar `requiredPlan` para nuevas asignaciones de integraciones.

## C.6 `src/components/agents/AgentsLibrary.tsx`

Implementar limite de 1 agente activo para Free/Starter.

Todos estos cambios se implementan en los archivos del codebase directamente.

---

**FIN DEL DOCUMENTO DEFINITIVO**

*Este documento es la fuente de verdad para la estructura de precios, features, y estrategia de Callengo. Reemplaza todos los documentos anteriores.*
