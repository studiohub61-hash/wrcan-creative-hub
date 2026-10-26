CREATE TABLE public.campaign_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  centre text NOT NULL,
  category text NOT NULL DEFAULT 'hygiene',
  title text NOT NULL,
  before_path text, before_at timestamptz,
  after_path text, after_at timestamptz,
  note text, latitude double precision, longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.campaign_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  centre text NOT NULL,
  subject text NOT NULL DEFAULT 'child',
  doc_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('missing','expired','valid')),
  note text, file_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.campaign_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  centre text NOT NULL,
  official_name text NOT NULL,
  department text NOT NULL,
  purpose text, photo_path text, signature text NOT NULL,
  latitude double precision, longitude double precision,
  visited_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.campaign_voice_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  centre text NOT NULL,
  language text NOT NULL DEFAULT 'zulu',
  summary text,
  audio_path text NOT NULL,
  duration_ms integer,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.campaign_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  centre text NOT NULL,
  child_ref text NOT NULL,
  milestone text NOT NULL,
  achieved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.campaign_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid(),
  centre text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  evidence_path text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','referred','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_evidence, public.campaign_documents, public.campaign_visits, public.campaign_voice_notes, public.campaign_milestones TO authenticated;
GRANT ALL ON public.campaign_evidence, public.campaign_documents, public.campaign_visits, public.campaign_voice_notes, public.campaign_milestones, public.campaign_incidents TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.campaign_incidents TO authenticated;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['campaign_evidence','campaign_documents','campaign_visits','campaign_voice_notes','campaign_milestones'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "own or coach read" ON public.%I FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), ''admin''))', t);
    EXECUTE format('CREATE POLICY "insert own" ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())', t);
    EXECUTE format('CREATE POLICY "update own or coach" ON public.%I FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), ''admin''))', t);
    EXECUTE format('CREATE POLICY "delete own" ON public.%I FOR DELETE TO authenticated USING (user_id = auth.uid())', t);
  END LOOP;
END $$;

ALTER TABLE public.campaign_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reporter or social worker read" ON public.campaign_incidents FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "report own" ON public.campaign_incidents FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "social worker update" ON public.campaign_incidents FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.campaign_public_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'centres', (SELECT count(DISTINCT lower(trim(c))) FROM (
        SELECT centre c FROM campaign_evidence UNION ALL SELECT centre FROM campaign_documents
        UNION ALL SELECT centre FROM campaign_visits UNION ALL SELECT centre FROM campaign_milestones) x),
    'evidence_total', (SELECT count(*) FROM campaign_evidence),
    'evidence_complete', (SELECT count(*) FROM campaign_evidence WHERE before_path IS NOT NULL AND after_path IS NOT NULL),
    'evidence_week', (SELECT count(*) FROM campaign_evidence WHERE created_at >= now() - interval '7 days'),
    'children_no_birth_cert', (SELECT count(*) FROM campaign_documents WHERE doc_type = 'birth_certificate' AND status <> 'valid'),
    'centres_health_expired', (SELECT count(DISTINCT lower(centre)) FROM campaign_documents WHERE doc_type = 'health_certificate' AND status <> 'valid'),
    'documents_by_type', COALESCE((SELECT jsonb_object_agg(doc_type, n) FROM (SELECT doc_type, count(*) n FROM campaign_documents WHERE status <> 'valid' GROUP BY doc_type) d), '{}'::jsonb),
    'visits_total', (SELECT count(*) FROM campaign_visits),
    'last_visit_at', (SELECT max(visited_at) FROM campaign_visits),
    'days_since_visit', (SELECT EXTRACT(day FROM now() - max(visited_at))::int FROM campaign_visits),
    'voice_notes', (SELECT count(*) FROM campaign_voice_notes),
    'voice_notes_week', (SELECT count(*) FROM campaign_voice_notes WHERE created_at >= now() - interval '7 days'),
    'milestones', COALESCE((SELECT jsonb_agg(jsonb_build_object('milestone', milestone, 'achieved', a, 'total', t, 'pct', round(100.0*a/NULLIF(t,0)))) FROM (
        SELECT milestone, count(*) FILTER (WHERE achieved) a, count(*) t FROM campaign_milestones GROUP BY milestone ORDER BY milestone) m), '[]'::jsonb),
    'incidents_open', (SELECT count(*) FROM campaign_incidents WHERE status <> 'closed'),
    'generated_at', now()
  )
$$;
GRANT EXECUTE ON FUNCTION public.campaign_public_stats() TO anon, authenticated;

CREATE POLICY "campaign upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campaign' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "campaign read own or coach" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'campaign' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));