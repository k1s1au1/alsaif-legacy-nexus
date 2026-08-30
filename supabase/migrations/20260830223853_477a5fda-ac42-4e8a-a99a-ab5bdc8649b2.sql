CREATE TYPE public.gender_type AS ENUM ('male','female');

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender public.gender_type,
  ADD COLUMN IF NOT EXISTS birth_calendar text NOT NULL DEFAULT 'gregorian',
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS birth_date_hijri text;

GRANT SELECT (gender, birth_calendar, birth_date, birth_date_hijri) ON public.profiles TO authenticated;

ALTER TABLE public.account_requests
  ADD COLUMN IF NOT EXISTS gender public.gender_type,
  ADD COLUMN IF NOT EXISTS birth_calendar text NOT NULL DEFAULT 'gregorian',
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS birth_date_hijri text;