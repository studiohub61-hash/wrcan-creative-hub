CREATE OR REPLACE FUNCTION public.shares_conversation(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_participants x
    JOIN public.conversation_participants y ON y.conversation_id = x.conversation_id
    WHERE x.user_id = _a AND y.user_id = _b)
$$;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_visible" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR is_public OR public.has_role(auth.uid(), 'admin') OR public.shares_conversation(auth.uid(), id));

DROP POLICY IF EXISTS "Signed-in users read logs" ON public.attendance_logs;
CREATE POLICY "Owners read logs" ON public.attendance_logs FOR SELECT TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Signed-in users read participants" ON public.participants;
DROP POLICY IF EXISTS "Signed-in users update participant status" ON public.participants;
CREATE POLICY "Owners read participants" ON public.participants FOR SELECT TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners update participants" ON public.participants FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "avatars_read_authenticated" ON storage.objects;
CREATE POLICY "avatars_read_visible" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (
  (storage.foldername(name))[1] = auth.uid()::text
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id::text = (storage.foldername(name))[1]
    AND (p.is_public OR public.shares_conversation(auth.uid(), p.id)))));

DROP POLICY IF EXISTS "chat_media_read_authenticated" ON storage.objects;
CREATE POLICY "chat_media_read_participants" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-media' AND (
  (storage.foldername(name))[1] = auth.uid()::text
  OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id::text = (storage.foldername(name))[2]
    AND public.is_participant(c.id, auth.uid()))));

DROP POLICY IF EXISTS "Talent media is readable" ON storage.objects;
CREATE POLICY "Talent media readable when shared" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'talent' AND (
  (storage.foldername(name))[1] = (SELECT auth.uid())::text
  OR EXISTS (SELECT 1 FROM public.talent_reels r WHERE r.media_path = name AND r.is_public)
  OR (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.status_posts s WHERE s.media_path = name AND s.expires_at > now()))));