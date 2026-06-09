-- Tighten contacts SELECT visibility.
--
-- Before: policy "Authenticated can read contacts" used `auth.uid() IS NOT NULL`,
-- so ANY authenticated user could read every row in `contacts` — i.e. every
-- member's name and phone number, with no role or scope check. All real users
-- today are admin/sender leaders, so this had no visible effect for them, but it
-- means any non-leader account (e.g. an App Store / Play review demo account, or
-- a future read-only "viewer") would see all member PII.
--
-- After: only leader roles (admin, sender) can read contacts. This is a strict
-- tightening with ZERO behavior change for existing users (all 5 are admin or
-- sender) and closes PII exposure for non-leader accounts. Contact writes are
-- unchanged (still service-role / SECURITY DEFINER sync RPCs only).
--
-- Note: this does not add ward-level scoping between leaders — the stake
-- messaging tool intentionally lets every leader reach every member. Per-ward
-- contact scoping, if ever wanted, is a separate, larger change.

drop policy if exists "Authenticated can read contacts" on public.contacts;

create policy "Leaders can read contacts"
  on public.contacts
  for select
  using (public.get_user_role() = any (array['admin', 'sender']));
