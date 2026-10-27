-- ============================================================================
-- Read-only RLS inspection. Safe to run any time.
-- Run BEFORE the harden_rls migration to capture current state,
-- and AFTER to verify.
-- ============================================================================

-- Every policy on every app table.
-- AFTER the migration: no row should list {anon} or {public} in `roles`.
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;


-- RLS enablement. AFTER: rls_enabled should be true for every table.
select relname as table_name,
       relrowsecurity  as rls_enabled,
       relforcerowsecurity as rls_forced
from pg_class
where relnamespace = 'public'::regnamespace
  and relkind = 'r'
order by relname;


-- Table privileges held by the anon role.
-- AFTER: this should return zero rows.
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon'
  and table_schema = 'public'
order by table_name, privilege_type;


-- SECURITY DEFINER functions without a pinned search_path.
-- These are an attack surface and are flagged by Supabase's security advisor.
-- AFTER: is_admin and guard_profile_privilege_columns should NOT appear.
select p.proname as function_name,
       pg_get_functiondef(p.oid) like '%search_path%' as has_search_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
order by p.proname;
