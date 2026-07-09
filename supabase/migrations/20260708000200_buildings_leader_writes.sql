-- Community Events Leaders manage buildings too (add/rename/delete).
DROP POLICY IF EXISTS "Admin can insert buildings" ON public.buildings;
CREATE POLICY "Authorized users can insert buildings" ON public.buildings
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin' OR (get_user_permissions() ->> 'can_text_community')::boolean = true);

DROP POLICY IF EXISTS "Admin can update buildings" ON public.buildings;
CREATE POLICY "Authorized users can update buildings" ON public.buildings
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin' OR (get_user_permissions() ->> 'can_text_community')::boolean = true)
  WITH CHECK (get_user_role() = 'admin' OR (get_user_permissions() ->> 'can_text_community')::boolean = true);

DROP POLICY IF EXISTS "Admin can delete buildings" ON public.buildings;
CREATE POLICY "Authorized users can delete buildings" ON public.buildings
  FOR DELETE TO authenticated
  USING (get_user_role() = 'admin' OR (get_user_permissions() ->> 'can_text_community')::boolean = true);
