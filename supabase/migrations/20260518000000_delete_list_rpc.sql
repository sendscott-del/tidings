-- delete_list RPC: SECURITY DEFINER function that bypasses the existing
-- lists DELETE row-level security policy, which silently fails when a list
-- has 0 members (the policy's USING clause references list_members in a
-- way that empty lists don't satisfy, even for admins). This RPC enforces
-- the intended permission model directly inside the function:
--
--   - admins (users.role = 'admin')        -> may delete any custom list
--   - stake pool (users.ward = 'Stake')    -> may delete any custom list
--   - ward senders                         -> may delete only lists whose
--                                              ward_scope matches their ward
--
-- Auto-lists (is_auto = true) are never deletable through this RPC; they
-- are rebuilt by the LCR import flow and would just come back anyway.

create or replace function public.delete_list(p_list_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_ward text;
  v_list_ward text;
  v_is_auto boolean;
  v_deleted integer;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  select role, ward into v_role, v_ward
  from public.users
  where id = auth.uid();

  if v_role is null then
    raise exception 'caller has no app user record' using errcode = '42501';
  end if;

  select ward_scope, is_auto into v_list_ward, v_is_auto
  from public.lists
  where id = p_list_id;

  if not found then
    return 0;
  end if;

  if v_is_auto then
    raise exception 'auto-lists cannot be deleted; re-import the LCR CSV instead' using errcode = '42501';
  end if;

  if v_role = 'admin' or v_ward = 'Stake' or v_list_ward is not distinct from v_ward then
    delete from public.list_members where list_id = p_list_id;
    delete from public.lists where id = p_list_id;
    get diagnostics v_deleted = row_count;
    return v_deleted;
  end if;

  raise exception 'not permitted to delete this list' using errcode = '42501';
end;
$$;

revoke all on function public.delete_list(uuid) from public;
grant execute on function public.delete_list(uuid) to authenticated;
