-- A visit belongs to the Saudi calendar day and account, never to a device.
CREATE TABLE IF NOT EXISTS public.daily_site_visits (
  visit_date date NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (visit_date, user_id)
);

ALTER TABLE public.daily_site_visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.daily_site_visits FROM anon, authenticated;
GRANT ALL ON public.daily_site_visits TO service_role;

-- Existing and updated clients already send a presence heartbeat while visible.
-- The trigger records server time, so a device cannot choose a day or another user.
CREATE OR REPLACE FUNCTION public.record_daily_site_visit_from_presence()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  seen_at timestamptz := statement_timestamp();
BEGIN
  IF auth.uid() IS DISTINCT FROM NEW.user_id
    OR NEW.status::text <> 'online'
    OR NOT public.is_family_member(NEW.user_id)
    OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.user_id AND p.is_active)
  THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.daily_site_visits (visit_date, user_id, recorded_at)
  VALUES ((seen_at AT TIME ZONE 'Asia/Riyadh')::date, NEW.user_id, seen_at)
  ON CONFLICT (visit_date, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_daily_site_visit_from_presence() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS record_daily_site_visit ON public.user_presence;
CREATE TRIGGER record_daily_site_visit
  AFTER INSERT OR UPDATE OF last_seen_at ON public.user_presence
  FOR EACH ROW EXECUTE FUNCTION public.record_daily_site_visit_from_presence();

-- Seed only accounts with a saved visit during today's Saudi day.
INSERT INTO public.daily_site_visits (visit_date, user_id)
SELECT (statement_timestamp() AT TIME ZONE 'Asia/Riyadh')::date, up.user_id
FROM public.user_presence up
JOIN public.profiles p ON p.id = up.user_id AND p.is_active
WHERE public.is_family_member(up.user_id)
  AND up.last_seen_at >= ((statement_timestamp() AT TIME ZONE 'Asia/Riyadh')::date::timestamp AT TIME ZONE 'Asia/Riyadh')
  AND up.last_seen_at <= statement_timestamp()
ON CONFLICT (visit_date, user_id) DO NOTHING;

-- The home counter receives an aggregate only, never individual visit records.
CREATE OR REPLACE FUNCTION public.get_today_site_visit_count()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  today date := (statement_timestamp() AT TIME ZONE 'Asia/Riyadh')::date;
BEGIN
  IF NOT public.is_family_member(auth.uid()) OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active
  ) THEN
    RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('visit_date', today, 'visitor_count', (
    SELECT count(*) FROM public.daily_site_visits v
    JOIN public.profiles p ON p.id = v.user_id AND p.is_active
    WHERE v.visit_date = today AND public.is_family_member(v.user_id)
  ));
END;
$$;
REVOKE ALL ON FUNCTION public.get_today_site_visit_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_today_site_visit_count() TO authenticated;
