-- Community Events budget (audience-scoped budgets).
--
-- Data seeded separately (not in this migration, since it ran via MCP against
-- the live project): a ward_budgets row named 'Community Events', and a
-- corrected blended SMS rate of 1.5¢/segment in tidings_rate_cache (delivery +
-- 10DLC carrier fees + Compliance Toolkit; the old 0.79¢ was delivery-only and
-- understated real cost ~1.9x).
--
-- The special ward 'Community Events' tallies every send to the community
-- directory (m.database = 'community') regardless of sender; every other
-- ward/stake budget now EXCLUDES community sends so nothing is double-counted.
-- Community Events Leaders (and admins) may read the Community Events budget
-- even though it isn't their assigned ward.

CREATE OR REPLACE FUNCTION public.get_ward_usage_cents(p_ward text)
 RETURNS numeric
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
declare
  v_caller_ward text;
  v_caller_role text;
  v_sms_rate numeric;
  v_mms_rate numeric;
  v_is_community boolean := (p_ward = 'Community Events');
begin
  select ward, role into v_caller_ward, v_caller_role
  from public.users where id = auth.uid();

  if v_caller_ward is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if v_caller_role <> 'admin'
     and v_caller_ward is distinct from p_ward
     and not (v_is_community and 'community_events_leader' = any(public.tidings_current_user_role_keys()))
  then
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
      and (
        (v_is_community and coalesce(m.database, 'stake') = 'community')
        or (not v_is_community and u.ward = p_ward and coalesce(m.database, 'stake') <> 'community')
      )
  ), 0)::numeric;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_ward_budget_status(p_ward text)
 RETURNS TABLE(ward_name text, budget_cents integer, used_cents numeric, remaining_cents numeric, quarter_start timestamptz, quarter_end timestamptz)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
declare
  v_caller_ward text;
  v_caller_role text;
  v_is_community boolean := (p_ward = 'Community Events');
begin
  select ward, role into v_caller_ward, v_caller_role
  from public.users where id = auth.uid();

  if v_caller_ward is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if v_caller_role <> 'admin'
     and v_caller_ward is distinct from p_ward
     and not (v_is_community and 'community_events_leader' = any(public.tidings_current_user_role_keys()))
  then
    raise exception 'Cross-ward access denied' using errcode = '42501';
  end if;

  return query
  select
    p_ward as ward_name,
    coalesce(b.budget_cents, 0) as budget_cents,
    public.get_ward_usage_cents(p_ward) as used_cents,
    (coalesce(b.budget_cents, 0)::numeric - public.get_ward_usage_cents(p_ward)) as remaining_cents,
    date_trunc('quarter', (now() at time zone 'America/Chicago')) at time zone 'America/Chicago' as quarter_start,
    (date_trunc('quarter', (now() at time zone 'America/Chicago')) + interval '3 months') at time zone 'America/Chicago' as quarter_end
  from (select 1) as dummy
  left join public.ward_budgets b on b.ward_name = p_ward;
end;
$function$;
