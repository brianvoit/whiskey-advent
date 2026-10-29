-- merge_legacy_profile: link a past (imported) taster to their real account.
--
-- The old version only moved tastings and push subscriptions, then deleted the
-- legacy profile. That failed for any legacy profile with comments, reactions
-- or a legacy import-map row (foreign keys without cascade), and it set the
-- legacy `approved` flag but not `status`, so the person stayed Pending.
--
-- Now it moves everything that points at the legacy id, approves the account,
-- gives it the seasons the legacy profile rated in plus the current season,
-- and removes the legacy profile and its placeholder login.
create or replace function public.merge_legacy_profile(legacy_id uuid, new_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and not public.is_admin() then
    raise exception 'Permission denied: merge_legacy_profile is admin-only';
  end if;

  if legacy_id = new_id then
    raise exception 'Cannot link a profile to itself';
  end if;
  if not exists (select 1 from profiles where id = legacy_id and coalesce(is_legacy, false)) then
    raise exception 'That is not a past (imported) profile';
  end if;
  if not exists (select 1 from profiles where id = new_id and not coalesce(is_legacy, false)) then
    raise exception 'Account to link into was not found';
  end if;
  -- tastings is unique on (user_id, whiskey_day_id). Refuse rather than drop
  -- either rating.
  if exists (
    select 1 from tastings a
    join tastings b on b.whiskey_day_id = a.whiskey_day_id
    where a.user_id = legacy_id and b.user_id = new_id
  ) then
    raise exception 'Both profiles have a rating for the same day; nothing was changed';
  end if;

  -- Seasons they took part in, plus the current one (as approving does).
  insert into user_season_access (user_id, season_id)
  select new_id, s.season_id from (
    select season_id from user_season_access where user_id = legacy_id
    union
    select w.season_id from tastings t join whiskey_days w on w.id = t.whiskey_day_id
    where t.user_id = legacy_id
    union
    select id from (select id from seasons order by year desc limit 1) cur
  ) s
  where s.season_id is not null
  on conflict do nothing;

  update tastings      set user_id = new_id where user_id = legacy_id;
  update comments      set user_id = new_id where user_id = legacy_id;
  update notifications set user_id = new_id where user_id = legacy_id;
  update notifications set actor_id = new_id where actor_id = legacy_id;

  -- Unique on (comment_id, user_id, reaction_type): drop duplicates first.
  delete from comment_reactions r
  where r.user_id = legacy_id
    and exists (
      select 1 from comment_reactions n
      where n.user_id = new_id
        and n.comment_id = r.comment_id
        and n.reaction_type = r.reaction_type
    );
  update comment_reactions set user_id = new_id where user_id = legacy_id;

  -- Unique on (user_id, endpoint): same.
  delete from push_subscriptions p
  where p.user_id = legacy_id
    and exists (
      select 1 from push_subscriptions n
      where n.user_id = new_id and n.endpoint = p.endpoint
    );
  update push_subscriptions set user_id = new_id where user_id = legacy_id;

  update legacy_2024_profile_map  set profile_id = new_id where profile_id = legacy_id;
  update legacy_rater_profile_map set profile_id = new_id where profile_id = legacy_id;

  -- Keep anything the person already set on their real account; fill gaps
  -- from the legacy profile.
  update profiles set
    first_name = coalesce(nullif(profiles.first_name, ''), legacy.first_name),
    last_name  = coalesce(nullif(profiles.last_name, ''),  legacy.last_name),
    avatar_url = coalesce(profiles.avatar_url, legacy.avatar_url),
    status     = 'active',
    approved   = true,
    is_legacy  = false
  from (select * from profiles where id = legacy_id) as legacy
  where profiles.id = new_id;

  delete from profiles where id = legacy_id;
  -- The legacy login is a placeholder from the import; with its profile gone,
  -- signing in to it would only reach a broken account.
  delete from auth.users where id = legacy_id;
end;
$function$;

revoke execute on function public.merge_legacy_profile(uuid, uuid) from anon, public;
grant  execute on function public.merge_legacy_profile(uuid, uuid) to authenticated;
