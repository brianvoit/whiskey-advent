-- These four objects are leftover 2024 import scaffolding. Nothing in the
-- application references them (verified by grep across src/ and
-- supabase/functions/). Two had RLS disabled entirely with full anon grants.
-- RLS is enabled with no policies, which denies all access to client roles
-- while leaving the data intact and reachable via service_role.
alter table public.legacy_2024_profile_map  enable row level security;
alter table public.legacy_rater_profile_map enable row level security;
alter table public.legacy_2024_ratings_raw  enable row level security;

-- The view was SECURITY DEFINER, so it ran with the creator's permissions and
-- bypassed RLS for any caller. security_invoker makes it respect the querying
-- user's policies instead.
alter view public.v_2024_whiskey_days set (security_invoker = on);

revoke all on public.legacy_2024_profile_map  from anon, authenticated;
revoke all on public.legacy_rater_profile_map from anon, authenticated;
revoke all on public.legacy_2024_ratings_raw  from anon, authenticated;
revoke all on public.v_2024_whiskey_days      from anon, authenticated;


-- ── Revoke every table privilege from anon across the public schema ─────────
-- Supabase grants anon full DML on public tables by default; RLS was the only
-- thing standing between the anon key and the data, and on four tables there
-- was no RLS at all. Nothing in this app talks to the REST API before sign-in
-- (auth goes through GoTrue), so anon needs no table access whatsoever.
do $$
declare obj record;
begin
  for obj in
    select c.relname, c.relkind
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind in ('r','v','m','f','p')
  loop
    execute format('revoke all on public.%I from anon', obj.relname);
  end loop;
end $$;

-- Prevent future tables from silently granting anon access again.
alter default privileges in schema public revoke all on tables from anon;
