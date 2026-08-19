-- Roles
CREATE TYPE public.app_role AS ENUM ('user','volunteer','worker','captain','moderator','admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY user_roles_select_own ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY user_roles_admin_manage ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS patronymic text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS region_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS settlement_id bigint,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS consent_privacy_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_terms_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_data_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- Auto-create profile from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (
    id, full_name, first_name, last_name, patronymic, phone, city, region, region_code,
    settlement_id, lat, lng, birth_date, avatar_url,
    consent_privacy_at, consent_terms_at, consent_data_at
  )
  VALUES (
    NEW.id,
    TRIM(COALESCE(NEW.raw_user_meta_data ->> 'last_name','') || ' ' || COALESCE(NEW.raw_user_meta_data ->> 'first_name','') || ' ' || COALESCE(NEW.raw_user_meta_data ->> 'patronymic','')),
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'patronymic', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'city', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'region', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'region_code', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'settlement_id','')::bigint,
    NULLIF(NEW.raw_user_meta_data ->> 'lat','')::double precision,
    NULLIF(NEW.raw_user_meta_data ->> 'lng','')::double precision,
    NULLIF(NEW.raw_user_meta_data ->> 'birth_date','')::date,
    NEW.raw_user_meta_data ->> 'avatar_url',
    CASE WHEN NEW.raw_user_meta_data ->> 'consent_privacy' = 'true' THEN now() END,
    CASE WHEN NEW.raw_user_meta_data ->> 'consent_terms' = 'true' THEN now() END,
    CASE WHEN NEW.raw_user_meta_data ->> 'consent_data' = 'true' THEN now() END
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;