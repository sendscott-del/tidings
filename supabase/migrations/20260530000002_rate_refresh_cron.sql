-- Daily cron: invoke refresh-twilio-rates so tidings_rate_cache stays current.
--
-- ONE-TIME SETUP (run once per Supabase project via SQL editor):
--   ALTER DATABASE postgres SET app.tidings_internal_fn_secret = '<INTERNAL_FN_SECRET>';
-- Use the same value as the INTERNAL_FN_SECRET edge-function env var.
-- Without this setting the cron will fire but get 401 — no harm, just a
-- noisy line in cron.job_run_details. The Admin → Settings refresh button
-- works regardless (it uses the admin user's JWT instead).

select cron.unschedule('refresh-twilio-rates') where exists (
  select 1 from cron.job where jobname = 'refresh-twilio-rates'
);

select cron.schedule(
  'refresh-twilio-rates',
  '17 7 * * *',  -- 07:17 UTC daily = ~02:17 America/Chicago, off-peak
  $cron$
  select net.http_post(
    url := 'https://jdlykebsqafcngpntxma.supabase.co/functions/v1/refresh-twilio-rates',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(current_setting('app.tidings_internal_fn_secret', true), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);
