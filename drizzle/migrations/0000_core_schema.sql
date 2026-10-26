CREATE TYPE public.app_role AS ENUM ('admin','recruiter','caterer','student','jobseeker');
CREATE TYPE public.member_type AS ENUM ('student','jobseeker','recruiter','caterer');
CREATE TYPE public.enrollment_status AS ENUM ('enrolled','in_progress','completed','withdrawn');
CREATE TYPE public.application_status AS ENUM ('submitted','shortlisted','interview','offered','placed','rejected');
CREATE TYPE public.message_kind AS ENUM ('text','image','video','audio','file','location','contact');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  member_type public.member_type NOT NULL DEFAULT 'jobseeker',
  date_of_birth date,
  gender text,
  city text,
  suburb text,
  province text,
  highest_qualification text,
  field_of_study text,
  skills text[] NOT NULL DEFAULT '{}',
  languages text[] NOT NULL DEFAULT '{}',
  experience_years integer NOT NULL DEFAULT 0,
  has_disability boolean NOT NULL DEFAULT false,
  disability_detail text,
  availability text,
  drivers_licence boolean NOT NULL DEFAULT false,
  company_name text,
  bio text,
  avatar_url text,
  cv_path text,
  is_public boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, member_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'member_type')::public.member_type, 'jobseeker')
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'member_type')::text, 'jobseeker')::public.app_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  provider text NOT NULL,
  accrediting_body text,
  category text NOT NULL DEFAULT 'general',
  description text NOT NULL DEFAULT '',
  nqf_level integer,
  duration_hours integer NOT NULL DEFAULT 20,
  credits integer,
  min_age integer NOT NULL DEFAULT 16,
  max_age integer NOT NULL DEFAULT 99,
  required_qualification text,
  tags text[] NOT NULL DEFAULT '{}',
  manual_url text,
  is_accredited boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_modules TO authenticated;
GRANT SELECT ON public.training_modules TO anon;
GRANT ALL ON public.training_modules TO service_role;
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules_public_read" ON public.training_modules FOR SELECT USING (is_active);
CREATE POLICY "modules_admin_write" ON public.training_modules FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  status public.enrollment_status NOT NULL DEFAULT 'enrolled',
  progress integer NOT NULL DEFAULT 0,
  score integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (user_id, module_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enrollments_own" ON public.enrollments FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  certificate_number text NOT NULL UNIQUE,
  learner_name text NOT NULL,
  module_title text NOT NULL,
  provider text NOT NULL,
  score integer,
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certificates_own" ON public.certificates FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company text NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'recruitment',
  description text NOT NULL DEFAULT '',
  city text,
  province text,
  employment_type text NOT NULL DEFAULT 'Full-time',
  salary_min integer,
  salary_max integer,
  min_age integer NOT NULL DEFAULT 16,
  max_age integer NOT NULL DEFAULT 99,
  required_qualification text,
  required_skills text[] NOT NULL DEFAULT '{}',
  min_experience integer NOT NULL DEFAULT 0,
  positions integer NOT NULL DEFAULT 1,
  disability_friendly boolean NOT NULL DEFAULT false,
  closes_at date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT SELECT ON public.jobs TO anon;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_public_read" ON public.jobs FOR SELECT USING (is_active);
CREATE POLICY "jobs_owner_write" ON public.jobs FOR ALL TO authenticated
USING (auth.uid() = posted_by OR public.has_role(auth.uid(),'admin'))
WITH CHECK (auth.uid() = posted_by OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.application_status NOT NULL DEFAULT 'submitted',
  match_score integer NOT NULL DEFAULT 0,
  cover_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "applications_own" ON public.applications FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "applications_recruiter_read" ON public.applications FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.posted_by = auth.uid()));
CREATE POLICY "applications_recruiter_update" ON public.applications FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.posted_by = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.posted_by = auth.uid()));

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  is_group boolean NOT NULL DEFAULT false,
  avatar_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  area_key text,
  is_community boolean NOT NULL DEFAULT false,
  invite_url text,
  description text,
  community_slug text UNIQUE
);
CREATE UNIQUE INDEX conversations_area_key_uidx ON public.conversations (area_key) WHERE area_key IS NOT NULL;
CREATE TABLE public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.message_kind NOT NULL DEFAULT 'text',
  body text,
  media_path text,
  media_mime text,
  media_size integer,
  duration_ms integer,
  latitude double precision,
  longitude double precision,
  reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.conversations, public.conversation_participants, public.messages TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id)
$$;

CREATE POLICY "conv_select" ON public.conversations FOR SELECT TO authenticated
USING (public.is_participant(id, auth.uid()));
CREATE POLICY "conv_select_community" ON public.conversations FOR SELECT TO authenticated
USING (is_community = true);
CREATE POLICY "conv_insert" ON public.conversations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);
CREATE POLICY "conv_update" ON public.conversations FOR UPDATE TO authenticated
USING (public.is_participant(id, auth.uid())) WITH CHECK (public.is_participant(id, auth.uid()));

CREATE POLICY "cp_select" ON public.conversation_participants FOR SELECT TO authenticated
USING (public.is_participant(conversation_id, auth.uid()));
CREATE POLICY "cp_insert" ON public.conversation_participants FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid()));
CREATE POLICY "cp_update_own" ON public.conversation_participants FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cp_delete_own" ON public.conversation_participants FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "msg_select" ON public.messages FOR SELECT TO authenticated
USING (public.is_participant(conversation_id, auth.uid()));
CREATE POLICY "msg_insert" ON public.messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = sender_id AND public.is_participant(conversation_id, auth.uid()));
CREATE POLICY "msg_update_own" ON public.messages FOR UPDATE TO authenticated
USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "msg_delete_own" ON public.messages FOR DELETE TO authenticated
USING (auth.uid() = sender_id);

CREATE OR REPLACE FUNCTION public.touch_conversation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_touch_conversation AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.touch_conversation();

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;

CREATE TABLE public.service_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stars integer NOT NULL,
  area text NOT NULL DEFAULT 'general',
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.service_ratings TO authenticated;
GRANT ALL ON public.service_ratings TO service_role;
ALTER TABLE public.service_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings_read" ON public.service_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "ratings_insert_own" ON public.service_ratings FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.data_purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  phone text,
  dataset text NOT NULL,
  record_count integer,
  purpose text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.data_purchase_requests TO anon, authenticated;
GRANT SELECT, UPDATE ON public.data_purchase_requests TO authenticated;
GRANT ALL ON public.data_purchase_requests TO service_role;
ALTER TABLE public.data_purchase_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpr_insert_any" ON public.data_purchase_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "dpr_admin_read" ON public.data_purchase_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "dpr_admin_update" ON public.data_purchase_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_conversation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_participant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_participant(uuid, uuid) TO authenticated;

CREATE TABLE public.message_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (message_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_receipts TO authenticated;
GRANT ALL ON public.message_receipts TO service_role;
ALTER TABLE public.message_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receipts_select_participants" ON public.message_receipts FOR SELECT TO authenticated
  USING (public.is_participant(conversation_id, auth.uid()));
CREATE POLICY "receipts_insert_own" ON public.message_receipts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_participant(conversation_id, auth.uid()));
CREATE POLICY "receipts_update_own" ON public.message_receipts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_receipts_conv ON public.message_receipts (conversation_id, user_id);

CREATE TABLE public.device_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'web',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tokens_own" ON public.device_tokens FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_device_tokens_updated BEFORE UPDATE ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.conversation_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_muted boolean NOT NULL DEFAULT false,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_settings TO authenticated;
GRANT ALL ON public.conversation_settings TO service_role;
ALTER TABLE public.conversation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conv_settings_own" ON public.conversation_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_conv_settings_updated BEFORE UPDATE ON public.conversation_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.live_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_locations TO authenticated;
GRANT ALL ON public.live_locations TO service_role;
ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_loc_select_participants" ON public.live_locations FOR SELECT TO authenticated
  USING (public.is_participant(conversation_id, auth.uid()));
CREATE POLICY "live_loc_write_own" ON public.live_locations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_participant(conversation_id, auth.uid()));
CREATE POLICY "live_loc_update_own" ON public.live_locations FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "live_loc_delete_own" ON public.live_locations FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE TRIGGER trg_live_loc_updated BEFORE UPDATE ON public.live_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_locations;

CREATE OR REPLACE FUNCTION public.start_direct_chat(_other_id uuid, _title text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _conv uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _other_id IS NULL OR _other_id = _me THEN RAISE EXCEPTION 'invalid participant'; END IF;

  SELECT c.id INTO _conv
  FROM public.conversations c
  JOIN public.conversation_participants a ON a.conversation_id = c.id AND a.user_id = _me
  JOIN public.conversation_participants b ON b.conversation_id = c.id AND b.user_id = _other_id
  WHERE c.is_group = false
  LIMIT 1;

  IF _conv IS NOT NULL THEN RETURN _conv; END IF;

  INSERT INTO public.conversations (created_by, is_group, title)
  VALUES (_me, false, COALESCE(_title, 'Wanda chat'))
  RETURNING id INTO _conv;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (_conv, _me), (_conv, _other_id)
  ON CONFLICT DO NOTHING;

  RETURN _conv;
END; $$;

REVOKE EXECUTE ON FUNCTION public.start_direct_chat(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_direct_chat(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_community(_conversation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = _conversation_id AND is_community) THEN
    RAISE EXCEPTION 'not a community group';
  END IF;
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (_conversation_id, _me)
  ON CONFLICT DO NOTHING;
  RETURN _conversation_id;
END; $$;

REVOKE ALL ON FUNCTION public.join_community(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_community(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.area_key_of(_suburb text, _city text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT NULLIF(lower(regexp_replace(trim(coalesce(NULLIF(trim(_suburb), ''), _city, '')), '\s+', '-', 'g')), '')
$$;

CREATE OR REPLACE FUNCTION public.area_label_of(_suburb text, _city text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT initcap(trim(coalesce(NULLIF(trim(_suburb), ''), _city, ''))) || ' Seekers'
$$;

CREATE OR REPLACE FUNCTION public.allocate_area_group(_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.profiles;
  k text;
  conv uuid;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = _user_id;
  IF p.id IS NULL OR p.member_type NOT IN ('jobseeker', 'student') THEN RETURN NULL; END IF;
  k := public.area_key_of(p.suburb, p.city);
  IF k IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO conv FROM public.conversations WHERE area_key = k;
  IF conv IS NULL THEN
    INSERT INTO public.conversations (title, is_group, area_key, created_by)
    VALUES (public.area_label_of(p.suburb, p.city), true, k, _user_id)
    RETURNING id INTO conv;
  END IF;

  DELETE FROM public.conversation_participants cp
  USING public.conversations c
  WHERE cp.conversation_id = c.id AND cp.user_id = _user_id
    AND c.area_key IS NOT NULL AND c.area_key <> k;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (conv, _user_id)
  ON CONFLICT DO NOTHING;

  RETURN conv;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.allocate_area_group(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.allocate_area_group(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_allocate_area()
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.allocate_area_group(auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.auto_allocate_area() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.auto_allocate_area() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.profiles_area_allocate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.allocate_area_group(NEW.id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.profiles_area_allocate() FROM public, anon, authenticated;

CREATE TRIGGER profiles_area_allocate_trg
AFTER INSERT OR UPDATE OF suburb, city, member_type ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_area_allocate();

CREATE TABLE public.status_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'text' CHECK (kind IN ('text','image','video')),
  body text,
  media_path text,
  media_mime text,
  background text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_posts TO authenticated;
GRANT ALL ON public.status_posts TO service_role;
ALTER TABLE public.status_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in members can view active statuses" ON public.status_posts
  FOR SELECT TO authenticated USING (expires_at > now());
CREATE POLICY "Members manage their own statuses" ON public.status_posts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.talent_reels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'video' CHECK (kind IN ('video','image')),
  title text NOT NULL,
  caption text,
  skill_tag text,
  area text,
  media_path text NOT NULL,
  media_mime text,
  duration_ms integer,
  views integer NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.talent_reels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.talent_reels TO authenticated;
GRANT ALL ON public.talent_reels TO service_role;
ALTER TABLE public.talent_reels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reels are viewable by everyone" ON public.talent_reels
  FOR SELECT USING (is_public = true);
CREATE POLICY "Members can read their own reels" ON public.talent_reels
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Members manage their own reels" ON public.talent_reels
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.reel_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.talent_reels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reel_id, user_id)
);
GRANT SELECT ON public.reel_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.reel_likes TO authenticated;
GRANT ALL ON public.reel_likes TO service_role;
ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can see reel likes" ON public.reel_likes FOR SELECT USING (true);
CREATE POLICY "Members like as themselves" ON public.reel_likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members remove their own likes" ON public.reel_likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_status_posts_updated_at BEFORE UPDATE ON public.status_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_talent_reels_updated_at BEFORE UPDATE ON public.talent_reels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.status_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.talent_reels;

CREATE TYPE public.donor_type AS ENUM ('individual','company','foundation','government','ngo');
CREATE TYPE public.donation_status AS ENUM ('pending','completed','failed','refunded');

CREATE TABLE public.donation_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  goal_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  cover_url text,
  beneficiaries integer NOT NULL DEFAULT 0,
  starts_at date NOT NULL DEFAULT current_date,
  ends_at date,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.donation_campaigns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donation_campaigns TO authenticated;
GRANT ALL ON public.donation_campaigns TO service_role;
ALTER TABLE public.donation_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaigns_public_read ON public.donation_campaigns FOR SELECT USING (is_active);
CREATE POLICY campaigns_admin_all ON public.donation_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON public.donation_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.donation_campaigns(id) ON DELETE SET NULL,
  donor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  donor_name text NOT NULL DEFAULT 'Anonymous',
  donor_type public.donor_type NOT NULL DEFAULT 'individual',
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'ZAR',
  method text NOT NULL DEFAULT 'eft',
  reference text,
  message text,
  is_anonymous boolean NOT NULL DEFAULT false,
  is_recurring boolean NOT NULL DEFAULT false,
  status public.donation_status NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX donations_created_idx ON public.donations (created_at DESC);
CREATE INDEX donations_campaign_idx ON public.donations (campaign_id);
GRANT SELECT, INSERT ON public.donations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donations TO authenticated;
GRANT ALL ON public.donations TO service_role;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY donations_public_read ON public.donations FOR SELECT USING (status IN ('completed','pending'));
CREATE POLICY donations_insert_any ON public.donations FOR INSERT WITH CHECK (
  donor_user_id IS NULL OR donor_user_id = auth.uid()
);
CREATE POLICY donations_own_update ON public.donations FOR UPDATE TO authenticated
  USING (donor_user_id = auth.uid()) WITH CHECK (donor_user_id = auth.uid());
CREATE POLICY donations_admin_all ON public.donations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.donor_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid NOT NULL REFERENCES public.donations(id) ON DELETE CASCADE,
  contact_name text,
  email text,
  phone text,
  company_registration text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.donor_contacts TO anon;
GRANT SELECT, INSERT ON public.donor_contacts TO authenticated;
GRANT ALL ON public.donor_contacts TO service_role;
ALTER TABLE public.donor_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY donor_contacts_insert_any ON public.donor_contacts FOR INSERT WITH CHECK (true);
CREATE POLICY donor_contacts_admin_read ON public.donor_contacts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.donations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.donation_campaigns;

CREATE OR REPLACE FUNCTION public.impact_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'members', (SELECT count(*) FROM public.profiles),
    'jobseekers', (SELECT count(*) FROM public.profiles WHERE member_type = 'jobseeker'),
    'students', (SELECT count(*) FROM public.profiles WHERE member_type = 'student'),
    'recruiters', (SELECT count(*) FROM public.profiles WHERE member_type IN ('recruiter','caterer')),
    'modules', (SELECT count(*) FROM public.training_modules WHERE is_active),
    'enrollments', (SELECT count(*) FROM public.enrollments),
    'completions', (SELECT count(*) FROM public.enrollments WHERE status = 'completed'),
    'certificates', (SELECT count(*) FROM public.certificates),
    'jobs', (SELECT count(*) FROM public.jobs WHERE is_active),
    'applications', (SELECT count(*) FROM public.applications),
    'placements', (SELECT count(*) FROM public.applications WHERE status = 'placed'),
    'reels', (SELECT count(*) FROM public.talent_reels WHERE is_public),
    'area_groups', (SELECT count(*) FROM public.conversations WHERE area_key IS NOT NULL),
    'raised', (SELECT COALESCE(sum(amount), 0) FROM public.donations WHERE status = 'completed'),
    'campaigns', (SELECT count(*) FROM public.donation_campaigns WHERE is_active)
  )
$$;

REVOKE ALL ON FUNCTION public.impact_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.impact_stats() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.control_room_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'new_users_today', (SELECT count(*) FROM public.profiles WHERE created_at >= date_trunc('day', now())),
    'emails_captured', (SELECT count(*) FROM public.profiles WHERE email IS NOT NULL),
    'emails_today', (SELECT count(*) FROM public.profiles WHERE email IS NOT NULL AND created_at >= date_trunc('day', now())),
    'active_sessions', (SELECT count(*) FROM public.profiles WHERE last_seen_at >= now() - interval '15 minutes'),
    'active_24h', (SELECT count(*) FROM public.profiles WHERE last_seen_at >= now() - interval '24 hours'),
    'reel_views', (SELECT coalesce(sum(views),0) FROM public.talent_reels),
    'reels_count', (SELECT count(*) FROM public.talent_reels),
    'interactions', (SELECT count(*) FROM public.reel_likes) + (SELECT count(*) FROM public.messages) + (SELECT count(*) FROM public.applications),
    'certificates', (SELECT count(*) FROM public.certificates),
    'certificates_today', (SELECT count(*) FROM public.certificates WHERE issued_at >= date_trunc('day', now())),
    'recruiters', (SELECT count(*) FROM public.profiles WHERE member_type IN ('recruiter','caterer')),
    'recruiters_online', (SELECT count(*) FROM public.profiles WHERE member_type IN ('recruiter','caterer') AND last_seen_at >= now() - interval '15 minutes'),
    'jobs', (SELECT count(*) FROM public.jobs WHERE is_active),
    'jobs_this_week', (SELECT count(*) FROM public.jobs WHERE created_at >= now() - interval '7 days'),
    'applications', (SELECT count(*) FROM public.applications),
    'messages', (SELECT count(*) FROM public.messages WHERE deleted_at IS NULL),
    'messages_last_hour', (SELECT count(*) FROM public.messages WHERE created_at >= now() - interval '1 hour'),
    'enrollments', (SELECT count(*) FROM public.enrollments),
    'completions', (SELECT count(*) FROM public.enrollments WHERE status = 'completed'),
    'daily_active', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('day', to_char(d.day,'Dy'), 'value', c.cnt) ORDER BY d.day), '[]'::jsonb)
      FROM generate_series(date_trunc('day', now()) - interval '6 days', date_trunc('day', now()), interval '1 day') AS d(day)
      CROSS JOIN LATERAL (
        SELECT count(DISTINCT p.id) AS cnt FROM public.profiles p
        WHERE p.last_seen_at >= d.day AND p.last_seen_at < d.day + interval '1 day'
      ) c
    ),
    'recent_logins', (
      SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT
          CASE WHEN p.email IS NULL THEN 'hidden'
               ELSE left(split_part(p.email,'@',1),2) || '***@' || split_part(p.email,'@',2) END AS email,
          p.full_name,
          p.last_seen_at,
          coalesce(p.city, p.province, 'South Africa') AS place
        FROM public.profiles p
        ORDER BY p.last_seen_at DESC
        LIMIT 6
      ) x
    ),
    'generated_at', now()
  );
$$;

REVOKE ALL ON FUNCTION public.control_room_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.control_room_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.control_room_stats() TO authenticated;
