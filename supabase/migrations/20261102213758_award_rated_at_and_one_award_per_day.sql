-- Competitive awards: decide them from the database, not each phone's count.
--
-- First Taster and Slow Poke (now Late Sipper) were decided on the client by
-- counting ratings right after saving. Two saves landing together could both
-- count before seeing each other: two people got Slow Poke, or nobody got
-- First Taster. Now:
--   * tastings.rated_at records when a rating was first given (set only by
--     the trigger below, so clients can't backdate it), and the edge function
--     picks the earliest / latest rater from it;
--   * at most one of each award per day, enforced by a unique index.

alter table public.tastings add column if not exists rated_at timestamptz;

-- Best available time for existing ratings (past seasons' awards aren't redone).
-- Without the updated_at trigger, so this doesn't touch every row's updated_at.
alter table public.tastings disable trigger set_tastings_updated_at;
update public.tastings
set rated_at = coalesce(updated_at, created_at)
where rating is not null and rated_at is null;
alter table public.tastings enable trigger set_tastings_updated_at;

create or replace function public.set_tasting_rated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.rating is null then
    new.rated_at := null;
  elsif tg_op = 'INSERT' or old.rating is null then
    new.rated_at := now();
  else
    -- Changing an existing rating keeps the time it was first given.
    new.rated_at := old.rated_at;
  end if;
  return new;
end;
$function$;

drop trigger if exists set_tastings_rated_at on public.tastings;
create trigger set_tastings_rated_at
  before insert or update on public.tastings
  for each row execute function public.set_tasting_rated_at();

create index if not exists tastings_day_rated_at_idx
  on public.tastings (whiskey_day_id, rated_at)
  where rating is not null;

-- Slow Poke is renamed Late Sipper. No award notifications exist yet; this
-- keeps any that do consistent.
update public.notifications set type = 'award_late_sipper' where type = 'award_slow_poke';

create unique index if not exists notifications_one_award_per_day
  on public.notifications (type, whiskey_day_id)
  where type in ('award_first_taster', 'award_late_sipper');
