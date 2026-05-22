-- 20260522030000_contacts_for_sync_rpc.sql
-- Service-role RPC that returns the Tidings contacts directory in a shape
-- Glean (and later Knit) can ingest. Only callable with the Tidings service
-- role key — EXECUTE is restricted to service_role.

CREATE OR REPLACE FUNCTION public.gather_tidings_contacts_for_sync()
  RETURNS TABLE(
    id uuid,
    full_name text,
    phone text,
    email text,
    unit_name text,
    callings text[],
    opted_out boolean,
    melchizedek boolean,
    relief_society boolean,
    elders_quorum boolean,
    young_women boolean,
    aaronic boolean,
    primary_member boolean,
    has_children boolean,
    age_group text,
    updated_at timestamptz
  )
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
  SELECT
    c.id,
    trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')) AS full_name,
    c.phone,
    c.email,
    c.unit_name,
    coalesce(c.callings, '{}'::text[]) AS callings,
    coalesce(c.opted_out, false) AS opted_out,
    coalesce(c.melchizedek, false),
    coalesce(c.relief_society, false),
    coalesce(c.elders_quorum, false),
    coalesce(c.young_women, false),
    coalesce(c.aaronic, false),
    coalesce(c.primary_member, false),
    coalesce(c.has_children, false),
    c.age_group,
    c.updated_at
  FROM public.contacts c;
$fn$;

REVOKE EXECUTE ON FUNCTION public.gather_tidings_contacts_for_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gather_tidings_contacts_for_sync() TO service_role;

COMMENT ON FUNCTION public.gather_tidings_contacts_for_sync() IS
  'Service-role-only directory dump for cross-project sync (Glean / Knit). Bypasses contacts RLS via SECURITY DEFINER.';
