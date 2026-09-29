DROP POLICY IF EXISTS "Members can view meetings" ON public.meetings;
CREATE POLICY "Accepted family members view meetings"
ON public.meetings
FOR SELECT
TO authenticated
USING (public.is_family_member(auth.uid()));

DROP POLICY IF EXISTS "All members view extras" ON public.family_tree_extras;
CREATE POLICY "Accepted family members view extras"
ON public.family_tree_extras
FOR SELECT
TO authenticated
USING (public.is_family_member(auth.uid()));

DROP POLICY IF EXISTS "All members view roles" ON public.user_roles;
CREATE POLICY "Members view own role and leadership views all"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_council_leadership(auth.uid())
);