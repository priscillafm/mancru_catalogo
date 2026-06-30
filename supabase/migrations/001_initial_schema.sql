-- ============================================================
-- MIGRATION 001 — Initial Schema
-- Architecture v2 MVP
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fuzzy text search on image mappings

-- ============================================================
-- PLANS (public, no RLS needed)
-- ============================================================
CREATE TABLE plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL UNIQUE,           -- 'starter' | 'growth' | 'enterprise'
  display_name    text NOT NULL,
  limits          jsonb NOT NULL DEFAULT '{}',    -- see comment below
  price_monthly   numeric(10,2),
  price_yearly    numeric(10,2),
  is_public       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- limits jsonb shape (documented here, validated in app):
-- {
--   "max_users": 3,
--   "max_products": 1000,
--   "max_brands": 10,
--   "max_storage_mb": 500,
--   "max_catalogs_per_month": 50,
--   "connectors_allowed": ["excel", "csv"],
--   "smart_collections": false,
--   "custom_pdf_template": false,
--   "api_access": false,
--   "audit_log_days": 30
-- }

INSERT INTO plans (name, display_name, limits, price_monthly, price_yearly) VALUES
  ('starter', 'Plan Starter', '{
    "max_users": 3,
    "max_products": 1000,
    "max_brands": 5,
    "max_storage_mb": 500,
    "max_catalogs_per_month": 50,
    "connectors_allowed": ["excel", "csv"],
    "smart_collections": false,
    "custom_pdf_template": false,
    "api_access": false,
    "audit_log_days": 30
  }', 29.00, 290.00),
  ('growth', 'Plan Growth', '{
    "max_users": 15,
    "max_products": 10000,
    "max_brands": 20,
    "max_storage_mb": 5000,
    "max_catalogs_per_month": 500,
    "connectors_allowed": ["excel", "csv", "google_sheets"],
    "smart_collections": true,
    "custom_pdf_template": true,
    "api_access": false,
    "audit_log_days": 90
  }', 79.00, 790.00),
  ('enterprise', 'Plan Enterprise', '{
    "max_users": -1,
    "max_products": -1,
    "max_brands": -1,
    "max_storage_mb": -1,
    "max_catalogs_per_month": -1,
    "connectors_allowed": ["excel", "csv", "google_sheets", "rest_api", "ftp", "erp_webhook"],
    "smart_collections": true,
    "custom_pdf_template": true,
    "api_access": true,
    "audit_log_days": 365
  }', 199.00, 1990.00);

-- ============================================================
-- COMPANIES
-- ============================================================
CREATE TABLE companies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  logo_url        text,
  website         text,
  settings        jsonb NOT NULL DEFAULT '{}',
  active          boolean NOT NULL DEFAULT true,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_companies_slug ON companies(slug) WHERE deleted_at IS NULL;

-- ============================================================
-- COMPANY SUBSCRIPTIONS
-- ============================================================
CREATE TABLE company_subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  plan_id               uuid NOT NULL REFERENCES plans(id),
  status                text NOT NULL DEFAULT 'trialing'
                          CHECK (status IN ('trialing','active','past_due','cancelled','paused')),
  trial_ends_at         timestamptz,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  cancelled_at          timestamptz,
  external_id           text,          -- Stripe / MercadoPago subscription ID (future)
  metadata              jsonb NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- USERS (mirrors auth.users)
-- ============================================================
CREATE TABLE users (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL DEFAULT '',
  email           text NOT NULL,
  avatar_url      text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- USER MEMBERSHIPS (user ↔ company with role)
-- ============================================================
CREATE TABLE user_memberships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'vendor'
                    CHECK (role IN ('super_admin','company_admin','vendor')),
  active          boolean NOT NULL DEFAULT true,
  invited_by      uuid REFERENCES users(id),
  joined_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id)
);

CREATE INDEX idx_memberships_user    ON user_memberships(user_id) WHERE active = true;
CREATE INDEX idx_memberships_company ON user_memberships(company_id) WHERE active = true;

-- ============================================================
-- BRANDS
-- ============================================================
CREATE TABLE brands (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            text NOT NULL,
  slug            text NOT NULL,
  color           text NOT NULL DEFAULT '#6366f1',
  text_color      text NOT NULL DEFAULT '#ffffff',
  aliases         text[] NOT NULL DEFAULT '{}',  -- alternate names from data sources
  sort_order      int NOT NULL DEFAULT 0,
  active          boolean NOT NULL DEFAULT true,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, slug)
);

CREATE INDEX idx_brands_company ON brands(company_id) WHERE deleted_at IS NULL;

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            text NOT NULL,
  slug            text NOT NULL,
  parent_id       uuid REFERENCES categories(id),  -- for future nesting
  aliases         text[] NOT NULL DEFAULT '{}',    -- alternate names from data sources
  sort_order      int NOT NULL DEFAULT 0,
  active          boolean NOT NULL DEFAULT true,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, slug)
);

CREATE INDEX idx_categories_company ON categories(company_id) WHERE deleted_at IS NULL;

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id        uuid REFERENCES brands(id) ON DELETE SET NULL,
  category_id     uuid REFERENCES categories(id) ON DELETE SET NULL,
  sku             text NOT NULL,
  name            text NOT NULL,
  description     text NOT NULL DEFAULT '',
  -- structured fields (common enough to be columns)
  price           numeric(12,2),
  stock           int,
  weight_g        int,
  -- image
  image_url       text,
  image_source    text CHECK (image_source IN ('external','storage','mapped') OR image_source IS NULL),
  -- state
  active          boolean NOT NULL DEFAULT true,
  deleted_at      timestamptz,
  -- flexible extension point
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, sku)
);

-- Critical: all queries filter by company_id first
CREATE INDEX idx_products_company_active ON products(company_id, active) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_company_brand  ON products(company_id, brand_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_company_cat    ON products(company_id, category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_sku            ON products(company_id, sku);
-- Full text search
CREATE INDEX idx_products_name_trgm ON products USING gin(name gin_trgm_ops);

-- ============================================================
-- PRODUCT VARIANTS
-- ============================================================
CREATE TABLE variant_attribute_types (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            text NOT NULL,   -- "Color"
  slug            text NOT NULL,   -- "color"
  UNIQUE (company_id, slug)
);

CREATE TABLE product_variants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku             text NOT NULL,
  image_url       text,
  active          boolean NOT NULL DEFAULT true,
  deleted_at      timestamptz,
  sort_order      int NOT NULL DEFAULT 0
);

CREATE INDEX idx_variants_product ON product_variants(product_id) WHERE deleted_at IS NULL;

CREATE TABLE variant_attribute_values (
  variant_id      uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  attribute_id    uuid NOT NULL REFERENCES variant_attribute_types(id) ON DELETE CASCADE,
  value           text NOT NULL,
  PRIMARY KEY (variant_id, attribute_id)
);

-- ============================================================
-- COLLECTIONS
-- ============================================================
CREATE TABLE collections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text NOT NULL DEFAULT '',
  type            text NOT NULL DEFAULT 'manual' CHECK (type IN ('manual','smart')),
  cover_image_url text,
  sort_order      int NOT NULL DEFAULT 0,
  active          boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES users(id),
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_collections_company ON collections(company_id) WHERE deleted_at IS NULL;

-- Smart collection rules (prepared, UI in v2)
CREATE TABLE collection_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id   uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  field           text NOT NULL,    -- 'brand_id' | 'category_id' | 'active' | etc.
  operator        text NOT NULL,    -- 'eq' | 'in' | 'gt' | 'lt' | 'contains'
  value           jsonb NOT NULL,
  rule_group      int NOT NULL DEFAULT 0
);

CREATE TABLE collection_products (
  collection_id   uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order      int NOT NULL DEFAULT 0,
  added_by        uuid REFERENCES users(id),
  added_at        timestamptz NOT NULL DEFAULT now(),
  is_cache        boolean NOT NULL DEFAULT false,  -- true = smart collection cache
  PRIMARY KEY (collection_id, product_id)
);

-- ============================================================
-- CATALOGS
-- ============================================================
CREATE TABLE catalogs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by      uuid REFERENCES users(id),
  name            text NOT NULL,
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','generated','shared')),
  share_token     text UNIQUE,       -- for public sharing (future)
  expires_at      timestamptz,
  pdf_url         text,              -- generated PDF in storage (future server-side gen)
  snapshot_data   jsonb,             -- frozen product data at generation time
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalogs_company ON catalogs(company_id) WHERE deleted_at IS NULL;

CREATE TABLE catalog_products (
  catalog_id      uuid NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order      int NOT NULL DEFAULT 0,
  -- snapshot of product at catalog generation time
  product_snapshot jsonb,
  PRIMARY KEY (catalog_id, product_id)
);

-- ============================================================
-- DATA SOURCE CONNECTORS
-- ============================================================
CREATE TABLE data_source_connectors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            text NOT NULL,
  type            text NOT NULL
                    CHECK (type IN ('excel','csv','google_sheets','rest_api','ftp','erp_webhook')),
  config          jsonb NOT NULL DEFAULT '{}',   -- credentials, URLs (encrypt sensitive at app level)
  field_mapping   jsonb NOT NULL DEFAULT '{}',   -- {"Source Column": "canonical_field"}
  schedule        text,                           -- cron expression (future auto-sync)
  active          boolean NOT NULL DEFAULT true,
  last_sync_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_connectors_company ON data_source_connectors(company_id);

-- ============================================================
-- SYNC EXECUTIONS
-- ============================================================
CREATE TABLE sync_executions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  connector_id    uuid REFERENCES data_source_connectors(id) ON DELETE SET NULL,
  triggered_by    uuid REFERENCES users(id),
  status          text NOT NULL DEFAULT 'parsing'
                    CHECK (status IN (
                      'parsing','diffing','awaiting_approval',
                      'applying','completed','failed','cancelled'
                    )),
  rows_parsed     int NOT NULL DEFAULT 0,
  rows_new        int NOT NULL DEFAULT 0,
  rows_updated    int NOT NULL DEFAULT 0,
  rows_deleted    int NOT NULL DEFAULT 0,
  rows_skipped    int NOT NULL DEFAULT 0,
  rows_errors     int NOT NULL DEFAULT 0,
  error_detail    text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX idx_sync_executions_company ON sync_executions(company_id, started_at DESC);

-- ============================================================
-- SYNC DIFF ROWS (individual per-product changes)
-- ============================================================
CREATE TABLE sync_diff_rows (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id    uuid NOT NULL REFERENCES sync_executions(id) ON DELETE CASCADE,
  sku             text NOT NULL,
  change_type     text NOT NULL
                    CHECK (change_type IN ('new','updated','deleted','no_change','error','skipped')),
  old_data        jsonb,
  new_data        jsonb,
  changed_fields  text[] NOT NULL DEFAULT '{}',
  excluded        boolean NOT NULL DEFAULT false,
  exclusion_reason text
);

-- Indexes for the diff review UI
CREATE INDEX idx_diff_rows_execution      ON sync_diff_rows(execution_id);
CREATE INDEX idx_diff_rows_exec_type      ON sync_diff_rows(execution_id, change_type);
CREATE INDEX idx_diff_rows_exec_excluded  ON sync_diff_rows(execution_id, excluded);

-- ============================================================
-- IMAGE CONNECTORS
-- ============================================================
CREATE TABLE image_connectors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            text NOT NULL,
  type            text NOT NULL
                    CHECK (type IN ('url_field','supabase_storage','cloudinary','custom_cdn','ftp')),
  config          jsonb NOT NULL DEFAULT '{}',
  is_default      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- IMAGE MAPPINGS (persistent, survives re-syncs)
-- ============================================================
CREATE TABLE image_mappings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_key      text NOT NULL,         -- original filename or reference: "IMG_4589.jpg"
  product_sku     text NOT NULL,         -- resolved target SKU
  resolved_url    text,                  -- final URL after resolution
  connector_id    uuid REFERENCES image_connectors(id) ON DELETE SET NULL,
  match_method    text NOT NULL DEFAULT 'manual'
                    CHECK (match_method IN ('exact_sku','fuzzy_filename','manual','ai_suggestion')),
  confidence      float NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  confirmed       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, source_key)
);

CREATE INDEX idx_image_mappings_company     ON image_mappings(company_id);
CREATE INDEX idx_image_mappings_sku         ON image_mappings(company_id, product_sku);
CREATE INDEX idx_image_mappings_unconfirmed ON image_mappings(company_id, confirmed) WHERE confirmed = false;
-- Trigram index for fuzzy filename matching
CREATE INDEX idx_image_mappings_trgm ON image_mappings USING gin(source_key gin_trgm_ops);

-- ============================================================
-- USAGE SNAPSHOTS (daily, for billing and dashboards)
-- ============================================================
CREATE TABLE usage_snapshots (
  company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  snapshot_date       date NOT NULL,
  products_count      int NOT NULL DEFAULT 0,
  users_count         int NOT NULL DEFAULT 0,
  brands_count        int NOT NULL DEFAULT 0,
  storage_bytes       bigint NOT NULL DEFAULT 0,
  catalogs_generated  int NOT NULL DEFAULT 0,
  sync_executions     int NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, snapshot_date)
);

-- ============================================================
-- AUDIT LOG (append-only, trigger-driven)
-- ============================================================
CREATE TABLE audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid REFERENCES companies(id) ON DELETE SET NULL,
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  action          text NOT NULL,       -- 'product.created' | 'catalog.generated' | etc.
  entity_type     text,
  entity_id       uuid,
  old_data        jsonb,
  new_data        jsonb,
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Partition-ready index (query by company + time range)
CREATE INDEX idx_audit_company_time ON audit_log(company_id, created_at DESC);
CREATE INDEX idx_audit_entity       ON audit_log(entity_type, entity_id);

-- ============================================================
-- AUDIT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _company_id uuid;
  _action text;
BEGIN
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    _action := TG_TABLE_NAME || '.created';
    _company_id := (NEW.company_id)::uuid;
    INSERT INTO audit_log(company_id, action, entity_type, entity_id, new_data)
    VALUES (_company_id, _action, TG_TABLE_NAME, NEW.id, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'UPDATE' THEN
    _action := TG_TABLE_NAME || '.updated';
    _company_id := (NEW.company_id)::uuid;
    INSERT INTO audit_log(company_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (_company_id, _action, TG_TABLE_NAME, NEW.id,
            row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'DELETE' THEN
    _action := TG_TABLE_NAME || '.deleted';
    _company_id := (OLD.company_id)::uuid;
    INSERT INTO audit_log(company_id, action, entity_type, entity_id, old_data)
    VALUES (_company_id, _action, TG_TABLE_NAME, OLD.id, row_to_json(OLD)::jsonb);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply audit trigger to critical tables
CREATE TRIGGER trg_audit_products
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_brands
  AFTER INSERT OR UPDATE OR DELETE ON brands
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_user_memberships
  AFTER INSERT OR UPDATE OR DELETE ON user_memberships
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_updated_at_companies     BEFORE UPDATE ON companies     FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_at_products      BEFORE UPDATE ON products      FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_at_brands        BEFORE UPDATE ON brands        FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_at_categories    BEFORE UPDATE ON categories    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_at_collections   BEFORE UPDATE ON collections   FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_at_catalogs      BEFORE UPDATE ON catalogs      FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_at_connectors    BEFORE UPDATE ON data_source_connectors FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_at_image_maps    BEFORE UPDATE ON image_mappings FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_at_subscriptions BEFORE UPDATE ON company_subscriptions FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_updated_at_users         BEFORE UPDATE ON users         FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Helper: get current user's company_id and role for a given company
CREATE OR REPLACE FUNCTION fn_user_role_in_company(p_company_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM user_memberships
  WHERE user_id = auth.uid()
    AND company_id = p_company_id
    AND active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION fn_is_super_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_memberships
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND active = true
  );
$$;

-- Enable RLS
ALTER TABLE companies              ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memberships       ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories             ENABLE ROW LEVEL SECURITY;
ALTER TABLE products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_attribute_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections            ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_source_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_executions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_diff_rows         ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_connectors       ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_mappings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_snapshots        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log              ENABLE ROW LEVEL SECURITY;

-- companies: members can read their own, super_admin can read all
CREATE POLICY pol_companies_select ON companies FOR SELECT USING (
  fn_is_super_admin() OR
  EXISTS (SELECT 1 FROM user_memberships WHERE user_id = auth.uid() AND company_id = companies.id AND active = true)
);
CREATE POLICY pol_companies_insert ON companies FOR INSERT WITH CHECK (fn_is_super_admin());
CREATE POLICY pol_companies_update ON companies FOR UPDATE USING (
  fn_is_super_admin() OR fn_user_role_in_company(id) = 'company_admin'
);

-- Generic "belongs to company" policy factory pattern:
-- Applied to: brands, categories, products, collections, catalogs,
--             data_source_connectors, sync_executions, image_connectors, image_mappings

-- brands
CREATE POLICY pol_brands_select ON brands FOR SELECT USING (
  fn_is_super_admin() OR
  EXISTS (SELECT 1 FROM user_memberships WHERE user_id = auth.uid() AND company_id = brands.company_id AND active = true)
);
CREATE POLICY pol_brands_modify ON brands FOR ALL USING (
  fn_is_super_admin() OR fn_user_role_in_company(company_id) IN ('company_admin')
);

-- categories
CREATE POLICY pol_categories_select ON categories FOR SELECT USING (
  fn_is_super_admin() OR
  EXISTS (SELECT 1 FROM user_memberships WHERE user_id = auth.uid() AND company_id = categories.company_id AND active = true)
);
CREATE POLICY pol_categories_modify ON categories FOR ALL USING (
  fn_is_super_admin() OR fn_user_role_in_company(company_id) IN ('company_admin')
);

-- products: all members can read, only admins can write
CREATE POLICY pol_products_select ON products FOR SELECT USING (
  fn_is_super_admin() OR
  EXISTS (SELECT 1 FROM user_memberships WHERE user_id = auth.uid() AND company_id = products.company_id AND active = true)
);
CREATE POLICY pol_products_modify ON products FOR ALL USING (
  fn_is_super_admin() OR fn_user_role_in_company(company_id) IN ('company_admin')
);

-- product_variants (inherit via join)
CREATE POLICY pol_variants_select ON product_variants FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM products p
    JOIN user_memberships m ON m.company_id = p.company_id
    WHERE p.id = product_variants.product_id AND m.user_id = auth.uid() AND m.active = true
  ) OR fn_is_super_admin()
);
CREATE POLICY pol_variants_modify ON product_variants FOR ALL USING (
  EXISTS (
    SELECT 1 FROM products p
    JOIN user_memberships m ON m.company_id = p.company_id
    WHERE p.id = product_variants.product_id AND m.user_id = auth.uid() AND m.active = true
      AND m.role IN ('company_admin')
  ) OR fn_is_super_admin()
);

-- collections
CREATE POLICY pol_collections_select ON collections FOR SELECT USING (
  fn_is_super_admin() OR
  EXISTS (SELECT 1 FROM user_memberships WHERE user_id = auth.uid() AND company_id = collections.company_id AND active = true)
);
CREATE POLICY pol_collections_modify ON collections FOR ALL USING (
  fn_is_super_admin() OR fn_user_role_in_company(company_id) IN ('company_admin')
);

-- collection_products
CREATE POLICY pol_coll_products_select ON collection_products FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM collections c
    JOIN user_memberships m ON m.company_id = c.company_id
    WHERE c.id = collection_products.collection_id AND m.user_id = auth.uid() AND m.active = true
  ) OR fn_is_super_admin()
);
CREATE POLICY pol_coll_products_modify ON collection_products FOR ALL USING (
  EXISTS (
    SELECT 1 FROM collections c
    JOIN user_memberships m ON m.company_id = c.company_id
    WHERE c.id = collection_products.collection_id AND m.user_id = auth.uid() AND m.active = true
      AND m.role = 'company_admin'
  ) OR fn_is_super_admin()
);

-- catalogs: all members can read/create, only own catalogs
CREATE POLICY pol_catalogs_select ON catalogs FOR SELECT USING (
  fn_is_super_admin() OR
  EXISTS (SELECT 1 FROM user_memberships WHERE user_id = auth.uid() AND company_id = catalogs.company_id AND active = true)
);
CREATE POLICY pol_catalogs_insert ON catalogs FOR INSERT WITH CHECK (
  fn_is_super_admin() OR
  EXISTS (SELECT 1 FROM user_memberships WHERE user_id = auth.uid() AND company_id = catalogs.company_id AND active = true)
);
CREATE POLICY pol_catalogs_update ON catalogs FOR UPDATE USING (
  fn_is_super_admin() OR created_by = auth.uid()
);

-- catalog_products
CREATE POLICY pol_cat_products_select ON catalog_products FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM catalogs c
    JOIN user_memberships m ON m.company_id = c.company_id
    WHERE c.id = catalog_products.catalog_id AND m.user_id = auth.uid() AND m.active = true
  ) OR fn_is_super_admin()
);
CREATE POLICY pol_cat_products_modify ON catalog_products FOR ALL USING (
  EXISTS (
    SELECT 1 FROM catalogs c
    WHERE c.id = catalog_products.catalog_id AND c.created_by = auth.uid()
  ) OR fn_is_super_admin()
);

-- data_source_connectors
CREATE POLICY pol_connectors_select ON data_source_connectors FOR SELECT USING (
  fn_is_super_admin() OR fn_user_role_in_company(company_id) = 'company_admin'
);
CREATE POLICY pol_connectors_modify ON data_source_connectors FOR ALL USING (
  fn_is_super_admin() OR fn_user_role_in_company(company_id) = 'company_admin'
);

-- sync_executions
CREATE POLICY pol_sync_exec_select ON sync_executions FOR SELECT USING (
  fn_is_super_admin() OR fn_user_role_in_company(company_id) = 'company_admin'
);
CREATE POLICY pol_sync_exec_modify ON sync_executions FOR ALL USING (
  fn_is_super_admin() OR fn_user_role_in_company(company_id) = 'company_admin'
);

-- sync_diff_rows (via sync_executions)
CREATE POLICY pol_diff_rows_select ON sync_diff_rows FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM sync_executions se
    JOIN user_memberships m ON m.company_id = se.company_id
    WHERE se.id = sync_diff_rows.execution_id AND m.user_id = auth.uid() AND m.active = true
      AND m.role = 'company_admin'
  ) OR fn_is_super_admin()
);
CREATE POLICY pol_diff_rows_modify ON sync_diff_rows FOR ALL USING (
  EXISTS (
    SELECT 1 FROM sync_executions se
    JOIN user_memberships m ON m.company_id = se.company_id
    WHERE se.id = sync_diff_rows.execution_id AND m.user_id = auth.uid() AND m.active = true
      AND m.role = 'company_admin'
  ) OR fn_is_super_admin()
);

-- image_connectors & image_mappings
CREATE POLICY pol_img_connectors ON image_connectors FOR ALL USING (
  fn_is_super_admin() OR fn_user_role_in_company(company_id) = 'company_admin'
);
CREATE POLICY pol_img_mappings_select ON image_mappings FOR SELECT USING (
  fn_is_super_admin() OR
  EXISTS (SELECT 1 FROM user_memberships WHERE user_id = auth.uid() AND company_id = image_mappings.company_id AND active = true)
);
CREATE POLICY pol_img_mappings_modify ON image_mappings FOR ALL USING (
  fn_is_super_admin() OR fn_user_role_in_company(company_id) = 'company_admin'
);

-- users: can read own, admins can read company members
CREATE POLICY pol_users_select ON users FOR SELECT USING (
  auth.uid() = id OR fn_is_super_admin() OR
  EXISTS (
    SELECT 1 FROM user_memberships m1
    JOIN user_memberships m2 ON m1.company_id = m2.company_id
    WHERE m1.user_id = auth.uid() AND m2.user_id = users.id
      AND m1.active = true AND m2.active = true
  )
);
CREATE POLICY pol_users_update ON users FOR UPDATE USING (auth.uid() = id OR fn_is_super_admin());

-- user_memberships
CREATE POLICY pol_memberships_select ON user_memberships FOR SELECT USING (
  auth.uid() = user_id OR fn_is_super_admin() OR
  fn_user_role_in_company(company_id) = 'company_admin'
);
CREATE POLICY pol_memberships_modify ON user_memberships FOR ALL USING (
  fn_is_super_admin() OR fn_user_role_in_company(company_id) = 'company_admin'
);

-- company_subscriptions
CREATE POLICY pol_subscriptions_select ON company_subscriptions FOR SELECT USING (
  fn_is_super_admin() OR fn_user_role_in_company(company_id) IN ('company_admin')
);
CREATE POLICY pol_subscriptions_modify ON company_subscriptions FOR ALL USING (fn_is_super_admin());

-- usage_snapshots
CREATE POLICY pol_usage_select ON usage_snapshots FOR SELECT USING (
  fn_is_super_admin() OR fn_user_role_in_company(company_id) IN ('company_admin')
);

-- audit_log: read-only for admins
CREATE POLICY pol_audit_select ON audit_log FOR SELECT USING (
  fn_is_super_admin() OR fn_user_role_in_company(company_id) = 'company_admin'
);
-- audit_log is written only by triggers (SECURITY DEFINER), never directly by clients
CREATE POLICY pol_audit_insert ON audit_log FOR INSERT WITH CHECK (false);

-- plans: public read
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY pol_plans_select ON plans FOR SELECT USING (true);
CREATE POLICY pol_plans_modify  ON plans FOR ALL    USING (fn_is_super_admin());

-- variant_attribute_types
CREATE POLICY pol_vat_select ON variant_attribute_types FOR SELECT USING (
  fn_is_super_admin() OR
  EXISTS (SELECT 1 FROM user_memberships WHERE user_id = auth.uid() AND company_id = variant_attribute_types.company_id AND active = true)
);
CREATE POLICY pol_vat_modify ON variant_attribute_types FOR ALL USING (
  fn_is_super_admin() OR fn_user_role_in_company(company_id) = 'company_admin'
);

-- variant_attribute_values (via product_variants → products)
CREATE POLICY pol_vav_select ON variant_attribute_values FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    JOIN user_memberships m ON m.company_id = p.company_id
    WHERE pv.id = variant_attribute_values.variant_id AND m.user_id = auth.uid() AND m.active = true
  ) OR fn_is_super_admin()
);

-- ============================================================
-- FUNCTION: auto-create user profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_handle_new_user();

-- ============================================================
-- FUNCTION: check plan limit
-- ============================================================
CREATE OR REPLACE FUNCTION fn_check_limit(p_company_id uuid, p_limit_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  _limit int;
  _current int;
  _plan_limits jsonb;
BEGIN
  SELECT pl.limits INTO _plan_limits
  FROM company_subscriptions cs
  JOIN plans pl ON pl.id = cs.plan_id
  WHERE cs.company_id = p_company_id AND cs.status IN ('trialing','active');

  IF _plan_limits IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_active_plan');
  END IF;

  _limit := (_plan_limits->>p_limit_key)::int;

  -- -1 means unlimited
  IF _limit = -1 THEN
    RETURN jsonb_build_object('allowed', true, 'limit', -1, 'current', 0);
  END IF;

  -- Get current usage from latest snapshot
  SELECT
    CASE p_limit_key
      WHEN 'max_products' THEN products_count
      WHEN 'max_users'    THEN users_count
      WHEN 'max_brands'   THEN brands_count
    END
  INTO _current
  FROM usage_snapshots
  WHERE company_id = p_company_id
  ORDER BY snapshot_date DESC
  LIMIT 1;

  _current := COALESCE(_current, 0);

  RETURN jsonb_build_object(
    'allowed',  _current < _limit,
    'limit',    _limit,
    'current',  _current,
    'remaining', GREATEST(0, _limit - _current)
  );
END;
$$;
