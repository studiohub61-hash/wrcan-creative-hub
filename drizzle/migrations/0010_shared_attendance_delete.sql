DROP POLICY IF EXISTS "Owners read logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Owners read participants" ON public.participants;
DROP POLICY IF EXISTS "Owners update participants" ON public.participants;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.participants TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.attendance_logs TO authenticated;
CREATE POLICY "Team reads participants" ON public.participants FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Team updates participants" ON public.participants FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Team deletes participants" ON public.participants FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Team reads logs" ON public.attendance_logs FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Team deletes logs" ON public.attendance_logs FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE OR REPLACE FUNCTION public.participants_cascade_logs() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN DELETE FROM public.attendance_logs WHERE participant_id = OLD.id; RETURN OLD; END $$;
REVOKE EXECUTE ON FUNCTION public.participants_cascade_logs() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER participants_cascade_logs AFTER DELETE ON public.participants FOR EACH ROW EXECUTE FUNCTION public.participants_cascade_logs();