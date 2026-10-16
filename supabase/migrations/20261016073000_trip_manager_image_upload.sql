-- Trip editing uses can_manage_section; the older storage policy only knows
-- admin/manager/chairman. Add the same current trip permission for new uploads.
-- Keep the bucket private and preserve policies used by other upload features.
BEGIN;

DROP POLICY IF EXISTS "Trip section managers upload their images" ON storage.objects;
CREATE POLICY "Trip section managers upload their images"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'trip-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND public.can_manage_section((SELECT auth.uid()), 'trips')
);

COMMIT;
