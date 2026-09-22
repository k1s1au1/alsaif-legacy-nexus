CREATE TABLE IF NOT EXISTS public.phone_login_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_key text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phone_login_codes_phone_key_idx ON public.phone_login_codes (phone_key, created_at DESC);

ALTER TABLE public.phone_login_codes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.phone_login_codes FROM anon, authenticated;
GRANT ALL ON public.phone_login_codes TO service_role;

-- Normalizes any stored/entered phone to its last 9 significant digits so that
-- 05xxxxxxxx, 9665xxxxxxxx and +9665xxxxxxxx all match the same member.
CREATE OR REPLACE FUNCTION public.phone_login_key(_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT right(regexp_replace(coalesce(_phone, ''), '\D', '', 'g'), 9)
$$;

-- Server-only lookup: returns the approved member owning this phone number.
CREATE OR REPLACE FUNCTION public.find_member_by_login_phone(_phone text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pp.user_id
  FROM public.profile_phones pp
  WHERE public.phone_login_key(pp.phone) = public.phone_login_key(_phone)
    AND length(public.phone_login_key(pp.phone)) = 9
    AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = pp.user_id)
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.find_member_by_login_phone(text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.find_member_by_login_phone(text) TO service_role;