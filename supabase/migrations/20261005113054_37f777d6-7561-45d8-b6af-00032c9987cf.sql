DROP POLICY IF EXISTS "Members can view contributions" ON public.family_project_contributions;
CREATE POLICY "Family members can view contributions" ON public.family_project_contributions FOR SELECT TO authenticated USING (public.is_family_member(auth.uid()));
DROP POLICY IF EXISTS "Authenticated can view attendees" ON public.trip_attendees;
CREATE POLICY "Family members can view trip attendees" ON public.trip_attendees FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_family_member(auth.uid()));
DROP POLICY IF EXISTS "Members can view presentations" ON public.meeting_presentations;
CREATE POLICY "Family members can view presentations" ON public.meeting_presentations FOR SELECT TO authenticated USING (public.is_family_member(auth.uid()));