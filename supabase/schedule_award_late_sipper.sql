-- Schedules the award-late-sipper edge function. Run by hand in the Supabase
-- SQL editor on 2026-11-02 (not a migration, so not in schema_migrations).
--
-- 15:00 UTC = 9 am Central (December is always CST). Dec 2 covers day 1;
-- Dec 25 covers day 24. The call is copied from the send-daily-reminder job so
-- its Authorization header (a key) never appears in this file.

select cron.schedule(
  'award-late-sipper',
  '0 15 2-25 12 *',
  (select replace(command, '/functions/v1/send-daily-reminder', '/functions/v1/award-late-sipper')
   from cron.job where jobname = 'send-daily-reminder')
);
