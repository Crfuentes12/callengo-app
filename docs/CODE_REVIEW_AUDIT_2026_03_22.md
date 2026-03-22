# Callengo - Auditoría Completa de Código (Marzo 22, 2026)

> Auditoría profunda realizada con 10 agentes de IA analizando archivo por archivo y simulando flujos de usuario reales.

---

## Resumen Ejecutivo

| Categoría | Críticos | Altos | Medios | Bajos | Total |
|-----------|----------|-------|--------|-------|-------|
| API Routes & Security | 6 | 12 | 5 | 2 | 25 |
| Frontend & UX | 1 | 2 | 4 | 4 | 11 |
| Business Logic (Bland/Redis/Billing) | 2 | 5 | 5 | 3 | 15 |
| Config, i18n & Dependencies | 3 | 1 | 3 | 1 | 8 |
| Auth & Data Flow | 1 | 5 | 7 | 3 | 16 |
| Signup/Onboarding Flow | 4 | 3 | 3 | 5 | 15 |
| Campaign/Calls Flow | 1 | 2 | 7 | 2 | 12 |
| Billing/Stripe Flow | 2 | 4 | 6 | 1 | 13 |
| CRM Integrations | 1 | 0 | 8 | 5 | 14 |
| Team & Admin | 1 | 1 | 9 | 4 | 15 |
| **TOTAL** | **22** | **35** | **57** | **30** | **144** |

**Build Status:** TypeScript compila sin errores. ESLint pasa con 1 warning. 8 vulnerabilidades npm (6 high).

---

## PROBLEMAS CRÍTICOS (Top 10 - Arreglar Inmediatamente)

### 1. Company Owner = Platform Admin (CRITICAL)
**Archivo:** `src/app/api/auth/check-admin/route.ts:23`, `src/app/api/admin/command-center/route.ts:33`
**Problema:** Cualquier owner de cualquier empresa puede acceder al `/admin/command-center` y cambiar el plan de Bland AI para TODAS las empresas, ver financiales de todos los clientes, y archivar empresas.
**Fix:** Agregar columna `is_platform_admin` en tabla `users`. Solo usuarios con `is_platform_admin = true` deben acceder a admin.

### 2. CSRF Protection Missing (CRITICAL)
**Archivo:** Toda la aplicación (90+ endpoints)
**Problema:** Ningún endpoint POST/PATCH/DELETE tiene validación de CSRF token. Un atacante puede cambiar planes de billing, invitar usuarios, y modificar configuraciones mediante CSRF.
**Fix:** Implementar CSRF tokens usando middleware de Next.js.

### 3. Admin Plan Change Bypasses Stripe (CRITICAL)
**Archivo:** `src/app/api/billing/change-plan/route.ts:83-98`
**Problema:** El endpoint admin cambia el plan directamente en la DB sin actualizar Stripe. Stripe sigue cobrando el plan anterior. Posible double-charging.
**Fix:** Usar la API de Stripe para actualizar la suscripción, no solo la DB.

### 4. Rate Limiting No Aplicado Globalmente (CRITICAL)
**Archivo:** `src/lib/rate-limit.ts`
**Problema:** Rate limiter definido pero solo usado en 4 endpoints. Billing, admin, integraciones y la mayoría de endpoints están desprotegidos contra brute-force y DDoS.
**Fix:** Aplicar rate limiting middleware globalmente.

### 5. OAuth State No Validado en Callbacks (CRITICAL)
**Archivos:** Todos los archivos `auth.ts` de CRM (hubspot, salesforce, pipedrive, zoho, dynamics, clio)
**Problema:** OAuth flows generan `state` parameter pero NINGÚN callback valida que el state corresponda a la sesión. Permite ataques CSRF OAuth donde un atacante puede vincular su propia cuenta CRM a la víctima.
**Fix:** Almacenar state en Redis/Supabase con TTL y validar en todos los callbacks.

### 6. Solo 2 de 7 Idiomas Implementados (CRITICAL)
**Archivos:** `src/i18n/translations/index.ts:9`, `src/i18n/language-detection.ts:68`
**Problema:** CLAUDE.md dice 7 idiomas (en, es, fr, de, it, nl, pt) pero solo existen `en.ts` y `es.ts`. El type `SupportedLanguage` solo acepta `'en' | 'es'`. Si un usuario tiene browser en francés/alemán, verá inglés sin explicación.
**Fix:** Crear los 5 archivos de traducción faltantes O actualizar la UI para mostrar solo en/es.

### 7. 120+ Clases CSS Malformadas (CRITICAL-UX)
**Archivos:** ImportModal, ContactDetailModal, PipedriveContactsPage, ContactsTable, HubSpotContactsPage, IntegrationsPage, SettingsManager, ReportsPage (120+ instancias)
**Problema:** Clases como `text-[var(--color-neutral-50)]0` y `bg-[var(--color-success-50)]0` tienen un `0` extra al final que invalida el CSS. Tailwind no compila estas clases, causando colores default del browser.
**Fix:** Buscar y reemplazar `)]0` por `)]` en todos los componentes.

### 8. Campaign No Auto-Dispatches After Creation (CRITICAL-UX)
**Archivo:** `src/components/agents/AgentConfigModal.tsx:494-570`
**Problema:** `handleStartCampaign()` crea un `agent_run` en status "draft" y redirige a la página de campaña. Pero NUNCA llama al endpoint `/api/campaigns/dispatch`. Las campañas quedan en draft para siempre.
**Fix:** Agregar llamada a dispatch automática después de crear el agent_run, o hacer visible un botón "Dispatch" en la página de detalle.

### 9. Home Page Crashes si Company/Subscription es NULL (CRITICAL)
**Archivo:** `src/app/(app)/home/page.tsx:33-34`
**Problema:** Usa `.single()` en queries de company y subscription. Si alguno es NULL (e.g., subscription no creada aún post-onboarding), la página crashea con 500.
**Fix:** Usar `.maybeSingle()` y agregar fallbacks/error boundaries.

### 10. Race Condition en Campaign Dispatch (CRITICAL)
**Archivo:** `src/app/api/campaigns/dispatch/route.ts:85-95, 144`
**Problema:** TOCTOU race condition en throttle check. Dos dispatches concurrentes pueden pasar ambos el check y exceder los límites de Bland AI. El re-check solo aplica para `i > 0`, el primer contacto siempre pasa.
**Fix:** Usar lock distribuido (Redis SET NX) o validar atomicamente.

---

## PROBLEMAS ALTOS (35 Issues)

### API Routes
| # | Problema | Archivo | Líneas |
|---|---------|---------|--------|
| 1 | Cross-company data exposure en billing-events | `api/admin/billing-events/route.ts` | company_id no validado contra usuario |
| 2 | No idempotency en Bland webhook | `api/bland/webhook/route.ts` | 140-150 |
| 3 | SimplyBook webhook sin firma | `api/integrations/simplybook/webhook/route.ts` | Sin verificación |
| 4 | State parameter reutilizable en OAuth | `api/integrations/google-calendar/callback/route.ts` | 28-38 |
| 5 | Sync operations sin ownership validation | `api/integrations/*/sync/route.ts` | Multiple |

### Business Logic
| # | Problema | Archivo | Líneas |
|---|---------|---------|--------|
| 6 | Token refresh race conditions (todos los CRM) | `lib/*/auth.ts` | 115-195 |
| 7 | Webhook timestamp no validado | `lib/webhooks.ts` | 157-159 |
| 8 | Negative counter fix no atómico en Redis | `lib/redis/concurrency-manager.ts` | 333-342 |
| 9 | Billing period edge case | `lib/billing/call-throttle.ts` | 270-280 |
| 10 | Prompt injection risk en intent analyzer | `lib/ai/intent-analyzer.ts` | 15-21 |

### Auth & Security
| # | Problema | Archivo | Líneas |
|---|---------|---------|--------|
| 11 | Service role key bypass en billing | `api/webhooks/stripe/route.ts` | 62-78 |
| 12 | RLS policies no verificadas en código | Todas las queries Supabase | - |
| 13 | supabaseAdmin exportado sin server-only marker | `lib/supabase/service.ts` | 5-6 |
| 14 | Missing email verification para operaciones críticas | `api/team/invite/route.ts` | - |
| 15 | Admin plan change sin audit logging | `api/billing/change-plan/route.ts` | 34-40 |

### Onboarding
| # | Problema | Archivo | Líneas |
|---|---------|---------|--------|
| 16 | Free plan assignment silently fails | `app/onboarding/page.tsx` | 138-149 |
| 17 | Website scraping sin timeout | `app/onboarding/page.tsx` | 155-187 |
| 18 | OAuth email verification no checked en middleware | `middleware.ts` | 105-110 |
| 19 | Bootstrap race condition crea empresas huérfanas | `api/company/bootstrap/route.ts` | 38-100 |

### Billing
| # | Problema | Archivo | Líneas |
|---|---------|---------|--------|
| 20 | Missing stripe_subscription_item_id bloquea overage | `api/billing/report-usage/route.ts` | 252-264 |
| 21 | Downgrade no bloquea usage existente | `api/webhooks/stripe/route.ts` | 526-561 |
| 22 | Free plan expiry race condition | `lib/billing/call-throttle.ts` | 88-106 |
| 23 | Currency exchange rates estáticos | `api/billing/create-checkout-session/route.ts` | 113-145 |

### Dependencies
| # | Problema | Archivo | Líneas |
|---|---------|---------|--------|
| 24 | 8 vulnerabilidades npm (6 high) + xlsx sin fix | `package.json` | - |

### Team/Admin
| # | Problema | Archivo | Líneas |
|---|---------|---------|--------|
| 25 | No existe endpoint para cambiar roles | `api/team/` | Feature faltante |

---

## PROBLEMAS MEDIOS (57 Issues)

### Frontend & UX
- Team page muestra `t.team.title` duplicado como subtítulo (`team/page.tsx:24-25`)
- Empty catch block en `analyzeCall()` sin feedback al usuario (`AgentConfigModal.tsx:375-378`)
- `window.location.href` en lugar de `router.push()` en login (`auth/login/page.tsx:34`)
- Error handling genérico en IntegrationsPage sync (`IntegrationsPage.tsx:550`)

### Business Logic
- Redis SCAN loop con MAX_SCAN_ITERATIONS=10 insuficiente para scale (`concurrency-manager.ts:394-418`)
- Stripe metered usage con `action: 'set'` sin idempotency keys (`overage-manager.ts:290`)
- Daily cap usa UTC sin timezone de empresa (`call-throttle.ts:229-240`)
- Rate limiter fallback in-memory no seguro para serverless (`rate-limit.ts:42-64`)

### Billing
- Overage budget alert reusa campo para 2 propósitos (`report-usage/route.ts:298-381`)
- Idempotency key insuficiente en allocateBlandCredits (`subaccount-manager.ts:69-77`)
- Usage no reset on admin plan change (`change-plan/route.ts:103-114`)
- stripe_subscription_item_id lost on plan update (`webhooks/stripe/route.ts:433-445`)
- Period dates can be stale on reset (`usage-tracker.ts:354-408`)
- Race condition en verify-session vs webhook (`verify-session/route.ts:117-130`)

### CRM
- Contacts huérfanos al desconectar integración (`*/disconnect/route.ts:46-51`)
- Token refresh race conditions (todos los CRM auth)
- Sin retry logic para CRM API 429/500 errors
- Contact mapping unsafe .or() query con valores vacíos (`hubspot/sync.ts:273-296`)
- SimplyBook sin mutex guard en token refresh (`simplybook/auth.ts:144-192`)
- Sync durante disconnect = race condition
- Plan check solo en connect, no en callback

### Team/Admin
- Invitation acceptance race condition (`accept-invite/route.ts:69-89`)
- Team member enumeration por cualquier usuario (`team/members/route.ts:21`)
- Extra_seats sin validación contra Stripe (`team/invite/route.ts:108-109`)
- Last-member removal puede dejar empresa sin owner (`team/remove/route.ts:79-90`)
- No audit logs para operaciones de team
- Orphan cleanup sin confirmación server-side
- Missing pagination en admin clients list (`admin/clients/route.ts:35-39`)
- Reconciliation severity basada en absolutos, no porcentajes (`admin/reconcile/route.ts:124-138`)
- Double invitation acceptance via callback path (`auth/callback/route.ts:66-104`)

### Other
- SSRF validation incompleta en web-scraper (`lib/web-scraper.ts:19-31`)
- Webhook auto-disable hardcoded a 10 failures (`webhooks.ts:102`)
- Console logs con emojis en producción (15+ archivos)
- Open redirect parcial en auth callback (`auth/callback/route.ts:14-21`)
- Geolocation hook sin estado de error (`hooks/useAutoGeolocation.ts:39-72`)
- Bland API key parcialmente expuesta en response (`admin/command-center/route.ts:450-453`)
- Refresh tokens en plaintext en Supabase

---

## PROBLEMAS BAJOS (30 Issues)

- Fetch timeout faltante en reCAPTCHA verify
- Integer overflow en paginación de contactos
- Seed endpoint demasiado permisivo
- Phone number rotation predecible
- Bland plan detection fallback inexacto
- Admin role confusion (admin vs owner)
- Console.error con info sensible
- Password strength meter vs minimum mismatch
- Import skips rows silently sin detalle
- Custom task sin character counter
- Voicemail message sin length indicator
- Various minor UX issues en onboarding

---

## ESTADO DEL BUILD

| Check | Resultado |
|-------|-----------|
| TypeScript (tsc --noEmit) | PASS - 0 errores |
| ESLint | PASS - 1 warning (unused variable en AgentConfigModal.tsx:375) |
| npm build | FAIL - Solo por Google Fonts bloqueado en sandbox (no es bug de código) |
| npm audit | 8 vulnerabilidades (1 low, 1 moderate, 6 high) |
| @supabase/auth-helpers-nextjs | DEPRECATED (v0.15.0) |

---

## PRIORIDADES DE FIX

### Semana 1 (Inmediato - Seguridad)
1. Separar `is_platform_admin` de company owner
2. Implementar CSRF protection global
3. Validar OAuth state en todos los callbacks CRM
4. Aplicar rate limiting globalmente
5. Hacer que admin change-plan sincronice con Stripe
6. Arreglar race condition en campaign dispatch

### Semana 2 (Alto - Funcionalidad)
7. Arreglar auto-dispatch de campañas
8. Arreglar home page crash con NULL subscription
9. Fix 120+ clases CSS malformadas
10. Implementar/remover idiomas faltantes
11. Arreglar free plan assignment silencioso en onboarding
12. Añadir timeout a website scraping
13. Fix OAuth email verification en middleware
14. Run `npm audit fix`

### Semana 3 (Medio - Estabilidad)
15. Arreglar webhook idempotency (Bland + Stripe)
16. Fix token refresh race conditions en CRM
17. Arreglar overage billing sin stripe_subscription_item_id
18. Añadir audit logging para team operations
19. Implementar pagination en admin endpoints
20. Fix reconciliation severity calculation

### Semana 4 (Bajo - Calidad)
21. Limpiar console.log emojis
22. Añadir error states a hooks
23. Mejorar import feedback (detalles de rows saltadas)
24. Añadir character counters a campos de texto
25. Tests automatizados para RLS policies

---

## CONCLUSIÓN

La plataforma Callengo tiene una **base arquitectónica sólida**: TypeScript estricto sin errores, componentes bien estructurados, sistema de billing completo con Stripe, integraciones CRM funcionales, y un sistema de concurrencia con Redis.

**Sin embargo, NO está lista para producción** sin abordar los problemas críticos:

- **Seguridad:** La falta de CSRF, rate limiting global, y la confusión admin/owner son riesgos serios
- **Billing:** El endpoint admin de cambio de plan que bypassa Stripe puede causar double-charging
- **UX:** Las campañas no se despachan automáticamente (el feature principal de la app no funciona end-to-end)
- **UI:** 120+ clases CSS rotas afectan la apariencia visual
- **i18n:** 5 de 7 idiomas no existen

**Recomendación:** Dedicar 2-4 semanas a fixes de seguridad y bugs críticos antes de aceptar clientes de pago.
