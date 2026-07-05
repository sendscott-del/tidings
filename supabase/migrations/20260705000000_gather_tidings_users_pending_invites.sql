-- The Gather hub lists Tidings users from public.users. But an invited user
-- exists there (role 'viewer', via the handle_new_user trigger on
-- auth.users) before they accept, so the hub couldn't tell an accepted user
-- apart from one who was only just invited. Surface the pending invite here:
-- return whether a live invite is outstanding, and the role it was staged with
-- (which invite-accept applies on acceptance).
DROP FUNCTION IF EXISTS public.gather_tidings_users();

CREATE OR REPLACE FUNCTION public.gather_tidings_users()
 RETURNS TABLE(
   id uuid,
   email text,
   full_name text,
   role text,
   ward text,
   pending boolean,
   invited_role text
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    u.id,
    u.email,
    u.full_name,
    u.role,
    u.ward,
    (ti.id IS NOT NULL) AS pending,
    ti.role            AS invited_role
  FROM public.users u
  LEFT JOIN LATERAL (
    SELECT i.id, i.role
    FROM public.tidings_invites i
    WHERE lower(i.email) = lower(u.email)
      AND i.accepted_at IS NULL
      AND i.revoked_at IS NULL
      AND i.expires_at > now()
    ORDER BY i.created_at DESC
    LIMIT 1
  ) ti ON true
  ORDER BY lower(u.email);
$function$;
