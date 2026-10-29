-- handle_new_user: fill the new profile's name from the sign-in provider.
--
-- Names were only collected in onboarding, which comes after approval, so
-- every pending sign-up showed as "Unnamed user" and admins couldn't tell who
-- they were approving (or which past profile to link). Google sends
-- full_name; split it at the first space. Onboarding still lets people edit it.
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
  return new;
end;
$function$;
