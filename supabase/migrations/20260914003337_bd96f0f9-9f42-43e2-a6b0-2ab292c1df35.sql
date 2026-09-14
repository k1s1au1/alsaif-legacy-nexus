CREATE TABLE public.profile_phones (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_phones TO authenticated;
GRANT ALL ON public.profile_phones TO service_role;
ALTER TABLE public.profile_phones ENABLE ROW LEVEL SECURITY;

INSERT INTO public.profile_phones (user_id, phone)
SELECT id, phone FROM public.profiles WHERE phone IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone, updated_at = now();

CREATE POLICY "Members view permitted phones"
ON public.profile_phones FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'chairman'::public.app_role)
  OR public.has_role(auth.uid(), 'vice_chairman'::public.app_role)
  OR public.has_role(auth.uid(), 'technical_admin'::public.app_role)
);

CREATE POLICY "Members manage own phone"
ON public.profile_phones FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "Members update own phone"
ON public.profile_phones FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Leadership manage phones"
ON public.profile_phones FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'chairman'::public.app_role)
  OR public.has_role(auth.uid(), 'vice_chairman'::public.app_role)
  OR public.has_role(auth.uid(), 'technical_admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'chairman'::public.app_role)
  OR public.has_role(auth.uid(), 'vice_chairman'::public.app_role)
  OR public.has_role(auth.uid(), 'technical_admin'::public.app_role)
);

CREATE OR REPLACE FUNCTION public.get_member_phone(_user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pp.phone
  FROM public.profile_phones pp
  WHERE pp.user_id = _user
    AND (
      auth.uid() = _user
      OR public.has_role(auth.uid(), 'chairman'::public.app_role)
      OR public.has_role(auth.uid(), 'vice_chairman'::public.app_role)
      OR public.has_role(auth.uid(), 'technical_admin'::public.app_role)
    )
$$;
REVOKE ALL ON FUNCTION public.get_member_phone(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_member_phone(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_profile_phone_to_private()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS DISTINCT FROM OLD.phone AND NEW.phone IS NOT NULL THEN
    INSERT INTO public.profile_phones (user_id, phone, updated_at)
    VALUES (NEW.id, NEW.phone, now())
    ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone, updated_at = now();
  END IF;
  NEW.phone := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_phone_to_private_trg ON public.profiles;
CREATE TRIGGER sync_profile_phone_to_private_trg
BEFORE UPDATE OF phone ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_phone_to_private();

UPDATE public.profiles SET phone = NULL WHERE phone IS NOT NULL;

REVOKE SELECT (phone) ON public.profiles FROM authenticated, anon;
REVOKE UPDATE (phone) ON public.profiles FROM authenticated;
GRANT ALL ON public.profile_phones TO service_role;