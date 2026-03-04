# CALLENGO - DOCUMENTO MAESTRO DE SIMULACION Y AUDITORIA DE PLATAFORMA

**Fecha:** 4 de Marzo, 2026
**Autor:** Auditoría de Arquitectura por IA Externa (Claude Code - Opus 4.6)
**Scope:** Análisis completo del codebase, simulación de 9 escenarios de usuario, evaluación de integraciones, identificación de problemas y recomendaciones estratégicas.
**Versión:** 1.0 - Exhaustiva

---

## TABLA DE CONTENIDOS

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Comprensión del Sistema](#2-comprensión-del-sistema)
3. [Perfil del Usuario Simulado](#3-perfil-del-usuario-simulado)
4. [Simulación: Appointment Confirmation Agent](#4-simulación-appointment-confirmation-agent)
5. [Simulación: Data Validation Agent](#5-simulación-data-validation-agent)
6. [Simulación: Lead Qualification Agent](#6-simulación-lead-qualification-agent)
7. [Auditoría de Integraciones de Calendario](#7-auditoría-de-integraciones-de-calendario)
8. [Auditoría de Integraciones CRM](#8-auditoría-de-integraciones-crm)
9. [Problemas Identificados y Callejones sin Salida](#9-problemas-identificados-y-callejones-sin-salida)
10. [Scorecard de Satisfacción al Cliente](#10-scorecard-de-satisfacción-al-cliente)
11. [Análisis Competitivo y Propuesta de Valor](#11-análisis-competitivo-y-propuesta-de-valor)
12. [Opinión del Auditor Externo](#12-opinión-del-auditor-externo)
13. [Roadmap de Correcciones Prioritarias](#13-roadmap-de-correcciones-prioritarias)

---

## 1. RESUMEN EJECUTIVO

### Veredicto General
Callengo es una plataforma **conceptualmente sólida y técnicamente ambiciosa** que aborda un dolor real del mercado: la pérdida de ingresos por no-shows, datos obsoletos y leads no calificados. La arquitectura es moderna (Next.js 14+, Supabase, Bland AI, Stripe) y el ecosistema de integraciones es impresionante para su etapa de desarrollo.

Sin embargo, hay **brechas críticas entre la promesa y la ejecución** que podrían frustrar al usuario de clínica privada descrito en el escenario. Las principales son:

1. **La sincronización de calendario funciona pero tiene puntos ciegos** - Los eventos se crean y sincronizan a Google/Outlook, pero SimplyBook.me no está integrada como fuente de citas para el agente de appointment confirmation.
2. **La detección de intención en el webhook es frágil** - Se basa en keyword matching del transcript (`includes('confirm')`, `includes('reschedule')`), no en análisis semántico.
3. **No hay tabla `simplybook_integrations` en el esquema proporcionado** - El código la referencia pero no existe en las migraciones principales visibles, indicando que SimplyBook fue añadido tarde y puede no estar completamente integrado.
4. **El flujo de appointment confirmation depende de metadata pre-populada** - El `calendar_event_id` debe existir en el metadata de la llamada para que la sincronización funcione, lo cual requiere que la cita ya esté importada al sistema de Callengo.

**Probabilidad de éxito para la clínica privada: 72/100** - Funcional con configuración cuidadosa, pero no plug-and-play.

---

## 2. COMPRENSIÓN DEL SISTEMA

### 2.1 Arquitectura Técnica

| Capa | Tecnología | Estado |
|------|-----------|--------|
| Frontend | Next.js 14+ (App Router), React, Tailwind CSS | Completo |
| Backend | Next.js API Routes (104 endpoints) | Completo |
| Base de Datos | Supabase PostgreSQL (50+ tablas, RLS habilitado) | Completo |
| Autenticación | Supabase Auth (Email, Google, Azure, Slack OIDC) | Completo |
| Voz IA | Bland AI (enhanced model, 40+ voces) | Completo |
| Análisis IA | OpenAI GPT-4o / GPT-4o-mini | Completo |
| Pagos | Stripe (checkout, portal, metered billing, webhooks) | Completo |
| Calendarios | Google Calendar API, Microsoft Graph API | Completo |
| Video | Zoom (S2S OAuth), Google Meet, Microsoft Teams | Completo |
| CRM | Salesforce, HubSpot, Pipedrive, Clio, Zoho, Dynamics 365 | Completo |
| Notificaciones | Slack, Sistema interno de notificaciones | Completo |
| Booking | SimplyBook.me (credenciales, no OAuth) | Parcial |

### 2.2 Flujo de Datos Principal

```
Contacto importado → Lista de contactos → Campaña (agent_run) creada
    → Call Queue generada → Bland AI ejecuta llamadas una por una
    → Bland AI retorna resultado vía webhook → Webhook procesa:
        1. call_logs (registro)
        2. contacts (actualización de status)
        3. calendar_events (creación/modificación)
        4. follow_up_queue (si necesita reintento)
        5. voicemail_logs (si buzón de voz)
        6. CRM sync (Pipedrive, Clio outbound)
        7. Outbound webhooks (Zapier/Make/n8n)
```

### 2.3 Agentes de Voz Disponibles

| Agente | Slug | Categoría | Capacidades de Calendario |
|--------|------|-----------|--------------------------|
| Appointment Confirmation | `appointment-confirmation` | appointment | Confirmar, reagendar, manejar no-shows, leer contexto de calendario |
| Data Validation | `data-validation` | verification | Agendar callbacks, programar follow-ups |
| Lead Qualification | `lead-qualification` | sales | Agendar reuniones con video links, verificar disponibilidad |

### 2.4 Planes y Restricciones

| Plan | Precio/mes | Minutos | Agentes | Integraciones Calendar | CRM |
|------|-----------|---------|---------|----------------------|-----|
| Free | $0 | 15 (único) | 1 (bloqueado) | Google Calendar + Meet | No |
| Starter | $X | 300 | 1 (intercambiable) | Google + Meet + Zoom + SimplyBook | No |
| Business | $299 | 1,200 | Ilimitados | Google + Outlook + Meet + Zoom + Teams | HubSpot, Pipedrive, Zoho |
| Teams | $649 | 2,500 | Ilimitados | Todo | Todo + Salesforce, Dynamics, Clio |
| Enterprise | $1,499 | 6,000 | Ilimitados | Todo | Todo |

---

## 3. PERFIL DEL USUARIO SIMULADO

### Persona: Dra. María Elena Gutiérrez
- **Rol:** Dueña de Clínica Privada "Salud Integral"
- **Ubicación:** Miami, FL (timezone: America/New_York)
- **Tamaño:** 3 doctores, 2 recepcionistas, ~150 citas/semana
- **Problema principal:** 18-22% de no-shows mensuales (~$12,000/mes perdidos)
- **Sistemas actuales:**
  - Google Calendar (Dr. García - medicina general)
  - Microsoft Outlook (Dra. Rodríguez - dermatología)
  - SimplyBook.me (portal de reservas para pacientes)
- **Plan seleccionado:** Business ($299/mes) - necesita Google + Outlook + CRM
- **Expectativas:**
  1. Reducir no-shows del 20% al 8% o menos
  2. Que las confirmaciones/reagendamientos se reflejen en sus 3 calendarios
  3. Que los pacientes que no contestan reciban seguimiento automático
  4. Acceso a métricas de rendimiento

---

## 4. SIMULACIÓN: APPOINTMENT CONFIRMATION AGENT

### Escenario 4.1: Paciente Confirma la Cita (Happy Path)

**Contexto:** María García tiene cita con Dr. García mañana a las 10:00 AM. La cita fue creada en Google Calendar y sincronizada a Callengo.

**Simulación del flujo:**

1. **Setup:** La Dra. Gutiérrez conecta Google Calendar vía OAuth (`/api/integrations/google-calendar/connect`). El sistema genera auth URL con scopes `calendar`, `calendar.events`, `userinfo.email`, `userinfo.profile`. ✅ **FUNCIONA**

2. **Sync:** Las citas se sincronizan automáticamente (`syncGoogleCalendarToCallengo()`). La cita de María García aparece en `calendar_events` con `external_event_id` del evento de Google. ✅ **FUNCIONA**

3. **Campaña:** La Dra. crea una campaña de appointment confirmation:
   - Selecciona el agente "Appointment Confirmation"
   - Selecciona los contactos con citas para mañana
   - Configura: voz "maya", max_duration 5 min, voicemail_action "leave_message"
   - ✅ **FUNCIONA** - el `agent_run` se crea con settings incluyendo `calendarConfig`

4. **Llamada:** Bland AI llama a María García. Primera frase: *"Hi María, this is [agent_name] calling from Salud Integral. I'm calling to confirm your appointment scheduled for tomorrow at 10 AM. Are you still able to make it?"*

5. **Respuesta del paciente:** *"Yes, I'll be there!"*

6. **Webhook procesado:** Bland retorna:
   - `concatenated_transcript` contiene "yes" y "I'll be there"
   - El webhook detecta `appointmentConfirmed` via keyword matching:
     ```javascript
     const appointmentConfirmed =
       transcript.includes('confirm') ||
       transcript.includes('i\'ll be there') ||
       transcript.includes('yes') ||
       metadata?.appointment_confirmed;
     ```
   - ⚠️ **RIESGO:** Si el paciente dice "yes, but I need to change the time", el sistema lo marcaría como confirmado incorrectamente porque detectó "yes".

7. **Sincronización:** `syncConfirmAppointment()` ejecuta:
   - Actualiza `calendar_events.confirmation_status = 'confirmed'` ✅
   - Actualiza `calendar_events.status = 'confirmed'` ✅
   - Pushea el cambio a Google Calendar via `updateGoogleEvent()` ✅
   - Pushea a Microsoft Outlook si existe via `updateMicrosoftEvent()` ✅
   - Actualiza `contacts.call_outcome = 'Appointment Confirmed'` ✅
   - Actualiza `contacts.custom_fields.appointment_confirmed = true` ✅
   - Dispatcha webhook event `appointment.confirmed` ✅
   - Incrementa `agent_runs.successful_calls` ✅

**Resultado:** ✅ EXITOSO con reservas
- La cita se confirma en Callengo, Google Calendar y Outlook
- **PROBLEMA DETECTADO:** La confirmación se refleja solo como metadatos en extendedProperties del evento de Google. El título del evento NO se modifica para indicar "[CONFIRMED]". El staff de la clínica tendría que entrar a Callengo para ver el status, no lo vería directamente en Google Calendar.
- **IMPACTO:** MEDIO - El recepcionista no puede distinguir citas confirmadas de no confirmadas mirando solo Google Calendar.

**Probabilidad de éxito de este escenario: 85%**

---

### Escenario 4.2: Paciente Necesita Reagendar

**Contexto:** Roberto López tiene cita el jueves a las 2 PM pero necesita cambiarla al viernes.

**Simulación del flujo:**

1. **Llamada:** El agente llama a Roberto. Roberto dice: *"I can't make it Thursday, can we move it to Friday at 3 PM?"*

2. **Webhook procesado:** El transcript contiene "can't make it" y "move":
   ```javascript
   const needsReschedule =
     transcript.includes('reschedule') ||
     transcript.includes('move') ||
     transcript.includes('different time') ||
     transcript.includes('can\'t make it') ||
     metadata?.needs_reschedule;
   ```
   ✅ Detecta correctamente la intención de reagendar.

3. **Extracción del nuevo horario:**
   - ⚠️ **PROBLEMA CRÍTICO:** El sistema depende de `metadata.new_appointment_time` para obtener la nueva hora. Esta metadata debe ser enviada por Bland AI como parte de su análisis del transcript.
   - Bland AI usa `analysis_questions` del template para extraer datos estructurados, pero **no hay evidencia de que el template tenga analysis_questions configuradas para extraer el nuevo horario**.
   - Si `metadata.new_appointment_time` no existe, el bloque de rescheduling ejecuta pero **no hace nada** porque está condicionado a `if (newStart)`:
     ```javascript
     if (newStart) {
       await syncRescheduleAppointment({...});
     }
     ```
   - **RESULTADO:** La intención se detecta pero el reagendamiento **NO se ejecuta** si Bland no extrae la fecha.

4. **Si la metadata SÍ contiene la nueva hora (best case):**
   - `syncRescheduleAppointment()` ejecuta:
     - Actualiza `calendar_events` con nuevo `start_time` y `end_time` ✅
     - Guarda `original_start_time` para referencia ✅
     - Incrementa `rescheduled_count` ✅
     - Pushea cambio a Google Calendar ✅
     - Pushea cambio a Microsoft Outlook ✅
     - Actualiza `contacts.custom_fields` con nueva fecha y razón ✅
     - Dispatcha `appointment.rescheduled` webhook ✅

5. **Verificación de disponibilidad:**
   - ⚠️ **PROBLEMA:** El agente le dice al paciente que puede reagendar, pero **no verifica disponibilidad en tiempo real durante la llamada**. La función `getNextAvailableSlot()` existe pero **no está conectada al prompt de Bland AI**. Bland AI no tiene acceso a la API de disponibilidad durante la llamada.
   - **IMPACTO:** ALTO - El agente podría confirmar un horario que ya está ocupado.

**Resultado:** ⚠️ PARCIALMENTE EXITOSO
- La detección de intención funciona
- La sincronización a calendarios funciona
- **FALLA:** No hay verificación de disponibilidad en tiempo real
- **FALLA:** Depende de que Bland AI extraiga la fecha exacta del transcript

**Probabilidad de éxito de este escenario: 55%**

---

### Escenario 4.3: Paciente No Contesta (No-Show / Voicemail)

**Contexto:** Ana Martínez no contesta la llamada. El sistema detecta buzón de voz.

**Simulación del flujo:**

1. **Llamada:** Bland AI llama a Ana. No contesta. El sistema detecta voicemail (`answered_by === 'voicemail'`).

2. **Voicemail:** Si `voicemail_action === 'leave_message'`, el agente deja un mensaje usando el `voicemail_template`:
   *"Hi Ana, this is [agent_name] from Salud Integral. I was calling to confirm your appointment for [date]. Please give us a call back to confirm. Thank you!"*
   ✅ **FUNCIONA**

3. **Webhook procesado - Callback scheduling:**
   ```javascript
   if (answered_by === 'voicemail' || status === 'no_answer' || status === 'voicemail') {
     const callbackDate = new Date();
     callbackDate.setDate(callbackDate.getDate() + 1);
     callbackDate.setHours(10, 0, 0, 0);
     await createAgentCallback(companyId, {
       contactId, contactName, contactPhone,
       callbackDate: callbackDate.toISOString(),
       agentName: metadata?.agent_name || 'AI Agent',
       reason: 'voicemail',
       notes: summary || `Auto-scheduled callback after voicemail`,
     });
   }
   ```
   ✅ Crea un evento de callback en el calendario para mañana a las 10 AM.

4. **Sincronización del callback:**
   - Se crea `calendar_events` con `event_type: 'voicemail_followup'` ✅
   - Se pushea a Google Calendar ✅
   - Se pushea a Microsoft Outlook ✅
   - Se crea entrada en `follow_up_queue` si hay `agent_run_id` ✅

5. **No-Show handling (si la cita ya pasó):**
   - Si `calendarConfig.noShowAutoRetry !== false` (default true):
     - `syncHandleNoShow()` marca el evento original como `status: 'no_show'`
     - Crea un evento de retry automáticamente
     - Actualiza `contacts.call_outcome = 'No Show'`
     - Incrementa `contacts.custom_fields.no_show_count`
     - ✅ **FUNCIONA** - Sistema de retry automático bien implementado

6. **Métricas actualizadas:**
   - `agent_runs.voicemails_detected++` ✅
   - `agent_runs.voicemails_left++` ✅
   - `agent_runs.follow_ups_scheduled++` ✅

**Resultado:** ✅ EXITOSO
- El flujo de voicemail y no-show está bien implementado
- Los callbacks se programan automáticamente
- Los eventos aparecen en Google Calendar y Outlook
- Las métricas se actualizan correctamente

**Probabilidad de éxito de este escenario: 90%**

---

## 5. SIMULACIÓN: DATA VALIDATION AGENT

### Escenario 5.1: Verificación Exitosa de Datos

**Contexto:** La clínica necesita verificar emails y teléfonos de su base de 500 pacientes antes de enviar un newsletter anual.

**Simulación del flujo:**

1. **Importación:** La Dra. Gutiérrez importa un CSV con 500 contactos via `/api/contacts/import`. El sistema:
   - Parsea el CSV con `parse-csv` endpoint ✅
   - Auto-detecta columnas (nombre, teléfono, email) ✅
   - Asigna a una lista "Verificación Anual" ✅
   - Valida formato E.164 para teléfonos ✅

2. **Campaña:** Crea campaña con Data Validation Agent:
   - Task template: *"Call [contact_name] to verify and update their contact information for Salud Integral..."*
   - First sentence: *"Hi [name], this is [agent] calling from Salud Integral. I'm calling to quickly verify your contact information..."*

3. **Llamada exitosa:** El paciente confirma: *"Yes, my email is still john@email.com and my phone is the same."*

4. **Análisis post-llamada:** El endpoint `/api/bland/analyze-call` usa OpenAI GPT-4o para extraer datos estructurados:
   - `verified_address`, `contact_name`, `email`, `phone`
   - `business_confirmed`, `sentiment`, `interest_level`
   - ✅ **FUNCIONA** - El análisis es semántico, no keyword-based

5. **Actualización de contacto:**
   - `contacts.status = 'contacted'` ✅
   - `contacts.call_outcome` actualizado ✅
   - `contacts.analysis` almacena el resultado del análisis ✅

**Resultado:** ✅ EXITOSO
- El flujo de verificación funciona de extremo a extremo
- El análisis por GPT-4o es superior a keyword matching
- Los datos se actualizan correctamente

**Probabilidad de éxito: 92%**

---

### Escenario 5.2: Paciente Ocupado Solicita Callback

**Contexto:** Laura Sánchez contesta pero dice que está ocupada y pide que la llamen en 2 horas.

**Simulación del flujo:**

1. **Llamada:** Laura dice: *"I'm busy right now, can you call me back in about 2 hours?"*

2. **Webhook procesado:**
   - El agente marca `metadata.callback_requested = true` (si Bland lo extrae)
   - El agente marca `metadata.callback_date` con la hora calculada (si Bland lo extrae)

3. **Callback scheduling:**
   ```javascript
   if (callbackRequested) {
     const callbackDate = metadata?.callback_date
       || new Date(Date.now() + (calendarConfig.followUpIntervalHours || 24) * 60 * 60 * 1000).toISOString();
     await syncScheduleCallback({...});
   }
   ```

4. **Problemas identificados:**
   - ⚠️ Si Bland no extrae `callback_requested` de su metadata, el callback NO se programa
   - ⚠️ Si Bland no extrae la hora específica ("2 horas"), el sistema usa el default de 24 horas, lo cual no es lo que la paciente pidió
   - El sistema de follow-up automático (`auto_create_followup` trigger) SÍ se activa si el call_log tiene status no_answer/busy, pero Laura SÍ contestó
   - **RESULTADO:** El callback probablemente se programa pero con el timing incorrecto (24h en vez de 2h)

5. **Si funciona correctamente:**
   - Se crea `calendar_events` con `event_type: 'callback'` ✅
   - Se crea `follow_up_queue` entry ✅
   - Se sincroniza a Google/Outlook ✅

**Resultado:** ⚠️ PARCIALMENTE EXITOSO
- El mecanismo existe pero depende de la capacidad de Bland AI para extraer metadata estructurada
- El timing del callback probablemente será incorrecto

**Probabilidad de éxito: 60%**

---

### Escenario 5.3: Datos del Paciente Han Cambiado

**Contexto:** Pedro Ramírez cambió de email y dirección. El agente necesita actualizar los datos.

**Simulación del flujo:**

1. **Llamada:** Pedro dice: *"Actually, I moved to 456 Oak Street, and my new email is pedro.new@gmail.com"*

2. **Análisis:** El endpoint `/api/bland/analyze-call` con GPT-4o extraería:
   ```json
   {
     "verified_address": "456 Oak Street",
     "email": "pedro.new@gmail.com",
     "data_changed": true
   }
   ```

3. **Actualización:**
   - ⚠️ **PROBLEMA:** El webhook NO actualiza automáticamente los campos del contacto con los nuevos datos extraídos del análisis. Solo actualiza `call_status`, `call_duration`, `recording_url`, `transcript_text`.
   - Los datos extraídos por GPT-4o se almacenan en `call_logs.analysis` pero **NO se escriben de vuelta en `contacts.email` o `contacts.address`**.
   - Un usuario tendría que ir manualmente a revisar el análisis y actualizar los datos del contacto.
   - **IMPACTO:** ALTO - Esto anula parcialmente el propósito del Data Validation Agent.

4. **Lo que SÍ funciona:**
   - El transcript se guarda completo ✅
   - El análisis GPT-4o identifica los cambios ✅
   - El recording se almacena ✅
   - El CRM se puede sincronizar con Pipedrive/Clio (si configurado) ✅

**Resultado:** ⚠️ PARCIALMENTE EXITOSO
- El agente recopila los datos nuevos exitosamente
- Pero los datos NO se actualizan automáticamente en el perfil del contacto
- Requiere intervención manual

**Probabilidad de éxito: 50%** (por la falta de auto-update)

---

## 6. SIMULACIÓN: LEAD QUALIFICATION AGENT

### Escenario 6.1: Lead Calificado que Agenda Reunión

**Contexto:** La clínica ofrece un nuevo servicio de medicina estética. Carlos Mendoza llamó interesado. El agente lo califica.

**Simulación del flujo:**

1. **Llamada:** El agente usa BANT framework:
   - Budget: *"We have some flexibility, probably around $5,000"* ✅
   - Authority: *"I make the decisions for my family"* ✅
   - Need: *"I want to explore botox options"* ✅
   - Timeline: *"Ideally within the next month"* ✅

2. **Lead calificado - scheduling:**
   - El agente ofrece: *"Would you like to schedule a consultation with Dr. Rodríguez?"*
   - Carlos: *"Sure, how about next Tuesday at 2 PM?"*

3. **Procesamiento (si metadata contiene `meeting_time`):**
   ```javascript
   if (meetingRequested && metadata?.meeting_time) {
     await syncScheduleMeeting({
       companyId, contactId, contactName,
       startTime: metadata.meeting_time,
       endTime: calculated,
       title: `Meeting: Carlos Mendoza`,
       description: `Qualified lead meeting with Carlos Mendoza`,
       videoProvider: calendarConfig.preferredVideoProvider || 'none',
     });
   }
   ```

4. **Creación de evento:**
   - `calendar_events` creado con `event_type: 'meeting'`, `source: 'ai_agent'` ✅
   - Si `videoProvider === 'google_meet'`: se crea Google Meet link automáticamente ✅
   - Si `videoProvider === 'zoom'`: se crea Zoom meeting via S2S OAuth ✅
   - Si `videoProvider === 'microsoft_teams'`: se crea Teams link ✅
   - Evento pusheado a Google Calendar Y Microsoft Outlook ✅
   - `contacts.status = 'qualified'`, `call_outcome = 'Meeting Scheduled'` ✅
   - Webhook `appointment.scheduled` disparado ✅

5. **Video link handling:**
   - El sistema tiene lógica sofisticada de ordenamiento:
     - Zoom: crea meeting primero, luego pushea a ambos calendarios con el link
     - Google Meet: pushea a Google primero (crea Meet link), luego a Microsoft con el link
     - Microsoft Teams: pushea a Microsoft primero (crea Teams link), luego a Google con el link
   - ✅ **BIEN IMPLEMENTADO** - Manejo inteligente de video providers

**Resultado:** ✅ EXITOSO (condicionado a metadata)
- Si Bland extrae `meeting_time` del transcript: flujo completo funciona
- Video links se generan correctamente
- Sincronización multi-calendario funciona

**Probabilidad de éxito: 70%** (dependiente de extracción de metadata por Bland)

---

### Escenario 6.2: Lead No Calificado que Pide Información

**Contexto:** Ana Rivera llama interesada pero no tiene presupuesto definido y necesita consultar con su esposo.

**Simulación del flujo:**

1. **Llamada:** El agente aplica BANT:
   - Budget: *"I don't really have a budget in mind"*
   - Authority: *"I need to talk to my husband first"*
   - Need: *"I'm just exploring options"*
   - Timeline: *"No rush"*

2. **Resultado:** Lead clasificado como "cold" o "warm"
   - No se agenda reunión (no hay `metadata.meeting_scheduled`)
   - El agente podría ofrecer callback: *"Would you like me to call you back once you've had a chance to discuss with your husband?"*

3. **Callback (si se solicita):**
   - Se programa via `syncScheduleCallback()` ✅
   - Se crea `follow_up_queue` entry ✅
   - Se sincroniza a calendarios ✅

4. **Análisis almacenado:**
   - `call_logs.analysis` contiene scoring del lead ✅
   - `contacts.call_outcome` actualizado ✅
   - Pero: `contacts.status` se queda como estaba (no se marca como 'cold' automáticamente) ⚠️

**Resultado:** ✅ EXITOSO
- El flujo de no-calificación funciona correctamente
- El callback se programa si se solicita
- Los datos de calificación se almacenan para revisión

**Probabilidad de éxito: 80%**

---

### Escenario 6.3: Lead Interesado pero Quiere Video Call con Doctor Específico

**Contexto:** Miguel Torres quiere una consulta virtual con la Dra. Rodríguez específicamente, a través de Zoom.

**Simulación del flujo:**

1. **Llamada:** Miguel dice: *"I'd like to schedule a Zoom consultation with Dr. Rodriguez specifically"*

2. **Procesamiento:**
   - El agente intenta agendar con `preferredVideoProvider: 'zoom'`
   - ⚠️ **PROBLEMA:** El agente no tiene forma de asignar la cita a un doctor específico. El campo `calendar_events.attendees` existe pero no hay lógica para routing a un calendar de un miembro del equipo específico.
   - El evento se crea en el calendario de la COMPAÑÍA, no en el calendario personal de Dra. Rodríguez.
   - Si Dra. Rodríguez usa Outlook y la clínica tiene Outlook conectado, el evento aparecerá en el Outlook compartido, pero no necesariamente en su calendario personal.

3. **Zoom meeting:**
   - Se crea via `createZoomMeeting()` usando S2S OAuth ✅
   - El `join_url` se almacena en `calendar_events.video_link` ✅
   - El link aparece en la descripción del evento de Google Calendar ✅
   - ✅ **FUNCIONA** técnicamente

4. **Disponibilidad:**
   - `getAvailability()` verifica slots libres en todos los calendarios conectados ✅
   - Incluye verificación de Google + Microsoft + eventos locales ✅
   - Excluye feriados federales de US ✅
   - Respeta horarios de trabajo configurados ✅
   - ⚠️ Pero: no filtra por calendario de un doctor específico

**Resultado:** ⚠️ PARCIALMENTE EXITOSO
- Zoom meeting se crea correctamente
- Pero no hay routing por doctor/recurso
- La disponibilidad es a nivel de compañía, no por individuo

**Probabilidad de éxito: 55%**

---

## 7. AUDITORÍA DE INTEGRACIONES DE CALENDARIO

### 7.1 Google Calendar

| Funcionalidad | Estado | Notas |
|---------------|--------|-------|
| Conexión OAuth | ✅ Completo | Scopes correctos, refresh token, prompt: consent |
| Sync inbound (Google → Callengo) | ✅ Completo | Full sync + incremental (sync tokens), paginated |
| Sync outbound (Callengo → Google) | ✅ Completo | Create, update, delete, cancel |
| Google Meet links | ✅ Completo | conferenceData con hangoutsMeet |
| Token refresh automático | ✅ Completo | 5 min buffer, auto-deactivate si falla |
| Extended properties | ✅ Completo | callengo_event_id, callengo_type, callengo_status |
| Fallback a 'primary' | ✅ Completo | Si calendar ID no existe, retry con 'primary' |
| Sync token persistence | ✅ Completo | Almacenado en calendar_integrations.sync_token |

**Evaluación: 9.5/10** - Integración muy robusta.

### 7.2 Microsoft Outlook

| Funcionalidad | Estado | Notas |
|---------------|--------|-------|
| Conexión OAuth | ✅ Completo | Microsoft Graph API, tenant configurable |
| Sync inbound (Outlook → Callengo) | ✅ Completo | deltaLink para incremental sync |
| Sync outbound (Callengo → Outlook) | ✅ Completo | Create, update, delete |
| Microsoft Teams links | ✅ Completo | isOnlineMeeting: true, onlineMeetingProvider: 'teamsForBusiness' |
| Token refresh | ✅ Completo | Con retry automático |
| Calendar selection | ✅ Completo | microsoft_calendar_id configurable |
| Delete vs Cancel | ✅ Correcto | Usa DELETE en Graph API (no PATCH) para cancelar |

**Evaluación: 9/10** - Integración sólida, ligeramente menos madura que Google.

### 7.3 SimplyBook.me

| Funcionalidad | Estado | Notas |
|---------------|--------|-------|
| Conexión | ⚠️ Parcial | Credenciales (no OAuth), token expira en 20h |
| Bookings sync | ⚠️ Parcial | Endpoint existe (`/api/integrations/simplybook/bookings`) pero no hay integración con calendar_events |
| Clients sync | ⚠️ Parcial | Endpoint existe pero no sincroniza a contacts automáticamente |
| Providers listing | ✅ Existe | Puede listar proveedores de la cuenta |
| Tabla de DB | ❌ PROBLEMA | `simplybook_integrations` se referencia en código pero NO aparece en el esquema principal de la BD |
| Token renewal | ⚠️ Manual | Token expira cada 20h, necesita re-autenticación |
| Calendar feed | ❌ No existe | Las reservas de SimplyBook NO se convierten en calendar_events |
| Appointment Confirmation integration | ❌ No existe | El agente de appointment confirmation NO puede leer citas de SimplyBook |

**Evaluación: 4/10** - Integración incompleta. El usuario de SimplyBook.me no puede usar el agente de appointment confirmation con sus reservas de SimplyBook.

### 7.4 Zoom

| Funcionalidad | Estado | Notas |
|---------------|--------|-------|
| S2S OAuth | ✅ Completo | Server-to-server, no requiere user consent |
| Meeting creation | ✅ Completo | Crea meetings con join_url |
| Link injection | ✅ Completo | Se inyecta en calendar events y descriptions |
| Token management | ✅ Completo | Caché de 50 minutos |

**Evaluación: 9/10** - Bien implementado.

### 7.5 Slack (Calendario de notificaciones)

| Funcionalidad | Estado | Notas |
|---------------|--------|-------|
| OAuth | ✅ Completo | Scopes correctos |
| Slash commands | ✅ Completo | /callengo today, upcoming, reschedule, mark-no-show |
| Button actions | ✅ Completo | confirm_event, cancel_event, no_show_event |
| Signature verification | ✅ Completo | HMAC-SHA256 |

**Evaluación: 8.5/10** - Buena integración de notificaciones.

---

## 8. AUDITORÍA DE INTEGRACIONES CRM

### 8.1 Resumen de CRM

| CRM | Inbound Sync | Outbound Sync | Bidirectional | Push desde Webhook | Plan |
|-----|-------------|---------------|---------------|-------------------|------|
| HubSpot | ✅ Full/Selective | ❌ | ❌ | ❌ | Business+ |
| Salesforce | ✅ Contacts + Leads | ❌ | ❌ | ❌ | Teams+ |
| Pipedrive | ✅ Full/Selective | ✅ Push + Notes | ✅ | ✅ Webhook | Business+ |
| Clio | ✅ Full/Selective | ✅ Notes only | ⚠️ Limitado | ✅ Webhook | Teams+ |
| Zoho | ✅ Contacts + Leads | ✅ Updates + Notes | ✅ Non-destructive | ❌ | Business+ |
| Dynamics 365 | ✅ Full/Selective | ❌ | ❌ | ❌ | Teams+ |

**Observación clave para la clínica:** La Dra. Gutiérrez necesitaría al menos plan Business ($299) para tener CRM. Si usa un CRM médico como Clio (para prácticas legales realmente, no médicas), necesitaría Teams ($649).

**Evaluación general CRM: 7.5/10** - Buen coverage pero sync unidireccional en la mayoría.

---

## 9. PROBLEMAS IDENTIFICADOS Y CALLEJONES SIN SALIDA

### 9.1 Problemas Críticos (Showstoppers)

#### P1: Detección de intención basada en keywords (no semántica)
- **Archivo:** `src/app/api/bland/webhook/route.ts:248-263`
- **Problema:** El sistema determina si una cita fue confirmada, reagendada o es no-show usando `transcript.includes()`. Esto es:
  - Propenso a falsos positivos ("Yes, I need to reschedule" → detecta "yes" como confirmación)
  - Propenso a falsos negativos ("I can definitely be there" → no contiene "confirm" ni "yes" ni "i'll be there")
  - No maneja idiomas mixtos (inglés/español) que serían comunes en Miami
- **Solución recomendada:** Usar OpenAI GPT-4o para clasificar la intención del transcript (similar a como ya se usa en `/api/bland/analyze-call`) y retornar un JSON estructurado con `intent: 'confirm' | 'reschedule' | 'cancel' | 'no_show' | 'callback' | 'undetermined'`.

#### P2: SimplyBook.me no alimenta el pipeline de Appointment Confirmation
- **Problema:** Las reservas de SimplyBook no se convierten en `calendar_events`, por lo tanto el agente de appointment confirmation no puede confirmar citas creadas en SimplyBook.
- **Impacto:** Un usuario que usa SimplyBook como su sistema de reservas (muchas clínicas lo usan) NO puede usar la funcionalidad core de Callengo.
- **Solución recomendada:** Crear un sync job que convierta bookings de SimplyBook en `calendar_events` con `source: 'simplybook'`, incluyendo `contact_id` mapping.

#### P3: Los datos validados por Data Validation no se escriben de vuelta al contacto
- **Archivo:** `src/app/api/bland/webhook/route.ts:108-133`
- **Problema:** Cuando un paciente proporciona datos actualizados (nuevo email, nueva dirección), estos se almacenan en el transcript y el análisis, pero NO actualizan `contacts.email`, `contacts.address`, etc.
- **Solución recomendada:** Después del análisis GPT-4o, si se detectan cambios en datos de contacto, ejecutar un UPDATE automático al contacto con los datos verificados.

### 9.2 Problemas Importantes (Degradan la Experiencia)

#### P4: No hay verificación de disponibilidad en tiempo real durante la llamada
- **Problema:** El agente de voz le dice al paciente "let me check available times" pero realmente no puede. Bland AI no tiene acceso a la API de disponibilidad durante la llamada.
- **Solución recomendada:** Usar Bland AI's "dynamic data" feature (si disponible) o usar webhooks intermedios para consultar disponibilidad.

#### P5: No hay routing por doctor/recurso
- **Problema:** Todas las citas se crean a nivel de compañía. No hay forma de asignar una cita a un doctor específico.
- **Impacto:** Para una clínica con múltiples doctores, esto es un deal-breaker parcial.
- **Solución recomendada:** Agregar un campo `assigned_to` en `calendar_events` y filtrar disponibilidad por recurso.

#### P6: Confirmaciones no visibles directamente en Google Calendar / Outlook
- **Problema:** Cuando una cita se confirma, solo se actualiza `extendedProperties` del evento de Google. El recepcionista no puede ver "[CONFIRMED]" en el título del evento.
- **Solución recomendada:** Modificar `updateGoogleEvent()` para prefijar el título con "[✓]" o "[CONFIRMED]" cuando `confirmation_status === 'confirmed'`.

#### P7: Token de SimplyBook expira cada 20 horas
- **Problema:** El token de SimplyBook tiene vida muy corta. Si el cron de sync falla durante la noche, la integración se desconecta.
- **Solución recomendada:** Implementar refresh automático del token antes de cada operación.

#### P8: El webhook de Bland no tiene análisis semántico del template de appointment
- **Problema:** El `analysis_questions` del template de agent no está configurado explícitamente en la migración. Bland AI puede no estar extrayendo `new_appointment_time`, `callback_requested`, `meeting_time` de forma estructurada.
- **Solución recomendada:** Configurar `analysis_questions` en el template con preguntas específicas:
  ```json
  [
    {"question": "Was the appointment confirmed?", "type": "boolean"},
    {"question": "Does the contact want to reschedule?", "type": "boolean"},
    {"question": "What is the new preferred date/time?", "type": "string"},
    {"question": "Does the contact want a callback?", "type": "boolean"},
    {"question": "What callback time was requested?", "type": "string"}
  ]
  ```

### 9.3 Problemas Menores (Nice to Fix)

#### P9: Duplicate RLS policies en varias tablas
- Hay policies duplicadas en tablas como `contacts`, `call_logs`, `company_settings`, `company_agents` (e.g., "Company members can manage contacts" Y "users_can_view_company_contacts" hacen lo mismo).
- **Impacto:** Performance negligible pero desorden en la administración.

#### P10: La función `auto_create_followup` trigger podría crear duplicados
- El trigger en `call_logs` para auto-crear follow-ups no verifica si ya existe un follow-up para ese contacto/agent_run.

#### P11: El agente habla solo en inglés
- Todos los templates (`first_sentence_template`, `voicemail_template`, `task_template`) están en inglés.
- **Para Miami:** Muchos pacientes preferirían español.
- **Solución:** Agregar `language` al agent_run settings y tener templates bilingües.

#### P12: No hay deduplicación en la importación de contactos
- Si se importa el mismo CSV dos veces, se crean contactos duplicados.
- No hay lógica de merge por email o teléfono.

---

## 10. SCORECARD DE SATISFACCIÓN AL CLIENTE

### Simulación: ¿Qué tan satisfecha estaría la Dra. Gutiérrez?

| Criterio | Peso | Puntuación (1-10) | Ponderado |
|----------|------|-------------------|-----------|
| **Facilidad de onboarding** | 10% | 8 | 0.80 |
| **Conexión de calendarios (Google)** | 15% | 9.5 | 1.43 |
| **Conexión de calendarios (Outlook)** | 10% | 9 | 0.90 |
| **Conexión de calendarios (SimplyBook)** | 10% | 4 | 0.40 |
| **Confirmación de citas funciona** | 15% | 7 | 1.05 |
| **Reagendamiento funciona** | 10% | 5.5 | 0.55 |
| **No-show handling funciona** | 10% | 9 | 0.90 |
| **Reflejo en calendarios externos** | 10% | 7.5 | 0.75 |
| **Métricas y reportes** | 5% | 8 | 0.40 |
| **Soporte multilingüe** | 5% | 3 | 0.15 |
| **TOTAL** | 100% | | **7.33/10** |

### Probabilidad de que la clínica logre sus objetivos:

| Objetivo | Probabilidad | Detalle |
|----------|-------------|---------|
| Reducir no-shows del 20% al 8% | **65%** | Funciona para citas en Google/Outlook pero no SimplyBook. La detección de intención podría fallar en ~15% de los casos. |
| Reducir cancellations | **70%** | El reagendamiento funciona si Bland extrae la metadata correctamente. Sin verificación de disponibilidad en tiempo real. |
| Rebook apropiado en calendario | **75%** | La sincronización bidireccional Google/Outlook es sólida. SimplyBook no se actualiza. |
| Reflejo en calendarios | **80%** | Google y Outlook se actualizan. SimplyBook no. Status de confirmación no visible en el título del evento. |

### Net Promoter Score Estimado: **6/10** (Passive)
La Dra. Gutiérrez probablemente diría: *"Funciona, me ayuda algo, pero no es tan fluido como esperaba. Tengo que hacer cosas manualmente que pensé que serían automáticas."*

---

## 11. ANÁLISIS COMPETITIVO Y PROPUESTA DE VALOR

### 11.1 Competidores Directos

| Competidor | Modelo | Fortaleza | Debilidad vs Callengo |
|-----------|--------|-----------|----------------------|
| **Luma Health** | SaaS médico | Integración nativa con EHR/EMR | No tiene IA de voz real, usa SMS/email |
| **Solutionreach** | SaaS dental/médico | Muy establecido en dental | Automatización básica, no IA conversacional |
| **NexHealth** | API-first | Excelente API, integra con PMS | No tiene agentes de voz autónomos |
| **Bland AI directo** | Platform | El motor de voz | No tiene CRM, calendario, ni campaign management |
| **Vapi.ai** | Voice AI platform | Más flexible, real-time | No tiene UI, no tiene integraciones listas |
| **Retell AI** | Voice AI | Baja latencia | Sin ecosystem de integraciones |

### 11.2 Ventaja Competitiva de Callengo

1. **Solución end-to-end:** No es solo voz, es voz + calendario + CRM + analytics + campaign management. Ningún competidor de voz IA ofrece esto completo.

2. **Multi-calendario real:** Google Calendar + Outlook + Zoom + Meet + Teams. Pocos competidores manejan ambos ecosistemas con sync bidireccional.

3. **Multi-CRM:** 6 CRMs integrados (HubSpot, Salesforce, Pipedrive, Clio, Zoho, Dynamics). Esto es impresionante para su etapa.

4. **Campaign management:** Agent runs con follow-ups, voicemail handling, call queue, y métricas. Esto es un diferenciador fuerte.

5. **Webhooks outbound:** Zapier/Make/n8n integration. Permite a usuarios avanzados extender la plataforma.

6. **Pricing accesible:** $299/mes por 1,200 minutos con todas las integraciones. Competidores como Solutionreach cobran $350+/mes por funcionalidad inferior.

### 11.3 Propuesta de Valor (Resumen)

**"Callengo es el único sistema que combina agentes de voz IA autónomos con gestión de campañas, sincronización multi-calendario bidireccional, y 6 integraciones CRM nativas, permitiendo a clínicas y negocios de servicios reducir no-shows, validar datos y calificar leads sin intervención humana."**

### 11.4 Moat (Barrera de Entrada)

| Factor | Fuerza del Moat |
|--------|----------------|
| Integraciones (14+ servicios) | ⭐⭐⭐⭐ Fuerte |
| Campaign management + analytics | ⭐⭐⭐ Medio |
| Voice AI (usa Bland, no propio) | ⭐⭐ Débil (depende de tercero) |
| Data/network effects | ⭐ Muy débil (no hay) |
| Brand | ⭐ En construcción |

**Riesgo principal:** La dependencia de Bland AI como motor de voz. Si Bland cambia precios, calidad, o deja de existir, Callengo pierde su capacidad core. Considerar abstracción del voice provider para soportar Vapi, Retell, o Twilio AI como alternativas.

---

## 12. OPINIÓN DEL AUDITOR EXTERNO

### Mi Evaluación Profesional como IA de Auditoría

Después de analizar exhaustivamente las 50+ tablas de base de datos, 104 endpoints de API, toda la lógica de calendario (1,200+ líneas), el sistema de webhooks, los templates de agentes, las migraciones, el frontend completo, y simular 9 escenarios reales, esta es mi opinión:

### Lo que está EXCEPCIONALMENTE bien hecho:

1. **Arquitectura de calendario:** El sistema `lib/calendar/` es sofisticado. La lógica de video provider ordering (Zoom primero, luego calendarios; o Google primero para Meet, luego Microsoft) demuestra pensamiento profundo. El sistema de availability con holidays, working hours, y conflict detection es robusto.

2. **Webhook processing:** El webhook de Bland es un orquestador impresionante. En un solo endpoint maneja: call logging, contact updates, calendar events, follow-ups, voicemail logs, CRM sync (Pipedrive, Clio), y outbound webhooks. Todo con error isolation (try/catch non-fatal para cada sección).

3. **RLS policies:** La seguridad a nivel de row está bien implementada. Company isolation es consistente en toda la base de datos.

4. **Billing system:** Stripe integration con metered billing, overage tracking, budget alerts, y subscription lifecycle management es production-ready.

5. **Migración strategy:** Las migraciones SQL son incrementales, bien documentadas, y manejan upserts con ON CONFLICT correctamente.

### Lo que necesita trabajo URGENTE:

1. **La brecha de inteligencia:** El sistema tiene un motor de voz inteligente (Bland AI) y un motor de análisis inteligente (OpenAI GPT-4o), pero el **puente entre ellos** (el webhook) es "tonto" - usa keyword matching. Esto es la debilidad #1 de toda la plataforma. La solución es pasar el transcript por GPT-4o en el webhook ANTES de tomar decisiones.

2. **SimplyBook.me es un MVP incompleto:** Tiene connect/disconnect pero no tiene el sync que alimentaría los flujos principales. Para el mercado de clínicas, esto es un gap importante.

3. **Auto-update de datos validados:** El Data Validation Agent pierde la mitad de su valor si no actualiza los datos automáticamente.

4. **Internacionalización:** Para el mercado latinoamericano y Miami, los templates solo en inglés son una barrera.

### Valoración general del proyecto:

| Aspecto | Calificación |
|---------|-------------|
| Visión del producto | ⭐⭐⭐⭐⭐ (10/10) |
| Arquitectura técnica | ⭐⭐⭐⭐ (8.5/10) |
| Completitud del MVP | ⭐⭐⭐⭐ (7.5/10) |
| Production readiness | ⭐⭐⭐ (7/10) |
| UX/flujo del usuario | ⭐⭐⭐⭐ (8/10) |
| Integraciones | ⭐⭐⭐⭐ (8.5/10) |
| Monetización | ⭐⭐⭐⭐ (8/10) |
| Escalabilidad | ⭐⭐⭐⭐ (8/10) |
| **PROMEDIO GENERAL** | **8.2/10** |

### Conclusión:

Callengo está en un **estado impresionante para su etapa de desarrollo**. La base arquitectónica es sólida, el ecosistema de integraciones es extenso, y la visión del producto es clara y viable comercialmente. Los problemas identificados son todos solucionables en 2-4 sprints de desarrollo. El problema más crítico (detección de intención por keywords) es un fix de ~2 días que elevaría significativamente la confiabilidad del producto.

**Mi recomendación:** No lanzar al mercado de clínicas hasta resolver P1 (detección semántica), P2 (SimplyBook sync), P3 (auto-update de datos), y P6 (confirmación visible en calendarios). Estos 4 fixes transformarían el producto de "funciona con limitaciones" a "funciona de forma impresionante".

---

## 13. ROADMAP DE CORRECCIONES PRIORITARIAS

### Sprint 1 (Semana 1-2): Fixes Críticos

| # | Fix | Esfuerzo | Impacto | Archivos |
|---|-----|----------|---------|----------|
| 1 | Reemplazar keyword matching con GPT-4o classification en webhook | 2 días | ⭐⭐⭐⭐⭐ | `src/app/api/bland/webhook/route.ts` |
| 2 | Configurar `analysis_questions` en templates de agentes | 0.5 días | ⭐⭐⭐⭐⭐ | Migración SQL nueva |
| 3 | Auto-update contactos con datos del análisis GPT-4o | 1 día | ⭐⭐⭐⭐ | `src/app/api/bland/webhook/route.ts` |
| 4 | Prefijar títulos de eventos confirmados "[✓]" en Google/Outlook | 0.5 días | ⭐⭐⭐⭐ | `src/lib/calendar/sync.ts` |

### Sprint 2 (Semana 3-4): SimplyBook + i18n

| # | Fix | Esfuerzo | Impacto |
|---|-----|----------|---------|
| 5 | SimplyBook bookings → calendar_events sync job | 3 días | ⭐⭐⭐⭐⭐ |
| 6 | Templates bilingües (EN/ES) con selección por contacto | 2 días | ⭐⭐⭐⭐ |
| 7 | Token renewal automático de SimplyBook | 1 día | ⭐⭐⭐ |
| 8 | Deduplicación de contactos en importación | 1 día | ⭐⭐⭐ |

### Sprint 3 (Semana 5-6): Mejoras de Experiencia

| # | Fix | Esfuerzo | Impacto |
|---|-----|----------|---------|
| 9 | Routing por doctor/recurso en calendario | 3 días | ⭐⭐⭐⭐ |
| 10 | Disponibilidad en tiempo real (Bland dynamic data) | 2 días | ⭐⭐⭐⭐ |
| 11 | Limpieza de RLS policies duplicadas | 1 día | ⭐⭐ |
| 12 | Guard contra follow-ups duplicados | 0.5 días | ⭐⭐⭐ |

### Post-Sprint: Estratégico

| # | Iniciativa | Esfuerzo | Impacto |
|---|-----------|----------|---------|
| 13 | Abstracción de voice provider (multi-provider support) | 2 semanas | ⭐⭐⭐⭐⭐ |
| 14 | Dashboard de recepcionista (vista simplificada) | 1 semana | ⭐⭐⭐⭐ |
| 15 | SMS fallback cuando no hay respuesta a llamada | 3 días | ⭐⭐⭐⭐ |
| 16 | Patient portal (enlace para auto-confirmar/reagendar) | 1 semana | ⭐⭐⭐⭐⭐ |

---

## APÉNDICE A: INVENTARIO DE ENDPOINTS API

Total: **104 endpoints**

### Distribución por Categoría:
- Billing/Stripe: 13 endpoints
- Contacts: 10 endpoints
- Bland AI/Voice: 7 endpoints
- Calendar: 4 endpoints
- Integrations: 53 endpoints (6 CRMs + Calendar + Sheets + Slack + Zoom + SimplyBook + Webhooks)
- Team: 5 endpoints
- AI/OpenAI: 4 endpoints
- Admin: 2 endpoints
- Settings: 3 endpoints
- Auth: 2 endpoints
- Misc: 1 endpoint

### Distribución por Servicio Externo:
- Bland AI: 3 direct calls
- OpenAI: 3 direct calls (GPT-4o, GPT-4o-mini)
- Stripe: 8 direct calls
- Google APIs: 5 services (Calendar, Meet, Sheets, OAuth, UserInfo)
- Microsoft Graph: 3 services (Calendar, Teams, OAuth)
- CRM APIs: 6 services (HubSpot, Salesforce, Pipedrive, Clio, Zoho, Dynamics)
- SimplyBook: 1 service (REST API)
- Slack: 2 services (OAuth, Interactions)
- Zoom: 1 service (S2S OAuth)

## APÉNDICE B: MAPA DE TABLAS DE BASE DE DATOS

Total: **50+ tablas** agrupadas en:

### Core (6 tablas)
`companies`, `users`, `contacts`, `contact_lists`, `company_settings`, `company_agents`

### Agentes y Llamadas (7 tablas)
`agent_templates`, `agent_runs`, `call_logs`, `call_queue`, `voicemail_logs`, `follow_up_queue`, `notifications`

### Calendario (3 tablas)
`calendar_events`, `calendar_integrations`, `calendar_sync_log`

### Billing (6 tablas)
`subscription_plans`, `company_subscriptions`, `usage_tracking`, `billing_history`, `billing_events`, `stripe_events`

### CRM Integrations (18 tablas)
3 tablas por CRM (integration, contact_mappings, sync_logs) × 6 CRMs

### Otros (10+ tablas)
`google_sheets_integrations`, `google_sheets_linked_sheets`, `team_invitations`, `ai_conversations`, `ai_messages`, `cancellation_feedback`, `retention_offers`, `retention_offer_log`, `webhook_endpoints`, `webhook_deliveries`, `integration_feedback`, `admin_finances`

## APÉNDICE C: RESUMEN DE TRIGGERS DE BASE DE DATOS

Total: **38 triggers** cubriendo:
- `updated_at` automático en 25+ tablas
- `notify_campaign_completion` - Notificación cuando campaña termina
- `notify_high_failure_rate` - Alerta si tasa de fallo alta
- `notify_minutes_limit` - Alerta de minutos cerca del límite
- `auto_create_followup` - Auto-crea follow-up cuando call_log se actualiza
- Triggers de `updated_at` para cada tabla de integración

---

**FIN DEL DOCUMENTO**

*Este documento fue generado por una auditoría automatizada de la plataforma Callengo realizada el 4 de Marzo de 2026. Los hallazgos se basan en análisis estático del código fuente, esquema de base de datos, y simulación lógica de flujos de usuario. No se ejecutaron llamadas reales ni se accedió a servicios externos durante la auditoría.*
