-- 20260522080000_contacts_sync_returns_jsonb.sql
-- PostgREST caps SETOF/TABLE-returning RPCs at db-max-rows (default 1000).
-- That cap was silently truncating the cross-app sync to 1000 of the ~3,244
-- contacts. A jsonb-returning function isn't a result set, so it sidesteps
-- the cap entirely.
--
-- Edge function consumers (Glean sync, Knit sync) don't need code changes —
-- the response body shape is identical (a JSON array of contact objects).

DROP FUNCTION IF EXISTS public.gather_tidings_contacts_for_sync();

CREATE OR REPLACE FUNCTION public.gather_tidings_contacts_for_sync()
  RETURNS jsonb
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
  SELECT coalesce(jsonb_agg(row), '[]'::jsonb) FROM (
    SELECT
      c.id,
      trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')) AS full_name,
      c.phone,
      c.email,
      c.unit_name,
      coalesce(c.callings, '{}'::text[]) AS callings,
      coalesce(c.opted_out, false) AS opted_out,
      coalesce(c.melchizedek, false) AS melchizedek,
      coalesce(c.relief_society, false) AS relief_society,
      coalesce(c.elders_quorum, false) AS elders_quorum,
      coalesce(c.young_women, false) AS young_women,
      coalesce(c.aaronic, false) AS aaronic,
      coalesce(c.primary_member, false) AS primary_member,
      coalesce(c.has_children, false) AS has_children,
      c.age_group,
      c.updated_at
    FROM public.contacts c
  ) row;
$fn$;

REVOKE EXECUTE ON FUNCTION public.gather_tidings_contacts_for_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gather_tidings_contacts_for_sync() TO service_role;
