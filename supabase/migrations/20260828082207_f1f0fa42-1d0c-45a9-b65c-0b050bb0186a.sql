CREATE OR REPLACE FUNCTION public.get_leaderboard(_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, full_name text, city text, total_credits integer, approved_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.full_name, p.city, p.total_credits, p.approved_count
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id AND ur.role IN ('admin','moderator')
  )
  ORDER BY p.total_credits DESC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 100), 1), 100)
$function$;