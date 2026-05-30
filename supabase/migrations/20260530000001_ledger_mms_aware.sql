-- Rewrite ward-usage RPCs to:
--   1. Distinguish MMS (messages.media_urls non-empty) from SMS at the row level
--   2. Read per-unit rates from tidings_rate_cache instead of a hardcoded 0.79
--
-- This is a retroactive change: historical sends are recomputed under the new
-- model on the next call, so previously-undercharged MMS quarters will now
-- show their corrected (higher) used_cents. Intentional per design decision
-- 2026-05-30.

create or replace function public.get_ward_usage_cents(p_ward text)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_caller_ward text;
  v_caller_role text;
  v_sms_rate numeric;
  v_mms_rate numeric;
begin
  select ward, role into v_caller_ward, v_caller_role
  from public.users where id = auth.uid();

  if v_caller_ward is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if v_caller_role <> 'admin' and v_caller_ward <> p_ward then
    raise exception 'Cross-ward access denied' using errcode = '42501';
  end if;

  v_sms_rate := public.get_current_rate_cents('sms');
  v_mms_rate := public.get_current_rate_cents('mms');

  return coalesce((
    select sum(
      case
        when coalesce(cardinality(m.media_urls), 0) > 0
          then v_mms_rate
        else greatest(1::numeric, ceil(length(m.body)::numeric / 160)) * v_sms_rate
      end
    )
    from public.message_logs ml
    join public.messages m on m.id = ml.message_id
    join public.users u on u.id = m.sent_by
    where ml.status in ('sent', 'failed')
      and ml.sent_at >= date_trunc('quarter', (now() at time zone 'America/Chicago'))
      and u.ward = p_ward
  ), 0)::numeric;
end;
$function$;

create or replace function public.get_ward_usage_history(p_ward text, p_quarters_back integer default 4)
returns table(quarter_label text, quarter_start timestamptz, used_cents numeric)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_sms_rate numeric;
  v_mms_rate numeric;
begin
  v_sms_rate := public.get_current_rate_cents('sms');
  v_mms_rate := public.get_current_rate_cents('mms');

  return query
  with quarters as (
    select generate_series(0, greatest(1, p_quarters_back) - 1) as q_offset
  ),
  ranges as (
    select
      (date_trunc('quarter', (now() at time zone 'America/Chicago')) - (q.q_offset || ' months')::interval * 3) as q_start_local,
      ((date_trunc('quarter', (now() at time zone 'America/Chicago')) - (q.q_offset || ' months')::interval * 3) + interval '3 months') as q_end_local
    from quarters q
  )
  select
    'Q' || extract(quarter from r.q_start_local)::text || ' ' || extract(year from r.q_start_local)::text as quarter_label,
    (r.q_start_local at time zone 'America/Chicago') as quarter_start,
    coalesce(sum(
      case
        when m.id is null then 0
        when coalesce(cardinality(m.media_urls), 0) > 0 then v_mms_rate
        else greatest(1::numeric, ceil(length(m.body)::numeric / 160)) * v_sms_rate
      end
    ), 0)::numeric as used_cents
  from ranges r
  left join public.message_logs ml
    on ml.status in ('sent', 'failed')
    and ml.sent_at >= (r.q_start_local at time zone 'America/Chicago')
    and ml.sent_at <  (r.q_end_local at time zone 'America/Chicago')
  left join public.messages m on m.id = ml.message_id
  left join public.users u on u.id = m.sent_by and u.ward = p_ward
  where ml.id is null or u.id is not null
  group by r.q_start_local
  order by r.q_start_local desc;
end;
$function$;
