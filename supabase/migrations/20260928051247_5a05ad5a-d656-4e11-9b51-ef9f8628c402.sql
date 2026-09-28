DROP POLICY IF EXISTS "Authenticated can view transactions" ON public.fund_transactions;
CREATE POLICY "Family members can view transactions"
ON public.fund_transactions FOR SELECT TO authenticated
USING (public.is_family_member(auth.uid()));

DROP POLICY IF EXISTS "Members can view tasks" ON public.tasks;
CREATE POLICY "Family members can view tasks"
ON public.tasks FOR SELECT TO authenticated
USING (public.is_family_member(auth.uid()));

DROP POLICY IF EXISTS "Members view profiles (non-sensitive columns)" ON public.profiles;
CREATE POLICY "Members view profiles (non-sensitive columns)"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR public.is_family_member(auth.uid()));