DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind='r' LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.relname);
    IF t.relname <> 'profiles' THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.relname);
    END IF;
  END LOOP;
END $$;

-- profiles: column-level SELECT excluding sensitive columns
REVOKE ALL ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, arabic_name, avatar_url, is_active, created_at, updated_at,
              first_name, father_name, grandfather_name, parent_id, terms_accepted_at)
  ON public.profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- anon: only what the public auth page needs
GRANT SELECT ON public.app_settings TO anon;
GRANT INSERT ON public.account_requests TO anon;

-- public stats for the login page
CREATE OR REPLACE FUNCTION public.public_stats()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'members', (SELECT count(*) FROM public.profiles WHERE is_active),
    'completedTasks', (SELECT count(*) FROM public.tasks WHERE status = 'done')
  );
$$;

GRANT EXECUTE ON FUNCTION public.public_stats() TO anon, authenticated;