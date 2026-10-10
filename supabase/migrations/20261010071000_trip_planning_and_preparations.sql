-- Keep planning votes separate from confirmed attendance. Existing trips and
-- registrations retain version 1; changing an approved plan requires reconfirmation.
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS accommodation_type text,
  ADD COLUMN IF NOT EXISTS planning_destinations jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS planning_dates jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS planning_revision integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS approval_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.trips ALTER COLUMN status SET DEFAULT 'planning';

CREATE TABLE IF NOT EXISTS public.trip_preferences (
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interested boolean NOT NULL DEFAULT false,
  destination_id text,
  date_id text,
  revision integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, user_id)
);
ALTER TABLE public.trip_preferences ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.trip_preferences TO authenticated;
GRANT ALL ON public.trip_preferences TO service_role;
DROP POLICY IF EXISTS "Family can read trip preferences" ON public.trip_preferences;
CREATE POLICY "Family can read trip preferences" ON public.trip_preferences
  FOR SELECT TO authenticated USING (public.is_family_member(auth.uid()));

ALTER TABLE public.trip_items
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.trip_attendees
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'going',
  ADD COLUMN IF NOT EXISTS companions_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approval_version integer NOT NULL DEFAULT 1;
GRANT UPDATE ON public.trip_attendees TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_trip_plan()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE o jsonb; ids text[];
BEGIN
  IF jsonb_typeof(NEW.planning_destinations) <> 'array'
     OR jsonb_typeof(NEW.planning_dates) <> 'array'
     OR jsonb_array_length(NEW.planning_destinations) > 8
     OR jsonb_array_length(NEW.planning_dates) > 8 THEN
    RAISE EXCEPTION 'خيارات التخطيط غير صالحة (الحد الأقصى 8)';
  END IF;
  ids := ARRAY[]::text[];
  FOR o IN SELECT value FROM jsonb_array_elements(NEW.planning_destinations) LOOP
    IF coalesce(o->>'id','') = '' OR length(coalesce(o->>'id','')) > 80
       OR length(btrim(coalesce(o->>'name',''))) NOT BETWEEN 1 AND 120
       OR (o->>'id') = ANY(ids) THEN RAISE EXCEPTION 'خيار الوجهة غير صالح'; END IF;
    ids := array_append(ids, o->>'id');
  END LOOP;
  ids := ARRAY[]::text[];
  FOR o IN SELECT value FROM jsonb_array_elements(NEW.planning_dates) LOOP
    IF coalesce(o->>'id','') = '' OR length(coalesce(o->>'id','')) > 80
       OR coalesce(o->>'start_date','') !~ '^\d{4}-\d{2}-\d{2}$'
       OR coalesce(o->>'end_date','') !~ '^\d{4}-\d{2}-\d{2}$'
       OR (o->>'end_date')::date < (o->>'start_date')::date
       OR (o->>'id') = ANY(ids) THEN RAISE EXCEPTION 'خيار الموعد غير صالح'; END IF;
    ids := array_append(ids, o->>'id');
  END LOOP;
  IF TG_OP = 'UPDATE' THEN
    -- The server owns revision numbers, including direct REST updates.
    NEW.planning_revision := OLD.planning_revision;
    NEW.approval_version := OLD.approval_version;
    NEW.approved_at := OLD.approved_at;
    NEW.approved_by := OLD.approved_by;
    IF NEW.planning_destinations IS DISTINCT FROM OLD.planning_destinations
       OR NEW.planning_dates IS DISTINCT FROM OLD.planning_dates THEN
      IF NEW.status <> 'planning' THEN RAISE EXCEPTION 'أرجع الرحلة للتخطيط قبل تعديل الخيارات'; END IF;
      NEW.planning_revision := OLD.planning_revision + 1;
    END IF;
    IF NEW.status = 'planning' AND OLD.status <> 'planning' THEN
      NEW.planning_revision := OLD.planning_revision + 1;
      NEW.approval_version := OLD.approval_version + 1;
      NEW.approved_at := NULL;
      NEW.approved_by := NULL;
    END IF;
  ELSE
    NEW.planning_revision := 1;
    NEW.approval_version := 1;
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
  END IF;
  IF NEW.status IN ('upcoming','ongoing') AND
     (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.location IS DISTINCT FROM OLD.location
       OR NEW.start_date IS DISTINCT FROM OLD.start_date
       OR NEW.end_date IS DISTINCT FROM OLD.end_date) THEN
    IF btrim(coalesce(NEW.location,'')) = '' OR NEW.start_date IS NULL OR NEW.end_date IS NULL
       OR NEW.end_date < NEW.start_date OR NEW.end_date < (now() AT TIME ZONE 'Asia/Riyadh')::date THEN
      RAISE EXCEPTION 'حدد الوجهة وتاريخ البداية والنهاية الصحيحين قبل اعتماد الرحلة';
    END IF;
    NEW.approved_at := now();
    NEW.approved_by := auth.uid();
    IF TG_OP = 'UPDATE' THEN NEW.approval_version := OLD.approval_version + 1; END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_trip_plan ON public.trips;
CREATE TRIGGER guard_trip_plan BEFORE INSERT OR UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.guard_trip_plan();

CREATE OR REPLACE FUNCTION public.save_trip_preference(
  _trip_id uuid, _interested boolean, _destination_id text, _date_id text, _revision integer
) RETURNS public.trip_preferences
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.trips; result public.trip_preferences; u uuid := auth.uid();
BEGIN
  IF u IS NULL OR NOT public.is_family_member(u) THEN RAISE EXCEPTION 'لا تملك صلاحية المشاركة'; END IF;
  SELECT * INTO t FROM public.trips WHERE id = _trip_id FOR SHARE;
  IF NOT FOUND OR t.status <> 'planning' THEN RAISE EXCEPTION 'الرحلة ليست قيد التخطيط'; END IF;
  IF t.planning_revision <> _revision THEN RAISE EXCEPTION 'تغيرت خيارات الرحلة؛ حدّث الصفحة واختر مجدداً'; END IF;
  IF _destination_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(t.planning_destinations) o WHERE o->>'id' = _destination_id
  ) THEN RAISE EXCEPTION 'الوجهة المختارة غير موجودة'; END IF;
  IF _date_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(t.planning_dates) o WHERE o->>'id' = _date_id
  ) THEN RAISE EXCEPTION 'الموعد المختار غير موجود'; END IF;
  INSERT INTO public.trip_preferences (trip_id,user_id,interested,destination_id,date_id,revision)
    VALUES (_trip_id,u,coalesce(_interested,false),_destination_id,_date_id,_revision)
    ON CONFLICT (trip_id,user_id) DO UPDATE SET interested=excluded.interested,
      destination_id=excluded.destination_id,date_id=excluded.date_id,
      revision=excluded.revision,updated_at=now() RETURNING * INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_trip_plan(
  _trip_id uuid, _location text, _start_date date, _end_date date, _revision integer
) RETURNS public.trips
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE t public.trips; result public.trips;
BEGIN
  IF NOT public.can_manage_section(auth.uid(),'trips') THEN RAISE EXCEPTION 'اعتماد الرحلة للمسؤول والرئيس والنائب'; END IF;
  SELECT * INTO t FROM public.trips WHERE id = _trip_id FOR UPDATE;
  IF NOT FOUND OR t.status <> 'planning' THEN RAISE EXCEPTION 'الرحلة ليست قيد التخطيط'; END IF;
  IF t.planning_revision <> _revision THEN RAISE EXCEPTION 'تغيرت الخطة؛ راجع الخيارات قبل الاعتماد'; END IF;
  UPDATE public.trips SET status='upcoming',location=btrim(_location),
    location_url=CASE WHEN t.location IS DISTINCT FROM btrim(_location) THEN NULL ELSE t.location_url END,
    start_date=_start_date,end_date=_end_date WHERE id=_trip_id RETURNING * INTO result;
  RETURN result;
END;
$$;

-- RLS limits which rows a member can touch; the trigger limits which fields.
DROP POLICY IF EXISTS "Members can claim or release trip items" ON public.trip_items;
DROP POLICY IF EXISTS "Members add their own preparations" ON public.trip_items;
CREATE POLICY "Members add their own preparations" ON public.trip_items FOR INSERT TO authenticated
  WITH CHECK (public.is_family_member(auth.uid()) AND created_by=auth.uid());
DROP POLICY IF EXISTS "Members update their preparations or volunteer" ON public.trip_items;
CREATE POLICY "Members update their preparations or volunteer" ON public.trip_items FOR UPDATE TO authenticated
  USING (public.is_family_member(auth.uid()) AND (created_by=auth.uid() OR assigned_to=auth.uid() OR assigned_to IS NULL))
  WITH CHECK (public.is_family_member(auth.uid()) AND (created_by=auth.uid() OR assigned_to=auth.uid() OR assigned_to IS NULL));
DROP POLICY IF EXISTS "Members delete their own preparations" ON public.trip_items;
CREATE POLICY "Members delete their own preparations" ON public.trip_items FOR DELETE TO authenticated
  USING (public.is_family_member(auth.uid()) AND created_by=auth.uid());

CREATE OR REPLACE FUNCTION public.guard_trip_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid(); manager boolean; t public.trips;
BEGIN
  -- Database maintenance and service-role work retain their existing access.
  IF u IS NULL THEN RETURN NEW; END IF;
  manager := public.can_manage_section(u,'trips');
  SELECT * INTO t FROM public.trips WHERE id=NEW.trip_id FOR SHARE;
  IF NOT FOUND OR t.status NOT IN ('upcoming','ongoing')
     OR coalesce(t.end_date,t.start_date) < (now() AT TIME ZONE 'Asia/Riyadh')::date THEN
    RAISE EXCEPTION 'تفتح التجهيزات بعد اعتماد الرحلة';
  END IF;
  NEW.name := btrim(NEW.name);
  IF length(NEW.name) NOT BETWEEN 1 AND 120 OR length(coalesce(NEW.notes,'')) > 1000 THEN
    RAISE EXCEPTION 'اسم التجهيز مطلوب (120 حرفاً) والملاحظات حتى 1000 حرف';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NOT manager AND (NEW.created_by <> u OR (NEW.assigned_to IS NOT NULL AND NEW.assigned_to <> u)) THEN
      RAISE EXCEPTION 'يمكنك إضافة تجهيز باسمك أو تركه للمتطوعين';
    END IF;
    NEW.completed_at := NULL; NEW.completed_by := NULL;
  ELSE
    IF NEW.id <> OLD.id OR NEW.trip_id <> OLD.trip_id OR NEW.created_by <> OLD.created_by
       OR NEW.created_at <> OLD.created_at THEN RAISE EXCEPTION 'لا يمكن تغيير ملكية التجهيز'; END IF;
    IF NOT manager THEN
      IF (NEW.name IS DISTINCT FROM OLD.name OR NEW.notes IS DISTINCT FROM OLD.notes)
         AND OLD.created_by <> u THEN RAISE EXCEPTION 'يمكنك تعديل التجهيز الذي أضفته فقط'; END IF;
      IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NOT (
        OLD.completed_at IS NULL AND ((OLD.assigned_to IS NULL AND NEW.assigned_to=u)
          OR (OLD.assigned_to=u AND NEW.assigned_to IS NULL))
      ) THEN RAISE EXCEPTION 'التجهيز مسؤولية عضو آخر'; END IF;
      IF (NEW.completed_at IS DISTINCT FROM OLD.completed_at OR NEW.completed_by IS DISTINCT FROM OLD.completed_by)
         AND (OLD.assigned_to IS DISTINCT FROM u OR NEW.assigned_to IS DISTINCT FROM u) THEN
        RAISE EXCEPTION 'تحديث الإنجاز للمسؤول عن التجهيز';
      END IF;
    END IF;
    IF NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
      NEW.completed_at := CASE WHEN NEW.completed_at IS NULL THEN NULL ELSE now() END;
      NEW.completed_by := CASE WHEN NEW.completed_at IS NULL THEN NULL ELSE u END;
    ELSE NEW.completed_by := OLD.completed_by; END IF;
  END IF;
  IF NEW.completed_at IS NOT NULL AND NEW.assigned_to IS NULL THEN RAISE EXCEPTION 'حدد مسؤول التجهيز قبل اكتماله'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_trip_item ON public.trip_items;
CREATE TRIGGER guard_trip_item BEFORE INSERT OR UPDATE ON public.trip_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_trip_item();

CREATE OR REPLACE FUNCTION public.set_trip_item_state(_item_id uuid, _action text)
RETURNS public.trip_items LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE i public.trip_items; result public.trip_items; u uuid := auth.uid();
BEGIN
  SELECT * INTO i FROM public.trip_items WHERE id=_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'تعذر العثور على التجهيز أو لا تملك صلاحية تعديله'; END IF;
  IF _action = 'claim' THEN
    IF i.assigned_to IS NOT NULL THEN RAISE EXCEPTION 'تولى عضو آخر هذا التجهيز؛ حدّث القائمة'; END IF;
    UPDATE public.trip_items SET assigned_to=u WHERE id=i.id RETURNING * INTO result;
  ELSIF _action = 'release' THEN
    IF i.assigned_to IS DISTINCT FROM u AND NOT public.can_manage_section(u,'trips') THEN RAISE EXCEPTION 'لا يمكنك إلغاء تطوع عضو آخر'; END IF;
    UPDATE public.trip_items SET assigned_to=NULL,completed_at=NULL WHERE id=i.id RETURNING * INTO result;
  ELSIF _action IN ('complete','reopen') THEN
    IF i.assigned_to IS NULL OR (i.assigned_to IS DISTINCT FROM u AND NOT public.can_manage_section(u,'trips')) THEN RAISE EXCEPTION 'التجهيز غير مسند إليك'; END IF;
    UPDATE public.trip_items SET completed_at=CASE WHEN _action='complete' THEN now() ELSE NULL END
      WHERE id=i.id RETURNING * INTO result;
  ELSE RAISE EXCEPTION 'عملية غير صالحة'; END IF;
  IF result.id IS NULL THEN RAISE EXCEPTION 'تعذر حفظ التجهيز'; END IF;
  RETURN result;
END;
$$;

DROP POLICY IF EXISTS "Users update own trip attendance" ON public.trip_attendees;
CREATE POLICY "Users update own trip attendance" ON public.trip_attendees FOR UPDATE TO authenticated
  USING (user_id=auth.uid() AND public.is_family_member(auth.uid()))
  WITH CHECK (user_id=auth.uid() AND public.is_family_member(auth.uid()));
CREATE OR REPLACE FUNCTION public.guard_trip_attendance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.trips;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.user_id <> auth.uid() OR NOT public.is_family_member(auth.uid()) THEN RAISE EXCEPTION 'تأكيد الحضور باسمك فقط'; END IF;
  IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.trip_id<>OLD.trip_id OR NEW.user_id<>OLD.user_id) THEN RAISE EXCEPTION 'لا يمكن تغيير صاحب الحضور'; END IF;
  SELECT * INTO t FROM public.trips WHERE id=NEW.trip_id FOR SHARE;
  IF NOT FOUND OR t.status NOT IN ('upcoming','ongoing') OR NEW.approval_version<>t.approval_version
     OR coalesce(t.end_date,t.start_date) < (now() AT TIME ZONE 'Asia/Riyadh')::date THEN
    RAISE EXCEPTION 'تغيرت خطة الرحلة؛ راجعها وأكد حضورك مجدداً';
  END IF;
  IF NEW.status NOT IN ('going','not_going') OR NEW.companions_count NOT BETWEEN 0 AND 50 THEN RAISE EXCEPTION 'بيانات الحضور غير صالحة'; END IF;
  IF NEW.status='not_going' THEN NEW.companions_count:=0; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_trip_attendance ON public.trip_attendees;
CREATE TRIGGER guard_trip_attendance BEFORE INSERT OR UPDATE ON public.trip_attendees
  FOR EACH ROW EXECUTE FUNCTION public.guard_trip_attendance();

CREATE OR REPLACE FUNCTION public.set_trip_attendance(
  _trip_id uuid, _status text, _companions integer, _version integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.trips; a public.trip_attendees; u uuid := auth.uid();
BEGIN
  IF u IS NULL OR NOT public.is_family_member(u) THEN RAISE EXCEPTION 'لا تملك صلاحية المشاركة'; END IF;
  SELECT * INTO t FROM public.trips WHERE id=_trip_id FOR SHARE;
  IF NOT FOUND OR t.status NOT IN ('upcoming','ongoing') OR t.approval_version<>_version
     OR coalesce(t.end_date,t.start_date) < (now() AT TIME ZONE 'Asia/Riyadh')::date THEN
    RAISE EXCEPTION 'تغيرت الرحلة؛ حدّث الصفحة وراجع تفاصيلها';
  END IF;
  IF _status IS NULL THEN
    DELETE FROM public.trip_attendees WHERE trip_id=_trip_id AND user_id=u;
    RETURN jsonb_build_object('status',NULL,'companions_count',0,'approval_version',_version);
  END IF;
  INSERT INTO public.trip_attendees (trip_id,user_id,status,companions_count,approval_version)
    VALUES (_trip_id,u,_status,_companions,_version)
    ON CONFLICT (trip_id,user_id) DO UPDATE SET status=excluded.status,
      companions_count=excluded.companions_count,approval_version=excluded.approval_version
    RETURNING * INTO a;
  RETURN to_jsonb(a);
END;
$$;

REVOKE ALL ON FUNCTION public.save_trip_preference(uuid,boolean,text,text,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_trip_plan(uuid,text,date,date,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_trip_item_state(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_trip_attendance(uuid,text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_trip_preference(uuid,boolean,text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_trip_plan(uuid,text,date,date,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_trip_item_state(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_trip_attendance(uuid,text,integer,integer) TO authenticated;

-- Realtime preference totals, alongside the existing trip/attendance/item channels.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='trip_preferences') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_preferences;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
