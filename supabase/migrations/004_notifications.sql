-- Notificaciones reales para la campanita + pedidos persistidos + preferencias por usuario.
-- Run this in Supabase Dashboard → SQL Editor (como el resto de las migraciones de este proyecto).
--
-- NOTA: `catalog_views` y `notifications` ya existían en la base viva (creadas a mano en algún
-- momento, sin migración) — acá se codifican con CREATE TABLE IF NOT EXISTS para que el esquema
-- quede documentado y en sync entre entornos.

-- ============================================================
-- TABLAS BASE (si no existen)
-- ============================================================
CREATE TABLE IF NOT EXISTS catalog_views (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id  uuid REFERENCES catalogs(id) ON DELETE CASCADE,
  viewed_at   timestamptz NOT NULL DEFAULT now(),
  user_agent  text
);

CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  type        text NOT NULL,
  message     text NOT NULL,
  data        jsonb NOT NULL DEFAULT '{}',
  read        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own notifications" ON notifications;
CREATE POLICY "users read own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users update own notifications" ON notifications;
CREATE POLICY "users update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());
-- Los inserts los hacen únicamente los triggers (SECURITY DEFINER más abajo);
-- no se habilita INSERT directo para usuarios.

-- ============================================================
-- PREFERENCIAS: qué tipo de notificación quiere recibir cada usuario
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL
  DEFAULT '{"catalog_view": true, "new_order": true, "plan_limit": true}';

-- ============================================================
-- PEDIDOS: persiste lo que hoy solo se mandaba por WhatsApp/email/portapapeles
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id   uuid REFERENCES catalogs(id) ON DELETE SET NULL,
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_name  text,
  client_ref   text,
  items        jsonb NOT NULL DEFAULT '[]',
  total_units  int NOT NULL DEFAULT 0,
  channel      text NOT NULL DEFAULT 'copy' CHECK (channel IN ('whatsapp','email','copy')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can submit an order" ON orders;
CREATE POLICY "anyone can submit an order" ON orders
  FOR INSERT WITH CHECK (true); -- lo envía un cliente público, sin sesión

DROP POLICY IF EXISTS "company members can read their orders" ON orders;
CREATE POLICY "company members can read their orders" ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_memberships
      WHERE user_id = auth.uid() AND company_id = orders.company_id AND active = true
    )
  );

-- ============================================================
-- Helper: reparte una notificación a todos los miembros activos de una empresa
-- que tengan ese tipo habilitado en sus preferencias
-- ============================================================
CREATE OR REPLACE FUNCTION fn_notify_company(p_company_id uuid, p_type text, p_message text, p_data jsonb, p_pref_key text)
RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, type, message, data)
  SELECT um.user_id, p_type, p_message, p_data
  FROM user_memberships um
  JOIN users u ON u.id = um.user_id
  WHERE um.company_id = p_company_id
    AND um.active = true
    AND coalesce((u.notification_prefs ->> p_pref_key)::boolean, true) = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Trigger 1: alguien abrió un catálogo
-- ============================================================
CREATE OR REPLACE FUNCTION fn_notify_catalog_view() RETURNS trigger AS $$
DECLARE
  v_company_id   uuid;
  v_catalog_name text;
BEGIN
  SELECT company_id, name INTO v_company_id, v_catalog_name FROM catalogs WHERE id = NEW.catalog_id;
  IF v_company_id IS NOT NULL THEN
    PERFORM fn_notify_company(v_company_id, 'catalog_view',
      'Alguien abrió tu catálogo "' || coalesce(v_catalog_name, '') || '"',
      jsonb_build_object('catalog_id', NEW.catalog_id), 'catalog_view');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_catalog_view ON catalog_views;
CREATE TRIGGER trg_notify_catalog_view AFTER INSERT ON catalog_views
  FOR EACH ROW EXECUTE FUNCTION fn_notify_catalog_view();

-- ============================================================
-- Trigger 2: llegó un pedido
-- ============================================================
CREATE OR REPLACE FUNCTION fn_notify_new_order() RETURNS trigger AS $$
BEGIN
  PERFORM fn_notify_company(NEW.company_id, 'new_order',
    'Nuevo pedido' || CASE WHEN coalesce(NEW.client_name, '') <> '' THEN ' de ' || NEW.client_name ELSE '' END
      || ' — ' || NEW.total_units || ' unidades',
    jsonb_build_object('order_id', NEW.id, 'catalog_id', NEW.catalog_id), 'new_order');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_new_order ON orders;
CREATE TRIGGER trg_notify_new_order AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION fn_notify_new_order();

-- ============================================================
-- Trigger 3: cerca del límite del plan (productos / usuarios)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_check_plan_limit(p_company_id uuid, p_resource text, p_label text, p_count int)
RETURNS void AS $$
DECLARE
  v_plan text;
  v_max  int;
  v_pct  numeric;
BEGIN
  SELECT plan INTO v_plan FROM companies WHERE id = p_company_id;
  SELECT (limits ->> p_resource)::int INTO v_max FROM plans WHERE name = v_plan;
  IF v_max IS NULL OR v_max <= 0 THEN RETURN; END IF; -- -1/null = ilimitado
  v_pct := p_count::numeric / v_max;
  IF v_pct >= 1 THEN
    PERFORM fn_notify_company(p_company_id, 'plan_limit',
      'Alcanzaste el límite de tu plan: ' || v_max || ' ' || p_label || '. Actualizá tu plan para seguir creciendo.',
      jsonb_build_object('resource', p_resource), 'plan_limit');
  ELSIF v_pct >= 0.8 THEN
    PERFORM fn_notify_company(p_company_id, 'plan_limit',
      'Estás cerca del límite de tu plan (' || p_count || '/' || v_max || ' ' || p_label || ')',
      jsonb_build_object('resource', p_resource), 'plan_limit');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_notify_products_limit() RETURNS trigger AS $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM products WHERE company_id = NEW.company_id AND deleted_at IS NULL;
  PERFORM fn_check_plan_limit(NEW.company_id, 'max_products', 'productos', v_count);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_products_limit ON products;
CREATE TRIGGER trg_notify_products_limit AFTER INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION fn_notify_products_limit();

CREATE OR REPLACE FUNCTION fn_notify_users_limit() RETURNS trigger AS $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM user_memberships WHERE company_id = NEW.company_id AND active = true;
  PERFORM fn_check_plan_limit(NEW.company_id, 'max_users', 'usuarios', v_count);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_users_limit ON user_memberships;
CREATE TRIGGER trg_notify_users_limit AFTER INSERT ON user_memberships
  FOR EACH ROW EXECUTE FUNCTION fn_notify_users_limit();
