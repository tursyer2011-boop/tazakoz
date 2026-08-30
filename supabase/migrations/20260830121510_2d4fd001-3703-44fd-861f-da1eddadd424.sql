DROP POLICY IF EXISTS report_photos_read ON storage.objects;
CREATE POLICY report_photos_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'reports'
  AND (
    owner = auth.uid()
    OR (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.photo_url = objects.name AND r.approved = true
    )
    OR EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.cleaned_photo_url = objects.name
        AND (r.user_id = auth.uid() OR r.assigned_worker_id = auth.uid())
    )
  )
);