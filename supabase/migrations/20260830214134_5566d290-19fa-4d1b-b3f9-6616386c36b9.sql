DROP POLICY IF EXISTS "Admins and managers can view account requests" ON public.account_requests;
DROP POLICY IF EXISTS "Admins and managers can update account requests" ON public.account_requests;
DROP POLICY IF EXISTS "Admins and managers can delete account requests" ON public.account_requests;

CREATE POLICY "Privileged users can view account requests"
ON public.account_requests FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'chairman'::app_role)
);

CREATE POLICY "Privileged users can update account requests"
ON public.account_requests FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'chairman'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'chairman'::app_role)
);

CREATE POLICY "Privileged users can delete account requests"
ON public.account_requests FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'chairman'::app_role)
);