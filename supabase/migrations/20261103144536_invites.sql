-- Invites (Admin → Users → Invite). An admin creates an invite for an email
-- address or phone number — optionally for a past (imported) profile — and
-- sends its link from their own Mail / Messages app. The link carries a
-- one-time token; signing in with it approves the person into the current
-- season, or links them to their past profile. Email invites also match when
-- someone signs up with that address without using the link.

create table if not exists public.invites (
  id                uuid primary key default gen_random_uuid(),
  token             text not null unique default replace(gen_random_uuid()::text, '-', ''),
  contact_type      text not null check (contact_type in ('email', 'phone')),
  contact           text not null,
  first_name        text,
  last_name         text,
  -- Past profile to link on accept (a legacy imported profile).
  legacy_profile_id uuid references public.profiles(id) on delete set null,
  invited_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  accepted_at       timestamptz,
  accepted_by       uuid references public.profiles(id) on delete set null
);

alter table public.invites enable row level security;

drop policy if exists invites_admin_all on public.invites;
create policy invites_admin_all on public.invites for all to authenticated
  using (is_admin()) with check (is_admin());

revoke all on public.invites from anon;

-- Accepting an invite changes status/approved/is_legacy, which the profile
-- guard only allows for admins. These trusted functions set this flag for the
-- rest of their transaction instead. (It's a custom setting: clients can't set
-- it through the API.)
create or replace function public.guard_profile_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role'
     or current_setting('whiskey.trusted_profile_update', true) = 'on' then
    return new;
  end if;

  if (new.role     is distinct from old.role
   or new.status   is distinct from old.status
   or new.approved is distinct from old.approved
   or new.is_legacy is distinct from old.is_legacy)
     and not public.is_admin()
  then
    raise exception
      'Permission denied: role, status, approved and is_legacy are admin-only';
  end if;

  return new;
end;
$function$;

-- The merge itself, without the admin check, so accepting an invite can use it.
-- Not callable through the API.
create or replace function public._merge_legacy_profile(legacy_id uuid, new_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if legacy_id = new_id then
    raise exception 'Cannot link a profile to itself';
  end if;
  if not exists (select 1 from profiles where id = legacy_id and coalesce(is_legacy, false)) then
    raise exception 'That is not a past (imported) profile';
  end if;
  if not exists (select 1 from profiles where id = new_id and not coalesce(is_legacy, false)) then
    raise exception 'Account to link into was not found';
  end if;
  if exists (
    select 1 from tastings a
    join tastings b on b.whiskey_day_id = a.whiskey_day_id
    where a.user_id = legacy_id and b.user_id = new_id
  ) then
    raise exception 'Both profiles have a rating for the same day; nothing was changed';
  end if;

  perform set_config('whiskey.trusted_profile_update', 'on', true);

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

  delete from comment_reactions r
  where r.user_id = legacy_id
    and exists (
      select 1 from comment_reactions n
      where n.user_id = new_id and n.comment_id = r.comment_id and n.reaction_type = r.reaction_type
    );
  update comment_reactions set user_id = new_id where user_id = legacy_id;

  delete from push_subscriptions p
  where p.user_id = legacy_id
    and exists (select 1 from push_subscriptions n where n.user_id = new_id and n.endpoint = p.endpoint);
  update push_subscriptions set user_id = new_id where user_id = legacy_id;

  update legacy_2024_profile_map  set profile_id = new_id where profile_id = legacy_id;
  update legacy_rater_profile_map set profile_id = new_id where profile_id = legacy_id;
  update invites set legacy_profile_id = null where legacy_profile_id = legacy_id;

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
  delete from auth.users where id = legacy_id;
end;
$function$;

revoke execute on function public._merge_legacy_profile(uuid, uuid) from anon, public, authenticated;

-- Admin-facing merge (Link a past profile): same as before, now a wrapper.
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
  perform public._merge_legacy_profile(legacy_id, new_id);
end;
$function$;

revoke execute on function public.merge_legacy_profile(uuid, uuid) from anon, public;
grant  execute on function public.merge_legacy_profile(uuid, uuid) to authenticated;

-- Accepts invite `invite_id` for `user_id`. Returns what happened:
-- 'linked' (joined their past profile), 'reactivated' (they signed in as the
-- past profile's own login), or 'joined' (new member). Not callable through
-- the API.
create or replace function public._accept_invite(p_invite_id uuid, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  inv invites;
  outcome text;
begin
  select * into inv from invites where id = p_invite_id for update;
  perform set_config('whiskey.trusted_profile_update', 'on', true);

  if inv.legacy_profile_id is not null and inv.legacy_profile_id <> p_user_id
     and exists (select 1 from profiles where id = inv.legacy_profile_id and coalesce(is_legacy, false)) then
    perform public._merge_legacy_profile(inv.legacy_profile_id, p_user_id);
    outcome := 'linked';
  elsif inv.legacy_profile_id = p_user_id then
    update profiles set status = 'active', approved = true, is_legacy = false where id = p_user_id;
    insert into user_season_access (user_id, season_id)
    select p_user_id, s.season_id from (
      select w.season_id from tastings t join whiskey_days w on w.id = t.whiskey_day_id where t.user_id = p_user_id
      union
      select id from (select id from seasons order by year desc limit 1) cur
    ) s
    where s.season_id is not null
    on conflict do nothing;
    outcome := 'reactivated';
  else
    update profiles set
      status     = 'active',
      approved   = true,
      first_name = coalesce(nullif(first_name, ''), inv.first_name),
      last_name  = coalesce(nullif(last_name, ''),  inv.last_name)
    where id = p_user_id;
    insert into user_season_access (user_id, season_id)
    select p_user_id, id from (select id from seasons order by year desc limit 1) cur
    on conflict do nothing;
    outcome := 'joined';
  end if;

  update invites set accepted_at = now(), accepted_by = p_user_id where id = p_invite_id;
  return outcome;
end;
$function$;

revoke execute on function public._accept_invite(uuid, uuid) from anon, public, authenticated;

-- Called by the app after sign-in when it was opened from an invite link.
-- Returns 'linked' | 'reactivated' | 'joined' | 'already' (this user already
-- accepted it) | 'used' (someone else did) | 'invalid'.
create or replace function public.redeem_invite(p_token text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth.uid();
  inv invites;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  select * into inv from invites where token = p_token for update;
  if not found then
    return 'invalid';
  end if;
  if inv.accepted_at is not null then
    return case when inv.accepted_by = me then 'already' else 'used' end;
  end if;
  return public._accept_invite(inv.id, me);
end;
$function$;

revoke execute on function public.redeem_invite(text) from anon, public;
grant  execute on function public.redeem_invite(text) to authenticated;

-- New sign-ups: name from the provider (as before), then accept an open email
-- invite for the same address. Accepting must never block signing up, so any
-- error there is logged and skipped (the admin can still approve by hand).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  full_name text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name',
                                          new.raw_user_meta_data ->> 'name')), '');
  invite_id uuid;
begin
  insert into profiles (id, status, approved, role, first_name, last_name)
  values (
    new.id, 'pending', false, 'user',
    split_part(full_name, ' ', 1),
    nullif(btrim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), '')
  )
  on conflict (id) do nothing;

  if new.email is not null then
    begin
      select id into invite_id from invites
      where accepted_at is null and contact_type = 'email' and lower(contact) = lower(new.email)
      order by created_at desc
      limit 1;
      if invite_id is not null then
        perform public._accept_invite(invite_id, new.id);
      end if;
    exception when others then
      raise warning 'Invite auto-accept failed for %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$function$;
