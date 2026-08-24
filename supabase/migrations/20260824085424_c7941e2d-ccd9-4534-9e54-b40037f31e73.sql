CREATE TABLE public.app_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  region_code text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'resident',
  roles text[] NOT NULL DEFAULT ARRAY['user']::text[],
  credits integer NOT NULL DEFAULT 0,
  total_credits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_users TO authenticated;
GRANT ALL ON public.app_users TO service_role;

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all users"
ON public.app_users FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

CREATE POLICY "Users can view own row"
ON public.app_users FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE OR REPLACE FUNCTION public.sync_app_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _roles text[];
  _kind text;
BEGIN
  SELECT COALESCE(array_agg(role::text ORDER BY role::text), ARRAY['user']::text[])
    INTO _roles FROM public.user_roles WHERE user_id = _user_id;

  _kind := CASE
    WHEN 'worker' = ANY(_roles) OR 'captain' = ANY(_roles) THEN 'worker'
    ELSE 'resident' END;

  INSERT INTO public.app_users (id, email, full_name, phone, city, region, region_code, kind, roles, credits, total_credits, created_at, updated_at)
  SELECT
    p.id,
    COALESCE((SELECT u.email FROM auth.users u WHERE u.id = p.id), ''),
    p.full_name, p.phone, p.city, p.region, p.region_code,
    _kind, _roles, p.credits, p.total_credits, p.created_at, now()
  FROM public.profiles p
  WHERE p.id = _user_id
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    city = EXCLUDED.city,
    region = EXCLUDED.region,
    region_code = EXCLUDED.region_code,
    kind = EXCLUDED.kind,
    roles = EXCLUDED.roles,
    credits = EXCLUDED.credits,
    total_credits = EXCLUDED.total_credits,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_sync_app_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_app_user(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_sync_app_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_app_user(COALESCE(NEW.user_id, OLD.user_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER sync_app_users_from_profiles
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_app_user_profile();

CREATE TRIGGER sync_app_users_from_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_app_user_role();

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.sync_app_user(r.id);
  END LOOP;
END $$;