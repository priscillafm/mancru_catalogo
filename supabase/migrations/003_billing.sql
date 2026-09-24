-- ============================================================
-- 003_billing.sql
-- Cobro con Mercado Pago + fix de datos del plan mismatch
-- Correr una sola vez en el SQL Editor de Supabase (proyecto Potato).
-- ============================================================

-- ------------------------------------------------------------
-- 0. FIX DE DATOS: plan mismatch (companies.plan vs plans.name)
-- ------------------------------------------------------------
-- companies.plan usaba 'basic' pero plans.name no tiene esa fila (tiene
-- 'free'/'pro'/'growth'/'enterprise') — usePlanLimits() nunca matcheaba
-- nada. Ya se corrigió el código para usar 'free'/'enterprise'.
--
-- IMPORTANTE — esto lo encontré probando el registro en vivo antes de
-- avisarte que estaba listo: companies tiene un CHECK constraint
-- (companies_plan_check) que hoy solo permite los valores viejos
-- ('basic'/'pro'/'empresa' presumiblemente) y no deja insertar 'free' ni
-- 'enterprise'. Sin este paso, CUALQUIER registro nuevo se rompe. Lo
-- recreo explícitamente para no depender de adivinar cuál era el valor
-- viejo:
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_plan_check;

UPDATE companies SET plan = 'free' WHERE plan NOT IN ('free', 'pro', 'enterprise');

ALTER TABLE companies ADD CONSTRAINT companies_plan_check CHECK (plan IN ('free', 'pro', 'enterprise'));

-- Fix adicional: la copy de marketing de Pro dice "usuarios ilimitados"
-- pero plans.limits->>'max_users' para 'pro' estaba en 3. Se alinea el
-- límite real a lo que ya se publicó en la landing.
UPDATE plans
SET limits = jsonb_set(limits, '{max_users}', '-1')
WHERE name = 'pro';

-- ------------------------------------------------------------
-- 1. Precio de lanzamiento (Pro: promo temporal en UYU)
-- ------------------------------------------------------------
ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_monthly_uyu numeric(10,2);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS promo_price_monthly_uyu numeric(10,2);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS promo_label text;

UPDATE plans SET price_monthly_uyu = 1190 WHERE name = 'pro'; -- ~USD 29, ajustar a gusto
UPDATE plans SET promo_price_monthly_uyu = 590, promo_label = 'Precio de lanzamiento'
WHERE name = 'pro';

-- Para terminar la promo más adelante (sin tocar código):
--   UPDATE plans SET promo_price_monthly_uyu = NULL WHERE name = 'pro';

-- ------------------------------------------------------------
-- 2. Registro de eventos de pago de Mercado Pago (idempotencia webhook)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mp_event_id     text UNIQUE NOT NULL,
  company_id      uuid REFERENCES companies(id) ON DELETE SET NULL,
  type            text NOT NULL,
  raw_payload     jsonb NOT NULL DEFAULT '{}',
  processed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_company ON payment_events(company_id, created_at DESC);

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

-- Solo admins de la empresa (o super_admin) pueden leer su propio historial de pagos.
CREATE POLICY pol_payment_events_select ON payment_events FOR SELECT USING (
  fn_is_super_admin() OR fn_user_role_in_company(company_id) IN ('company_admin')
);

-- Nadie inserta desde el cliente — solo el webhook, que usa la service-role key
-- (bypassea RLS por completo), igual que el resto de las tablas de auditoría.
CREATE POLICY pol_payment_events_insert ON payment_events FOR INSERT WITH CHECK (false);
