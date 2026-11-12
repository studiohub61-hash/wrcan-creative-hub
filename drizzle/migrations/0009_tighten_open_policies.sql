DROP POLICY IF EXISTS "ratings_read" ON public.service_ratings;
CREATE POLICY "ratings_read_own_or_admin" ON public.service_ratings FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "donor_contacts_insert_any" ON public.donor_contacts;
CREATE POLICY "donor_contacts_insert_for_donation" ON public.donor_contacts FOR INSERT TO public
WITH CHECK (EXISTS (SELECT 1 FROM public.donations d WHERE d.id = donation_id
  AND (d.donor_user_id IS NULL OR d.donor_user_id = auth.uid())
  AND d.created_at > now() - interval '1 hour'));

DROP POLICY IF EXISTS "dpr_insert_any" ON public.data_purchase_requests;
CREATE POLICY "dpr_insert_pending" ON public.data_purchase_requests FOR INSERT TO public
WITH CHECK (status = 'pending'
  AND length(trim(company_name)) BETWEEN 1 AND 200
  AND length(trim(contact_name)) BETWEEN 1 AND 200
  AND contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(contact_email) <= 255
  AND length(trim(dataset)) BETWEEN 1 AND 200
  AND (record_count IS NULL OR record_count > 0));

DROP POLICY IF EXISTS "Anyone can see reel likes" ON public.reel_likes;
CREATE POLICY "Likes visible on public or own reels" ON public.reel_likes FOR SELECT TO public
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.talent_reels r WHERE r.id = reel_id AND (r.is_public OR r.user_id = auth.uid())));