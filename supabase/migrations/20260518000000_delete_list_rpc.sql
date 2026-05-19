-- delete_list RPC: provides a deterministic, observable delete path so the
-- client can distinguish "deleted" from "not found" from "not permitted",
-- instead of the previous direct DELETE which silently returns 0 rows when
-- the row-level policy declines (the same status as a successful delete
-- of an already-gone row). Permission semantics mirror the existing
-- lists DELETE row-level policy: callers whose users.role is 'admin' or
-- 'sender' may delete any custom list. Auto-lists are never deletable
-- through this RPC (they would be rebuilt by the next LCR import).

create or replace function public.delete_list(p_list_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_is_auto boolean;
  v_deleted integer;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  select role into v_role
  from public.users
  where id = auth.uid();

  if v_role is null or v_role not in ('admin', 'sender') then
    raise exception 'not permitted to delete lists' using errcode = '42501';
  end if;

  select is_auto into v_is_auto
  from public.lists
  where id = p_list_id;

  if not found then
    return 0;
  end if;

  if v_is_auto then
    raise exception 'auto-lists cannot be deleted; re-import the LCR CSV instead' using errcode = '42501';
  end if;

  delete from public.list_members where list_id = p_list_id;
  delete from public.lists where id = p_list_id;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.delete_list(uuid) from public;
grant execute on function public.delete_list(uuid) to authenticated;
