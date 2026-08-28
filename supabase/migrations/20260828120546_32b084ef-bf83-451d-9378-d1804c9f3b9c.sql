-- 1. Backfill usernames for existing profiles
UPDATE public.profiles
SET username = 'user_' || lpad((floor(random() * 100000))::int::text, 5, '0') || substr(replace(id::text,'-',''), 1, 4)
WHERE username IS NULL OR btrim(username) = '';

-- 2. Case-insensitive uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL AND btrim(username) <> '';

-- 3. Availability check used by the signup form
CREATE OR REPLACE FUNCTION public.username_available(_username text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _username IS NULL OR btrim(_username) = '' THEN false
    WHEN _username !~ '^[a-zA-Z0-9_.]{3,24}$' THEN false
    ELSE NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE lower(p.username) = lower(btrim(_username))
    )
  END
$$;

GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated, service_role;

-- 4. Signup trigger: store the chosen username, fall back to an automatic one
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _wanted text;
  _final text;
BEGIN
  _wanted := lower(btrim(COALESCE(NEW.raw_user_meta_data ->> 'username', '')));
  _wanted := regexp_replace(_wanted, '[^a-z0-9_.]', '', 'g');

  IF length(_wanted) < 3
     OR EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.username) = _wanted) THEN
    LOOP
      _final := 'user_' || lpad((floor(random() * 100000))::int::text, 5, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.username) = _final);
    END LOOP;
  ELSE
    _final := _wanted;
  END IF;

  INSERT INTO public.profiles (
    id, full_name, first_name, last_name, patronymic, phone, city, region, region_code,
    settlement_id, lat, lng, birth_date, avatar_url, username,
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
    _final,
    CASE WHEN NEW.raw_user_meta_data ->> 'consent_privacy' = 'true' THEN now() END,
    CASE WHEN NEW.raw_user_meta_data ->> 'consent_terms' = 'true' THEN now() END,
    CASE WHEN NEW.raw_user_meta_data ->> 'consent_data' = 'true' THEN now() END
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;