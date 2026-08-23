CREATE OR REPLACE FUNCTION public.assign_user_role(
  _user_id uuid,
  _role public.app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'chairman'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية لتعديل الرتب';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RAISE EXCEPTION 'العضو غير موجود';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);
END;
$$;

REVOKE ALL ON FUNCTION public.assign_user_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid, public.app_role) TO service_role;