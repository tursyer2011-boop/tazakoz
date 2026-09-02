ALTER TABLE public.depots ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '';

WITH pool AS (
  SELECT num, row_number() OVER () AS rn FROM (
    SELECT g AS num FROM generate_series(100000, 999999) g ORDER BY random() LIMIT (SELECT count(*) FROM public.depots)
  ) s
), tgt AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn FROM public.depots
)
UPDATE public.depots d
SET code = 'TZK' || pool.num::text
FROM tgt JOIN pool ON pool.rn = tgt.rn
WHERE d.id = tgt.id;

UPDATE public.depots SET address = 'Казахстан, ' || region || ', ' || city WHERE address = '';

CREATE UNIQUE INDEX IF NOT EXISTS depots_code_key ON public.depots (code);

DO $$
DECLARE
  t RECORD;
  member_profile RECORD;
  target_depot RECORD;
BEGIN
  FOR t IN SELECT te.id, te.depot_id, te.captain_id FROM public.teams te LOOP
    SELECT p.id, p.city, p.region_code, p.lat, p.lng
      INTO member_profile
      FROM public.profiles p
      JOIN public.team_members tm ON tm.user_id = p.id
     WHERE tm.team_id = t.id
     ORDER BY tm.is_captain DESC
     LIMIT 1;
    CONTINUE WHEN member_profile IS NULL OR COALESCE(member_profile.region_code, '') = '';

    IF EXISTS (
      SELECT 1 FROM public.depots d
       WHERE d.id = t.depot_id AND d.region_code = member_profile.region_code
    ) THEN
      CONTINUE;
    END IF;

    SELECT d.* INTO target_depot
      FROM public.depots d
     WHERE d.active AND d.region_code = member_profile.region_code
     ORDER BY (lower(d.city) = lower(COALESCE(member_profile.city, ''))) DESC,
              COALESCE(abs(d.lat - member_profile.lat) + abs(d.lng - member_profile.lng), 999)
     LIMIT 1;
    CONTINUE WHEN target_depot IS NULL;

    UPDATE public.teams
       SET depot_id = target_depot.id, region_code = target_depot.region_code
     WHERE id = t.id;
    UPDATE public.team_positions
       SET lat = target_depot.lat, lng = target_depot.lng, updated_at = now()
     WHERE team_id = t.id;
  END LOOP;
END $$;