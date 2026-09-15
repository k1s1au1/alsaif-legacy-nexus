UPDATE public.account_requests SET desired_password = NULL WHERE desired_password IS NOT NULL;
ALTER TABLE public.account_requests DROP COLUMN desired_password;
DROP TRIGGER IF EXISTS sync_profile_phone_to_private_trg ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_profile_phone_to_private();
ALTER TABLE public.profiles DROP COLUMN phone;

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
REVOKE ALL ON FUNCTION public.get_member_phone(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_phone(uuid) TO authenticated, service_role;