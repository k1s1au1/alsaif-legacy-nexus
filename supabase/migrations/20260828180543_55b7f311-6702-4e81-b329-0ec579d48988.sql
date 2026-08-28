DROP POLICY IF EXISTS "Authenticated can view archive media" ON storage.objects;
CREATE POLICY "Archive media follows archive access rules"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'archive-media'
  AND EXISTS (
    SELECT 1 FROM public.archive_items ai
    WHERE ai.storage_path = storage.objects.name
  )
);