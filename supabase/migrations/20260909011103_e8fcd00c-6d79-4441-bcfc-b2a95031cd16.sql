REVOKE SELECT (desired_password) ON public.account_requests FROM authenticated;
REVOKE SELECT (desired_password) ON public.account_requests FROM anon;
GRANT SELECT (desired_password) ON public.account_requests TO service_role;

UPDATE public.account_requests
SET desired_password = NULL
WHERE status <> 'pending' AND desired_password IS NOT NULL;