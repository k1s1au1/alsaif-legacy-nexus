DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relname <> 'profiles'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- profiles: column-level grants so phone / fcm_token stay hidden
GRANT ALL ON public.profiles TO service_role;
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(format('%I', column_name), ', ') INTO cols
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='profiles'
    AND column_name NOT IN ('phone','fcm_token');
  EXECUTE format('GRANT SELECT (%s) ON public.profiles TO authenticated', cols);
  EXECUTE format('GRANT INSERT (%s), UPDATE (%s) ON public.profiles TO authenticated', cols, cols);
END $$;
GRANT UPDATE (phone, fcm_token), INSERT (phone, fcm_token) ON public.profiles TO authenticated;

-- anon: only what the login screen needs
GRANT SELECT ON public.app_settings TO anon;
GRANT INSERT ON public.account_requests TO anon;