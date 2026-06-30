-- ============================================================
-- SEED: Mancru (migración desde potato.html)
-- Ejecutar DESPUÉS de crear el primer usuario admin en Supabase Auth
-- Reemplazar los UUIDs de ejemplo con los reales.
-- ============================================================

-- 1. Crear empresa Mancru
INSERT INTO companies (id, name, slug, website, settings) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Mancru', 'mancru', 'www.mancru.com', '{}')
ON CONFLICT (slug) DO NOTHING;

-- 2. Asignar plan Growth
INSERT INTO company_subscriptions (company_id, plan_id, status, trial_ends_at)
SELECT
  '00000000-0000-0000-0000-000000000001',
  id,
  'trialing',
  now() + interval '30 days'
FROM plans WHERE name = 'growth'
ON CONFLICT (company_id) DO NOTHING;

-- 3. Marcas (de potato.html SEED_BRANDS)
INSERT INTO brands (id, company_id, name, slug, color, text_color) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Bloox',       'bloox',       '#F5A623', '#111111'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Bloox to Go', 'bloox-to-go', '#34D6C4', '#111111'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Roca Mobile',  'roca-mobile',  '#8B7CFF', '#FFFFFF')
ON CONFLICT DO NOTHING;

-- 4. Categorías extraídas de los productos seed
INSERT INTO categories (id, company_id, name, slug) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Power Banks', 'power-banks'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Cables',      'cables'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Adaptadores', 'adaptadores'),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Auriculares', 'auriculares'),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Accesorios',  'accesorios')
ON CONFLICT DO NOTHING;

-- 5. Connector Excel por defecto para Mancru
INSERT INTO data_source_connectors (company_id, name, type, field_mapping) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'Excel Mancru',
    'excel',
    '{
      "marca":       "brand",
      "codigo":      "sku",
      "nombre":      "name",
      "categoria":   "category",
      "descripcion": "description",
      "activo":      "active",
      "url":         "image_ref"
    }'
  )
ON CONFLICT DO NOTHING;

-- NOTE: Los productos se sincronizan desde el Excel original usando
-- la pantalla "Sincronizar Empresa" → no se insertan manualmente aquí.
-- Las imágenes de Mancru son URLs externas (Mode A):
-- https://www.mancru.com/imgs/productos/

-- 6. Para asignar el usuario admin: ejecutar después de crear usuario en Auth
-- UPDATE user_memberships SET role = 'company_admin'
-- WHERE user_id = '<uuid del usuario>' AND company_id = '00000000-0000-0000-0000-000000000001';
-- O insertar directamente:
-- INSERT INTO user_memberships (user_id, company_id, role)
-- VALUES ('<uuid>', '00000000-0000-0000-0000-000000000001', 'company_admin');
