ALTER TABLE public.secure_vault ADD COLUMN IF NOT EXISTS shared_with text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.can_view_vault_item(_u uuid, _owner uuid, _shared text[], _unlock timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _u = _owner OR (
    (_unlock IS NULL OR _unlock <= now()) AND (
      (_shared @> ARRAY['all'] AND public.is_family_member(_u))
      OR _shared @> ARRAY[_u::text]
    )
  )
$$;

DROP POLICY IF EXISTS "Owners can view their vault items" ON public.secure_vault;
CREATE POLICY "Owners and recipients can view vault items" ON public.secure_vault
FOR SELECT TO authenticated
USING (public.can_view_vault_item(auth.uid(), owner_id, shared_with, unlock_at));

CREATE POLICY "Recipients can read shared vault files" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'vault-media' AND EXISTS (
  SELECT 1 FROM public.secure_vault v
  WHERE v.storage_path = storage.objects.name
    AND public.can_view_vault_item(auth.uid(), v.owner_id, v.shared_with, v.unlock_at)
));