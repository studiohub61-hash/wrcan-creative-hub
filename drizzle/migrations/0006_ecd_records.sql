CREATE TABLE public.ecd_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  feature text NOT NULL,
  centre text NOT NULL DEFAULT '',
  subject text NOT NULL,
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','flagged')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ecd_records TO authenticated;
GRANT ALL ON public.ecd_records TO service_role;
ALTER TABLE public.ecd_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.ecd_records FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own insert" ON public.ecd_records FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own update" ON public.ecd_records FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own delete" ON public.ecd_records FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX ecd_records_user_feature ON public.ecd_records(user_id, feature);