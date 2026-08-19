ALTER TABLE public.worker_applications
  ADD COLUMN IF NOT EXISTS iin text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS doc_type text NOT NULL DEFAULT 'id_card',
  ADD COLUMN IF NOT EXISTS doc_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS doc_front_url text,
  ADD COLUMN IF NOT EXISTS doc_back_url text,
  ADD COLUMN IF NOT EXISTS selfie_url text,
  ADD COLUMN IF NOT EXISTS father_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mother_name text NOT NULL DEFAULT '';

DROP POLICY IF EXISTS worker_docs_insert ON storage.objects;
CREATE POLICY worker_docs_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'worker-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS worker_docs_select ON storage.objects;
CREATE POLICY worker_docs_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'worker-docs' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  )
);