-- comments and comment_reactions had RLS DISABLED entirely, with anon holding
-- SELECT/INSERT/UPDATE/DELETE grants. Any holder of the public anon key could
-- read every comment, post comments attributed to any user, edit them, or
-- delete all of them.

-- ── comments ────────────────────────────────────────────────────────────────
alter table public.comments enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies
             where schemaname='public' and tablename='comments'
  loop
    execute format('drop policy %I on public.comments', pol.policyname);
  end loop;
end $$;

create policy comments_select on public.comments for select to authenticated
  using (public.is_approved() or public.is_admin());

-- The author must be the caller. This is what was missing entirely.
create policy comments_insert_own on public.comments for insert to authenticated
  with check (user_id = auth.uid() and (public.is_approved() or public.is_admin()));

create policy comments_update_own on public.comments for update to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy comments_delete_own_or_admin on public.comments for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());


-- ── comment_reactions ───────────────────────────────────────────────────────
-- Note: deleting a comment cascades to its reactions. Cascade deletes are not
-- subject to child-table RLS, so comments_delete_own_or_admin remains the
-- effective control there.
alter table public.comment_reactions enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies
             where schemaname='public' and tablename='comment_reactions'
  loop
    execute format('drop policy %I on public.comment_reactions', pol.policyname);
  end loop;
end $$;

create policy comment_reactions_select on public.comment_reactions for select to authenticated
  using (public.is_approved() or public.is_admin());

create policy comment_reactions_insert_own on public.comment_reactions for insert to authenticated
  with check (user_id = auth.uid() and (public.is_approved() or public.is_admin()));

create policy comment_reactions_delete_own on public.comment_reactions for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());
