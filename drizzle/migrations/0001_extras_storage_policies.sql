CREATE TABLE public.uploaded_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  issuer text,
  issued_on date,
  file_path text NOT NULL,
  file_mime text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uploaded_certificates TO authenticated;
GRANT ALL ON public.uploaded_certificates TO service_role;
ALTER TABLE public.uploaded_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uploaded_certs_own" ON public.uploaded_certificates FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "uploaded_certs_admin_read" ON public.uploaded_certificates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
ALTER PUBLICATION supabase_realtime ADD TABLE public.uploaded_certificates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.certificates;

CREATE OR REPLACE FUNCTION public.can_view_control_room()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;
REVOKE ALL ON FUNCTION public.can_view_control_room() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_control_room() TO authenticated;

CREATE OR REPLACE FUNCTION public.control_room_stats_secure()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_view_control_room() THEN RAISE EXCEPTION 'not allowed'; END IF;
  RETURN public.control_room_stats();
END; $$;
REVOKE ALL ON FUNCTION public.control_room_stats_secure() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.control_room_stats_secure() TO authenticated;

CREATE OR REPLACE FUNCTION public.control_room_members()
RETURNS TABLE (id uuid, full_name text, member_type text, city text, suburb text, last_seen_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_view_control_room() THEN RAISE EXCEPTION 'not allowed'; END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.member_type::text, p.city, p.suburb, p.last_seen_at
    FROM public.profiles p ORDER BY p.last_seen_at DESC LIMIT 500;
END; $$;
REVOKE ALL ON FUNCTION public.control_room_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.control_room_members() TO authenticated;

CREATE OR REPLACE FUNCTION public.control_room_uploads()
RETURNS TABLE (kind text, user_id uuid, full_name text, title text, latitude double precision, longitude double precision, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_view_control_room() THEN RAISE EXCEPTION 'not allowed'; END IF;
  RETURN QUERY
    SELECT 'certificate'::text, u.user_id, COALESCE(p.full_name,''), u.title, u.latitude, u.longitude, u.created_at
    FROM public.uploaded_certificates u LEFT JOIN public.profiles p ON p.id = u.user_id
    WHERE u.latitude IS NOT NULL AND u.longitude IS NOT NULL
    UNION ALL
    SELECT m.kind::text, m.sender_id, COALESCE(p.full_name,''), COALESCE(m.body, m.kind::text), m.latitude, m.longitude, m.created_at
    FROM public.messages m LEFT JOIN public.profiles p ON p.id = m.sender_id
    WHERE m.latitude IS NOT NULL AND m.longitude IS NOT NULL AND m.deleted_at IS NULL
    ORDER BY 7 DESC LIMIT 100;
END; $$;
REVOKE ALL ON FUNCTION public.control_room_uploads() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.control_room_uploads() TO authenticated;

CREATE OR REPLACE FUNCTION public.my_unread_count()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(count(*), 0)::integer
  FROM public.messages m
  JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = auth.uid()
  WHERE m.sender_id <> auth.uid() AND m.deleted_at IS NULL AND m.created_at > cp.last_read_at
$$;
REVOKE ALL ON FUNCTION public.my_unread_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_unread_count() TO authenticated;

CREATE OR REPLACE FUNCTION public.member_achievements(_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'certificates', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.issued_at DESC) FROM public.certificates c WHERE c.user_id = _user_id), '[]'::jsonb),
    'completed', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('title', t.title, 'provider', t.provider, 'score', e.score, 'completed_at', e.completed_at) ORDER BY e.completed_at DESC)
      FROM public.enrollments e JOIN public.training_modules t ON t.id = e.module_id
      WHERE e.user_id = _user_id AND e.status = 'completed'), '[]'::jsonb)
  )
$$;
REVOKE ALL ON FUNCTION public.member_achievements(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_achievements(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.certificate_directory()
RETURNS TABLE (user_id uuid, full_name text, city text, avatar_url text, wanda_certs integer, uploaded_certs integer, completed integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM (
    SELECT p.id AS user_id, p.full_name, p.city, p.avatar_url,
      (SELECT count(*) FROM public.certificates c WHERE c.user_id = p.id)::integer AS wanda_certs,
      (SELECT count(*) FROM public.uploaded_certificates u WHERE u.user_id = p.id)::integer AS uploaded_certs,
      (SELECT count(*) FROM public.enrollments e WHERE e.user_id = p.id AND e.status = 'completed')::integer AS completed
    FROM public.profiles p WHERE p.is_public
  ) d
  WHERE d.wanda_certs + d.uploaded_certs + d.completed > 0
  ORDER BY d.wanda_certs + d.uploaded_certs DESC, d.full_name
$$;
REVOKE ALL ON FUNCTION public.certificate_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.certificate_directory() TO authenticated;

CREATE POLICY "chat_media_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "chat_media_read_authenticated" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-media');
CREATE POLICY "chat_media_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_read_authenticated" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');
CREATE POLICY "avatars_write_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_update_own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "certificates_read_own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'certificates' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "certificates_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'certificates' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "certificates_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'certificates' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Talent media is readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'talent');
CREATE POLICY "Members upload their own talent media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'talent' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Members update their own talent media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'talent' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Members delete their own talent media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'talent' AND (storage.foldername(name))[1] = auth.uid()::text);
