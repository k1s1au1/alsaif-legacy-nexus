GRANT UPDATE (gender, birth_calendar, birth_date, birth_date_hijri, theme_color) ON public.profiles TO authenticated;

REVOKE SELECT (phone, fcm_token) ON public.profiles FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.profiles_lock_identity_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_onboarding_incomplete boolean;
BEGIN
  IF v_uid IS NULL
     OR public.has_role(v_uid, 'admin'::public.app_role)
     OR public.has_role(v_uid, 'chairman'::public.app_role)
     OR current_setting('app.apply_profile_change', true) = 'on'
  THEN
    RETURN NEW;
  END IF;

  -- First-time onboarding: identity data is not complete yet, allow filling it in
  v_onboarding_incomplete :=
    OLD.gender IS NULL
    OR (OLD.birth_date IS NULL AND OLD.birth_date_hijri IS NULL)
    OR OLD.first_name IS NULL
    OR OLD.father_name IS NULL
    OR OLD.grandfather_name IS NULL;

  IF v_onboarding_incomplete THEN
    RETURN NEW;
  END IF;

  IF NEW.arabic_name IS DISTINCT FROM OLD.arabic_name
     OR NEW.full_name IS DISTINCT FROM OLD.full_name
     OR NEW.first_name IS DISTINCT FROM OLD.first_name
     OR NEW.father_name IS DISTINCT FROM OLD.father_name
     OR NEW.grandfather_name IS DISTINCT FROM OLD.grandfather_name THEN
    RAISE EXCEPTION 'PROFILE_LOCKED: يتطلب تعديل الاسم موافقة الإدارة';
  END IF;
  IF NEW.gender IS DISTINCT FROM OLD.gender THEN
    RAISE EXCEPTION 'PROFILE_LOCKED: يتطلب تعديل الجنس موافقة الإدارة';
  END IF;
  IF NEW.birth_date IS DISTINCT FROM OLD.birth_date
     OR NEW.birth_date_hijri IS DISTINCT FROM OLD.birth_date_hijri
     OR NEW.birth_calendar IS DISTINCT FROM OLD.birth_calendar THEN
    RAISE EXCEPTION 'PROFILE_LOCKED: يتطلب تعديل تاريخ الميلاد موافقة الإدارة';
  END IF;

  RETURN NEW;
END;
$function$;