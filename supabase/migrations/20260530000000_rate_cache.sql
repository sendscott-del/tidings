-- Rate cache: single source of truth for Twilio per-message costs.
-- Replaces hardcoded constants in Compose.tsx and the ledger RPCs.
-- Refreshed by the refresh-twilio-rates edge function (blended from
-- Twilio Usage Records so carrier fees are included).

create table if not exists public.tidings_rate_cache (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('sms','mms')),
  country text not null default 'US',
  cents_per_unit numeric(8,4) not null check (cents_per_unit >= 0),
  source text not null check (source in ('twilio_pricing_api','twilio_usage_blended','manual')),
  sample_size integer,
  notes text,
  computed_at timestamptz not null default now()
);

create index if not exists tidings_rate_cache_lookup_idx
  on public.tidings_rate_cache (channel, country, computed_at desc);

alter table public.tidings_rate_cache enable row level security;

-- Authenticated users can read rates (needed by Compose for the budget preview).
drop policy if exists tidings_rate_cache_select on public.tidings_rate_cache;
create policy tidings_rate_cache_select
  on public.tidings_rate_cache for select
  to authenticated
  using (true);

-- Writes only via SECURITY DEFINER functions / service role.
revoke insert, update, delete on public.tidings_rate_cache from authenticated;

-- Seed with current production rates so day-one behavior matches today.
-- Marked 'manual' so the first refresh-twilio-rates run will supersede them.
insert into public.tidings_rate_cache (channel, country, cents_per_unit, source, notes)
values
  ('sms', 'US', 0.79, 'manual', 'Seed: prior hardcoded ledger rate'),
  ('mms', 'US', 2.00, 'manual', 'Seed: prior hardcoded Compose preview rate');

-- Helper RPC: latest rate for a channel.
create or replace function public.get_current_rate_cents(p_channel text, p_country text default 'US')
returns numeric
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select cents_per_unit
  from public.tidings_rate_cache
  where channel = p_channel
    and country = p_country
  order by computed_at desc
  limit 1
$$;

grant execute on function public.get_current_rate_cents(text, text) to authenticated;
