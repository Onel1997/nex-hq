-- Image Agent — Supabase Storage bucket for generated visual assets

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'image-assets',
  'image-assets',
  true,
  52428800,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read image assets" ON storage.objects;
CREATE POLICY "Public read image assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'image-assets');

DROP POLICY IF EXISTS "Service role manage image assets" ON storage.objects;
CREATE POLICY "Service role manage image assets"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'image-assets')
WITH CHECK (bucket_id = 'image-assets');
