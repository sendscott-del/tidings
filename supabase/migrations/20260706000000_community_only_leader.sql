-- Community-only leaders: view + send only community lists, no ward/stake access.

-- 1. Gate the stake directory by can_text_stake (mirrors community_contacts).
--    Backward-compatible: a null/absent can_text_stake still grants access, so
--    existing senders are unaffected; only an explicit false (community-only
--    leaders) is denied.
DROP POLICY IF EXISTS "Leaders can read contacts" ON public.contacts;
CREATE POLICY "Leaders can read contacts" ON public.contacts
  FOR SELECT TO authenticated
  USING (
    get_user_role() = 'admin'
    OR (
      get_user_role() = ANY (ARRAY['admin','sender'])
      AND COALESCE((get_user_permissions() ->> 'can_text_stake')::boolean, true) = true
    )
  );

-- 2. Add a community_leader flag to the Gather-hub Tidings users RPC.
DROP FUNCTION IF EXISTS public.gather_tidings_users();
CREATE OR REPLACE FUNCTION public.gather_tidings_users()
 RETURNS TABLE(id uuid, email text, full_name text, role text, ward text, pending boolean, invited_role text, community_leader boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    u.id, u.email, u.full_name, u.role, u.ward,
    (ti.id IS NOT NULL) AS pending,
    ti.role            AS invited_role,
    EXISTS (
      SELECT 1 FROM public.tidings_user_roles r
      WHERE r.user_id = u.id AND r.role_key = 'community_events_leader'
    )                  AS community_leader
  FROM public.users u
  LEFT JOIN LATERAL (
    SELECT i.id, i.role
    FROM public.tidings_invites i
    WHERE lower(i.email) = lower(u.email)
      AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
    ORDER BY i.created_at DESC
    LIMIT 1
  ) ti ON true
  ORDER BY lower(u.email);
$function$;

-- 3. Toggle a Tidings user's community-events-leader status from the Gather hub.
CREATE OR REPLACE FUNCTION public.gather_tidings_set_community_leader(p_email text, p_on boolean)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  select id into v_id from public.users where lower(email) = lower(p_email);
  if v_id is null then
    raise exception 'No Tidings user with email %', p_email using errcode = 'P0002';
  end if;

  if p_on then
    insert into public.tidings_user_roles (user_id, role_key)
    select v_id, 'community_events_leader'
    where not exists (
      select 1 from public.tidings_user_roles
      where user_id = v_id and role_key = 'community_events_leader'
    );

    update public.users
    set role = case when role = 'viewer' then 'sender' else role end,
        ward = 'Community',
        permissions = coalesce(permissions, '{}'::jsonb)
          || jsonb_build_object('can_text_community', true, 'can_text_stake', false)
    where id = v_id;
  else
    delete from public.tidings_user_roles
    where user_id = v_id and role_key = 'community_events_leader';

    update public.users
    set ward = null,
        permissions = coalesce(permissions, '{}'::jsonb)
          || jsonb_build_object('can_text_community', false, 'can_text_stake', true)
    where id = v_id;
  end if;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.gather_tidings_set_community_leader(text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.gather_tidings_set_community_leader(text, boolean) TO anon, authenticated, service_role;
