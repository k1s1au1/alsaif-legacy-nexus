DROP POLICY IF EXISTS "Members can view attendees" ON public.meeting_attendees;
CREATE POLICY "Accepted family members view attendees"
ON public.meeting_attendees
FOR SELECT
TO authenticated
USING (public.is_family_member(auth.uid()));

DROP POLICY IF EXISTS "Members read votes" ON public.member_post_votes;
CREATE POLICY "Accepted family members read votes"
ON public.member_post_votes
FOR SELECT
TO authenticated
USING (public.is_family_member(auth.uid()));

DROP POLICY IF EXISTS "Anyone authenticated can view section heads" ON public.section_heads;
CREATE POLICY "Accepted family members view section heads"
ON public.section_heads
FOR SELECT
TO authenticated
USING (public.is_family_member(auth.uid()));