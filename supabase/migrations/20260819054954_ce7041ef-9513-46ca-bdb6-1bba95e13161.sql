DROP VIEW IF EXISTS public.leaderboard;

CREATE OR REPLACE FUNCTION public.get_leaderboard(_limit integer DEFAULT 100)
RETURNS TABLE (id uuid, full_name text, city text, total_credits integer, approved_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.city, p.total_credits, p.approved_count
  FROM public.profiles p
  ORDER BY p.total_credits DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 100), 1), 100)
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer) TO authenticated;
