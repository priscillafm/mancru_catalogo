-- ============================================================
-- seed_demo.sql
-- Catálogo de ejemplo público, enlazado desde la landing
-- ("Ver catálogo de ejemplo →"). Correr en el SQL Editor de
-- Supabase. No toca datos reales.
--
-- El id del catálogo tiene que coincidir con DEMO_CATALOG_ID en
-- src/utils/demoCatalog.js. Usa DO UPDATE para poder re-correrlo
-- cada vez que se ajuste el catálogo de ejemplo (ver 123.pdf / spec
-- de diseño: 2 proveedores, 9 productos c/u).
-- ============================================================

INSERT INTO companies (id, name, slug, plan, website)
VALUES (
  '00000000-0000-0000-0000-0000000000d0',
  'Distribuidora Demo',
  'distribuidora-demo',
  'free',
  'potatouy.com'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  website = EXCLUDED.website;

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
      "d5": { "amount": 70,  "currency": "$" },
      "d6": { "amount": 85,  "currency": "$" },
      "d7": { "amount": 160, "currency": "$" },
      "d8": { "amount": 110, "currency": "$" },
      "d9": { "amount": 190, "currency": "$" },
      "d10": { "amount": 65,  "currency": "$" },
      "d11": { "amount": 110, "currency": "$" },
      "d12": { "amount": 200, "currency": "$" },
      "d13": { "amount": 75,  "currency": "$" },
      "d14": { "amount": 60,  "currency": "$" },
      "d15": { "amount": 130, "currency": "$" },
      "d16": { "amount": 145, "currency": "$" },
      "d17": { "amount": 95,  "currency": "$" },
      "d18": { "amount": 260, "currency": "$" }
    },
    "brandGroups": [
      {
        "brand": { "id": "b1", "name": "Bebidas del Sur", "color": "#0F4C5C", "text_color": "#fff" },
        "products": [
          { "id": "d1", "sku": "BDS-001", "name": "Agua saborizada 500ml", "description": "Pomelo y limón, sin azúcar agregada. Caja por 12." },
          { "id": "d2", "sku": "BDS-002", "name": "Gaseosa cola 1.5L",     "description": "Botella retornable. Pack por 6 unidades." },
          { "id": "d3", "sku": "BDS-003", "name": "Jugo de naranja 1L",   "description": "Exprimido, sin conservantes. Requiere frío." },
          { "id": "d4", "sku": "BDS-004", "name": "Energizante 250ml",    "description": "Lata. Caja por 24 unidades." },
          { "id": "d5", "sku": "BDS-005", "name": "Agua mineral 2L",      "description": "Sin gas. Pack por 6 botellas." },
          { "id": "d6", "sku": "BDS-006", "name": "Agua con gas 500ml",   "description": "Pack por 12. Etiqueta rediseñada 2026." },
          { "id": "d7", "sku": "BDS-007", "name": "Té frío durazno 1L",   "description": "Botella PET. Caja por 8 unidades." },
          { "id": "d8", "sku": "BDS-008", "name": "Agua tónica 1L",       "description": "Pack por 6. Rotación alta en verano." },
          { "id": "d9", "sku": "BDS-009", "name": "Limonada artesanal 500ml", "description": "Con menta y jengibre. Caja por 12." }
        ]
      },
      {
        "brand": { "id": "b2", "name": "Snacks Andinos", "color": "#E07A28", "text_color": "#fff" },
        "products": [
          { "id": "d10", "sku": "SA-101", "name": "Papas fritas clásicas",  "description": "Bolsa 120g. Display por 20 unidades." },
          { "id": "d11", "sku": "SA-102", "name": "Maní salado 200g",       "description": "Tostado en horno. Caja por 24." },
          { "id": "d12", "sku": "SA-103", "name": "Mix frutos secos 300g",  "description": "Almendras, nueces y castañas. Caja por 12." },
          { "id": "d13", "sku": "SA-104", "name": "Galletas de avena",      "description": "Pack de 6 unidades. Sin azúcar agregada." },
          { "id": "d14", "sku": "SA-105", "name": "Palitos salados 150g",   "description": "Display por 20. Precio promocional." },
          { "id": "d15", "sku": "SA-106", "name": "Chips de batata 120g",   "description": "Corte rústico. Caja por 16." },
          { "id": "d16", "sku": "SA-107", "name": "Barritas de cereal x6",  "description": "Miel y avena. Caja por 12 packs." },
          { "id": "d17", "sku": "SA-108", "name": "Pasas de uva 250g",      "description": "Sin semillas. Caja por 20." },
          { "id": "d18", "sku": "SA-109", "name": "Almendras tostadas 200g","description": "Sin sal. Caja por 12." }
        ]
      }
    ]
  }'::jsonb,
  now()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  snapshot_data = EXCLUDED.snapshot_data;
