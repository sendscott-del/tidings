-- Invite-based user signup + user-managed profile (signature, full name, email).

-- 1. Invites table.
CREATE TABLE IF NOT EXISTS public.tidings_invites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  full_name    text,
  role         text NOT NULL CHECK (role IN ('admin', 'sender', 'viewer')),
  permissions  jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature    text,
  ward         text,
  token        text NOT NULL UNIQUE,
  expires_at   timestamptz NOT NULL,
  accepted_at  timestamptz,
  revoked_at   timestamptz,
  created_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tidings_invites_email_pending_idx
  ON public.tidings_invites (email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS tidings_invites_token_idx
  ON public.tidings_invites (token);

ALTER TABLE public.tidings_invites ENABLE ROW LEVEL SECURITY;

-- Admins can read/insert/update/delete invites.
DROP POLICY IF EXISTS "Admin can read invites" ON public.tidings_invites;
CREATE POLICY "Admin can read invites" ON public.tidings_invites
  FOR SELECT USING (get_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin can insert invites" ON public.tidings_invites;
CREATE POLICY "Admin can insert invites" ON public.tidings_invites
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin can update invites" ON public.tidings_invites;
CREATE POLICY "Admin can update invites" ON public.tidings_invites
  FOR UPDATE USING (get_user_role() = 'admin');

DROP POLICY IF EXISTS "Admin can delete invites" ON public.tidings_invites;
CREATE POLICY "Admin can delete invites" ON public.tidings_invites
  FOR DELETE USING (get_user_role() = 'admin');

-- The invite-accept edge function uses service role and bypasses RLS, so it
-- doesn't need a policy of its own.

COMMENT ON TABLE public.tidings_invites IS
  'Pending user invitations. Admin pre-stages role/ward/permissions/signature; the accept endpoint copies these onto the new public.users row so the invitee cannot tamper with their own access level.';

-- 2. Trigger to keep public.users.email in sync with auth.users.email.
--    This fires whenever auth.users.email changes (e.g. after a user confirms
--    a self-service email change from /profile). Without this, the public.users
--    row would carry a stale email.
CREATE OR REPLACE FUNCTION public.sync_auth_email_to_public_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.users SET email = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_auth_email_to_public_users ON auth.users;
CREATE TRIGGER trg_sync_auth_email_to_public_users
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_auth_email_to_public_users();

COMMENT ON FUNCTION public.sync_auth_email_to_public_users() IS
  'Mirrors auth.users.email into public.users.email so the app-side row stays consistent after a confirmed email change.';

-- 3. Public preview of an invite by token, callable by anon/authenticated.
--    Returns nothing for unknown/expired/accepted/revoked tokens, so an
--    attacker enumerating tokens learns nothing (and the token is 128 bits
--    of entropy, so enumeration is infeasible anyway).
CREATE OR REPLACE FUNCTION public.get_invite_preview(p_token text)
RETURNS TABLE (email text, role text, ward text, full_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT i.email, i.role, i.ward, i.full_name
  FROM public.tidings_invites i
  WHERE i.token = p_token
    AND i.accepted_at IS NULL
    AND i.revoked_at IS NULL
    AND i.expires_at > now()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_preview(text) TO anon, authenticated;
