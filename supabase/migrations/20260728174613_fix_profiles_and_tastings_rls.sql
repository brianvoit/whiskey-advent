-- ── Privilege-escalation guard ──────────────────────────────────────────────
-- RLS is row-level, not column-level. The dropped "Users manage own profile"
-- policy was FOR ALL with USING (auth.uid() = id), so any signed-in user could
-- run  update profiles set role='admin' where id = <own id>  and become admin,
-- or set status='active' to self-approve. This trigger closes that.
create or replace function public.guard_profile_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
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
$$;

revoke execute on function public.guard_profile_privilege_columns() from anon, authenticated, public;

drop trigger if exists profiles_guard_privilege_columns on public.profiles;
create trigger profiles_guard_privilege_columns
  before update on public.profiles
  for each row execute function public.guard_profile_privilege_columns();


-- ── profiles: drop all 8 existing policies and rebuild ──────────────────────
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies
             where schemaname='public' and tablename='profiles'
  loop
    execute format('drop policy %I on public.profiles', pol.policyname);
  end loop;
end $$;

-- Self always readable (pending users need this for the awaiting-approval
-- screen); approved users and admins see everyone (Tasters, Compare, comment
-- authorship, avatars).
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_approved() or public.is_admin());

create policy profiles_insert_self on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- Deliberately NOT gated on is_approved(): a pending user must be able to
-- complete onboarding, which writes tasting_mode / onboarding_complete.
-- Column-level protection comes from the trigger above.
create policy profiles_update_self_or_admin on public.profiles for update to authenticated
  using      (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy profiles_delete_admin on public.profiles for delete to authenticated
  using (public.is_admin());


-- ── tastings: drop all 6 existing policies and rebuild ──────────────────────
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies
             where schemaname='public' and tablename='tastings'
  loop
    execute format('drop policy %I on public.tastings', pol.policyname);
  end loop;
end $$;

-- Group visibility for approved users — Stats, Compare and group averages
-- depend on reading everyone's ratings.
create policy tastings_select on public.tastings for select to authenticated
  using (public.is_approved() or public.is_admin());

create policy tastings_insert_own on public.tastings for insert to authenticated
  with check (user_id = auth.uid() and (public.is_approved() or public.is_admin()));

create policy tastings_update_own on public.tastings for update to authenticated
  using      (user_id = auth.uid() and (public.is_approved() or public.is_admin()))
  with check (user_id = auth.uid() and (public.is_approved() or public.is_admin()));

create policy tastings_delete_own_or_admin on public.tastings for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());
