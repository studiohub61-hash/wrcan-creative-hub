CREATE TABLE public.participants (
  id text PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL,
  site text NOT NULL DEFAULT '',
  start_time text NOT NULL DEFAULT '08:00',
  end_time text NOT NULL DEFAULT '16:00',
  photo_data text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'off_site',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.attendance_logs (
  id text PRIMARY KEY,
  participant_id text NOT NULL,
  name text NOT NULL,
  role text NOT NULL,
  action text NOT NULL,
  punctuality text,
  gps text,
  photo_data text NOT NULL DEFAULT '',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.participants TO authenticated;
GRANT SELECT, INSERT ON public.attendance_logs TO authenticated;
GRANT ALL ON public.participants TO service_role;
GRANT ALL ON public.attendance_logs TO service_role;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read participants" ON public.participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users register participants" ON public.participants FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Signed-in users update participant status" ON public.participants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed-in users read logs" ON public.attendance_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users add own logs" ON public.attendance_logs FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
ALTER TABLE public.participants REPLICA IDENTITY FULL;
ALTER TABLE public.attendance_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs;