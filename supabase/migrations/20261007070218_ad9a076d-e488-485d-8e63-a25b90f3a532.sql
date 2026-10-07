ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS minutes text;
NOTIFY pgrst, 'reload schema';