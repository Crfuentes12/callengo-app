# Callengo - Guia Completa de Setup

## 1. Variables de Entorno

Crea un archivo `.env.local` en la raiz del proyecto:

```bash
# =============================================
# SUPABASE (obligatorio)
# =============================================
# Ve a: https://supabase.com/dashboard → tu proyecto → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...tu-service-role-key

# =============================================
# STRIPE (obligatorio para billing)
# =============================================
# Ve a: https://dashboard.stripe.com/apikeys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
# Ve a: https://dashboard.stripe.com/webhooks → tu endpoint → Signing secret
STRIPE_WEBHOOK_SECRET=whsec_...

# =============================================
# BLAND AI (obligatorio para llamadas)
# =============================================
# Ve a: https://app.bland.ai → Settings → API Keys
BLAND_API_KEY=sk-...

# =============================================
# OPENAI (obligatorio para analisis de llamadas)
# =============================================
# Ve a: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-...

# =============================================
# APP URL (opcional, default: http://localhost:3000)
# =============================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Donde se usa cada variable:

| Variable | Para que sirve |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto Supabase (base de datos + auth) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Key publica de Supabase (client-side, safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | Key admin de Supabase (server-only, NUNCA exponerla) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Key publica de Stripe para cargar Stripe.js en el browser |
| `STRIPE_SECRET_KEY` | Key secreta de Stripe para crear checkouts, subscriptions, etc |
| `STRIPE_WEBHOOK_SECRET` | Para verificar que los webhooks vienen de Stripe |
| `BLAND_API_KEY` | API key de Bland AI para hacer llamadas telefonicas |
| `OPENAI_API_KEY` | API key de OpenAI para analizar transcripciones con GPT-4o |
| `NEXT_PUBLIC_APP_URL` | URL de tu app para redirects de Stripe (checkout, portal) |

---

## 2. Setup de Supabase

### Paso 1: Crear proyecto

1. Ve a https://supabase.com/dashboard
2. Crea un nuevo proyecto
3. Guarda la URL y las keys (Settings → API)

### Paso 2: Habilitar Auth

1. En Supabase Dashboard → Authentication → Providers
2. Habilita **Email** (ya viene habilitado por default)
3. En Settings → Auth → Email: habilita "Confirm email"

### Paso 3: Ejecutar SQL

Ve a **SQL Editor** en tu dashboard de Supabase y ejecuta estos scripts **EN ORDEN**:

---

#### SCRIPT 1: Tablas Base (ejecutar primero)

```sql
-- ============================================
-- TABLAS BASE - Ejecutar PRIMERO
-- ============================================

-- 1. Companies
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website text,
  description text,
  logo_url text,
  favicon_url text,
  industry text,
  context_data jsonb,
  context_summary text,
  context_extracted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Users (linked to auth.users)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text DEFAULT 'user' NOT NULL,
  currency text DEFAULT 'USD' NOT NULL,
  country_code text,
  country_name text,
  city text,
  region text,
  timezone text,
  ip_address text,
  location_logs jsonb DEFAULT '[]'::jsonb NOT NULL,
  location_updated_at timestamptz,
  notifications_enabled boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 3. Contact Lists
CREATE TABLE IF NOT EXISTS contact_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 4. Contacts
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  phone_number text NOT NULL,
  original_phone_number text,
  address text,
  city text,
  state text,
  zip_code text,
  contact_name text,
  email text,
  status text DEFAULT 'new' NOT NULL,
  call_outcome text,
  last_call_date timestamptz,
  call_attempts integer DEFAULT 0 NOT NULL,
  call_id text,
  call_status text,
  call_duration integer,
  recording_url text,
  transcript_text text,
  transcripts jsonb,
  analysis jsonb,
  call_metadata jsonb,
  notes text,
  is_test_call boolean DEFAULT false NOT NULL,
  tags text[],
  list_id uuid REFERENCES contact_lists(id) ON DELETE SET NULL,
  custom_fields jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 5. Agent Templates (pre-built agents)
CREATE TABLE IF NOT EXISTS agent_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  category text,
  task_template text NOT NULL,
  first_sentence_template text,
  voicemail_template text,
  analysis_questions jsonb,
  is_active boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 6. Company Agents (company-specific instances)
CREATE TABLE IF NOT EXISTS company_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_template_id uuid NOT NULL REFERENCES agent_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  custom_task text,
  custom_settings jsonb,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 7. Agent Runs (campaigns)
CREATE TABLE IF NOT EXISTS agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_template_id uuid NOT NULL REFERENCES agent_templates(id),
  name text NOT NULL,
  status text DEFAULT 'draft' NOT NULL,
  total_contacts integer DEFAULT 0 NOT NULL,
  completed_calls integer DEFAULT 0 NOT NULL,
  successful_calls integer DEFAULT 0 NOT NULL,
  failed_calls integer DEFAULT 0 NOT NULL,
  total_cost numeric DEFAULT 0 NOT NULL,
  settings jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  follow_up_enabled boolean DEFAULT false NOT NULL,
  follow_up_max_attempts integer DEFAULT 3 NOT NULL,
  follow_up_interval_hours integer DEFAULT 24 NOT NULL,
  follow_up_conditions jsonb DEFAULT '["no_answer", "voicemail", "busy"]'::jsonb NOT NULL,
  voicemail_enabled boolean DEFAULT true NOT NULL,
  voicemail_detection_enabled boolean DEFAULT true NOT NULL,
  voicemail_message text,
  voicemail_action text DEFAULT 'leave_message' NOT NULL,
  voicemails_detected integer DEFAULT 0 NOT NULL,
  voicemails_left integer DEFAULT 0 NOT NULL,
  follow_ups_scheduled integer DEFAULT 0 NOT NULL,
  follow_ups_completed integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 8. Call Logs
CREATE TABLE IF NOT EXISTS call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  agent_template_id uuid REFERENCES agent_templates(id),
  agent_run_id uuid REFERENCES agent_runs(id) ON DELETE SET NULL,
  call_id text NOT NULL,
  status text,
  completed boolean DEFAULT false NOT NULL,
  call_length numeric,
  price numeric,
  answered_by text,
  recording_url text,
  transcript text,
  summary text,
  analysis jsonb,
  error_message text,
  metadata jsonb,
  voicemail_detected boolean DEFAULT false NOT NULL,
  voicemail_left boolean DEFAULT false NOT NULL,
  voicemail_message_url text,
  voicemail_duration numeric,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 9. Company Settings
CREATE TABLE IF NOT EXISTS company_settings (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  bland_api_key text,
  openai_api_key text,
  default_voice text DEFAULT 'maya' NOT NULL,
  default_max_duration integer DEFAULT 5 NOT NULL,
  default_interval_minutes integer DEFAULT 1 NOT NULL,
  test_phone_number text,
  settings jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 10. Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  price_monthly numeric NOT NULL,
  price_annual numeric NOT NULL,
  minutes_included integer NOT NULL,
  max_call_duration integer DEFAULT 5 NOT NULL,
  price_per_extra_minute numeric NOT NULL,
  max_users integer DEFAULT 1 NOT NULL,
  price_per_extra_user numeric,
  max_agents integer,
  max_concurrent_calls integer DEFAULT 1 NOT NULL,
  max_calls_per_hour integer,
  max_calls_per_day integer,
  auto_overage_default boolean DEFAULT false NOT NULL,
  features jsonb DEFAULT '[]'::jsonb NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  display_order integer DEFAULT 0 NOT NULL,
  stripe_product_id text,
  stripe_price_id_monthly text,
  stripe_price_id_annual text,
  stripe_metered_price_id text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 11. Company Subscriptions
CREATE TABLE IF NOT EXISTS company_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id),
  billing_cycle text DEFAULT 'monthly' NOT NULL,
  status text DEFAULT 'active' NOT NULL,
  current_period_start timestamptz DEFAULT now() NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean DEFAULT false NOT NULL,
  trial_end timestamptz,
  extra_users integer DEFAULT 0 NOT NULL,
  overage_enabled boolean DEFAULT false NOT NULL,
  overage_budget numeric DEFAULT 0 NOT NULL,
  overage_spent numeric DEFAULT 0 NOT NULL,
  last_overage_alert_at timestamptz,
  overage_alert_level integer DEFAULT 0 NOT NULL,
  stripe_subscription_id text,
  stripe_customer_id text,
  stripe_subscription_item_id text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 12. Usage Tracking
CREATE TABLE IF NOT EXISTS usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES company_subscriptions(id) ON DELETE SET NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  minutes_used numeric DEFAULT 0 NOT NULL,
  minutes_included integer NOT NULL,
  overage_minutes numeric DEFAULT 0 NOT NULL,
  total_cost numeric DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 13. Billing History
CREATE TABLE IF NOT EXISTS billing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES company_subscriptions(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'usd' NOT NULL,
  description text,
  status text NOT NULL,
  invoice_url text,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  payment_method text,
  failure_reason text,
  billing_date timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 14. Call Queue
CREATE TABLE IF NOT EXISTS call_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  agent_id uuid NOT NULL REFERENCES company_agents(id),
  agent_run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' NOT NULL,
  priority integer DEFAULT 0 NOT NULL,
  queued_at timestamptz DEFAULT now() NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  call_id text,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 15. Billing Events
CREATE TABLE IF NOT EXISTS billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES company_subscriptions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  minutes_consumed numeric,
  cost_usd numeric,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 16. Admin Finances
CREATE TABLE IF NOT EXISTS admin_finances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  bland_plan text,
  bland_plan_cost numeric,
  bland_talk_rate numeric,
  bland_transfer_rate numeric,
  bland_concurrent_limit integer,
  bland_hourly_limit integer,
  bland_daily_limit integer,
  openai_cost numeric,
  openai_tokens_used bigint,
  supabase_cost numeric,
  total_minutes_used numeric,
  total_calls_made integer,
  total_companies_active integer,
  total_users_active integer,
  revenue_subscriptions numeric,
  revenue_overages numeric,
  revenue_extras numeric,
  revenue_total numeric,
  cost_bland numeric,
  cost_openai numeric,
  cost_supabase numeric,
  cost_total numeric,
  gross_margin numeric,
  gross_margin_percent numeric,
  avg_revenue_per_company numeric,
  avg_minutes_per_call numeric,
  overage_revenue_percent numeric,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 17. Stripe Events (idempotency)
CREATE TABLE IF NOT EXISTS stripe_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  data jsonb NOT NULL,
  processed boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  processed_at timestamptz
);

-- 18. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 19. Follow-up Queue
CREATE TABLE IF NOT EXISTS follow_up_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  original_call_id uuid REFERENCES call_logs(id) ON DELETE SET NULL,
  attempt_number integer DEFAULT 1 NOT NULL,
  max_attempts integer DEFAULT 3 NOT NULL,
  next_attempt_at timestamptz NOT NULL,
  last_attempt_at timestamptz,
  status text DEFAULT 'pending' NOT NULL,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 20. Voicemail Logs
CREATE TABLE IF NOT EXISTS voicemail_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  call_id uuid NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE,
  agent_run_id uuid REFERENCES agent_runs(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  detected_at timestamptz NOT NULL,
  confidence_score numeric,
  detection_method text,
  message_left boolean DEFAULT false NOT NULL,
  message_text text,
  message_duration numeric,
  message_audio_url text,
  follow_up_scheduled boolean DEFAULT false NOT NULL,
  follow_up_id uuid REFERENCES follow_up_queue(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 21. Cancellation Feedback
CREATE TABLE IF NOT EXISTS cancellation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES company_subscriptions(id) ON DELETE SET NULL,
  reason text NOT NULL,
  reason_details text,
  plan_name text,
  plan_slug text,
  months_subscribed integer DEFAULT 0,
  monthly_price numeric DEFAULT 0,
  was_offered_retention boolean DEFAULT false,
  accepted_retention boolean DEFAULT false,
  outcome text DEFAULT 'cancelled',
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 22. Retention Offers
CREATE TABLE IF NOT EXISTS retention_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  times_redeemed integer DEFAULT 0 NOT NULL,
  last_redeemed_at timestamptz,
  next_eligible_after_months integer DEFAULT 6 NOT NULL,
  stripe_coupon_id text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 23. Retention Offer Log
CREATE TABLE IF NOT EXISTS retention_offer_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES company_subscriptions(id) ON DELETE SET NULL,
  action text NOT NULL,
  months_paid_at_time integer DEFAULT 0,
  months_required integer DEFAULT 3,
  was_eligible boolean DEFAULT false,
  stripe_coupon_id text,
  plan_name text,
  plan_slug text,
  details text,
  created_at timestamptz DEFAULT now() NOT NULL
);
```

---

#### SCRIPT 2: Indexes (ejecutar despues de las tablas)

```sql
-- ============================================
-- INDEXES para performance
-- ============================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_currency ON users(currency);

-- Contacts
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_list_id ON contacts(list_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_number);

-- Call Logs
CREATE INDEX IF NOT EXISTS idx_call_logs_company_id ON call_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_contact_id ON call_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_agent_run_id ON call_logs(agent_run_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_id ON call_logs(call_id);

-- Agent Runs
CREATE INDEX IF NOT EXISTS idx_agent_runs_company_id ON agent_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);

-- Subscriptions
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_company_id ON company_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_stripe_id ON company_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_customer_id ON company_subscriptions(stripe_customer_id);

-- Usage Tracking
CREATE INDEX IF NOT EXISTS idx_usage_tracking_company_id ON usage_tracking(company_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period ON usage_tracking(period_start, period_end);

-- Billing
CREATE INDEX IF NOT EXISTS idx_billing_history_company_id ON billing_history(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_stripe_invoice ON billing_history(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_company_id ON billing_events(company_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Follow-ups
CREATE INDEX IF NOT EXISTS idx_follow_up_queue_company_id ON follow_up_queue(company_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_queue_status ON follow_up_queue(status);
CREATE INDEX IF NOT EXISTS idx_follow_up_queue_next_attempt ON follow_up_queue(next_attempt_at) WHERE status = 'pending';

-- Voicemails
CREATE INDEX IF NOT EXISTS idx_voicemail_logs_company_id ON voicemail_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_voicemail_logs_agent_run_id ON voicemail_logs(agent_run_id);
CREATE INDEX IF NOT EXISTS idx_voicemail_logs_created_at ON voicemail_logs(created_at DESC);

-- Stripe Events
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed ON stripe_events(processed) WHERE NOT processed;

-- Plans
CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON subscription_plans(slug);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_stripe_product ON subscription_plans(stripe_product_id);

-- Call Queue
CREATE INDEX IF NOT EXISTS idx_call_queue_company_id ON call_queue(company_id);
CREATE INDEX IF NOT EXISTS idx_call_queue_status ON call_queue(status);
CREATE INDEX IF NOT EXISTS idx_call_queue_agent_run_id ON call_queue(agent_run_id);
```

---

#### SCRIPT 3: Row Level Security (ejecutar despues de indexes)

```sql
-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE voicemail_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellation_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_offer_log ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own company data
-- (Ajusta segun tus necesidades de seguridad)

-- Companies: users see their own company
CREATE POLICY "Users can view own company" ON companies
  FOR SELECT USING (id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Users: users see team members
CREATE POLICY "Users can view company users" ON users
  FOR SELECT USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id = auth.uid());

-- Contacts: company-scoped
CREATE POLICY "Company contacts access" ON contacts
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Contact Lists: company-scoped
CREATE POLICY "Company contact_lists access" ON contact_lists
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Call Logs: company-scoped
CREATE POLICY "Company call_logs access" ON call_logs
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Agent Templates: everyone can read
CREATE POLICY "Anyone can read agent_templates" ON agent_templates
  FOR SELECT USING (true);

-- Company Agents: company-scoped
CREATE POLICY "Company agents access" ON company_agents
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Agent Runs: company-scoped
CREATE POLICY "Company agent_runs access" ON agent_runs
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Company Settings: company-scoped
CREATE POLICY "Company settings access" ON company_settings
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Subscription Plans: everyone can read
CREATE POLICY "Anyone can read plans" ON subscription_plans
  FOR SELECT USING (true);

-- Company Subscriptions: company-scoped
CREATE POLICY "Company subscriptions access" ON company_subscriptions
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Usage Tracking: company-scoped
CREATE POLICY "Company usage access" ON usage_tracking
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Billing History: company-scoped
CREATE POLICY "Company billing access" ON billing_history
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Notifications: company-scoped
CREATE POLICY "Company notifications select" ON notifications
  FOR SELECT USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Company notifications update" ON notifications
  FOR UPDATE USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- System can insert notifications
CREATE POLICY "System insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- Follow-up Queue: company-scoped
CREATE POLICY "Company followups access" ON follow_up_queue
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Voicemail Logs: company-scoped
CREATE POLICY "Company voicemails select" ON voicemail_logs
  FOR SELECT USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "System insert voicemails" ON voicemail_logs
  FOR INSERT WITH CHECK (true);

-- Call Queue: company-scoped
CREATE POLICY "Company call_queue access" ON call_queue
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Billing Events: company-scoped
CREATE POLICY "Company billing_events access" ON billing_events
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Cancellation Feedback: company-scoped select
CREATE POLICY "Company cancellation_feedback select" ON cancellation_feedback
  FOR SELECT USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "System insert cancellation_feedback" ON cancellation_feedback
  FOR INSERT WITH CHECK (true);

-- Retention Offers: company-scoped
CREATE POLICY "Company retention_offers access" ON retention_offers
  FOR SELECT USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Retention Offer Log: company-scoped
CREATE POLICY "Company retention_offer_log select" ON retention_offer_log
  FOR SELECT USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));
```

---

#### SCRIPT 4: Seed de Planes (obligatorio - sin esto no funciona billing)

```sql
-- ============================================
-- SEED: Subscription Plans
-- ============================================

INSERT INTO subscription_plans (name, slug, description, price_monthly, price_annual, minutes_included, max_call_duration, price_per_extra_minute, max_users, max_agents, max_concurrent_calls, auto_overage_default, display_order, is_active)
VALUES
  ('Free', 'free', 'Get started with AI calling', 0, 0, 15, 3, 0.80, 1, 1, 1, false, 0, true),
  ('Starter', 'starter', 'For small businesses getting started', 99, 1068, 300, 3, 0.60, 1, 1, 2, false, 1, true),
  ('Business', 'business', 'For growing businesses', 279, 2988, 1200, 5, 0.35, 3, -1, 5, true, 2, true),
  ('Teams', 'teams', 'For teams that need collaboration', 599, 6348, 2400, 8, 0.22, 5, -1, 10, true, 3, true),
  ('Enterprise', 'enterprise', 'For large organizations', 1500, 16200, 6000, 15, 0.18, -1, -1, 25, true, 4, true)
ON CONFLICT (slug) DO UPDATE SET
  price_monthly = EXCLUDED.price_monthly,
  price_annual = EXCLUDED.price_annual,
  minutes_included = EXCLUDED.minutes_included,
  max_call_duration = EXCLUDED.max_call_duration,
  price_per_extra_minute = EXCLUDED.price_per_extra_minute;
```

---

#### SCRIPT 5: Core Agent Templates (los 3 agentes base)

```sql
-- ============================================
-- SEED: Core Agent Templates
-- ============================================

-- Deactivate all existing agents first
UPDATE agent_templates SET is_active = false;

-- Upsert the 3 core agents
INSERT INTO agent_templates (slug, name, description, icon, category, task_template, first_sentence_template, voicemail_template, analysis_questions, is_active, sort_order)
VALUES
(
  'lead-qualifier',
  'Lead Qualifier',
  'Qualifies leads by confirming business details, gauging interest level, and identifying decision-makers. Perfect for B2B outreach.',
  'target',
  'sales',
  'You are a friendly and professional lead qualification specialist calling on behalf of {{company_name}}. Your goal is to: 1) Confirm you are speaking with the right person/business, 2) Briefly introduce {{company_name}} and what we do, 3) Gauge their interest level, 4) Identify if they are a decision-maker, 5) If interested, mention that someone from our team will follow up with more details. Be conversational, not pushy. If they are not interested, thank them politely and end the call.',
  'Hi, this is {{agent_name}} calling from {{company_name}}. Am I speaking with the right person at {{contact_company}}?',
  'Hi, this is {{agent_name}} from {{company_name}}. I was hoping to speak with someone about how we might be able to help your business. Could you please give us a call back at your convenience? Thank you!',
  '[{"question":"Was the lead qualified?","type":"boolean"},{"question":"Interest level","type":"scale","min":1,"max":5},{"question":"Is this person a decision maker?","type":"boolean"},{"question":"What is their main pain point?","type":"text"}]',
  true,
  1
),
(
  'appointment-confirmation',
  'Appointment Confirmation',
  'Confirms upcoming appointments, verifies contact details, and handles rescheduling requests. Reduces no-shows by up to 40%.',
  'calendar',
  'operations',
  'You are a polite appointment confirmation agent calling on behalf of {{company_name}}. Your goals are to: 1) Confirm the upcoming appointment details, 2) Verify the contact''s information is correct, 3) Ask if they need to reschedule, 4) Remind them of any preparation needed. Be warm and helpful. If they need to reschedule, note their preferred time and let them know someone will confirm the new time.',
  'Hi, this is {{agent_name}} calling from {{company_name}}. I''m calling to confirm your upcoming appointment. Do you have a moment?',
  'Hi, this is {{agent_name}} from {{company_name}} calling to confirm your upcoming appointment. Please call us back to confirm or if you need to reschedule. Thank you!',
  '[{"question":"Was the appointment confirmed?","type":"boolean"},{"question":"Does the contact need to reschedule?","type":"boolean"},{"question":"Preferred reschedule time","type":"text"},{"question":"Contact information verified?","type":"boolean"}]',
  true,
  2
),
(
  'customer-satisfaction',
  'Customer Satisfaction Survey',
  'Conducts brief satisfaction surveys to gather feedback, identify issues, and measure customer happiness. Builds loyalty through personal outreach.',
  'star',
  'feedback',
  'You are a friendly customer satisfaction survey agent calling on behalf of {{company_name}}. Your goals are to: 1) Thank them for being a customer, 2) Ask about their recent experience with our product/service, 3) Rate their satisfaction on a scale of 1-10, 4) Ask what we could improve, 5) If they mention specific issues, acknowledge them and assure follow-up. Keep it brief (under 3 minutes) and conversational.',
  'Hi, this is {{agent_name}} from {{company_name}}. We value your feedback and I''d love to ask you a few quick questions about your experience with us. It''ll only take a couple of minutes.',
  'Hi, this is {{agent_name}} from {{company_name}}. We''d love to hear about your experience with us. When you have a moment, please call us back. Your feedback means a lot to us!',
  '[{"question":"Satisfaction rating","type":"scale","min":1,"max":10},{"question":"Would they recommend us?","type":"boolean"},{"question":"Main feedback or complaint","type":"text"},{"question":"Any specific issues mentioned?","type":"text"}]',
  true,
  3
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  category = EXCLUDED.category,
  task_template = EXCLUDED.task_template,
  first_sentence_template = EXCLUDED.first_sentence_template,
  voicemail_template = EXCLUDED.voicemail_template,
  analysis_questions = EXCLUDED.analysis_questions,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;
```

---

#### SCRIPT 6: Triggers y Functions (automatizaciones)

```sql
-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'companies', 'users', 'contacts', 'contact_lists', 'company_agents',
      'agent_runs', 'company_settings', 'subscription_plans', 'company_subscriptions',
      'usage_tracking', 'call_queue', 'admin_finances', 'follow_up_queue',
      'notifications', 'retention_offers'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      t, t
    );
  END LOOP;
END;
$$;

-- Notification: Campaign completion
CREATE OR REPLACE FUNCTION notify_campaign_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO notifications (company_id, type, title, message, metadata)
    VALUES (
      NEW.company_id,
      'campaign_complete',
      'Campaign Completed',
      format('Campaign "%s" has finished. %s/%s calls completed.', NEW.name, NEW.completed_calls, NEW.total_contacts),
      jsonb_build_object('agent_run_id', NEW.id, 'success_rate',
        CASE WHEN NEW.completed_calls > 0
          THEN round((NEW.successful_calls::numeric / NEW.completed_calls) * 100)
          ELSE 0
        END
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_campaign_complete ON agent_runs;
CREATE TRIGGER on_campaign_complete
  AFTER UPDATE ON agent_runs
  FOR EACH ROW
  EXECUTE FUNCTION notify_campaign_completion();

-- Notification: High failure rate (>50%)
CREATE OR REPLACE FUNCTION notify_high_failure_rate()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completed_calls >= 10
     AND NEW.failed_calls::numeric / NEW.completed_calls > 0.5
     AND (OLD.completed_calls < 10 OR OLD.failed_calls::numeric / OLD.completed_calls <= 0.5)
  THEN
    INSERT INTO notifications (company_id, type, title, message, metadata)
    VALUES (
      NEW.company_id,
      'high_failure_rate',
      'High Failure Rate Alert',
      format('Campaign "%s" has a failure rate above 50%%. Consider pausing and reviewing.', NEW.name),
      jsonb_build_object('agent_run_id', NEW.id, 'failure_rate',
        round((NEW.failed_calls::numeric / NEW.completed_calls) * 100)
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_high_failure_rate ON agent_runs;
CREATE TRIGGER on_high_failure_rate
  AFTER UPDATE ON agent_runs
  FOR EACH ROW
  EXECUTE FUNCTION notify_high_failure_rate();

-- Notification: Minutes usage alerts (80%, 90%, 100%)
CREATE OR REPLACE FUNCTION notify_minutes_limit()
RETURNS TRIGGER AS $$
DECLARE
  pct numeric;
BEGIN
  IF NEW.minutes_included > 0 THEN
    pct := (NEW.minutes_used / NEW.minutes_included) * 100;

    IF pct >= 100 AND (OLD.minutes_used / NULLIF(OLD.minutes_included, 0)) * 100 < 100 THEN
      INSERT INTO notifications (company_id, type, title, message, metadata)
      VALUES (NEW.company_id, 'minutes_exceeded', 'Minutes Limit Reached',
        'You have used 100% of your included minutes. Additional usage will be charged at overage rates.',
        jsonb_build_object('minutes_used', NEW.minutes_used, 'minutes_included', NEW.minutes_included));
    ELSIF pct >= 90 AND (OLD.minutes_used / NULLIF(OLD.minutes_included, 0)) * 100 < 90 THEN
      INSERT INTO notifications (company_id, type, title, message, metadata)
      VALUES (NEW.company_id, 'minutes_warning', '90% Minutes Used',
        format('You have used %s of %s included minutes.', round(NEW.minutes_used), NEW.minutes_included),
        jsonb_build_object('minutes_used', NEW.minutes_used, 'minutes_included', NEW.minutes_included));
    ELSIF pct >= 80 AND (OLD.minutes_used / NULLIF(OLD.minutes_included, 0)) * 100 < 80 THEN
      INSERT INTO notifications (company_id, type, title, message, metadata)
      VALUES (NEW.company_id, 'minutes_alert', '80% Minutes Used',
        format('You have used %s of %s included minutes.', round(NEW.minutes_used), NEW.minutes_included),
        jsonb_build_object('minutes_used', NEW.minutes_used, 'minutes_included', NEW.minutes_included));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_minutes_update ON usage_tracking;
CREATE TRIGGER on_minutes_update
  AFTER UPDATE ON usage_tracking
  FOR EACH ROW
  EXECUTE FUNCTION notify_minutes_limit();
```

---

## 3. Setup de Stripe

### Paso 1: Crear cuenta
Ve a https://dashboard.stripe.com y crea una cuenta (modo test).

### Paso 2: Sync automatico de productos
Despues de configurar las env vars, ejecuta:
```bash
npm run stripe:sync
```
Esto crea automaticamente los 5 planes como Products + Prices en Stripe y actualiza los IDs en tu tabla `subscription_plans`.

### Paso 3: Configurar Webhook
1. En Stripe Dashboard → Developers → Webhooks
2. Agrega endpoint: `https://TU-DOMINIO.com/api/webhooks/stripe`
3. Selecciona estos eventos:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.trial_will_end`
4. Copia el **Signing secret** y ponlo en `STRIPE_WEBHOOK_SECRET`

### Para desarrollo local con webhooks:
```bash
# Instalar Stripe CLI
# https://stripe.com/docs/stripe-cli
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## 4. Setup de Bland AI

1. Crea cuenta en https://app.bland.ai
2. Ve a Settings → API Keys
3. Copia tu API key y ponla en `BLAND_API_KEY`
4. Configura el webhook URL en tu Bland dashboard:
   `https://TU-DOMINIO.com/api/bland/webhook`

---

## 5. Setup de OpenAI

1. Ve a https://platform.openai.com/api-keys
2. Crea una nueva API key
3. Ponla en `OPENAI_API_KEY`
4. Modelos usados: `gpt-4o` y `gpt-4o-mini` (asegurate de tener acceso)

---

## 6. Levantar la App

```bash
# 1. Instalar dependencias
npm install

# 2. Verificar .env.local esta creado con todas las variables

# 3. Desarrollo
npm run dev

# 4. Build de produccion
npm run build

# 5. Sync de planes a Stripe (una sola vez)
npm run stripe:sync
```

---

## 7. Orden Completo de Setup

1. Crear proyecto en Supabase
2. Copiar URL + keys al `.env.local`
3. Ejecutar los 6 scripts SQL en orden en el SQL Editor de Supabase
4. Crear cuenta Stripe (test mode) → copiar keys al `.env.local`
5. Crear cuenta Bland AI → copiar key al `.env.local`
6. Crear API key OpenAI → copiar al `.env.local`
7. `npm install`
8. `npm run stripe:sync` (crea los productos en Stripe)
9. `npm run dev`
10. Registrarte en la app → verificar email → onboarding

---

## 8. Servicios Externos Resumen

| Servicio | Para que | Costo aprox. |
|---|---|---|
| **Supabase** | Base de datos + auth + realtime | Free tier disponible |
| **Stripe** | Pagos y subscripciones | 2.9% + $0.30 por transaccion |
| **Bland AI** | Hacer llamadas telefonicas con IA | Segun plan |
| **OpenAI** | Analizar transcripciones de llamadas | ~$0.01-0.03 por llamada |
