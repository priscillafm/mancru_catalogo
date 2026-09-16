-- Fix: un catálogo público (status = 'shared') no se veía si quien abría el
-- link estaba logueado en Potato con una cuenta que no pertenece a esa
-- empresa (ej: la vendedora prueba su propio link estando logueada, o un
-- cliente que también tiene cuenta propia). pol_catalogs_select solo
-- contempla miembros de la empresa; nunca hubo una policy para "es público".
-- Se agrega acá, para TO public (anon + authenticated), separada de
-- pol_catalogs_select para no tocar esa policy existente.
-- Run this in Supabase Dashboard → SQL Editor.

DROP POLICY IF EXISTS pol_catalogs_select_public ON catalogs;
CREATE POLICY pol_catalogs_select_public ON catalogs FOR SELECT
  USING (status = 'shared' AND deleted_at IS NULL);

-- Mismo problema podría afectar la lectura de productos embebidos vía
-- catalog_products cuando el catálogo es público (hoy el catálogo público
-- solo usa snapshot_data, pero se cubre por consistencia).
DROP POLICY IF EXISTS pol_cat_products_select_public ON catalog_products;
CREATE POLICY pol_cat_products_select_public ON catalog_products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM catalogs c
      WHERE c.id = catalog_products.catalog_id AND c.status = 'shared' AND c.deleted_at IS NULL
    )
  );

-- Y la lectura de companies (nombre/logo/website) para el header del
-- catálogo público.
DROP POLICY IF EXISTS pol_companies_select_public ON companies;
CREATE POLICY pol_companies_select_public ON companies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM catalogs c
      WHERE c.company_id = companies.id AND c.status = 'shared' AND c.deleted_at IS NULL
    )
  );
