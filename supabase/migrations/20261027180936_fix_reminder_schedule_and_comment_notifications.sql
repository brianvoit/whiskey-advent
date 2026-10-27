-- 5 pm on Dec 24 in the Americas is Dec 25 in UTC, so the hourly reminder
-- job must also run on Dec 25 (UTC). send-daily-reminder now computes the
-- advent day in each user's own timezone and ignores anything outside a local
-- Dec 1–24.
select cron.alter_job(
  job_id   := (select jobid from cron.job where jobname = 'send-daily-reminder'),
  schedule := '0 * 1-25 12 *'
);

-- notify_comment_inserted() existed but was never attached to a trigger, so no
-- in-app "X commented on Day N" notifications were ever created and the
-- Comments toggle in onboarding/profile had no effect.
drop trigger if exists on_comment_inserted on public.comments;
create trigger on_comment_inserted
  after insert on public.comments
  for each row execute function public.notify_comment_inserted();
