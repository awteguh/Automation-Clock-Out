-- ============================================================
-- Supabase pg_cron setup — call the app's cron endpoint every minute.
--
-- PREREQUISITES:
--   1. The app must be DEPLOYED and reachable from the internet (Supabase
--      cannot reach http://localhost). e.g. https://your-app.vercel.app
--   2. Set CRON_SECRET in the app's environment, and put the SAME value below.
--   3. Set SCHEDULER_ENABLED=false in the app env so the in-process node-cron
--      does NOT also fire (otherwise both pg_cron and node-cron run — the daily
--      run-date guard mostly prevents doubles, but disabling one avoids races).
--
-- Run this whole file in the Supabase Dashboard > SQL Editor.
-- ============================================================

-- 1) Enable the required extensions.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) (Re)create the every-minute job.
--    Safe to re-run: we unschedule first if it already exists.
do $$
begin
  perform cron.unschedule('clock-attendance-runner');
exception
  when others then null; -- job didn't exist yet
end $$;

-- ──────────────────────────────────────────────────────────────
-- REPLACE the two placeholders below:
--   <APP_BASE_URL>  e.g. https://your-app.vercel.app   (no trailing slash)
--   <CRON_SECRET>   same value as CRON_SECRET in the app env
-- ──────────────────────────────────────────────────────────────
select cron.schedule(
  'clock-attendance-runner',
  '* * * * *',                       -- every minute
  $job$
    select net.http_post(
      url     := '<APP_BASE_URL>/api/cron/run',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'x-cron-secret', '<CRON_SECRET>'
      ),
      body    := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $job$
);

-- ============================================================
-- Useful checks (run separately):
--
--   -- list scheduled jobs
--   select jobid, schedule, jobname, active from cron.job;
--
--   -- recent job runs (did pg_cron fire?)
--   select jobid, status, return_message, start_time
--   from cron.job_run_details
--   order by start_time desc limit 20;
--
--   -- recent HTTP responses from pg_net (what did the endpoint return?)
--   select id, status_code, content
--   from net._http_response
--   order by created desc limit 20;
--
--   -- stop the job
--   select cron.unschedule('clock-attendance-runner');
-- ============================================================
