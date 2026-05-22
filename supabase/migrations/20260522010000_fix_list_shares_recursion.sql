-- 20260522010000_fix_list_shares_recursion.sql
-- Hotfix: split list_shares FOR ALL write policy into per-command (INSERT/DELETE).
-- A FOR ALL policy applies to SELECT too, and its USING clause did EXISTS on lists,
-- causing infinite recursion when reading lists (since the lists SELECT policy does
-- EXISTS back on list_shares). All SELECT on lists threw 42P17 until this fix.

DROP POLICY IF EXISTS list_shares_admin_or_creator_write ON public.list_shares;

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
