
-- DEPOTS
CREATE TABLE public.depots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  region text NOT NULL DEFAULT '',
  region_code text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.depots TO authenticated;
GRANT ALL ON public.depots TO service_role;
ALTER TABLE public.depots ENABLE ROW LEVEL SECURITY;
CREATE POLICY depots_select ON public.depots FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_depots_region ON public.depots (region_code);

-- TEAMS
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_code text NOT NULL UNIQUE,
  depot_id uuid NOT NULL REFERENCES public.depots(id) ON DELETE CASCADE,
  region_code text NOT NULL DEFAULT '',
  captain_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  credits_balance integer NOT NULL DEFAULT 1000,
  daily_limit integer NOT NULL DEFAULT 1000,
  refill_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  admin_topups_today integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY teams_select ON public.teams FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_teams_region ON public.teams (region_code);

-- TEAM MEMBERS
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_captain boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_members_select ON public.team_members FOR SELECT TO authenticated USING (true);

-- CREDIT REQUESTS
CREATE TABLE public.credit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL DEFAULT 1000,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_requests TO authenticated;
GRANT ALL ON public.credit_requests TO service_role;
ALTER TABLE public.credit_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_requests_select ON public.credit_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- TEAM LIVE POSITIONS
CREATE TABLE public.team_positions (
  team_id uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  status text NOT NULL DEFAULT 'idle',
  target_report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.team_positions TO authenticated;
GRANT ALL ON public.team_positions TO service_role;
ALTER TABLE public.team_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_positions_select ON public.team_positions FOR SELECT TO authenticated USING (true);

-- REPORTS: depot routing
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS depot_id uuid REFERENCES public.depots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS region_code text NOT NULL DEFAULT '';

-- PROFILES: admin binding
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_region text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS admin_region_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS admin_city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS admin_activated_at timestamptz;
