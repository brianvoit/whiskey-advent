-- ============================================================================
-- ROLLBACK ARTIFACT — policy state captured 2026-07-28, BEFORE RLS hardening.
--
-- This is the exact set of policies that existed prior to the
-- 2026072812xxxx_* hardening migrations. Kept so the previous state can be
-- restored if the hardening breaks something unexpected.
--
-- ⚠️  Two of these policies are the vulnerabilities themselves and should NOT
--     be restored except as a deliberate, temporary step:
--       • "Public read profiles"   — SELECT USING (true), readable by anon
--       • "Public read tastings"   — SELECT USING (true), readable by anon
--       • "Users manage own profile" — FOR ALL, allows self-promotion to admin
--
-- Note: every original policy targeted role `public`, which in Postgres
-- includes `anon`. That is the systemic issue the hardening fixes.
-- ============================================================================

-- ── notifications ───────────────────────────────────────────────────────────
create policy "users read own notifications"   on public.notifications for select using (user_id = auth.uid());
create policy "users update own notifications" on public.notifications for update using (user_id = auth.uid());

-- ── profiles ────────────────────────────────────────────────────────────────
create policy "Users manage own profile"    on public.profiles for all    using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles: insert own"        on public.profiles for insert with check (auth.uid() = id);
create policy "Admins can read all profiles" on public.profiles for select using ((auth.uid() = id) OR is_admin());
create policy "Public read profiles"        on public.profiles for select using (true);
create policy "profiles: admin read all"    on public.profiles for select using (is_admin());
create policy "profiles: self read"         on public.profiles for select using (auth.uid() = id);
create policy "profiles: admin update all"  on public.profiles for update using (is_admin()) with check (is_admin());
create policy "profiles: self update"       on public.profiles for update using ((auth.uid() = id) AND is_approved()) with check ((auth.uid() = id) AND is_approved());

-- ── push_subscriptions ──────────────────────────────────────────────────────
create policy "Users manage own subscriptions" on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── seasons ─────────────────────────────────────────────────────────────────
create policy "seasons: admin write"   on public.seasons for all    using (is_admin()) with check (is_admin());
create policy "seasons: approved read" on public.seasons for select using (is_approved());

-- ── tastings ────────────────────────────────────────────────────────────────
create policy "Users manage own tastings" on public.tastings for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tastings: delete own"      on public.tastings for delete using ((auth.uid() = user_id) AND is_approved());
create policy "tastings: insert own"      on public.tastings for insert with check ((auth.uid() = user_id) AND is_approved());
create policy "Public read tastings"      on public.tastings for select using (true);
create policy "tastings: approved read"   on public.tastings for select using (is_approved());
create policy "tastings: update own"      on public.tastings for update using ((auth.uid() = user_id) AND is_approved()) with check ((auth.uid() = user_id) AND is_approved());

-- ── user_season_access ──────────────────────────────────────────────────────
create policy "Admins manage season access"  on public.user_season_access for all using (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);
create policy "Users read own season access" on public.user_season_access for select using (user_id = auth.uid());

-- ── whiskey_days ────────────────────────────────────────────────────────────
create policy "whiskey_days: admin write"   on public.whiskey_days for all    using (is_admin()) with check (is_admin());
create policy "whiskey_days: approved read" on public.whiskey_days for select using (is_approved());

-- ── Tables with NO RLS at the time of capture ───────────────────────────────
-- comments, comment_reactions, legacy_2024_profile_map, legacy_rater_profile_map
-- To restore that (NOT recommended):
--   alter table public.comments disable row level security;
--   alter table public.comment_reactions disable row level security;
--   alter table public.legacy_2024_profile_map disable row level security;
--   alter table public.legacy_rater_profile_map disable row level security;
