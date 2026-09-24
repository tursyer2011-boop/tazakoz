DROP POLICY IF EXISTS "depots public read" ON public.depots;
DROP POLICY IF EXISTS depots_select ON public.depots;
CREATE POLICY depots_active_read ON public.depots FOR SELECT TO anon, authenticated
  USING (active = true AND region_code = '09');
CREATE POLICY depots_staff_read ON public.depots FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'moderator'::app_role));

DROP POLICY IF EXISTS teams_select ON public.teams;
CREATE POLICY teams_select ON public.teams FOR SELECT TO authenticated
  USING (private.is_team_member(id, auth.uid())
    OR private.has_role(auth.uid(), 'admin'::app_role)
    OR private.has_role(auth.uid(), 'moderator'::app_role));

DROP POLICY IF EXISTS report_photos_read ON storage.objects;
CREATE POLICY report_photos_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'reports' AND (
    owner = auth.uid()
    OR (storage.foldername(name))[1] = (auth.uid())::text
    OR private.has_role(auth.uid(), 'admin'::app_role)
    OR private.has_role(auth.uid(), 'moderator'::app_role)
    OR EXISTS (SELECT 1 FROM public.reports r
      WHERE (r.photo_url = objects.name OR r.cleaned_photo_url = objects.name)
        AND (r.user_id = auth.uid() OR r.assigned_worker_id = auth.uid()))
  ));