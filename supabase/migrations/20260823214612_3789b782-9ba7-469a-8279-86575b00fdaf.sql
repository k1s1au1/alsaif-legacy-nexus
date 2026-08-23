ALTER FUNCTION public.assign_user_role(uuid, public.app_role) SECURITY INVOKER;

DROP POLICY IF EXISTS "Privileged users can insert roles" ON public.user_roles;
CREATE POLICY "Privileged users can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'chairman'::public.app_role)
);

DROP POLICY IF EXISTS "Privileged users can delete roles" ON public.user_roles;
CREATE POLICY "Privileged users can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'chairman'::public.app_role)
);