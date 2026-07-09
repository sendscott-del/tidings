-- Community Events Leaders manage the community directory, not just read it.
-- Mirror the SELECT policy: admin OR can_text_community.
DROP POLICY IF EXISTS "Admin can insert community contacts" ON public.community_contacts;
CREATE POLICY "Authorized users can insert community contacts" ON public.community_contacts
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin' OR (get_user_permissions() ->> 'can_text_community')::boolean = true);

DROP POLICY IF EXISTS "Admin can update community contacts" ON public.community_contacts;
CREATE POLICY "Authorized users can update community contacts" ON public.community_contacts
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin' OR (get_user_permissions() ->> 'can_text_community')::boolean = true)
  WITH CHECK (get_user_role() = 'admin' OR (get_user_permissions() ->> 'can_text_community')::boolean = true);

DROP POLICY IF EXISTS "Admin can delete community contacts" ON public.community_contacts;
CREATE POLICY "Authorized users can delete community contacts" ON public.community_contacts
  FOR DELETE TO authenticated
  USING (get_user_role() = 'admin' OR (get_user_permissions() ->> 'can_text_community')::boolean = true);
