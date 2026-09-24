REVOKE ALL ON FUNCTION public.can_run_full_backup(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_run_full_backup(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.is_family_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_family_member(uuid) TO authenticated, service_role;
