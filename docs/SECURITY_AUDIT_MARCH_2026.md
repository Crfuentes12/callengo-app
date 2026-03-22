# CALLENGO — Auditoría de Seguridad Integral (Marzo 2026)

> Auditoría automatizada ejecutada por 10 agentes de IA en paralelo.
> Fecha: 22 de Marzo 2026
> Alcance: Codebase completo de Callengo

---

## Resumen Ejecutivo

Se identificaron **120+ hallazgos** distribuidos en 10 áreas del sistema. Los más críticos afectan: seguridad de autenticación, integridad de facturación, aislamiento de datos entre empresas, y concurrencia en el sistema de llamadas.

### Conteo por Severidad

| Severidad | Total | Áreas más afectadas |
|-----------|-------|---------------------|
| **CRITICAL** | ~28 | Auth, Billing, Bland AI, CRM, Team, i18n |
| **HIGH** | ~32 | Todos los módulos |
| **MEDIUM** | ~35 | Analytics, Calendar, Admin, Contacts |
| **LOW** | ~25 | UX, Logging, Config |

---

## 1. AUTH & SECURITY

### CRITICAL
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| SEC-01 | **`middleware.ts` NO EXISTE** — sin protección de rutas a nivel Edge | `src/middleware.ts` | N/A |
| SEC-02 | Rate limiting definido pero **NO aplicado** en endpoints sensibles | `src/lib/rate-limit.ts` | 108-116 |
| SEC-03 | Bland AI webhook — verificación de firma es **opcional** en producción | `src/app/api/bland/webhook/route.ts` | 92-113 |

### HIGH
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| SEC-04 | Patrón inconsistente de `company_id` — algunos endpoints lo aceptan del body (IDOR) | Múltiples endpoints | — |
| SEC-05 | Tokens de invitación — mecanismo de generación no verificable | `src/app/api/team/invite/route.ts` | 136-145 |
| SEC-06 | OAuth redirect usa `window.location.origin` — spoofable | `src/contexts/AuthContext.tsx` | 100-107 |

### MEDIUM
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| SEC-07 | Admin endpoints validan rol correctamente pero sin middleware de defensa en profundidad | `src/app/api/admin/` | — |
| SEC-08 | RLS activo pero necesita auditoría tabla por tabla | Supabase policies | — |

---

## 2. BILLING & STRIPE

### CRITICAL
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| BIL-01 | Stripe API version inválida: `'2025-12-15.clover'` | `src/lib/stripe.ts` | 8 |
| BIL-02 | Overage budget usa `>` en vez de `>=` — permite exceder presupuesto | `src/lib/billing/call-throttle.ts` | 326 |
| BIL-03 | `stripe_subscription_item_id` puede ser null → overage no se reporta a Stripe | `src/app/api/billing/report-usage/route.ts` | 247 |
| BIL-04 | Cambio de plan NO resetea `minutes_used` en `usage_tracking` | `src/app/api/webhooks/stripe/route.ts` | 447-454 |

### HIGH
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| BIL-05 | Metadata de Stripe (`plan_slug`) se confía sin validar contra DB | `src/app/api/webhooks/stripe/route.ts` | 137-141, 434-436 |
| BIL-06 | `overage_spent` no se resetea en todos los escenarios de facturación | `src/app/api/webhooks/stripe/route.ts` | 735-742 |
| BIL-07 | Free plan expiry no se enforce en dispatch de llamadas | `src/lib/billing/usage-tracker.ts` | 123-148 |
| BIL-08 | Rate limiting no aplicado en `change-plan`, `update-overage`, `report-usage` | Múltiples | — |

### MEDIUM
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| BIL-09 | Aritmética de punto flotante en costos de overage | `src/app/api/billing/report-usage/route.ts` | 115 |
| BIL-10 | Webhook replay posible — no valida timestamp del evento | `src/app/api/webhooks/stripe/route.ts` | 52-78 |
| BIL-11 | Overage se puede habilitar en planes que no lo soportan | `src/app/api/billing/update-overage/route.ts` | 85-100 |
| BIL-12 | Magic number 225 min/booster hardcodeado en 3 lugares | Múltiples | — |

---

## 3. BLAND AI / REDIS CONCURRENCY

### CRITICAL
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| BLA-01 | **Slot leak** — pre-log falla pero Redis adquiere slot zombi | `src/app/api/bland/send-call/route.ts` | 90-205 |
| BLA-02 | Webhook puede liberar slots de IDs `pre_*` — contadores inconsistentes | `src/app/api/bland/webhook/route.ts` | 230-237 |
| BLA-03 | **TTL de 30 min** demasiado corto para llamadas largas | `src/lib/redis/concurrency-manager.ts` | 278-285 |
| BLA-04 | Contact cooldown falla si Redis tiene problemas — rechaza llamadas legítimas | `src/lib/redis/concurrency-manager.ts` | 258-266 |

### HIGH
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| BLA-05 | Webhook signature verification es **opcional** | `src/app/api/bland/webhook/route.ts` | 92-113 |
| BLA-06 | Race condition en liberación de slot al expirar TTL | `src/lib/redis/concurrency-manager.ts` | 312-320 |
| BLA-07 | Upsert silencioso — llamada no registrada, no analizada, no facturada | `src/app/api/bland/webhook/route.ts` | 166-182 |
| BLA-08 | Contact cooldown es **global** — Company A bloquea llamadas de Company B | `src/lib/redis/concurrency-manager.ts` | 52-53 |
| BLA-09 | Llamadas sin webhook nunca se facturan | `src/app/api/bland/webhook/route.ts` | 1064-1083 |

### MEDIUM
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| BLA-10 | Respuesta de Bland no se valida — `call_id` podría ser undefined | `src/lib/bland/master-client.ts` | 248-256 |
| BLA-11 | Campaign dispatch parcial se reporta incorrectamente | `src/app/api/campaigns/dispatch/route.ts` | 108-265 |

---

## 4. CRM INTEGRATIONS

### CRITICAL
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| CRM-01 | SimplyBook almacena **contraseñas en texto plano** | `src/app/api/integrations/simplybook/connect/route.ts` | 44-96 |
| CRM-02 | Disconnect no limpia contact mappings — datos huérfanos | Todos los `/disconnect/` | — |
| CRM-03 | Race condition en detección de duplicados (SELECT + INSERT no atómico) | HubSpot, Pipedrive, Zoho, Salesforce sync | — |

### HIGH
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| CRM-04 | Token refresh concurrente sin lock distribuido | Todos los `auth.ts` | — |
| CRM-05 | Sin rate limiting en endpoints de sync | Todos los `/sync/` | — |
| CRM-06 | SimplyBook webhook **sin verificación de firma** | `src/app/api/integrations/simplybook/webhook/route.ts` | 39-109 |
| CRM-07 | Pipedrive scope validation retorna `true` silenciosamente | `src/lib/pipedrive/sync.ts` | 44-49 |

### MEDIUM
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| CRM-08 | **Plan-gating bypass** — `/sync` no revalida plan tras downgrade | Todos los sync endpoints | — |
| CRM-09 | Sync sobreescribe datos sin resolución de conflictos | Todos los sync libs | — |
| CRM-10 | Outbound sync solo pushea notas, no datos de contacto | `src/lib/hubspot/sync.ts` | 592-642 |

---

## 5. CAMPAIGNS & CONTACTS

### CRITICAL
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| CAM-01 | **CSV Injection** — fórmulas no sanitizadas en import | `src/lib/call-agent-utils.ts` | 217-276 |
| CAM-02 | **Dispatch race condition** — sin idempotency key, doble click = llamadas duplicadas | `src/app/api/campaigns/dispatch/route.ts` | 41-269 |

### HIGH
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| CAM-03 | Eliminar contacto durante campaña activa — orphaned call_logs | `src/app/api/contacts/[id]/route.ts` | 175-234 |
| CAM-04 | Contact stats hace full table scan — **DOS vector** con 100k+ contactos | `src/app/api/contacts/stats/route.ts` | 28-48 |
| CAM-05 | Contact cooldown sin fallback si Redis caído | `src/app/api/campaigns/dispatch/route.ts` | 159 |
| CAM-06 | Follow-up queue **sin timezone awareness** | `src/lib/queue/followup-queue.ts` | 56-63 |

### MEDIUM
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| CAM-07 | Campaign state machine sin validación de transiciones | `src/app/api/campaigns/dispatch/route.ts` | 244-252 |
| CAM-08 | Plan limits se verifican ANTES de deduplicación en import | `src/app/api/contacts/import/route.ts` | 114-168 |
| CAM-09 | Voicemail URLs posiblemente sin control de acceso | `src/app/api/bland/webhook/route.ts` | 186-228 |

---

## 6. ADMIN COMMAND CENTER

### CRITICAL
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| ADM-01 | `/api/billing/change-plan` solo verifica `admin` pero **NO `owner`** | `src/app/api/billing/change-plan/route.ts` | 28 |

### HIGH
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| ADM-02 | Reconciliación sobreescribe minutos con `Map.set()` en vez de acumular | `src/app/api/admin/reconcile/route.ts` | 93-96 |
| ADM-03 | `costPerCall` mezcla ALL calls con solo completed calls | `src/app/api/admin/command-center/route.ts` | 587-588 |
| ADM-04 | Gross margin mezcla MRR snapshot con costos reales | `src/app/api/admin/command-center/route.ts` | 585 |

### MEDIUM
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| ADM-05 | Trial conversion rate incluye trials no convertidos | `src/app/api/admin/command-center/route.ts` | 390-394 |
| ADM-06 | ARPC excluye empresas en trial | `src/app/api/admin/command-center/route.ts` | 586 |

---

## 7. CALENDAR & SCHEDULING

### CRITICAL
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| CAL-01 | **Bug timezone** en Microsoft Calendar sync — eventos all-day con hora incorrecta | `src/lib/calendar/microsoft.ts` | 668-678 |
| CAL-02 | Mismo bug timezone en Google Calendar sync | `src/lib/calendar/google.ts` | 554-560 |
| CAL-03 | Availability calculation NO es timezone-aware | `src/lib/calendar/availability.ts` | 415-419 |

### HIGH
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| CAL-04 | OAuth token refresh falla silenciosamente (Microsoft + Google) | `src/lib/calendar/microsoft.ts`, `google.ts` | — |
| CAL-05 | No se previenen double-bookings en dispatch | `src/app/api/campaigns/dispatch/route.ts` | — |
| CAL-06 | No-show detection programa reintentos infinitos | `src/lib/calendar/sync.ts` | 465-512 |
| CAL-07 | Confirmación de citas no valida ventana 24-48h | `src/lib/calendar/campaign-sync.ts` | 207-291 |
| CAL-08 | No hay cleanup de calendar events al cancelar campaña | `src/app/api/campaigns/dispatch/route.ts` | — |

---

## 8. i18n & FRONTEND

### CRITICAL
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| I18-01 | **Portugués (pt.ts) NO EXISTE** — documentación dice 7 idiomas | `src/i18n/translations/` | — |
| I18-02 | `SupportedLanguage` solo declara `'en' \| 'es'` — 5 idiomas inutilizables | `src/i18n/translations/index.ts` | 13 |
| I18-03 | Validación de localStorage solo acepta `['en', 'es']` | `src/i18n/context.tsx` | 45 |
| I18-04 | Detección de idioma solo funciona para 2/7 idiomas | `src/i18n/language-detection.ts` | 61-74 |

### HIGH
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| I18-05 | AgentConfigModal con múltiples strings hardcodeados en inglés | `src/components/agents/AgentConfigModal.tsx` | 1769-1879 |
| I18-06 | **13+ console.log con emojis** de debug en producción | `src/components/agents/AgentConfigModal.tsx` | 374-512 |

### MEDIUM
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| I18-07 | Fechas hardcodeadas a `'en-US'` en Dashboard | `src/components/dashboard/DashboardOverview.tsx` | 752 |
| I18-08 | 109 instancias de `toLocaleString()` sin locale explícito | Múltiples componentes | — |
| I18-09 | Clase CSS malformada `bg-[var(--color-success-50)]0` | `src/components/analytics/AnalyticsDashboard.tsx` | 416 |
| I18-10 | Sin ARIA labels en AgentConfigModal | `src/components/agents/AgentConfigModal.tsx` | — |

---

## 9. OPENAI & ANALYTICS

### CRITICAL
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| AI-01 | **Prompt injection** — transcripts interpolados sin sanitización | `src/lib/ai/intent-analyzer.ts` | 54-270 |
| AI-02 | Endpoint `context-suggestions` sin system message | `src/app/api/openai/context-suggestions/route.ts` | 52-58 |

### HIGH
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| AI-03 | `recommend-agent` retorna `success: true` con fallback silencioso | `src/app/api/openai/recommend-agent/route.ts` | 67-77 |
| AI-04 | Sin diferenciación de errores OpenAI — todos retornan 500 | Todos los endpoints OpenAI | — |
| AI-05 | Sin timeout ni retry configurado en OpenAI calls | Todos los endpoints OpenAI | — |
| AI-06 | KPI success rate usa filtros inconsistentes | `src/components/analytics/AnalyticsDashboard.tsx` | 60-70 |

### MEDIUM
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| AI-07 | Sin tracking de costos OpenAI — `cost_openai` nunca se popula | Todos los endpoints OpenAI | — |
| AI-08 | Charts con data mínima/cero se renderizan misleading | `src/components/analytics/AnalyticsDashboard.tsx` | 189-192 |

---

## 10. TEAM & ONBOARDING

### CRITICAL
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| TEA-01 | Growth plan permite invitar miembros (debería bloquear, tiene 1 seat) | `src/app/api/team/invite/route.ts` | 75-81 |
| TEA-02 | Team invite se **auto-acepta** en OAuth callback sin consentimiento | `src/app/auth/callback/route.ts` | 66-172 |
| TEA-03 | Sin rate limiting en TODOS los endpoints de team | `src/app/api/team/` | — |
| TEA-04 | Extra seats no se validan contra compras reales | `src/app/api/team/invite/route.ts` | 84-108 |
| TEA-05 | Admin puede invitar como `admin` — escalación de privilegios | `src/app/api/team/invite/route.ts` | 21-29 |

### HIGH
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| TEA-06 | Team removal NO revoca sesiones ni elimina cuenta Auth | `src/app/api/team/remove/route.ts` | 89-92 |
| TEA-07 | `expires_at` de invitaciones posiblemente no se setea | `src/app/api/team/invite/route.ts` | — |

### MEDIUM
| ID | Hallazgo | Archivo | Línea |
|----|----------|---------|-------|
| TEA-08 | Plan features en código vs DB fuera de sync | `src/config/plan-features.ts` vs migrations | — |
| TEA-09 | Onboarding retry sin cleanup — estado inconsistente | `src/app/onboarding/page.tsx` | 82-97 |
| TEA-10 | Extra seat pricing hardcodeado ($49) | `src/app/api/billing/seat-checkout/route.ts` | 9 |

---

## Top 20 Hallazgos Más Urgentes (Prioridad de Fix)

| # | ID | Descripción | Impacto |
|---|-----|-------------|---------|
| 1 | SEC-01 | `middleware.ts` no existe | Cualquier endpoint mal configurado = datos expuestos |
| 2 | BLA-01 | Slot leak en Redis | Contadores zombi bloquean llamadas legítimas |
| 3 | BLA-08 | Contact cooldown global (no por empresa) | Violación de aislamiento entre empresas |
| 4 | CAM-02 | Dispatch sin idempotency | Doble click = llamadas duplicadas |
| 5 | TEA-04 | Extra seats sin validar compras | Empresas invitan sin pagar |
| 6 | BIL-04 | Plan change no resetea minutes_used | Facturación incorrecta post-upgrade |
| 7 | CRM-01 | SimplyBook passwords en texto plano | Compromiso de DB = passwords expuestos |
| 8 | AI-01 | Prompt injection en transcripts | Manipulación de análisis IA |
| 9 | CAL-01/02 | Timezone bugs en calendar sync | Eventos all-day con hora incorrecta |
| 10 | SEC-02 | Rate limiting no aplicado | Endpoints críticos vulnerables a fuerza bruta |
| 11 | TEA-05 | Admin puede crear más admins | Escalación de privilegios |
| 12 | BIL-01 | Stripe API version inválida | Comportamiento impredecible de Stripe |
| 13 | BLA-05 | Bland webhook signature opcional | Cualquiera puede forjar webhooks |
| 14 | I18-02 | Solo 2/7 idiomas funcionales | 5 idiomas configurados pero inutilizables |
| 15 | TEA-01 | Growth plan sin bloqueo de team | Bypass de límite de seats |
| 16 | CAM-01 | CSV injection en import | Ejecución de fórmulas en Excel |
| 17 | BIL-02 | Overage budget `>` vs `>=` | Exceso de presupuesto |
| 18 | CRM-03 | Race condition en dedup de contactos | Duplicados en sync |
| 19 | ADM-02 | Reconciliación pierde minutos | Reportes financieros incorrectos |
| 20 | TEA-06 | Removal no revoca sesiones | Ex-miembros mantienen acceso |

---

## Recomendaciones Generales

1. **Crear `middleware.ts`** con protección de rutas a nivel Edge — defensa en profundidad
2. **Aplicar rate limiting globalmente** — usar los limiters ya definidos en `rate-limit.ts`
3. **Estandarizar `company_id`** — NUNCA aceptar del request body, siempre derivar del usuario autenticado
4. **Implementar idempotency keys** en dispatch de campañas y operaciones de billing
5. **Auditar RLS policies** tabla por tabla en Supabase
6. **Completar sistema i18n** — activar los 7 idiomas declarados
7. **Agregar tests automatizados** — actualmente no hay tests
8. **Implementar circuit breaker** para dependencias externas (Redis, Bland, OpenAI, CRMs)
9. **Sanitizar inputs** en CSV import y transcripts de IA
10. **Implementar soft-delete** para contactos y miembros de equipo con audit trail
