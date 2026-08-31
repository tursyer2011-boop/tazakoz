CREATE TABLE IF NOT EXISTS public.admin_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  region text NOT NULL DEFAULT '',
  region_code text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_invites_email_active_idx
  ON public.admin_invites (lower(email)) WHERE used_at IS NULL;

GRANT SELECT ON public.admin_invites TO authenticated;
GRANT ALL ON public.admin_invites TO service_role;

ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_invites_select_staff" ON public.admin_invites;
CREATE POLICY "admin_invites_select_staff"
  ON public.admin_invites FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));