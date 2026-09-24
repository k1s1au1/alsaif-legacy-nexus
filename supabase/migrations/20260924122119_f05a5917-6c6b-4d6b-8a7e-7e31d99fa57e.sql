-- 1) Backup audit log
CREATE TABLE public.system_backups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'full',
  tables_count integer NOT NULL DEFAULT 0,
  rows_count integer NOT NULL DEFAULT 0,
  bytes_size bigint NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_backups TO authenticated;
GRANT ALL ON public.system_backups TO service_role;

ALTER TABLE public.system_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leadership and technical admin read backup log"
ON public.system_backups FOR SELECT TO authenticated
USING (public.is_council_leadership(auth.uid()) OR public.is_technical_admin(auth.uid()));

-- 2) Who may run a full backup
CREATE OR REPLACE FUNCTION public.can_run_full_backup(_u uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_chairman(_u) OR public.is_technical_admin(_u);
$$;

-- 3) Approved-member helper
CREATE OR REPLACE FUNCTION public.is_family_member(_u uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _u IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _u);
$$;

-- 4) Tighten tautological read policies
DROP POLICY IF EXISTS "Members read comments" ON public.member_post_comments;
CREATE POLICY "Members read comments"
ON public.member_post_comments FOR SELECT TO authenticated
USING (public.is_family_member(auth.uid()));

DROP POLICY IF EXISTS "Members can view projects" ON public.family_projects;
CREATE POLICY "Members can view projects"
ON public.family_projects FOR SELECT TO authenticated
USING (public.is_family_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view trips" ON public.trips;
CREATE POLICY "Authenticated can view trips"
ON public.trips FOR SELECT TO authenticated
USING (public.is_family_member(auth.uid()));
