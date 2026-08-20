CREATE TABLE IF NOT EXISTS public.email_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  purpose text NOT NULL DEFAULT 'signup',
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_otps_email_idx ON public.email_otps (lower(email), created_at DESC);
GRANT ALL ON public.email_otps TO service_role;
ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.email_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_masked text NOT NULL,
  purpose text NOT NULL DEFAULT 'signup',
  provider text NOT NULL DEFAULT 'resend',
  event text NOT NULL,
  status text NOT NULL DEFAULT '',
  http_status integer,
  error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_delivery_log_created_idx ON public.email_delivery_log (created_at DESC);
GRANT SELECT ON public.email_delivery_log TO authenticated;
GRANT ALL ON public.email_delivery_log TO service_role;
ALTER TABLE public.email_delivery_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_delivery_log_admin_select ON public.email_delivery_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

ALTER TABLE public.worker_applications
  ADD COLUMN IF NOT EXISTS applicant_age integer,
  ADD COLUMN IF NOT EXISTS parent_full_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS parent_contact text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS parent_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_doc_url text;