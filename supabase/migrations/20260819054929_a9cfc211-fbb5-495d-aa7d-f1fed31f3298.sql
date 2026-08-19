-- Profiles: restrict full row access to owner
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Public leaderboard exposes only safe columns
CREATE OR REPLACE VIEW public.leaderboard
WITH (security_invoker = off) AS
  SELECT id, full_name, city, total_credits, approved_count
  FROM public.profiles;

GRANT SELECT ON public.leaderboard TO authenticated;

-- Storage: only owner or approved report photos are readable
DROP POLICY IF EXISTS report_photos_read ON storage.objects;
CREATE POLICY report_photos_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'reports'
    AND (
      owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.reports r
        WHERE r.photo_url = storage.objects.name
          AND r.approved = true
      )
    )
  );
