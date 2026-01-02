# Free Plan Setup Instructions

Este documento explica cómo configurar el nuevo plan Free con 20 minutos gratuitos one-time.

## Características del Plan Free

- **Precio**: $0/mes
- **Minutos incluidos**: 20 (one-time, NO renovables)
- **Máximo por llamada**: 3 minutos
- **Concurrencia**: 1 llamada simultánea
- **Usuarios**: 1
- **Precio overage**: $0.80/min
- **Budget máximo de overage**: $20
- **Features**: AI calling básico, export CSV/Excel, email support only

## Pasos de Instalación

### 1. Crear el Plan Free

Ejecuta el siguiente SQL en tu Supabase SQL Editor:

```bash
# Archivo: free-plan-migration.sql
```

Este script:
- Crea el plan Free con slug 'free'
- Configura 20 minutos one-time (no renovables)
- Establece $0.80/min de overage
- Límite de 3 min por llamada
- 1 concurrencia

### 2. Configurar el Trigger Automático

Ejecuta el siguiente SQL en tu Supabase SQL Editor:

```bash
# Archivo: free-plan-trigger.sql
```

Este trigger:
- Se ejecuta automáticamente cuando se crea una nueva company
- Asigna el plan Free a todos los nuevos usuarios
- Configura la subscription con status 'active'
- Desactiva overage por defecto (usuario debe activarlo manualmente)

### 3. Verificar la Configuración

Después de ejecutar los scripts, verifica:

1. **Plan Free creado**:
   ```sql
   SELECT * FROM subscription_plans WHERE slug = 'free';
   ```

2. **Trigger funcionando**:
   Crea una cuenta de prueba y verifica que automáticamente tenga el plan Free asignado.

3. **Overage configurado**:
   - Overage disponible para usuarios Free
   - Límite máximo de $20 en budget de overage
   - $0.80 por minuto extra

## Características Implementadas

### 1. UI de Billing Settings

- ✅ Muestra advertencia de "One-Time Credit" en plan actual
- ✅ Controles de overage disponibles para plan Free
- ✅ Límite de $20 en budget de overage para Free
- ✅ Mensaje claro: "20 minutos no renovables, solo para testing"
- ✅ Info de concurrencia y límites en la vista de planes

### 2. API de Overage

- ✅ Endpoint `/api/billing/update-overage` actualizado
- ✅ Aplica límite de $20 automáticamente para usuarios Free
- ✅ Logging de eventos de billing

### 3. Protecciones

**Budget Limits**:
- Free plan: máximo $20 de overage
- Paid plans: sin límite (usuario controla)

**Rate Limits**:
- 3 minutos máximo por llamada (Free)
- 1 concurrencia (Free)

## Migración de Usuarios Existentes (Opcional)

Si tienes usuarios existentes sin plan, puedes asignarles el plan Free:

```sql
-- Asignar plan Free a companies sin subscription
INSERT INTO company_subscriptions (
  company_id,
  plan_id,
  billing_cycle,
  status,
  current_period_start,
  current_period_end,
  overage_enabled,
  overage_budget,
  overage_spent,
  overage_alert_level
)
SELECT
  c.id as company_id,
  (SELECT id FROM subscription_plans WHERE slug = 'free') as plan_id,
  'monthly' as billing_cycle,
  'active' as status,
  NOW() as current_period_start,
  NOW() + INTERVAL '30 days' as current_period_end,
  false as overage_enabled,
  0 as overage_budget,
  0 as overage_spent,
  70 as overage_alert_level
FROM companies c
LEFT JOIN company_subscriptions cs ON c.id = cs.company_id
WHERE cs.id IS NULL;
```

## Puntos Importantes

1. **Los 20 minutos son ONE-TIME**: No se renuevan mensualmente. Es un crédito único para testing.

2. **Overage es opcional**: El usuario debe activarlo manualmente si quiere seguir haciendo llamadas después de agotar sus 20 minutos.

3. **Límite de $20**: Protege tanto al usuario como a la empresa de gastos excesivos en plan Free.

4. **Upgrade path claro**: La UI debe empujar al usuario a upgradearse a un plan pago para uso continuo.

## Copy/Messaging Importante

Estos mensajes DEBEN aparecer en la UI:

### En Current Plan (Free):
> "Your 20 free minutes are for testing only and do not renew. For ongoing use, please upgrade to a paid plan."

### En Overage Controls (Free):
> "Your 20 free minutes are one-time only, not monthly. Overage rate: $0.80/min. Max budget: $20. For ongoing use, upgrade to a paid plan."

## Testing

1. Crea una cuenta nueva
2. Verifica que automáticamente tenga plan Free con 20 minutos
3. Verifica que pueda activar overage con máximo $20
4. Verifica que el mensaje de "one-time credit" aparezca
5. Haz una llamada de prueba y verifica los límites (3 min max, 1 concurrencia)

## Troubleshooting

**Problema**: Nuevos usuarios no reciben el plan Free
- **Solución**: Verifica que el trigger esté activo:
  ```sql
  SELECT * FROM pg_trigger WHERE tgname = 'on_company_created_assign_free_plan';
  ```

**Problema**: Usuarios pueden configurar más de $20 en overage budget
- **Solución**: Verifica que el endpoint `/api/billing/update-overage` tenga la lógica de límite

**Problema**: Los minutos se renuevan mensualmente
- **Solución**: Esto es esperado en el backend, pero NO deben renovarse. Implementa lógica para que el plan Free solo dé 20 minutos UNA VEZ en la vida de la cuenta.
