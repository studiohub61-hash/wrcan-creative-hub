CREATE TABLE public.hub_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), host_id uuid NOT NULL, title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160), code text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)), latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90), longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180), radius_m integer NOT NULL DEFAULT 500 CHECK (radius_m BETWEEN 50 AND 50000), stream_url text, ends_at timestamptz NOT NULL DEFAULT (now() + interval '4 hours'), closed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.hub_sessions TO authenticated;
GRANT ALL ON public.hub_sessions TO service_role;
ALTER TABLE public.hub_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY session_read ON public.hub_sessions FOR SELECT TO authenticated USING (host_id = auth.uid() OR (closed_at IS NULL AND ends_at > now()));
CREATE POLICY session_create ON public.hub_sessions FOR INSERT TO authenticated WITH CHECK (host_id = auth.uid());
CREATE POLICY session_update ON public.hub_sessions FOR UPDATE TO authenticated USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());
CREATE TABLE public.hub_session_locations (
 session_id uuid NOT NULL REFERENCES public.hub_sessions(id) ON DELETE CASCADE, user_id uuid NOT NULL, latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90), longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180), accuracy double precision NOT NULL CHECK (accuracy >= 0), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(session_id,user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_session_locations TO authenticated;
GRANT ALL ON public.hub_session_locations TO service_role;
ALTER TABLE public.hub_session_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY location_read ON public.hub_session_locations FOR SELECT TO authenticated USING (updated_at > now() - interval '2 minutes' AND EXISTS (SELECT 1 FROM public.hub_sessions s WHERE s.id = session_id AND s.closed_at IS NULL AND s.ends_at > now() AND (s.host_id = auth.uid() OR user_id = auth.uid())));
CREATE POLICY location_insert ON public.hub_session_locations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.hub_sessions s WHERE s.id = session_id AND s.closed_at IS NULL AND s.ends_at > now()));
CREATE POLICY location_update ON public.hub_session_locations FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.hub_sessions s WHERE s.id = session_id AND s.closed_at IS NULL AND s.ends_at > now()));
CREATE POLICY location_delete ON public.hub_session_locations FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE FUNCTION public.touch_hub_location() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER touch_hub_location BEFORE INSERT OR UPDATE ON public.hub_session_locations FOR EACH ROW EXECUTE FUNCTION public.touch_hub_location();
ALTER PUBLICATION supabase_realtime ADD TABLE public.hub_session_locations;
CREATE INDEX hub_location_freshness ON public.hub_session_locations(session_id, updated_at);