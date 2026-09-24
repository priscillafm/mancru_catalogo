-- Panel de superadministración: métricas agregadas por empresa y bandeja de soporte.
-- Las funciones devuelven solo conteos y nombres de empresa (nunca mails de usuarios, productos ni precios)
-- y se rechazan para cualquiera que no sea super_admin.

ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp text;

ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS handled_at timestamptz;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contact_messages_status_check') THEN
    ALTER TABLE contact_messages
      ADD CONSTRAINT contact_messages_status_check CHECK (status IN ('new', 'answered', 'archived'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION admin_require() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT fn_is_super_admin() THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION admin_companies()
RETURNS TABLE (
  company_id uuid, company_name text, plan text, created_at timestamptz,
  users_count bigint, products_count bigint, products_with_image bigint, products_with_price bigint,
  catalogs_count bigint, shared_catalogs bigint, views_30d bigint, orders_30d bigint,
  has_whatsapp boolean, has_logo boolean, last_activity timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
#variable_conflict use_column
BEGIN
  PERFORM admin_require();
  RETURN QUERY
  SELECT
    c.id, c.name, c.plan, c.created_at,
    (SELECT count(*) FROM user_memberships m WHERE m.company_id = c.id AND m.active),
    (SELECT count(*) FROM products p WHERE p.company_id = c.id AND p.deleted_at IS NULL),
    (SELECT count(*) FROM products p WHERE p.company_id = c.id AND p.deleted_at IS NULL AND p.image_url IS NOT NULL),
    (SELECT count(*) FROM products p WHERE p.company_id = c.id AND p.deleted_at IS NULL AND p.price IS NOT NULL),
    (SELECT count(*) FROM catalogs k WHERE k.company_id = c.id AND k.deleted_at IS NULL),
    (SELECT count(*) FROM catalogs k WHERE k.company_id = c.id AND k.deleted_at IS NULL AND k.status = 'shared'),
    (SELECT count(*) FROM catalog_views v JOIN catalogs k ON k.id = v.catalog_id
       WHERE k.company_id = c.id AND v.viewed_at > now() - interval '30 days'),
    (SELECT count(*) FROM orders o WHERE o.company_id = c.id AND o.created_at > now() - interval '30 days'),
    EXISTS (SELECT 1 FROM user_memberships m JOIN users u ON u.id = m.user_id
       WHERE m.company_id = c.id AND coalesce(u.whatsapp, '') <> ''),
    (c.logo_url IS NOT NULL),
    GREATEST(
      c.created_at,
      (SELECT max(k.updated_at) FROM catalogs k WHERE k.company_id = c.id),
      (SELECT max(p.updated_at) FROM products p WHERE p.company_id = c.id),
      (SELECT max(o.created_at) FROM orders o WHERE o.company_id = c.id)
    )
  FROM companies c
  WHERE c.deleted_at IS NULL
  ORDER BY c.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_support_list() RETURNS SETOF contact_messages
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  PERFORM admin_require();
  RETURN QUERY SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 200;
END;
$$;

CREATE OR REPLACE FUNCTION admin_support_set_status(p_id uuid, p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM admin_require();
  UPDATE contact_messages
     SET status = p_status,
         handled_at = CASE WHEN p_status = 'new' THEN NULL ELSE now() END
   WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION admin_require() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION admin_companies() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION admin_support_list() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION admin_support_set_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_companies() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_support_list() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_support_set_status(uuid, text) TO authenticated;
