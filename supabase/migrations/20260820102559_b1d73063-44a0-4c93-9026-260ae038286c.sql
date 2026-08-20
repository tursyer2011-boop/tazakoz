CREATE TABLE IF NOT EXISTS public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credits integer not null check (credits > 0),
  amount_kzt integer not null,
  full_name text not null,
  phone text not null,
  status text not null default 'pending',
  decided_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payouts read" ON public.payout_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own payouts insert" ON public.payout_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.point_checkins (
  id uuid primary key default gen_random_uuid(),
  depot_id uuid not null references public.depots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'resident',
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT ON public.point_checkins TO authenticated;
GRANT ALL ON public.point_checkins TO service_role;
ALTER TABLE public.point_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checkins read" ON public.point_checkins FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own checkins insert" ON public.point_checkins FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

GRANT SELECT ON public.depots TO anon, authenticated;
DROP POLICY IF EXISTS "depots public read" ON public.depots;
CREATE POLICY "depots public read" ON public.depots FOR SELECT TO anon, authenticated USING (true);