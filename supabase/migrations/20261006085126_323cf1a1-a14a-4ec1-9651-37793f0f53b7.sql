CREATE OR REPLACE FUNCTION public.claim_push_token(_token text, _platform text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR _token IS NULL OR length(_token) < 10 THEN RETURN; END IF;
  DELETE FROM public.push_tokens WHERE token = _token AND user_id <> _uid;
  INSERT INTO public.push_tokens (user_id, token, platform, is_active)
  VALUES (_uid, _token, coalesce(_platform, 'web'), true)
  ON CONFLICT (user_id, token) DO UPDATE SET is_active = true, platform = EXCLUDED.platform, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.release_push_token(_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  DELETE FROM public.push_tokens WHERE token = _token AND user_id = auth.uid();
END $$;

REVOKE EXECUTE ON FUNCTION public.claim_push_token(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.release_push_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_push_token(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_push_token(text) TO authenticated;

-- Cleanup: keep only the most recently updated owner of each shared token
DELETE FROM public.push_tokens a USING public.push_tokens b
WHERE a.token = b.token AND a.id <> b.id
  AND (a.updated_at < b.updated_at OR (a.updated_at = b.updated_at AND a.id < b.id));