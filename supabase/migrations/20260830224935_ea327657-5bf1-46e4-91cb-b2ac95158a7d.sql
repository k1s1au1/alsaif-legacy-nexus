-- 1) Table
CREATE TABLE public.profile_change_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changes jsonb NOT NULL,
  current_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX profile_change_requests_one_pending
  ON public.profile_change_requests (user_id)
  WHERE status = 'pending';

GRANT SELECT, INSERT ON public.profile_change_requests TO authenticated;
GRANT UPDATE, DELETE ON public.profile_change_requests TO authenticated;
GRANT ALL ON public.profile_change_requests TO service_role;

ALTER TABLE public.profile_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own or admin can view change requests"
ON public.profile_change_requests FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'chairman'::public.app_role)
);

CREATE POLICY "members can submit own change request"
ON public.profile_change_requests FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "admins can review change requests"
ON public.profile_change_requests FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'chairman'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'chairman'::public.app_role)
);

CREATE POLICY "own pending or admin can delete change request"
ON public.profile_change_requests FOR DELETE TO authenticated
USING (
  (user_id = auth.uid() AND status = 'pending')
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'chairman'::public.app_role)
);

CREATE TRIGGER profile_change_requests_touch
BEFORE UPDATE ON public.profile_change_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Lock identity fields on profiles
CREATE OR REPLACE FUNCTION public.profiles_lock_identity_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Service role / internal (definer) operations and admins bypass the lock
  IF v_uid IS NULL
     OR public.has_role(v_uid, 'admin'::public.app_role)
     OR public.has_role(v_uid, 'chairman'::public.app_role)
     OR current_setting('app.apply_profile_change', true) = 'on'
  THEN
    RETURN NEW;
  END IF;

  IF OLD.arabic_name IS NOT NULL AND NEW.arabic_name IS DISTINCT FROM OLD.arabic_name THEN
    RAISE EXCEPTION 'PROFILE_LOCKED: يتطلب تعديل الاسم موافقة الإدارة';
  END IF;
  IF OLD.full_name IS NOT NULL AND NEW.full_name IS DISTINCT FROM OLD.full_name THEN
    RAISE EXCEPTION 'PROFILE_LOCKED: يتطلب تعديل الاسم موافقة الإدارة';
  END IF;
  IF OLD.first_name IS NOT NULL AND NEW.first_name IS DISTINCT FROM OLD.first_name THEN
    RAISE EXCEPTION 'PROFILE_LOCKED: يتطلب تعديل الاسم موافقة الإدارة';
  END IF;
  IF OLD.father_name IS NOT NULL AND NEW.father_name IS DISTINCT FROM OLD.father_name THEN
    RAISE EXCEPTION 'PROFILE_LOCKED: يتطلب تعديل الاسم موافقة الإدارة';
  END IF;
  IF OLD.grandfather_name IS NOT NULL AND NEW.grandfather_name IS DISTINCT FROM OLD.grandfather_name THEN
    RAISE EXCEPTION 'PROFILE_LOCKED: يتطلب تعديل الاسم موافقة الإدارة';
  END IF;
  IF OLD.gender IS NOT NULL AND NEW.gender IS DISTINCT FROM OLD.gender THEN
    RAISE EXCEPTION 'PROFILE_LOCKED: يتطلب تعديل الجنس موافقة الإدارة';
  END IF;
  IF OLD.birth_date IS NOT NULL AND NEW.birth_date IS DISTINCT FROM OLD.birth_date THEN
    RAISE EXCEPTION 'PROFILE_LOCKED: يتطلب تعديل تاريخ الميلاد موافقة الإدارة';
  END IF;
  IF OLD.birth_date_hijri IS NOT NULL AND NEW.birth_date_hijri IS DISTINCT FROM OLD.birth_date_hijri THEN
    RAISE EXCEPTION 'PROFILE_LOCKED: يتطلب تعديل تاريخ الميلاد موافقة الإدارة';
  END IF;
  IF (OLD.birth_date IS NOT NULL OR OLD.birth_date_hijri IS NOT NULL)
     AND NEW.birth_calendar IS DISTINCT FROM OLD.birth_calendar THEN
    RAISE EXCEPTION 'PROFILE_LOCKED: يتطلب تعديل تاريخ الميلاد موافقة الإدارة';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_lock_identity_fields_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_lock_identity_fields();

-- 3) Submit a change request
CREATE OR REPLACE FUNCTION public.submit_profile_change_request(_changes jsonb, _reason text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_allowed text[] := ARRAY['arabic_name','full_name','first_name','father_name','grandfather_name','gender','birth_calendar','birth_date','birth_date_hijri'];
  v_key text;
  v_current jsonb;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _changes IS NULL OR jsonb_typeof(_changes) <> 'object' OR _changes = '{}'::jsonb THEN
    RAISE EXCEPTION 'لا توجد تعديلات مطلوبة';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(_changes) LOOP
    IF NOT (v_key = ANY(v_allowed)) THEN
      RAISE EXCEPTION 'حقل غير مسموح: %', v_key;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM public.profile_change_requests WHERE user_id = v_uid AND status = 'pending') THEN
    RAISE EXCEPTION 'لديك طلب تعديل قيد المراجعة بالفعل';
  END IF;

  SELECT jsonb_build_object(
    'arabic_name', arabic_name, 'full_name', full_name, 'first_name', first_name,
    'father_name', father_name, 'grandfather_name', grandfather_name,
    'gender', gender, 'birth_calendar', birth_calendar,
    'birth_date', birth_date, 'birth_date_hijri', birth_date_hijri
  ) INTO v_current
  FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.profile_change_requests (user_id, changes, current_values, reason)
  VALUES (v_uid, _changes, COALESCE(v_current, '{}'::jsonb), NULLIF(btrim(COALESCE(_reason,'')), ''))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 4) Review (approve / reject)
CREATE OR REPLACE FUNCTION public.review_profile_change_request(_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.profile_change_requests;
  v_c jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT (public.has_role(v_uid, 'admin'::public.app_role) OR public.has_role(v_uid, 'chairman'::public.app_role)) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية مراجعة الطلبات';
  END IF;

  SELECT * INTO v_req FROM public.profile_change_requests WHERE id = _id;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'الطلب غير موجود';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'تمت مراجعة هذا الطلب مسبقاً';
  END IF;

  IF _approve THEN
    v_c := v_req.changes;
    PERFORM set_config('app.apply_profile_change', 'on', true);

    UPDATE public.profiles SET
      arabic_name      = CASE WHEN v_c ? 'arabic_name' THEN NULLIF(v_c->>'arabic_name','') ELSE arabic_name END,
      full_name        = CASE WHEN v_c ? 'full_name' THEN NULLIF(v_c->>'full_name','') ELSE full_name END,
      first_name       = CASE WHEN v_c ? 'first_name' THEN NULLIF(v_c->>'first_name','') ELSE first_name END,
      father_name      = CASE WHEN v_c ? 'father_name' THEN NULLIF(v_c->>'father_name','') ELSE father_name END,
      grandfather_name = CASE WHEN v_c ? 'grandfather_name' THEN NULLIF(v_c->>'grandfather_name','') ELSE grandfather_name END,
      gender           = CASE WHEN v_c ? 'gender' THEN NULLIF(v_c->>'gender','')::public.gender_type ELSE gender END,
      birth_calendar   = CASE WHEN v_c ? 'birth_calendar' THEN COALESCE(NULLIF(v_c->>'birth_calendar',''), birth_calendar) ELSE birth_calendar END,
      birth_date       = CASE WHEN v_c ? 'birth_date' THEN NULLIF(v_c->>'birth_date','')::date ELSE birth_date END,
      birth_date_hijri = CASE WHEN v_c ? 'birth_date_hijri' THEN NULLIF(v_c->>'birth_date_hijri','') ELSE birth_date_hijri END
    WHERE id = v_req.user_id;

    PERFORM set_config('app.apply_profile_change', 'off', true);
  END IF;

  UPDATE public.profile_change_requests
  SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
      reviewed_by = v_uid,
      reviewed_at = now(),
      review_note = NULLIF(btrim(COALESCE(_note,'')), '')
  WHERE id = _id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_profile_change_request(jsonb, text) FROM public;
REVOKE ALL ON FUNCTION public.review_profile_change_request(uuid, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_profile_change_request(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_profile_change_request(uuid, boolean, text) TO authenticated;