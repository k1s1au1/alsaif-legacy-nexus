-- Keep companion totals in the RSVP row so every device reads the same count.
ALTER TABLE public.meeting_attendees
  ADD COLUMN IF NOT EXISTS companions_count integer NOT NULL DEFAULT 0
  CHECK (companions_count >= 0);

NOTIFY pgrst, 'reload schema';
