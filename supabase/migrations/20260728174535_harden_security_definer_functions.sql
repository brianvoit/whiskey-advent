-- Pin search_path on all SECURITY DEFINER functions (advisor lint 0011).
-- ALTER FUNCTION is used rather than CREATE OR REPLACE so bodies are preserved
-- byte-for-byte; only the config is changed.
alter function public.is_admin()                set search_path = public;
alter function public.is_approved()             set search_path = public;
alter function public.notify_comment_inserted() set search_path = public;
alter function public.set_updated_at()          set search_path = public;
alter function public.handle_new_user()         set search_path = public;

-- merge_legacy_profile: add an admin guard. This function is SECURITY DEFINER
-- and reassigns tastings, sets approved = true, and DELETEs a profile row.
-- It was callable by anon via /rest/v1/rpc/merge_legacy_profile, which allowed
-- any unauthenticated caller to delete arbitrary accounts and self-approve.
create or replace function public.merge_legacy_profile(legacy_id uuid, new_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: merge_legacy_profile is admin-only';
  END IF;

  UPDATE tastings SET user_id = new_id WHERE user_id = legacy_id;
  UPDATE push_subscriptions SET user_id = new_id WHERE user_id = legacy_id;
  UPDATE profiles SET
    first_name         = legacy.first_name,
    last_name          = legacy.last_name,
    tasting_mode       = legacy.tasting_mode,
    reveal_preferences = legacy.reveal_preferences,
    approved           = true,
    is_legacy          = false
  FROM (SELECT * FROM profiles WHERE id = legacy_id) AS legacy
  WHERE profiles.id = new_id;
  DELETE FROM profiles WHERE id = legacy_id;
END;
$function$;

-- Trigger functions must never be callable as RPC endpoints. Revoking EXECUTE
-- does not affect trigger firing, which runs in the table owner's context.
revoke execute on function public.notify_comment_inserted() from anon, authenticated;
revoke execute on function public.set_updated_at()          from anon, authenticated;
revoke execute on function public.handle_new_user()         from anon, authenticated;

-- Policy helpers: authenticated needs EXECUTE because RLS expressions are
-- evaluated as the querying role. anon does not.
revoke execute on function public.is_admin()    from anon;
revoke execute on function public.is_approved() from anon;
grant  execute on function public.is_admin()    to authenticated;
grant  execute on function public.is_approved() to authenticated;

-- Admin-only RPC.
revoke execute on function public.merge_legacy_profile(uuid, uuid) from anon, public;
grant  execute on function public.merge_legacy_profile(uuid, uuid) to authenticated;
