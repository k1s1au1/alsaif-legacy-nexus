DROP POLICY IF EXISTS "Members read posts" ON public.member_posts;
CREATE POLICY "Members read posts" ON public.member_posts FOR SELECT TO authenticated USING (public.is_family_member(auth.uid()));
DROP POLICY IF EXISTS "Authenticated members can view trip items" ON public.trip_items;
CREATE POLICY "Authenticated members can view trip items" ON public.trip_items FOR SELECT TO authenticated USING (public.is_family_member(auth.uid()));
DROP POLICY IF EXISTS "Anyone signed in views presence" ON public.user_presence;
CREATE POLICY "Anyone signed in views presence" ON public.user_presence FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_family_member(auth.uid()));