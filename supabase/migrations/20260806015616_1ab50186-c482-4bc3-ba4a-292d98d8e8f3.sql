CREATE TABLE public.steps_data (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Riyadh')::date,
  steps integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'device',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.steps_data TO authenticated;
GRANT ALL ON public.steps_data TO service_role;

ALTER TABLE public.steps_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view all steps"
  ON public.steps_data FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert own steps"
  ON public.steps_data FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own steps"
  ON public.steps_data FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own steps"
  ON public.steps_data FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER steps_data_touch_updated_at
  BEFORE UPDATE ON public.steps_data
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX steps_data_date_idx ON public.steps_data (date DESC);