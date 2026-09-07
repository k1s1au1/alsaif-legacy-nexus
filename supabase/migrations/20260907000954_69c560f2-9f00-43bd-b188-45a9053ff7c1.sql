DROP POLICY IF EXISTS "Members manage own rsvp insert" ON public.event_attendees;
DROP POLICY IF EXISTS "Members manage own rsvp update" ON public.event_attendees;

CREATE POLICY "Members manage own rsvp insert"
ON public.event_attendees FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.can_view_event(auth.uid(), event_id));

CREATE POLICY "Members manage own rsvp update"
ON public.event_attendees FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND public.can_view_event(auth.uid(), event_id))
WITH CHECK (auth.uid() = user_id AND public.can_view_event(auth.uid(), event_id));