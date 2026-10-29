-- Server-only, short-lived device approvals. No Auth tokens or passwords are stored.
CREATE TABLE public.tv_login_requests (
  id uuid PRIMARY KEY,
  device_hash text NOT NULL UNIQUE CHECK (device_hash ~ '^[0-9a-f]{64}$'),
  approval_hash text NOT NULL UNIQUE CHECK (approval_hash ~ '^[0-9a-f]{64}$'),
  code text NOT NULL CHECK (code ~ '^[0-9]{6}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied','consumed')),
  approved_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_polled_at timestamptz,
  claimed_at timestamptz,
  CHECK (device_hash <> approval_hash),
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '6 minutes'),
  CHECK (status NOT IN ('approved','consumed') OR approved_user_id IS NOT NULL)
);
CREATE INDEX tv_login_requests_expiry_idx ON public.tv_login_requests(expires_at);
ALTER TABLE public.tv_login_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tv_login_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tv_login_requests TO service_role;

CREATE TABLE public.tv_login_rate_limits (
  rate_key text NOT NULL CHECK (length(rate_key) BETWEEN 1 AND 140),
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),
  PRIMARY KEY (rate_key, window_start)
);
CREATE INDEX tv_login_rate_limits_expiry_idx ON public.tv_login_rate_limits(window_start);
ALTER TABLE public.tv_login_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tv_login_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tv_login_rate_limits TO service_role;

-- SECURITY INVOKER, granted only to service_role. UPSERT makes the quota atomic.
CREATE FUNCTION public.tv_login_take_rate_limit(_key text, _window timestamptz, _limit integer)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE total integer;
BEGIN
  IF _limit < 1 OR _limit > 2000 OR length(_key) NOT BETWEEN 1 AND 140 THEN RETURN false; END IF;
  INSERT INTO public.tv_login_rate_limits(rate_key,window_start,attempts)
  VALUES (_key,_window,1)
  ON CONFLICT (rate_key,window_start) DO UPDATE
    SET attempts = LEAST(public.tv_login_rate_limits.attempts + 1, 1000000)
  RETURNING attempts INTO total;
  RETURN total <= _limit;
END;
$$;
REVOKE ALL ON FUNCTION public.tv_login_take_rate_limit(text,timestamptz,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tv_login_take_rate_limit(text,timestamptz,integer) TO service_role;
