-- Storage bucket for product images (Mode B/C uploads)
-- Run this in Supabase Dashboard → Storage → New bucket,
-- OR via the Supabase CLI after linking.

-- Policy: company admins can upload to their own company folder
-- Public read for all authenticated users of the same company

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "company images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "company admins can upload images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images' AND
    -- path must start with the user's company_id
    EXISTS (
      SELECT 1 FROM user_memberships
      WHERE user_id = auth.uid()
        AND company_id = (string_to_array(name, '/'))[1]::uuid
        AND role IN ('super_admin','company_admin')
        AND active = true
    )
  );

CREATE POLICY "company admins can update images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images' AND
    EXISTS (
      SELECT 1 FROM user_memberships
      WHERE user_id = auth.uid()
        AND company_id = (string_to_array(name, '/'))[1]::uuid
        AND role IN ('super_admin','company_admin')
        AND active = true
    )
  );
