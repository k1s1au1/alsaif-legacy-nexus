CREATE OR REPLACE FUNCTION public.assign_user_role(_user_id uuid, _role app_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_other_chairman uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT public.is_chairman(v_actor) THEN
    RAISE EXCEPTION 'رئيس المجلس فقط يمكنه تعديل الرتب';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RAISE EXCEPTION 'العضو غير موجود';
  END IF;

  -- Only one chairman is allowed in the system
  IF _role = 'chairman' THEN
    SELECT user_id INTO v_other_chairman
    FROM public.user_roles
    WHERE role = 'chairman' AND user_id <> _user_id
    LIMIT 1;
    IF v_other_chairman IS NOT NULL THEN
      RAISE EXCEPTION 'يوجد رئيس مجلس حالياً، يجب تغيير رتبته أولاً قبل تعيين رئيس جديد';
    END IF;
  END IF;

  -- A chairman cannot strip their own chairman rank
  IF _user_id = v_actor AND _role <> 'chairman' THEN
    RAISE EXCEPTION 'لا يمكن لرئيس المجلس إزالة رتبته عن نفسه';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND role <> _role;

  PERFORM public.log_admin_action(
    'role_assigned',
    _user_id,
    jsonb_build_object('role', _role::text)
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.assign_user_role(uuid, app_role) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid, app_role) TO authenticated, service_role;