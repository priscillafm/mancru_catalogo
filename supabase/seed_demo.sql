-- ============================================================
-- seed_demo.sql
-- Catálogo de ejemplo público, enlazado desde la landing
-- ("Ver catálogo de ejemplo →"). Correr una sola vez en el
-- SQL Editor de Supabase. No toca seed_mancru.sql ni datos reales.
--
-- El id del catálogo tiene que coincidir con DEMO_CATALOG_ID en
-- src/pages/Landing.jsx.
-- ============================================================

INSERT INTO companies (id, name, slug, plan, website)
VALUES (
  '00000000-0000-0000-0000-0000000000d0',
  'Distribuidora Demo',
  'distribuidora-demo',
  'free',
  'potato-catalogo.vercel.app'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO catalogs (id, company_id, name, status, snapshot_data, created_at)
VALUES (
  '00000000-0000-0000-0000-0000000000de',
  '00000000-0000-0000-0000-0000000000d0',
  'Catálogo de ejemplo',
  'shared',
  '{
    "currency": "UYU",
    "vendorWhatsapp": null,
    "prices": {
      "d1": { "amount": 180, "currency": "$" },
      "d2": { "amount": 95,  "currency": "$" },
      "d3": { "amount": 220, "currency": "$" },
      "d4": { "amount": 140, "currency": "$" },
      "d5": { "amount": 65,  "currency": "$" },
      "d6": { "amount": 110, "currency": "$" },
      "d7": { "amount": 200, "currency": "$" },
      "d8": { "amount": 75,  "currency": "$" }
    },
    "brandGroups": [
      {
        "brand": { "id": "b1", "name": "Bebidas del Sur", "color": "#DC2626", "text_color": "#fff" },
        "products": [
          { "id": "d1", "sku": "BDS-001", "name": "Agua saborizada 500ml", "image_url": "https://picsum.photos/seed/potato-d1/300" },
          { "id": "d2", "sku": "BDS-002", "name": "Gaseosa cola 1.5L",     "image_url": "https://picsum.photos/seed/potato-d2/300" },
          { "id": "d3", "sku": "BDS-003", "name": "Jugo de naranja 1L",   "image_url": "https://picsum.photos/seed/potato-d3/300" },
          { "id": "d4", "sku": "BDS-004", "name": "Energizante 250ml",    "image_url": "https://picsum.photos/seed/potato-d4/300" }
        ]
      },
      {
        "brand": { "id": "b2", "name": "Snacks Andinos", "color": "#16A34A", "text_color": "#fff" },
        "products": [
          { "id": "d5", "sku": "SA-101", "name": "Papas fritas clásicas", "image_url": "https://picsum.photos/seed/potato-d5/300" },
          { "id": "d6", "sku": "SA-102", "name": "Maní salado 200g",       "image_url": "https://picsum.photos/seed/potato-d6/300" },
          { "id": "d7", "sku": "SA-103", "name": "Mix frutos secos 300g",  "image_url": "https://picsum.photos/seed/potato-d7/300" },
          { "id": "d8", "sku": "SA-104", "name": "Galletas de avena",      "image_url": "https://picsum.photos/seed/potato-d8/300" }
        ]
      }
    ]
  }'::jsonb,
  now()
)
ON CONFLICT (id) DO NOTHING;
