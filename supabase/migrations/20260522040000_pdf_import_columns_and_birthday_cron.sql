-- v0.26.0 — PDF directory import + expanded auto-lists
-- Adds columns sourced from the LCR 12-column landscape PDF report,
-- plus a monthly birthday-list rotation driven by pg_cron.
--
-- Schema additions are purely additive: existing `sex` and the boolean cluster
-- (melchizedek/aaronic/relief_society/elders_quorum/young_women/primary_member)
-- remain in place so the legacy CSV parser keeps working unchanged.

alter table public.contacts
  add column if not exists birth_month int,
  add column if not exists birth_day int,
  add column if not exists class_assignment text[] default '{}'::text[],
  add column if not exists is_endowed boolean default false,
  add column if not exists is_returned_missionary boolean default false,
  add column if not exists is_single boolean default false,
  add column if not exists priesthood text,
  add column if not exists gender text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'contacts_birth_month_check'
  ) then
    alter table public.contacts
      add constraint contacts_birth_month_check
      check (birth_month is null or (birth_month between 1 and 12));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contacts_birth_day_check'
  ) then
    alter table public.contacts
      add constraint contacts_birth_day_check
      check (birth_day is null or (birth_day between 1 and 31));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contacts_priesthood_check'
  ) then
    alter table public.contacts
      add constraint contacts_priesthood_check
      check (priesthood is null or priesthood in ('Aaronic','Melchizedek','Unordained'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contacts_gender_check'
  ) then
    alter table public.contacts
      add constraint contacts_gender_check
      check (gender is null or gender in ('M','F'));
  end if;
end $$;

create index if not exists contacts_birth_month_unit_idx
  on public.contacts (birth_month, unit_name);

-- ---------------------------------------------------------------------------
-- Birthday list rotation
--
-- One rolling list per ward named '<Ward> — Birthdays This Month'.
-- Membership is recomputed on every contact import (by the import-contacts
-- edge function) and on the 1st of each month by pg_cron.
-- ---------------------------------------------------------------------------

create or replace function public.tidings_rebuild_birthday_lists()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_month int := extract(month from (now() at time zone 'America/Chicago'))::int;
  ward record;
  list_uuid uuid;
begin
  for ward in
    select distinct unit_name
    from public.contacts
    where unit_name is not null and unit_name <> ''
  loop
    -- Upsert the per-ward rolling list
    select id into list_uuid
    from public.lists
    where name = ward.unit_name || ' — Birthdays This Month'
      and database = 'stake'
      and is_auto = true
    limit 1;

    if list_uuid is null then
      insert into public.lists (name, database, is_auto, ward_scope)
      values (ward.unit_name || ' — Birthdays This Month', 'stake', true, ward.unit_name)
      returning id into list_uuid;
    end if;

    -- Reset membership
    delete from public.list_members where list_id = list_uuid;

    -- Repopulate with this month's birthdays for this ward
    insert into public.list_members (list_id, contact_id, contact_type)
    select list_uuid, c.id, 'stake'
    from public.contacts c
    where c.unit_name = ward.unit_name
      and c.birth_month = current_month
      and c.phone is not null
      and coalesce(c.opted_out, false) = false;
  end loop;
end $$;

grant execute on function public.tidings_rebuild_birthday_lists() to service_role;

-- Schedule the monthly rotation. 06:01 UTC on the 1st = 00:01/01:01 Chicago
-- depending on DST. Close enough — the list is not time-critical to the minute.
do $$ begin
  -- Remove any prior schedule with the same name so re-running the migration
  -- in a branch / on a reset doesn't create duplicates.
  if exists (select 1 from cron.job where jobname = 'tidings-birthday-rotation') then
    perform cron.unschedule('tidings-birthday-rotation');
  end if;

  perform cron.schedule(
    'tidings-birthday-rotation',
    '1 6 1 * *',
    $cmd$ select public.tidings_rebuild_birthday_lists() $cmd$
  );
end $$;
