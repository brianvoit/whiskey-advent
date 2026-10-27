-- The client and both push edge functions read/write these two columns, but
-- they were never created. PostgREST rejects any update naming an unknown
-- column, so onboarding's final save failed for every new user, the reminder
-- toggle never saved, and send-daily-reminder / send-award-push errored on
-- their subscription queries.
alter table public.profiles
  add column if not exists notifications_opt_in boolean not null default false;

alter table public.profiles
  add column if not exists theme_mode text
  check (theme_mode in ('light', 'dark', 'system'));
