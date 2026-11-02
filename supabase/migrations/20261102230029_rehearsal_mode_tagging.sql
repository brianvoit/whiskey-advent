-- Rehearsal mode (Admin → Debug): everything saved while rehearsing is tagged,
-- is visible only to admins who are rehearsing, and is deleted when rehearsal
-- is switched off (clear_rehearsal_data).
--
-- While rehearsing, the app adds an `x-rehearsal: 1` header to its database
-- requests. The database stamps the tag itself from that header — not from the
-- request body — and only honours it for admins.

alter table public.tastings          add column if not exists rehearsal boolean not null default false;
alter table public.comments          add column if not exists rehearsal boolean not null default false;
alter table public.comment_reactions add column if not exists rehearsal boolean not null default false;
alter table public.notifications     add column if not exists rehearsal boolean not null default false;

-- True for a request from an admin whose app is in rehearsal mode.
create or replace function public.is_rehearsing()
returns boolean
language sql
stable
set search_path to 'public'
as $function$
  select coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-rehearsal', '') = '1'
     and public.is_admin();
$function$;

-- Tags new rows, and keeps real rows from being changed or removed while
-- rehearsing (switching rehearsal off would otherwise delete real data).
create or replace function public.stamp_rehearsal()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    new.rehearsal := public.is_rehearsing();
    return new;
  end if;

  if not old.rehearsal and public.is_rehearsing() then
    raise exception 'Real data can''t be changed in rehearsal mode. Turn rehearsal off first.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  -- A leftover rehearsal row saved outside rehearsal becomes real.
  new.rehearsal := old.rehearsal and public.is_rehearsing();
  return new;
end;
$function$;

drop trigger if exists stamp_rehearsal on public.tastings;
create trigger stamp_rehearsal before insert or update or delete on public.tastings
  for each row execute function public.stamp_rehearsal();
drop trigger if exists stamp_rehearsal on public.comments;
create trigger stamp_rehearsal before insert or update or delete on public.comments
  for each row execute function public.stamp_rehearsal();
drop trigger if exists stamp_rehearsal on public.comment_reactions;
create trigger stamp_rehearsal before insert or update or delete on public.comment_reactions
  for each row execute function public.stamp_rehearsal();

-- Rehearsal data is visible only to rehearsers; real data stays visible to all.
drop policy if exists tastings_select on public.tastings;
create policy tastings_select on public.tastings for select to authenticated
  using ((is_approved() or is_admin()) and (not rehearsal or is_rehearsing()));

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select to authenticated
  using ((is_approved() or is_admin()) and (not rehearsal or is_rehearsing()));

drop policy if exists comment_reactions_select on public.comment_reactions;
create policy comment_reactions_select on public.comment_reactions for select to authenticated
  using ((is_approved() or is_admin()) and (not rehearsal or is_rehearsing()));

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications for select
  using (user_id = auth.uid() and (not rehearsal or is_rehearsing()));

-- One real award of each kind per day, and separately one rehearsal award, so
-- a rehearsal award never blocks the real one.
drop index if exists public.notifications_one_award_per_day;
create unique index notifications_one_award_per_day
  on public.notifications (type, whiskey_day_id)
  where type in ('award_first_taster', 'award_late_sipper') and not rehearsal;
create unique index if not exists notifications_one_rehearsal_award_per_day
  on public.notifications (type, whiskey_day_id)
  where type in ('award_first_taster', 'award_late_sipper') and rehearsal;

-- Rehearsal comments don't notify anyone.
create or replace function public.notify_comment_inserted()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_actor_name text;
  v_day_number integer;
BEGIN
  IF NEW.rehearsal THEN
    RETURN NEW;
  END IF;

  SELECT TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,''))
  INTO v_actor_name FROM profiles WHERE id = NEW.user_id;
  IF v_actor_name = '' OR v_actor_name IS NULL THEN v_actor_name := 'Someone'; END IF;

  SELECT day_number INTO v_day_number
  FROM whiskey_days WHERE id = NEW.whiskey_day_id;

  INSERT INTO notifications (user_id, type, actor_id, actor_name, whiskey_day_id, body)
  SELECT
    p.id, 'comment', NEW.user_id, v_actor_name, NEW.whiskey_day_id,
    v_actor_name || ' commented on Day ' || v_day_number
  FROM profiles p
  WHERE p.status = 'active'
    AND p.id != NEW.user_id
    AND p.comment_notifications_opt_in = true;

  RETURN NEW;
END;
$function$;

-- Deletes rehearsal data: the caller's own, or (admins) everyone's. Called
-- when rehearsal mode is switched off. Returns what it deleted.
create or replace function public.clear_rehearsal_data(everyone boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth.uid();
  n_reactions int;
  n_comments int;
  n_notifications int;
  n_ratings int;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  if everyone and not public.is_admin() then
    raise exception 'Only admins can clear everyone''s rehearsal data';
  end if;

  delete from comment_reactions where rehearsal and (everyone or user_id = me);
  get diagnostics n_reactions = row_count;
  delete from comments where rehearsal and (everyone or user_id = me);
  get diagnostics n_comments = row_count;
  delete from notifications where rehearsal and (everyone or user_id = me or actor_id = me);
  get diagnostics n_notifications = row_count;
  delete from tastings where rehearsal and (everyone or user_id = me);
  get diagnostics n_ratings = row_count;

  return jsonb_build_object(
    'ratings', n_ratings, 'comments', n_comments,
    'reactions', n_reactions, 'notifications', n_notifications
  );
end;
$function$;

revoke execute on function public.clear_rehearsal_data(boolean) from anon, public;
grant  execute on function public.clear_rehearsal_data(boolean) to authenticated;
