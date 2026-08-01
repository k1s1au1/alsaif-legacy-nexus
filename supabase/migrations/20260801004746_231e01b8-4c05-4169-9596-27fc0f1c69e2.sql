ALTER TABLE public.anonymous_suggestions
  ADD COLUMN status text NOT NULL DEFAULT 'new',
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.anonymous_suggestions
  ADD CONSTRAINT anonymous_suggestions_status_check
  CHECK (status IN ('new','reviewing','accepted','rejected'));

GRANT UPDATE ON public.anonymous_suggestions TO authenticated;

CREATE POLICY "Management can update suggestions"
ON public.anonymous_suggestions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'chairman'));

CREATE TRIGGER anonymous_suggestions_touch
BEFORE UPDATE ON public.anonymous_suggestions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();