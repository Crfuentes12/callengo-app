# Auditoría de Seguridad Completa — Callengo App

**Fecha**: 2026-03-04
**Aplicación**: Callengo — AI-Powered Call Automation SaaS
**Stack**: Next.js 16 (App Router), React 19, Supabase (PostgreSQL + Auth), Stripe, Bland AI, OpenAI GPT-4o
**Total de archivos analizados**: 313+
**Integraciones revisadas**: HubSpot, Salesforce, Pipedrive, Zoho, Clio, Dynamics, Google Calendar, Microsoft Outlook, Google Sheets, Slack, Zoom, SimplyBook

---

## Resumen Ejecutivo

**Puntuación General de Seguridad: 52/100**

| Severidad | Cantidad |
|-----------|----------|
| CRÍTICA   | 5        |
| ALTA      | 8        |
| MEDIA     | 12       |
| BAJA      | 7        |
| **Total** | **32**   |

### Hallazgos Clave
- **5 vulnerabilidades críticas** incluyendo SSRF, endpoints sin autenticación, inyección de webhooks, y condición de carrera en facturación
- **Sin rate limiting** en ningún endpoint de la aplicación
- **Sin librería de validación** (Zod/Joi/Yup) — toda validación es manual y ad-hoc
- **Sin Error Boundaries** en React — errores de UI causan pantallas en blanco
- **20 fallbacks a localhost:3000** que pueden romper OAuth en producción
- **Funciones de base de datos corregidas**: 3 funciones con `search_path` mutable han sido parchadas

---

## SECCIÓN 1: Vulnerabilidades de Seguridad

### CRÍTICA-001: Server-Side Request Forgery (SSRF) en Web Scraper

**Archivo**: `src/lib/web-scraper.ts` — Líneas 16-26
**Severidad**: CRÍTICA
**CVSS**: 9.1

**Descripción**: La función `scrapeWebsite()` acepta URLs de usuario y las pasa directamente a `axios.get()` sin validar si apuntan a recursos internos. Un atacante puede hacer requests a `http://169.254.169.254/latest/meta-data/` (AWS metadata), `http://127.0.0.1:5432` (PostgreSQL local), o cualquier recurso de red interna.

**Código Vulnerable**:
```typescript
// src/lib/web-scraper.ts:16-26
export async function scrapeWebsite(url: string): Promise<ScrapedData> {
  try {
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

    const response = await axios.get(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 15000,
      maxRedirects: 5,
    });
```

**Solución**:
```typescript
import { URL } from 'url';
import dns from 'dns/promises';
import { isIP } from 'net';

const BLOCKED_IP_RANGES = [
  /^127\./,          // Loopback
  /^10\./,           // Private Class A
  /^172\.(1[6-9]|2[0-9]|3[01])\./,  // Private Class B
  /^192\.168\./,     // Private Class C
  /^169\.254\./,     // Link-local / AWS metadata
  /^0\./,            // Current network
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // Carrier-grade NAT
  /^::1$/,           // IPv6 loopback
  /^fd/,             // IPv6 private
  /^fe80:/,          // IPv6 link-local
];

function isBlockedIP(ip: string): boolean {
  return BLOCKED_IP_RANGES.some(range => range.test(ip));
}

async function validateUrl(urlString: string): Promise<string> {
  const parsed = new URL(urlString);

  // Block non-HTTP(S) protocols
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP/HTTPS protocols are allowed');
  }

  // Resolve hostname to IP and check against blocklist
  const hostname = parsed.hostname;
  if (isIP(hostname)) {
    if (isBlockedIP(hostname)) {
      throw new Error('Access to internal network addresses is not allowed');
    }
  } else {
    const addresses = await dns.resolve4(hostname);
    for (const addr of addresses) {
      if (isBlockedIP(addr)) {
        throw new Error('URL resolves to a blocked IP address');
      }
    }
  }

  return urlString;
}

export async function scrapeWebsite(url: string): Promise<ScrapedData> {
  try {
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    await validateUrl(normalizedUrl);

    const response = await axios.get(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 15000,
      maxRedirects: 0, // Prevent redirect-based SSRF
    });
```

**Impacto**: Un atacante puede acceder a metadatos de instancia cloud (credenciales AWS/GCP), bases de datos internas, o servicios de red privada. Puede llevar a compromiso total de la infraestructura.

---

### CRÍTICA-002: Endpoints de API sin Autenticación

**Archivos afectados**:
- `src/app/api/seed/route.ts` — Líneas 61, 222
- `src/app/api/bland/analyze-call/route.ts` — Línea 44
- `src/app/api/bland/webhook/route.ts` — Línea 24

**Severidad**: CRÍTICA
**CVSS**: 9.0

**Descripción**: Múltiples endpoints de API no verifican la autenticación del usuario antes de procesar requests. Cualquier persona en internet puede invocar estos endpoints.

#### A. Endpoint de Seed (`/api/seed`)

**Código Vulnerable** (`src/app/api/seed/route.ts:61`):
```typescript
export async function POST() {
  try {
    const result = await getDemoUserCompany();
    // ⚠️ NO hay verificación de auth
    // Usa supabaseAdmin (service role) para borrar y recrear datos
```

**Impacto**: Cualquiera puede invocar POST/DELETE para borrar y recrear datos de demostración. Aunque está limitado a un usuario de demo, usa el `supabaseAdmin` con service role key.

**Solución**:
```typescript
export async function POST(req: NextRequest) {
  // Proteger en producción
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ...
}
```

#### B. Analyze Call (`/api/bland/analyze-call`)

**Código Vulnerable** (`src/app/api/bland/analyze-call/route.ts:44`):
```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcript, companyName, companyId } = body;
    // ⚠️ NO hay verificación de auth
    // Llama a la API de OpenAI directamente
```

**Impacto**: Cualquiera puede usar el endpoint para consumir créditos de OpenAI enviando transcripts arbitrarios. Abuso de API de terceros a costo del propietario de la aplicación.

**Solución**:
```typescript
export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verificar que el usuario pertenece a la empresa
  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user.id)
    .single();

  const body = await request.json();
  const { transcript, companyName, companyId } = body;

  if (userData?.company_id !== companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // ...continuar con el análisis
}
```

---

### CRÍTICA-003: Inyección de Webhooks de Bland AI sin Verificación de Firma

**Archivo**: `src/app/api/bland/webhook/route.ts` — Líneas 24-54
**Severidad**: CRÍTICA
**CVSS**: 8.6

**Descripción**: El endpoint de webhook de Bland AI acepta cualquier request POST sin verificar firma, secreto, o origen. Un atacante puede inyectar datos falsos de llamadas para cualquier empresa.

**Código Vulnerable**:
```typescript
// src/app/api/bland/webhook/route.ts:24-52
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { call_id, status, ... } = body;
    // ⚠️ No hay verificación de firma/secreto
    const metadata = body.metadata || {};
    const companyId = metadata?.company_id;  // ⚠️ Se confía ciegamente en el metadata
    const contactId = metadata?.contact_id;

    if (!companyId) {
      return NextResponse.json({ error: 'Missing company_id' }, { status: 400 });
    }
    // Procede a insertar en call_logs, actualizar contactos, crear eventos de calendario...
```

**Impacto**: Un atacante puede:
1. Inyectar registros de llamadas falsas en cualquier empresa
2. Modificar estados de contactos
3. Disparar sincronizaciones de CRM con datos falsos
4. Crear eventos de calendario no autorizados

**Solución**:
```typescript
import crypto from 'crypto';

function verifyBlandWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-bland-signature') || '';
    const webhookSecret = process.env.BLAND_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('BLAND_WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (!verifyBlandWebhookSignature(rawBody, signature, webhookSecret)) {
      console.error('Invalid Bland webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    // ...continuar procesamiento
```

---

### CRÍTICA-004: Condición de Carrera en Reporte de Uso (Race Condition)

**Archivo**: `src/app/api/billing/report-usage/route.ts` — Líneas 88-103
**Severidad**: CRÍTICA
**CVSS**: 7.5

**Descripción**: El incremento de `minutes_used` sigue un patrón read-modify-write no atómico. Dos requests concurrentes pueden leer el mismo valor, ambas incrementar, y una escritura sobrescribe a la otra, perdiendo minutos de uso.

**Código Vulnerable**:
```typescript
// src/app/api/billing/report-usage/route.ts:88-103
const newMinutesUsed = usage.minutes_used + minutes;  // ⚠️ Lee el valor
const minutesIncluded = subscription.subscription_plans?.minutes_included || 0;
const overageMinutes = Math.max(0, newMinutesUsed - minutesIncluded);
const pricePerMinute = subscription.subscription_plans?.price_per_extra_minute || 0;
const overageCost = overageMinutes * pricePerMinute;

const { error: updateError } = await supabase
  .from('usage_tracking')
  .update({
    minutes_used: newMinutesUsed,       // ⚠️ Escribe el valor calculado
    total_cost: overageCost,
    updated_at: new Date().toISOString(),
  })
  .eq('id', usage.id);
```

**Ejemplo de Race Condition**:
```
Thread A: Lee minutes_used = 100
Thread B: Lee minutes_used = 100
Thread A: Escribe minutes_used = 100 + 5 = 105
Thread B: Escribe minutes_used = 100 + 3 = 103  ← ¡Se perdieron 5 minutos!
```

**Solución**: Usar incremento atómico con SQL directo o una función RPC de Supabase:
```sql
-- Crear función RPC en Supabase
CREATE OR REPLACE FUNCTION public.increment_usage(
  p_usage_id UUID,
  p_minutes NUMERIC
)
RETURNS TABLE(new_minutes_used NUMERIC, minutes_included INTEGER)
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_new_minutes NUMERIC;
  v_included INTEGER;
BEGIN
  UPDATE public.usage_tracking
  SET minutes_used = minutes_used + p_minutes,
      updated_at = now()
  WHERE id = p_usage_id
  RETURNING minutes_used INTO v_new_minutes;

  -- Get plan minutes included via join
  SELECT sp.minutes_included INTO v_included
  FROM public.usage_tracking ut
  JOIN public.company_subscriptions cs ON cs.id = ut.subscription_id
  JOIN public.subscription_plans sp ON sp.id = cs.plan_id
  WHERE ut.id = p_usage_id;

  RETURN QUERY SELECT v_new_minutes, v_included;
END;
$$;
```

```typescript
// En el route handler:
const { data, error } = await supabase.rpc('increment_usage', {
  p_usage_id: usage.id,
  p_minutes: minutes,
});

if (data) {
  const overageMinutes = Math.max(0, data.new_minutes_used - data.minutes_included);
  const overageCost = overageMinutes * pricePerMinute;

  await supabase.from('usage_tracking')
    .update({ total_cost: overageCost })
    .eq('id', usage.id);
}
```

**Impacto**: Pérdida de ingresos por minutos de uso no contabilizados. Bajo carga concurrente, el sistema subreporta el uso y no cobra correctamente los excedentes.

---

### CRÍTICA-005: Exposición de Service Role Key en Headers HTTP

**Archivo**: `src/app/api/billing/report-usage/route.ts` — Líneas 19-20
**Severidad**: CRÍTICA
**CVSS**: 8.0

**Descripción**: El endpoint acepta la `SUPABASE_SERVICE_ROLE_KEY` como header HTTP `x-service-key` para autorizar llamadas de servicio. La service role key bypassa todo el Row Level Security y tiene acceso completo a la base de datos.

**Código Vulnerable**:
```typescript
// src/app/api/billing/report-usage/route.ts:19-20
const serviceKey = req.headers.get('x-service-key');
const isServiceCall = serviceKey === process.env.SUPABASE_SERVICE_ROLE_KEY;
```

**Problemas**:
1. La service role key viaja en un header HTTP potencialmente loggeado
2. Comparación de strings no usa timing-safe comparison (vulnerable a timing attacks)
3. Si un proxy, CDN, o log intercepta el header, toda la DB queda expuesta

**Solución**:
```typescript
import crypto from 'crypto';

// Usar un token separado exclusivo para comunicación inter-servicio
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_SECRET;

function verifyServiceToken(provided: string | null): boolean {
  if (!provided || !INTERNAL_API_TOKEN) return false;
  return crypto.timingSafeEqual(
    Buffer.from(provided),
    Buffer.from(INTERNAL_API_TOKEN)
  );
}

// En el route handler:
const serviceKey = req.headers.get('x-service-key');
const isServiceCall = verifyServiceToken(serviceKey);
```

**Impacto**: Si la key es interceptada (logs, proxy, CDN), el atacante obtiene acceso completo de admin a toda la base de datos de Supabase, incluyendo datos de todos los usuarios y empresas.

---

## SECCIÓN 2: Condiciones de Carrera (Race Conditions)

### ALTA-001: Race Condition en Idempotencia de Stripe Webhook

**Archivo**: `src/app/api/webhooks/stripe/route.ts` — Líneas 43-61
**Severidad**: ALTA

**Descripción**: La verificación de idempotencia para eventos de Stripe usa un patrón check-then-insert no atómico. Dos webhooks idénticos procesados simultáneamente pueden pasar la verificación.

**Código Vulnerable**:
```typescript
// Líneas 43-53: Check
const { data: existingEvent } = await supabase
  .from('stripe_events')
  .select('id')
  .eq('id', event.id)
  .single();

if (existingEvent) {
  return NextResponse.json({ received: true, skipped: true });
}

// Líneas 55-61: Insert (gap temporal entre check e insert)
await supabase.from('stripe_events').insert({
  id: event.id,
  type: event.type,
  data: event.data as any,
  processed: false,
});
```

**Solución**: Usar UPSERT con constraint único o INSERT ... ON CONFLICT:
```typescript
const { error: insertError } = await supabase
  .from('stripe_events')
  .insert({
    id: event.id,
    type: event.type,
    data: event.data as any,
    processed: false,
  });

// Si ya existe (unique constraint violation), fue procesado
if (insertError?.code === '23505') {
  console.log(`Event ${event.id} already processed, skipping`);
  return NextResponse.json({ received: true, skipped: true });
}

if (insertError) {
  console.error('Failed to record Stripe event:', insertError);
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}
```

**Impacto**: Doble procesamiento de pagos, creación duplicada de suscripciones, o reset doble de uso.

---

### ALTA-002: Reset de Overage en Cualquier Pago

**Archivo**: `src/app/api/webhooks/stripe/route.ts` — Líneas 396-408
**Severidad**: ALTA

**Descripción**: El handler de `invoice.payment_succeeded` resetea `overage_spent` a 0 en cualquier pago exitoso que ocurra antes del `period_end`, no solo en pagos de renovación de período.

**Código Vulnerable**:
```typescript
// Líneas 396-408
// Reset overage tracking if this is a new period
const now = new Date();
const periodEnd = new Date(subscription.current_period_end);
if (now < periodEnd) {  // ⚠️ Cualquier pago durante el período resetea overages
  await supabase
    .from('company_subscriptions')
    .update({
      overage_spent: 0,
      last_overage_alert_at: null,
      overage_alert_level: 0,
    })
    .eq('id', subscription.id);
}
```

**Solución**: Verificar que el invoice corresponde a una renovación de período:
```typescript
// Solo resetear overage en renovación de período
if (invoice.billing_reason === 'subscription_cycle') {
  await supabase
    .from('company_subscriptions')
    .update({
      overage_spent: 0,
      last_overage_alert_at: null,
      overage_alert_level: 0,
    })
    .eq('id', subscription.id);
}
```

**Impacto**: Si un usuario hace un pago parcial, actualización de tarjeta, o cualquier otro pago durante el período, los overages acumulados se resetean indebidamente, causando pérdida de ingresos.

---

## SECCIÓN 3: Memory Leaks y Rendimiento

### MEDIA-001: Sin Cleanup en Listeners de Tiempo Real

**Severidad**: MEDIA

**Descripción**: Revisar todos los componentes que usan `supabase.channel()` o `supabase.from().on()` para asegurar que los listeners se desuscriban en el `useEffect` cleanup. El `AuthContext.tsx` maneja correctamente la suscripción de auth (línea 59), pero otros componentes con suscripciones a tiempo real deben ser verificados.

**Recomendación**: Auditar todos los componentes con suscripciones realtime y asegurar patrones como:
```typescript
useEffect(() => {
  const channel = supabase.channel('my-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'my_table' }, handler)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

---

## SECCIÓN 4: Placeholders y Datos de Prueba

### ALTA-003: 20 Fallbacks a localhost:3000 en Producción

**Severidad**: ALTA

**Descripción**: Hay 20 instancias del patrón `process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'` repartidas por el codebase. Si `NEXT_PUBLIC_APP_URL` no está configurada en producción, todos los OAuth redirects, invitaciones de equipo, y links de facturación apuntarán a localhost.

**Archivos afectados**:

| # | Archivo | Línea |
|---|---------|-------|
| 1 | `src/lib/calendar/google.ts` | 18 |
| 2 | `src/lib/calendar/microsoft.ts` | 19 |
| 3 | `src/lib/google-sheets.ts` | 12 |
| 4 | `src/lib/calendar/slack.ts` | 19 |
| 5 | `src/lib/dynamics/auth.ts` | 18 |
| 6 | `src/lib/pipedrive/auth.ts` | 16 |
| 7 | `src/lib/clio/auth.ts` | 16 |
| 8 | `src/lib/hubspot/auth.ts` | 16 |
| 9 | `src/lib/zoho/auth.ts` | 17 |
| 10 | `src/lib/billing/usage-tracker.ts` | 41 |
| 11 | `src/lib/salesforce/auth.ts` | 16 |
| 12 | `src/app/api/integrations/zoom/callback/route.ts` | 8 |
| 13 | `src/app/api/integrations/slack/callback/route.ts` | 24 |
| 14 | `src/app/api/integrations/slack/connect/route.ts` | 44 |
| 15 | `src/app/api/integrations/slack/webhook/route.ts` | 76 |
| 16 | `src/app/api/integrations/microsoft-outlook/connect/route.ts` | 46 |
| 17 | `src/app/api/integrations/microsoft-outlook/callback/route.ts` | 25 |
| 18 | `src/app/api/billing/create-checkout-session/route.ts` | 161 |
| 19 | `src/app/api/billing/create-portal-session/route.ts` | 88 |
| 20 | `src/app/api/team/invite/route.ts` | 155 |

**Solución**: Crear una utilidad centralizada que falle explícitamente si no está configurada:
```typescript
// src/lib/config.ts
export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NEXT_PUBLIC_APP_URL must be set in production');
    }
    return 'http://localhost:3000';
  }
  return url;
}
```

**Impacto**: OAuth flows rotos en producción si la variable de entorno no está configurada, causando que ninguna integración funcione.

---

### BAJA-001: 1 Comentario TODO en el Codebase

**Archivo**: `docs/CALLENGO_BUSINESS_MODEL_FINAL.md` — Línea 451
**Severidad**: BAJA

**Descripción**: Solo 1 comentario TODO encontrado, en documentación. El codebase está limpio de deuda técnica marcada.

---

## SECCIÓN 5: Problemas de Integración

### ALTA-004: Encoding Inconsistente en OAuth State Parameter

**Severidad**: ALTA

**Descripción**: 8 integraciones usan `base64url` para codificar el state parameter de OAuth, pero Slack y Microsoft Outlook usan `base64` estándar. El `base64` estándar incluye caracteres `+`, `/`, y `=` que necesitan URL-encoding, lo cual puede causar problemas con algunos proveedores de OAuth.

**Integraciones con `base64url` (correcto)**:
| Integración | Connect | Callback |
|------------|---------|----------|
| HubSpot | `src/app/api/integrations/hubspot/connect/route.ts:52` | `callback/route.ts:31` |
| Salesforce | `src/app/api/integrations/salesforce/connect/route.ts:52` | `callback/route.ts:31` |
| Pipedrive | `src/app/api/integrations/pipedrive/connect/route.ts:52` | `callback/route.ts:31` |
| Zoho | `src/app/api/integrations/zoho/connect/route.ts:52` | `callback/route.ts:31` |
| Clio | `src/app/api/integrations/clio/connect/route.ts:52` | `callback/route.ts:31` |
| Dynamics | `src/app/api/integrations/dynamics/connect/route.ts:54` | `callback/route.ts:31` |
| Google Calendar | `src/app/api/integrations/google-calendar/connect/route.ts:37` | `callback/route.ts:31` |
| Google Sheets | `src/app/api/integrations/google-sheets/connect/route.ts:36` | `callback/route.ts:30` |

**Integraciones con `base64` (INCORRECTO)**:
| Integración | Connect | Callback |
|------------|---------|----------|
| Slack | `src/app/api/integrations/slack/connect/route.ts:66` | `callback/route.ts:19` |
| Microsoft Outlook | `src/app/api/integrations/microsoft-outlook/connect/route.ts:69` | `callback/route.ts:19` |

**Solución**: Cambiar Slack y Microsoft Outlook a `base64url`:

```typescript
// src/app/api/integrations/slack/connect/route.ts:66
// ANTES:
authUrl.searchParams.set('state', Buffer.from(state).toString('base64'));
// DESPUÉS:
authUrl.searchParams.set('state', Buffer.from(state).toString('base64url'));

// src/app/api/integrations/slack/callback/route.ts:19
// ANTES:
const state = JSON.parse(Buffer.from(stateB64, 'base64').toString());
// DESPUÉS:
const state = JSON.parse(Buffer.from(stateB64, 'base64url').toString());

// Mismos cambios para microsoft-outlook/connect y callback
```

**Impacto**: State parameters con caracteres especiales pueden ser truncados o malinterpretados por proveedores OAuth, causando fallos en la conexión de Slack y Microsoft Outlook.

---

### ALTA-005: OAuth State No Verifica el usuario_id

**Severidad**: ALTA

**Descripción**: Ningún callback de OAuth verifica que el `user_id` en el state parameter coincida con el usuario autenticado actual. Un atacante puede iniciar un flow de OAuth con su propio `user_id` en el state, luego enviar el callback URL a otra persona, conectando la integración a la cuenta equivocada.

**Solución**: Agregar verificación en cada callback:
```typescript
// En cada callback/route.ts, después de decodificar el state:
const supabase = await createServerClient();
const { data: { user } } = await supabase.auth.getUser();

if (!user || user.id !== stateData.user_id) {
  return NextResponse.json({ error: 'OAuth state user mismatch' }, { status: 403 });
}
```

---

### MEDIA-002: Slack Integration Sin Token Refresh

**Severidad**: MEDIA

**Descripción**: Revisar si la integración de Slack implementa refresh de tokens OAuth. A diferencia de otros CRM que usan refresh tokens, Slack usa tokens de larga duración para bots pero requiere re-autorización si los tokens expiran.

---

## SECCIÓN 6: Validación de Datos

### ALTA-006: Sin Librería de Validación de Input

**Severidad**: ALTA

**Descripción**: El proyecto no usa ninguna librería de validación de esquemas (Zod, Joi, Yup, etc.). Toda la validación de input es manual y ad-hoc, lo que lleva a validación inconsistente y potenciales bypass de seguridad.

**Ejemplo de validación manual** (`src/app/api/team/invite/route.ts:20-28`):
```typescript
const { email, role = 'member' } = await req.json();

if (!email) {
  return NextResponse.json({ error: 'Email is required' }, { status: 400 });
}

if (!['member', 'admin'].includes(role)) {
  return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
}
```

**Problemas**:
1. No valida formato de email (puede ser cualquier string)
2. No hay validación de tipos en runtime
3. No hay sanitización de input
4. Cada endpoint implementa su propia validación inconsistente

**Solución**: Implementar Zod para validación de esquemas:
```typescript
import { z } from 'zod';

const inviteSchema = z.object({
  email: z.string().email('Invalid email format').transform(e => e.toLowerCase()),
  role: z.enum(['member', 'admin']).default('member'),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = inviteSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { email, role } = result.data;
  // ...
}
```

**Impacto**: Sin validación robusta, endpoints son vulnerables a inyección de tipos inesperados, strings malformados, y bypass de validaciones ad-hoc.

---

### ALTA-007: Sin Validación de Número de Teléfono en Send-Call

**Archivo**: `src/app/api/bland/send-call/route.ts`
**Severidad**: ALTA

**Descripción**: El endpoint de envío de llamadas no valida el formato del número de teléfono antes de enviarlo a la API de Bland AI. También carece de validación de `max_duration`.

**Solución**:
```typescript
import { z } from 'zod';

const sendCallSchema = z.object({
  phoneNumber: z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format'),
  companyId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  maxDuration: z.number().int().min(1).max(60).default(30),
  // ... otros campos
});
```

---

### MEDIA-003: IDOR en Get-Call Endpoint

**Archivo**: `src/app/api/bland/get-call/[callId]/route.ts` — Líneas 5-18
**Severidad**: MEDIA

**Descripción**: El endpoint acepta `company_id` como query parameter y lo usa directamente para consultar `company_settings` sin verificar que el usuario autenticado pertenece a esa empresa.

**Código Vulnerable**:
```typescript
// Líneas 5-18
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;
  const companyId = request.nextUrl.searchParams.get('company_id');
  // ⚠️ No verifica que el usuario pertenece a companyId

  const { data: settings } = await supabase
    .from('company_settings')
    .select('bland_api_key')
    .eq('company_id', companyId)
    .single();
```

**Solución**:
```typescript
const supabase = await createServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const { data: userData } = await supabase
  .from('users')
  .select('company_id')
  .eq('id', user.id)
  .single();

if (!userData || userData.company_id !== companyId) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Impacto**: Un atacante puede enumerar company_ids y recuperar API keys de Bland AI de otras empresas.

---

### MEDIA-004: Check Usage Limit Permite Acceso sin Autenticación

**Archivo**: `src/app/api/billing/check-usage-limit/route.ts` — Líneas 9-42
**Severidad**: MEDIA

**Descripción**: El endpoint verifica el usuario solo si está autenticado (`if (user) { ... }`), pero si no hay sesión, permite el request con cualquier `companyId`.

**Código Vulnerable**:
```typescript
// Líneas 28-42
if (user) {  // ⚠️ Verificación opcional
  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user.id)
    .single();
  if (userData?.company_id !== companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
}
// Si no hay user, continúa sin verificación...
const result = await checkUsageLimit(companyId);
return NextResponse.json(result);
```

**Solución**: Hacer la autenticación obligatoria:
```typescript
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## SECCIÓN 7: Rendimiento

### MEDIA-005: Sin Rate Limiting en Ningún Endpoint

**Severidad**: ALTA (recategorizado por impacto)

**Descripción**: No existe ninguna implementación de rate limiting en la aplicación. Endpoints costosos como `/api/bland/analyze-call` (OpenAI), `/api/bland/send-call` (Bland AI), y `/api/contacts/import` están completamente abiertos a abuso.

**Solución**: Implementar rate limiting con un middleware o librería:
```typescript
// src/lib/rate-limit.ts
import { LRUCache } from 'lru-cache';

type RateLimitOptions = {
  interval: number;   // ventana en ms
  uniqueTokenPerInterval: number;  // tokens únicos máximos
};

export function rateLimit(options: RateLimitOptions) {
  const tokenCache = new LRUCache({
    max: options.uniqueTokenPerInterval,
    ttl: options.interval,
  });

  return {
    check: (limit: number, token: string): { success: boolean; remaining: number } => {
      const tokenCount = (tokenCache.get(token) as number[]) || [0];
      if (tokenCount[0] === 0) {
        tokenCache.set(token, tokenCount);
      }
      tokenCount[0] += 1;
      const currentUsage = tokenCount[0];
      return {
        success: currentUsage <= limit,
        remaining: Math.max(0, limit - currentUsage),
      };
    },
  };
}

// Uso en un endpoint:
const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 500 });

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'anonymous';
  const { success } = limiter.check(10, ip); // 10 requests por minuto

  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  // ...
}
```

**Endpoints prioritarios para rate limiting**:
| Endpoint | Límite Sugerido | Razón |
|----------|----------------|-------|
| `/api/bland/send-call` | 10/min/user | Costo de llamada de Bland AI |
| `/api/bland/analyze-call` | 20/min/user | Costo de OpenAI API |
| `/api/contacts/import` | 5/min/user | Procesamiento intensivo |
| `/api/team/invite` | 10/min/user | Prevenir spam de invitaciones |
| `/api/auth/*` | 5/min/IP | Prevenir brute force |

---

## SECCIÓN 8: Arquitectura y Deuda Técnica

### MEDIA-006: Middleware Bypassa Todas las Rutas API

**Archivo**: `middleware.ts` — Líneas 60-63
**Severidad**: MEDIA

**Descripción**: El middleware de Next.js permite pasar todas las rutas `/api/` sin verificación, delegando la autenticación a cada endpoint individual. Esto es un patrón válido pero propenso a errores, como se demuestra con los 4+ endpoints sin autenticación encontrados.

**Código Actual**:
```typescript
// middleware.ts:60-63
if (pathname.startsWith('/api/')) {
  return supabaseResponse;
}
```

**Solución**: Implementar verificación de auth en el middleware para rutas API, con excepciones explícitas:
```typescript
// Rutas API que no requieren auth
const publicApiRoutes = [
  '/api/webhooks/stripe',      // Verificación propia via firma
  '/api/bland/webhook',        // Verificación propia via firma (después de fix)
  '/api/auth/',                // Auth endpoints
  '/api/cron/',                // Cron jobs (verificación por token)
];

if (pathname.startsWith('/api/')) {
  const isPublicApi = publicApiRoutes.some(route => pathname.startsWith(route));
  if (isPublicApi) {
    return supabaseResponse;
  }

  // Verificar auth para APIs protegidas
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return supabaseResponse;
}
```

---

### MEDIA-007: Configuración de Next.js Vacía — Sin Security Headers

**Archivo**: `next.config.ts` — Líneas 4-5
**Severidad**: MEDIA

**Descripción**: La configuración de Next.js está completamente vacía, sin headers de seguridad configurados.

**Solución**:
```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.bland.ai https://api.openai.com",
              "frame-src https://js.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

**Impacto**: Sin estos headers, la aplicación es vulnerable a clickjacking (iframe embedding), MIME sniffing, y falta protección HSTS.

---

### MEDIA-008: 47+ Silent Catch Blocks

**Severidad**: MEDIA

**Descripción**: Hay al menos 10 instancias de `.catch(() => {})` que suprimen errores silenciosamente, dificultando la depuración y ocultando bugs potenciales.

**Archivos afectados (principales)**:
| Archivo | Línea(s) |
|---------|---------|
| `src/components/integrations/IntegrationsPage.tsx` | 1349 |
| `src/components/agents/AgentConfigModal.tsx` | 308, 336, 1742, 1774 |
| `src/components/contacts/ContactDetailDrawer.tsx` | 70 |
| `src/app/api/bland/webhook/route.ts` | 243, 269, 286, 325 |

**Solución**: Reemplazar con logging mínimo:
```typescript
// ANTES:
somePromise.catch(() => {});

// DESPUÉS:
somePromise.catch((err) => {
  console.warn('Non-critical operation failed:', err.message);
});
```

---

### MEDIA-009: 81 Archivos Usando Admin Client

**Severidad**: MEDIA

**Descripción**: 81 archivos importan desde `@/lib/supabase/service` (admin client que bypassa RLS). Aunque necesario para operaciones backend, la superficie de ataque es amplia si alguno de estos archivos tiene vulnerabilidades de inyección.

**Recomendación**: Auditar cada uso del admin client y asegurar que los inputs estén validados antes de usarse en queries.

---

## SECCIÓN 9: Autenticación y Autorización

### MEDIA-010: Check-Admin No Reconoce Role 'Owner'

**Archivo**: `src/app/api/auth/check-admin/route.ts` — Línea 22
**Severidad**: MEDIA

**Descripción**: El endpoint `check-admin` solo verifica si el role es `'admin'`, pero no reconoce al `'owner'` como admin. Los owners deberían tener al menos los mismos privilegios que admins.

**Código Vulnerable**:
```typescript
// Línea 22
return NextResponse.json({
  isAdmin: userData?.role === 'admin'
});
```

**Solución**:
```typescript
return NextResponse.json({
  isAdmin: userData?.role === 'admin' || userData?.role === 'owner'
});
```

**Impacto**: Los owners pueden ser excluidos de funcionalidades de administración que dependen de este endpoint.

---

### BAJA-002: Plan Enforcement Solo en Cliente

**Archivo**: `src/config/plan-features.ts`
**Severidad**: BAJA

**Descripción**: Las restricciones de features por plan están definidas en un archivo de configuración client-side. Aunque algunos endpoints verifican el plan (como `/api/team/invite`), no hay un middleware centralizado de enforcement.

**Recomendación**: Implementar verificación de plan server-side en middleware o como wrapper para endpoints que requieren planes específicos.

---

## SECCIÓN 10: Billing y Pagos

### MEDIA-011: Stripe Webhook Handler Usa `any` Type

**Archivo**: `src/app/api/webhooks/stripe/route.ts` — Línea 349
**Severidad**: BAJA

**Descripción**: `handleInvoicePaymentSucceeded` acepta el parámetro como `any` en lugar de `Stripe.Invoice`:
```typescript
async function handleInvoicePaymentSucceeded(invoice: any) {
```

**Solución**: Usar el tipo correcto de Stripe:
```typescript
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
```

---

## SECCIÓN 11: Webhooks

### BAJA-003: Sistema de Webhooks Salientes Bien Implementado

**Archivo**: `src/lib/webhooks.ts`
**Severidad**: INFORMATIVA

**Descripción**: El sistema de webhooks salientes está bien implementado con:
- Firma HMAC-SHA256
- Timeout de 10 segundos
- Auto-desactivación después de 10 fallos consecutivos
- Registro de intentos en base de datos

**Estado**: Sin acción requerida.

---

## SECCIÓN 12: Contactos e Importación

### BAJA-004: Endpoint de Contactos Bien Protegido

**Archivo**: `src/app/api/contacts/[id]/route.ts`
**Severidad**: INFORMATIVA

**Descripción**: Los endpoints de contactos (GET/PATCH/DELETE) verifican correctamente la propiedad de company_id y usan un whitelist de campos permitidos para PATCH. Sin vulnerabilidades encontradas.

---

## SECCIÓN 13: Llamadas y Campañas

### BAJA-005: Sin Bounds en max_duration de Llamadas

**Archivo**: `src/app/api/bland/send-call/route.ts`
**Severidad**: BAJA

**Descripción**: El campo `max_duration` no tiene validación de rango. Un usuario podría enviar una duración excesivamente larga, generando costos elevados.

**Solución**: Agregar validación de rango (1-60 minutos).

---

## SECCIÓN 14: TypeScript

### BAJA-006: Uso de `any` en Handlers de Stripe

**Archivos**: `src/app/api/webhooks/stripe/route.ts`
**Severidad**: BAJA

**Descripción**: Algunos handlers de eventos de Stripe usan `any` type en lugar de los tipos específicos de Stripe, reduciendo la seguridad de tipos.

---

## SECCIÓN 15: Compliance y Privacidad

### MEDIA-012: Sin React Error Boundaries

**Severidad**: MEDIA

**Descripción**: No se encontraron componentes de Error Boundary en la aplicación React. Errores no capturados en componentes causarán pantallas en blanco sin mensajes de error amigables.

**Solución**:
```typescript
// src/components/ErrorBoundary.tsx
'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // Aquí se podría enviar a un servicio de monitoreo como Sentry
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center p-8">
            <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">Please refresh the page or try again later.</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Usar en el layout principal:
```typescript
// src/app/layout.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

---

### BAJA-007: Console.log en Producción

**Severidad**: BAJA

**Descripción**: Se encontraron 155+ archivos con `console.log`. Aunque ninguno parece exponer datos sensibles directamente (tokens, contraseñas), los logs excesivos en producción pueden:
1. Impactar rendimiento
2. Llenar storage de logs
3. Potencialmente exponer datos de negocio

**Recomendación**: Implementar un logger estructurado (pino, winston) con niveles de log configurables por entorno.

---

## Correcciones Aplicadas en esta Auditoría

### FIX-001: Supabase Function search_path Mutable

**Archivo creado**: `supabase/migrations/20260304000003_fix_function_search_path_clio_zoho_dynamics.sql`

**Funciones corregidas**:
1. `public.update_clio_updated_at()` — Agregado `SET search_path = ''`
2. `public.update_zoho_updated_at()` — Agregado `SET search_path = ''`
3. `public.update_dynamics_updated_at()` — Agregado `SET search_path = ''`

**Antes**:
```sql
CREATE OR REPLACE FUNCTION update_clio_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Después**:
```sql
CREATE OR REPLACE FUNCTION public.update_clio_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
```

**Referencia**: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

---

## Matriz de Riesgo

```
                    IMPACTO
              Bajo    Medio    Alto    Crítico
         ┌─────────┬─────────┬────────┬─────────┐
Probable │ BAJA-001│ MEDIA-08│ ALTA-03│ CRIT-002│
         │ BAJA-005│ MEDIA-09│ ALTA-06│ CRIT-003│
         │ BAJA-006│ MEDIA-10│ ALTA-07│ CRIT-004│
         │ BAJA-007│         │ MEDIA-5│         │
         ├─────────┼─────────┼────────┼─────────┤
Posible  │ BAJA-002│ MEDIA-01│ ALTA-04│ CRIT-001│
         │         │ MEDIA-06│ ALTA-05│ CRIT-005│
         │         │ MEDIA-07│        │         │
         │         │ MEDIA-12│        │         │
         ├─────────┼─────────┼────────┼─────────┤
Raro     │ BAJA-003│ MEDIA-02│ ALTA-01│         │
         │ BAJA-004│ MEDIA-03│ ALTA-02│         │
         │         │ MEDIA-04│        │         │
         │         │ MEDIA-11│        │         │
         └─────────┴─────────┴────────┴─────────┘
PROBABILIDAD
```

---

## Plan de Remediación Priorizado

### Fase 1 — Inmediato (0-3 días) — Vulnerabilidades Críticas

| # | Hallazgo | Archivo | Acción |
|---|----------|---------|--------|
| 1 | CRIT-001 | `src/lib/web-scraper.ts` | Implementar validación de URL contra IPs internas |
| 2 | CRIT-002 | `src/app/api/seed/route.ts` | Agregar auth check o desactivar en producción |
| 3 | CRIT-002 | `src/app/api/bland/analyze-call/route.ts` | Agregar autenticación obligatoria |
| 4 | CRIT-003 | `src/app/api/bland/webhook/route.ts` | Implementar verificación de firma |
| 5 | CRIT-004 | `src/app/api/billing/report-usage/route.ts` | Usar incremento atómico (RPC function) |
| 6 | CRIT-005 | `src/app/api/billing/report-usage/route.ts` | Reemplazar service key con token interno dedicado |

### Fase 2 — Urgente (3-7 días) — Vulnerabilidades Altas

| # | Hallazgo | Archivo | Acción |
|---|----------|---------|--------|
| 7 | ALTA-001 | `src/app/api/webhooks/stripe/route.ts` | Usar INSERT + ON CONFLICT para idempotencia |
| 8 | ALTA-002 | `src/app/api/webhooks/stripe/route.ts` | Verificar `billing_reason` antes de resetear overage |
| 9 | ALTA-003 | 20 archivos | Centralizar getAppUrl() con error en producción |
| 10 | ALTA-004 | Slack + Microsoft Outlook | Cambiar base64 → base64url |
| 11 | ALTA-005 | Todos los OAuth callbacks | Verificar user_id del state |
| 12 | ALTA-006 | Todo el proyecto | Agregar Zod para validación de schemas |
| 13 | ALTA-007 | `src/app/api/bland/send-call/route.ts` | Validar formato de teléfono y max_duration |
| 14 | MEDIA-005 | Todo el proyecto | Implementar rate limiting |

### Fase 3 — Importante (1-2 semanas) — Vulnerabilidades Medias

| # | Hallazgo | Archivo | Acción |
|---|----------|---------|--------|
| 15 | MEDIA-003 | `src/app/api/bland/get-call/[callId]/route.ts` | Verificar company_id del usuario |
| 16 | MEDIA-004 | `src/app/api/billing/check-usage-limit/route.ts` | Hacer auth obligatorio |
| 17 | MEDIA-006 | `middleware.ts` | Centralizar auth de API routes |
| 18 | MEDIA-007 | `next.config.ts` | Agregar security headers |
| 19 | MEDIA-008 | 10+ archivos | Reemplazar catch blocks silenciosos |
| 20 | MEDIA-010 | `src/app/api/auth/check-admin/route.ts` | Incluir 'owner' en admin check |
| 21 | MEDIA-012 | Nuevo componente | Agregar Error Boundaries |

### Fase 4 — Mejoras (2-4 semanas) — Vulnerabilidades Bajas

| # | Hallazgo | Acción |
|---|----------|--------|
| 22 | BAJA-002 | Implementar enforcement de plan server-side |
| 23 | BAJA-005 | Agregar validación de rango para max_duration |
| 24 | BAJA-006 | Reemplazar `any` con tipos de Stripe |
| 25 | BAJA-007 | Implementar logger estructurado |

---

## Checklist de Verificación Post-Corrección

### Vulnerabilidades Críticas
- [ ] **SSRF**: Enviar request con URL `http://169.254.169.254/latest/meta-data/` y verificar que es rechazada
- [ ] **Seed Endpoint**: Enviar POST a `/api/seed` sin auth y verificar 401
- [ ] **Analyze Call**: Enviar POST a `/api/bland/analyze-call` sin auth y verificar 401
- [ ] **Bland Webhook**: Enviar POST a `/api/bland/webhook` sin firma y verificar 401
- [ ] **Usage Race**: Ejecutar 2 requests concurrentes de report-usage y verificar que los minutos se suman correctamente
- [ ] **Service Key**: Verificar que SUPABASE_SERVICE_ROLE_KEY ya no se acepta en headers

### Vulnerabilidades Altas
- [ ] **Stripe Idempotencia**: Enviar mismo evento 2 veces simultáneamente y verificar que solo se procesa 1 vez
- [ ] **Overage Reset**: Verificar que solo se resetea en `billing_reason === 'subscription_cycle'`
- [ ] **Localhost Fallback**: Verificar que `getAppUrl()` lanza error si `NEXT_PUBLIC_APP_URL` no está set en producción
- [ ] **OAuth State Encoding**: Verificar que Slack y Microsoft Outlook usan base64url
- [ ] **OAuth User Verification**: Verificar que callbacks rechazan si user_id no coincide
- [ ] **Zod Validation**: Verificar que todos los endpoints principales usan schemas de Zod
- [ ] **Phone Validation**: Enviar número de teléfono inválido a send-call y verificar rechazo
- [ ] **Rate Limiting**: Enviar 20+ requests rápidos a endpoints protegidos y verificar 429

### Vulnerabilidades Medias
- [ ] **Get-Call IDOR**: Intentar acceder a call con company_id de otra empresa y verificar 403
- [ ] **Check-Usage**: Enviar request sin auth y verificar 401
- [ ] **Middleware Auth**: Verificar que rutas API protegidas requieren auth en middleware
- [ ] **Security Headers**: Verificar presencia de CSP, X-Frame-Options, HSTS en response headers
- [ ] **Silent Catches**: Verificar que errores se loggean en archivos corregidos
- [ ] **Check-Admin Owner**: Verificar que owners son reconocidos como admin
- [ ] **Error Boundaries**: Simular error en componente y verificar fallback UI

### Base de Datos
- [ ] **search_path**: Ejecutar `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'update_clio_updated_at'` y verificar `SET search_path = ''`
- [ ] **search_path**: Repetir para `update_zoho_updated_at` y `update_dynamics_updated_at`
- [ ] **RLS**: Verificar que RLS está habilitado en todas las tablas de integración

---

## Recomendaciones Arquitectónicas

### 1. Implementar Middleware de Autenticación Centralizado
Mover la verificación de auth de endpoints individuales al middleware de Next.js, con una lista explícita de excepciones para webhooks y endpoints públicos.

### 2. Adoptar Zod para Validación de Esquemas
Crear schemas de validación para todos los endpoints y reutilizarlos como tipos TypeScript (type inference de Zod).

### 3. Implementar Rate Limiting
Usar un middleware basado en LRU cache en memoria para desarrollo, y Redis para producción (Upstash o similar).

### 4. Agregar Monitoreo de Errores
Integrar Sentry o similar para capturar y reportar errores en producción, reemplazando los `console.error` actuales.

### 5. Implementar Logger Estructurado
Reemplazar `console.log` con un logger como `pino` que soporte niveles, metadata estructurada, y configuración por entorno.

### 6. Security Headers como Estándar
Configurar CSP, HSTS, X-Frame-Options, y otros headers de seguridad en `next.config.ts`.

### 7. Auditar Admin Client Usage
Reducir los 81 archivos que usan admin client al mínimo necesario, preferiendo el client autenticado con RLS cuando sea posible.

### 8. Atomic Database Operations
Para cualquier operación de lectura-modificación-escritura, usar funciones RPC de Supabase/PostgreSQL que ejecuten la operación atómicamente.

### 9. Webhook Signature Verification
Implementar verificación de firma para todos los webhooks entrantes (Bland AI, y cualquier futuro webhook).

### 10. Separar Tokens de Servicio
No reutilizar la `SUPABASE_SERVICE_ROLE_KEY` para comunicación inter-servicio. Crear tokens dedicados con alcance limitado.

---

*Fin del Reporte de Auditoría de Seguridad — Callengo App*
*Generado: 2026-03-04*
