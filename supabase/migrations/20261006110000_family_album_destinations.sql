-- Custom family albums and an explicit album section head. Preserve the four
-- existing sections and their data; custom memories reference an album by UUID.
BEGIN;

ALTER TABLE public.section_heads DROP CONSTRAINT IF EXISTS section_heads_section_check;
ALTER TABLE public.section_heads ADD CONSTRAINT section_heads_section_check
  CHECK (section IN ('meetings','trips','occasions','tasks','news','community','faith','heritage','finance','archive'));

CREATE TABLE IF NOT EXISTS public.archive_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT archive_albums_title_check CHECK (
    title = btrim(title) AND char_length(title) BETWEEN 1 AND 60
    AND title NOT IN ('ألبوم العائلة','الاجتماعات','المناسبات','الرحلات','الترفيه')
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS archive_albums_title_unique
  ON public.archive_albums (lower(regexp_replace(btrim(title), '\s+', ' ', 'g')));
ALTER TABLE public.archive_albums ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.archive_albums TO authenticated;
GRANT ALL ON public.archive_albums TO service_role;

DROP POLICY IF EXISTS "Family members view albums" ON public.archive_albums;
CREATE POLICY "Family members view albums" ON public.archive_albums
  FOR SELECT TO authenticated USING (public.is_family_member(auth.uid()));
DROP POLICY IF EXISTS "Album heads and leadership create albums" ON public.archive_albums;
CREATE POLICY "Album heads and leadership create albums" ON public.archive_albums
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid() AND public.can_manage_section(auth.uid(), 'archive')
  );

ALTER TABLE public.archive_items ADD COLUMN IF NOT EXISTS album_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.archive_items'::regclass AND conname = 'archive_items_album_id_fkey') THEN
    ALTER TABLE public.archive_items ADD CONSTRAINT archive_items_album_id_fkey
      FOREIGN KEY (album_id) REFERENCES public.archive_albums(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.archive_items'::regclass AND conname = 'archive_items_custom_section_check') THEN
    ALTER TABLE public.archive_items ADD CONSTRAINT archive_items_custom_section_check
      CHECK (album_id IS NULL OR section = 'family'::public.archive_section);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS archive_items_album_id_idx ON public.archive_items (album_id) WHERE album_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.can_manage_archive_item(_user uuid, _section text, _album uuid, _uploader uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND (
    public.can_manage_section(_user, 'archive')
    OR ((_album IS NOT NULL OR _section = 'family') AND _user = _uploader)
    OR (_album IS NULL AND public.can_manage_section(_user, _section))
  );
$$;
REVOKE ALL ON FUNCTION public.can_manage_archive_item(uuid, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_archive_item(uuid, text, uuid, uuid) TO authenticated, service_role;

-- Replace obsolete permissive policies too, so alternate historical migrations
-- cannot grant a technical admin or a legacy manager blanket album rights.
DO $$ DECLARE policy record;
BEGIN
  FOR policy IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'archive_items'
  LOOP EXECUTE format('DROP POLICY %I ON public.archive_items', policy.policyname); END LOOP;
END $$;

CREATE POLICY "View archive by album rules" ON public.archive_items
  FOR SELECT TO authenticated USING (
    (album_id IS NOT NULL AND public.is_family_member(auth.uid()))
    OR (album_id IS NULL AND (
      section = 'family'::public.archive_section OR auth.uid() = uploader_id
      OR public.can_manage_section(auth.uid(), 'archive')
      OR public.can_manage_section(auth.uid(), section::text)
    ))
  );
CREATE POLICY "Insert archive by album rules" ON public.archive_items
  FOR INSERT TO authenticated WITH CHECK (
    uploader_id = auth.uid() AND split_part(storage_path, '/', 1) = auth.uid()::text
    AND (
      (album_id IS NOT NULL AND public.is_family_member(auth.uid()) AND EXISTS (SELECT 1 FROM public.archive_albums a WHERE a.id = album_id))
      OR (album_id IS NULL AND (section = 'family'::public.archive_section OR public.can_manage_section(auth.uid(), 'archive') OR public.can_manage_section(auth.uid(), section::text)))
    )
  );
CREATE POLICY "Update archive by album rules" ON public.archive_items
  FOR UPDATE TO authenticated
  USING (public.can_manage_archive_item(auth.uid(), section::text, album_id, uploader_id))
  WITH CHECK (public.can_manage_archive_item(auth.uid(), section::text, album_id, uploader_id));
CREATE POLICY "Delete archive by album rules" ON public.archive_items
  FOR DELETE TO authenticated
  USING (public.can_manage_archive_item(auth.uid(), section::text, album_id, uploader_id));

-- Named albums are permanent collections. The existing three-day expiry of
-- unpinned daily family memories is unchanged.
CREATE OR REPLACE FUNCTION public.archive_enforce_expiry()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.album_id IS NULL AND NEW.section = 'family' THEN
    IF NEW.expires_at IS NULL OR NEW.expires_at > NEW.created_at + INTERVAL '3 days' THEN
      NEW.expires_at := NEW.created_at + INTERVAL '3 days';
    END IF;
  ELSE NEW.expires_at := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Owners or admins can delete archive media" ON storage.objects;
DROP POLICY IF EXISTS "Priv roles delete archive media" ON storage.objects;
DROP POLICY IF EXISTS "Archive media deletion follows album rules" ON storage.objects;
CREATE POLICY "Archive media deletion follows album rules" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'archive-media' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.can_manage_section(auth.uid(), 'archive')
      OR EXISTS (SELECT 1 FROM public.archive_items ai WHERE ai.storage_path = storage.objects.name
        AND public.can_manage_archive_item(auth.uid(), ai.section::text, ai.album_id, ai.uploader_id))
    )
  );

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'archive_albums') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.archive_albums;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
