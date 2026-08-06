-- Add bottom_nav_prefs to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bottom_nav_prefs JSONB DEFAULT '["dashboard", "news", "chat"]'::jsonb;

-- Update column grants to include the new column
DO $$
DECLARE
    cols text;
BEGIN
    SELECT string_agg(column_name, ', ') INTO cols
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles'
      AND column_name NOT IN ('phone', 'fcm_token');

    EXECUTE format('GRANT SELECT (%s) ON public.profiles TO authenticated', cols);
    EXECUTE format('GRANT INSERT (%s), UPDATE (%s) ON public.profiles TO authenticated', cols, cols);
END $$;
