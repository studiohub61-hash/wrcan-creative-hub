ALTER TABLE public.status_posts ADD COLUMN IF NOT EXISTS latitude double precision, ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.talent_reels ADD COLUMN IF NOT EXISTS latitude double precision, ADD COLUMN IF NOT EXISTS longitude double precision;

CREATE OR REPLACE FUNCTION public.control_room_uploads()
RETURNS TABLE (kind text, user_id uuid, full_name text, title text, latitude double precision, longitude double precision, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_view_control_room() THEN RAISE EXCEPTION 'not allowed'; END IF;
  RETURN QUERY
    SELECT * FROM (
      SELECT 'certificate'::text AS k, u.user_id AS uid, COALESCE(p.full_name,'') AS fn, u.title AS t, u.latitude AS la, u.longitude AS lo, u.created_at AS ca
      FROM public.uploaded_certificates u LEFT JOIN public.profiles p ON p.id = u.user_id
      WHERE u.latitude IS NOT NULL AND u.longitude IS NOT NULL
      UNION ALL
      SELECT 'reel'::text, r.user_id, COALESCE(p.full_name,''), r.title, r.latitude, r.longitude, r.created_at
      FROM public.talent_reels r LEFT JOIN public.profiles p ON p.id = r.user_id
      WHERE r.latitude IS NOT NULL AND r.longitude IS NOT NULL
      UNION ALL
      SELECT 'status'::text, s.user_id, COALESCE(p.full_name,''), COALESCE(s.body,'Status'), s.latitude, s.longitude, s.created_at
      FROM public.status_posts s LEFT JOIN public.profiles p ON p.id = s.user_id
      WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL
      UNION ALL
      SELECT m.kind::text, m.sender_id, COALESCE(p.full_name,''), COALESCE(m.body, m.kind::text), m.latitude, m.longitude, m.created_at
      FROM public.messages m LEFT JOIN public.profiles p ON p.id = m.sender_id
      WHERE m.latitude IS NOT NULL AND m.longitude IS NOT NULL AND m.deleted_at IS NULL
    ) x ORDER BY x.ca DESC LIMIT 100;
END; $$;
REVOKE ALL ON FUNCTION public.control_room_uploads() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.control_room_uploads() TO authenticated;
