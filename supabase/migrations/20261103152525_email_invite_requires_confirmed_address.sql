-- Email sign-ups: only accept an email invite once the address is confirmed.
--
-- Until now every account came from Google, whose addresses are confirmed at
-- sign-up. With email + password sign-up, anyone could register a friend's
-- invited address; matching it before confirmation would hand them the
-- invite. So: match at sign-up only if the address is already confirmed
-- (Google), and otherwise when it gets confirmed.

-- Accepts the newest open email invite for `p_email`, if any. Never raises:
-- signing up or confirming must not fail because of an invite.
create or replace function public._accept_email_invite(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  invite_id uuid;
begin
  if p_email is null then
    return;
  end if;
  select id into invite_id from invites
  where accepted_at is null and contact_type = 'email' and lower(contact) = lower(p_email)
  order by created_at desc
  limit 1;
  if invite_id is not null then
    perform public._accept_invite(invite_id, p_user_id);
  end if;
exception when others then
  raise warning 'Invite auto-accept failed for %: %', p_user_id, sqlerrm;
end;
$function$;

revoke execute on function public._accept_email_invite(uuid, text) from anon, public, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  full_name text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name',
                                          new.raw_user_meta_data ->> 'name')), '');
begin
  insert into profiles (id, status, approved, role, first_name, last_name)
  values (
    new.id, 'pending', false, 'user',
    split_part(full_name, ' ', 1),
    nullif(btrim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), '')
  )
  on conflict (id) do nothing;

  if new.email_confirmed_at is not null then
    perform public._accept_email_invite(new.id, new.email);
  end if;

  return new;
end;
$function$;

create or replace function public.handle_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public._accept_email_invite(new.id, new.email);
  return new;
end;
$function$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_user_email_confirmed();
