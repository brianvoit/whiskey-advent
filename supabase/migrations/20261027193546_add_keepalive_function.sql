-- Free-plan projects pause after 7 days of low database activity. A daily
-- GitHub Action (.github/workflows/keepalive.yml) calls this through the REST
-- API with the public anon key. It reads no tables and returns only the time,
-- so exposing it to anon reveals nothing; SECURITY INVOKER means it runs with
-- anon's (empty) table privileges.
create or replace function public.keepalive()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$ select now() $$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon;
