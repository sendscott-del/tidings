-- Security hardening (2026-06-12 code review)
-- 1. The gather_tidings_* mutators are SECURITY DEFINER and were EXECUTE-able by
--    anon/authenticated with NO internal auth check — anyone with the public anon
--    key could self-grant admin, dump all users, or delete users. They are only
--    ever called by the Gather hub bridge using service_role. Lock them down.
-- 2. Trigger/cron-only functions should never be directly invokable from the API.
-- 3. message_logs read policy was `auth.uid() IS NOT NULL`, exposing every
--    recipient phone number to any signed-in user (incl. viewers). Scope it to
--    admin/sender to match the contacts policy.

-- --- 1. gather_tidings_* mutators + bulk reader: service_role only -----------
REVOKE EXECUTE ON FUNCTION public.gather_tidings_grant_user(text, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gather_tidings_update_user(uuid, text, text)       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gather_tidings_revoke_user(uuid)                    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gather_tidings_users()                              FROM anon, authenticated;

-- --- 2. trigger / cron functions: not for direct API invocation --------------
REVOKE EXECUTE ON FUNCTION public.tidings_notify_push()              FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tidings_sync_role_to_shared()      FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_auth_email_to_public_users()  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tidings_rebuild_birthday_lists()   FROM anon, authenticated;

-- rate cache helper has no reason to be reachable pre-login
REVOKE EXECUTE ON FUNCTION public.get_current_rate_cents(text, text) FROM anon;

-- --- 3. message_logs read policy: admin/sender only -------------------------
DROP POLICY IF EXISTS "Authenticated can read message logs" ON public.message_logs;
CREATE POLICY "Admin or sender can read message logs" ON public.message_logs
  FOR SELECT TO authenticated
  USING (get_user_role() = ANY (ARRAY['admin', 'sender']));
