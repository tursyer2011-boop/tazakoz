
CREATE POLICY "report_photos_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'reports');
CREATE POLICY "report_photos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'reports' AND owner = auth.uid());
