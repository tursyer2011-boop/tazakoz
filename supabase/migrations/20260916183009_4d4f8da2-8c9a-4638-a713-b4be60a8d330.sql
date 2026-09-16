ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS photo_hash text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS reports_photo_hash_idx ON public.reports (photo_hash);
CREATE INDEX IF NOT EXISTS reports_user_created_idx ON public.reports (user_id, created_at DESC);