CREATE TABLE public.anonymous_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT, SELECT, DELETE ON public.anonymous_suggestions TO authenticated;
GRANT ALL ON public.anonymous_suggestions TO service_role;

ALTER TABLE public.anonymous_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can submit suggestions"
ON public.anonymous_suggestions FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Management can read suggestions"
ON public.anonymous_suggestions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

CREATE POLICY "Management can delete suggestions"
ON public.anonymous_suggestions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));