-- 20260522000000_callings_and_list_sharing.sql
-- Gathered suite changes for Tidings, 2026-05-22.
-- 1. contacts.callings text[]  — for Glean/Knit auto-grant by calling
-- 2. lists.created_by uuid     — to make custom lists private-to-creator until shared
-- 3. tidings_user_roles        — local mirror of the shared gather_user_roles, for fast RLS
-- 4. list_shares               — explicit per-list share grants (by user or by role)
-- 5. RLS tightening on lists / list_members / messages / inbound_messages

-- ============ 1. Callings on contacts ============
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS callings text[] DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS contacts_callings_gin_idx ON public.contacts USING gin (callings);

COMMENT ON COLUMN public.contacts.callings IS 'Current callings held by this contact. Used by Glean (auto-grant access to Bishopric / EQ Pres / RS Pres / Welfare Specialist) and Knit. Free-text by design until LCR import is wired.';

-- ============ 2. lists.created_by ============
ALTER TABLE public.lists
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id);

COMMENT ON COLUMN public.lists.created_by IS 'Tidings user who created this custom list. NULL for auto-lists (is_auto=true). Custom lists are visible only to creator + admins + entries in list_shares.';

-- ============ 3. Local role mirror ============
-- Mirror of the shared gather_user_roles, scoped to Tidings auth users.
-- Maintained by the admin UI via a Tidings RPC that calls the shared project's RPC and writes here.
CREATE TABLE IF NOT EXISTS public.tidings_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_key text NOT NULL,
  ward text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES public.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS tidings_user_roles_unique
  ON public.tidings_user_roles(user_id, role_key, COALESCE(ward, ''));

ALTER TABLE public.tidings_user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tidings_user_roles_read ON public.tidings_user_roles;
CREATE POLICY tidings_user_roles_read ON public.tidings_user_roles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS tidings_user_roles_admin_write ON public.tidings_user_roles;
CREATE POLICY tidings_user_roles_admin_write ON public.tidings_user_roles
  FOR ALL TO authenticated
  USING      (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- Helper: current user's role keys (fast, in-project)
CREATE OR REPLACE FUNCTION public.tidings_current_user_role_keys()
  RETURNS text[]
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
  SELECT COALESCE(array_agg(role_key), '{}'::text[])
  FROM public.tidings_user_roles
  WHERE user_id = auth.uid();
$fn$;

-- ============ 4. list_shares ============
CREATE TABLE IF NOT EXISTS public.list_shares (
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('user','role')),
  scope_value text NOT NULL,
  granted_by uuid REFERENCES public.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, scope_type, scope_value)
);

CREATE INDEX IF NOT EXISTS list_shares_lookup_idx
  ON public.list_shares(scope_type, scope_value);

ALTER TABLE public.list_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS list_shares_read ON public.list_shares;
CREATE POLICY list_shares_read ON public.list_shares
  FOR SELECT TO authenticated USING (true);

-- IMPORTANT: this is split into per-command (INSERT, DELETE) rather than FOR ALL.
-- A FOR ALL policy also applies to SELECT, and the USING clause's EXISTS on `lists`
-- triggers the lists SELECT policy, which does EXISTS back on list_shares, causing
-- "infinite recursion detected in policy for relation lists". Per-command policies
-- only run for that command and avoid the loop.
DROP POLICY IF EXISTS list_shares_admin_or_creator_write ON public.list_shares;
DROP POLICY IF EXISTS list_shares_admin_or_creator_insert ON public.list_shares;
DROP POLICY IF EXISTS list_shares_admin_or_creator_delete ON public.list_shares;

CREATE POLICY list_shares_admin_or_creator_insert ON public.list_shares
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() = 'admin'
    OR EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_id AND l.created_by = auth.uid())
  );

CREATE POLICY list_shares_admin_or_creator_delete ON public.list_shares
  FOR DELETE TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_id AND l.created_by = auth.uid())
  );

COMMENT ON TABLE public.list_shares IS 'Per-list visibility grants. scope_type=user: scope_value is a tidings users.id; scope_type=role: scope_value is a gather_roles_catalog.role_key.';

-- ============ 5. Visibility helper ============
-- A list is visible to the current user iff:
--   - auto-list, OR
--   - they are admin, OR
--   - they are the creator, OR
--   - there's a user-share to them, OR
--   - there's a role-share to a role they hold.
CREATE OR REPLACE FUNCTION public.tidings_can_see_list(p_list_id uuid)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = p_list_id
      AND (
        l.is_auto = true
        OR public.get_user_role() = 'admin'
        OR l.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.list_shares s
          WHERE s.list_id = l.id
            AND (
              (s.scope_type = 'user' AND s.scope_value = auth.uid()::text)
              OR (s.scope_type = 'role' AND s.scope_value = ANY(public.tidings_current_user_role_keys()))
            )
        )
      )
  );
$fn$;

-- ============ 6. Tighten lists / list_members / messages / inbound_messages RLS ============

DROP POLICY IF EXISTS "Authenticated can read lists" ON public.lists;
CREATE POLICY "Authenticated can read scoped lists" ON public.lists
  FOR SELECT TO authenticated
  USING (
    is_auto = true
    OR public.get_user_role() = 'admin'
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.list_shares s
      WHERE s.list_id = lists.id
        AND (
          (s.scope_type = 'user' AND s.scope_value = auth.uid()::text)
          OR (s.scope_type = 'role' AND s.scope_value = ANY(public.tidings_current_user_role_keys()))
        )
    )
  );

DROP POLICY IF EXISTS "Authenticated can read list members" ON public.list_members;
CREATE POLICY "Authenticated can read scoped list members" ON public.list_members
  FOR SELECT TO authenticated
  USING (public.tidings_can_see_list(list_id));

-- Messages: same scoping — if you can't see any of the lists this message was sent to, you can't see the message.
-- Admin and the original sender always see their own messages regardless.
DROP POLICY IF EXISTS "Authenticated can read messages" ON public.messages;
CREATE POLICY "Authenticated can read scoped messages" ON public.messages
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR sent_by = auth.uid()
    OR (
      list_ids IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM unnest(list_ids) AS lid
        WHERE public.tidings_can_see_list(lid)
      )
    )
  );

-- Inbound messages: visible to anyone who can see at least one list the contact belongs to.
-- Admin sees everything.
DROP POLICY IF EXISTS "Authenticated can read inbound messages" ON public.inbound_messages;
CREATE POLICY "Authenticated can read scoped inbound messages" ON public.inbound_messages
  FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR (
      contact_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.list_members lm
        WHERE lm.contact_id = inbound_messages.contact_id
          AND public.tidings_can_see_list(lm.list_id)
      )
    )
  );

DROP POLICY IF EXISTS "Authenticated can update inbound messages" ON public.inbound_messages;
CREATE POLICY "Authenticated can update scoped inbound messages" ON public.inbound_messages
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role() = 'admin'
    OR (
      contact_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.list_members lm
        WHERE lm.contact_id = inbound_messages.contact_id
          AND public.tidings_can_see_list(lm.list_id)
      )
    )
  );

-- Backfill created_by for existing custom lists: NULL (no creator known). Auto-lists already null is fine.
-- Admins can edit/share these. New custom lists going forward will set created_by from the client.
