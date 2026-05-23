# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server at localhost:5173
npm run build        # Type-check + Vite production build (tsc -b && vite build)
npm run lint         # ESLint
npx tsc -b --noEmit  # Type-check only (run after edits to catch TS6133 unused-var errors)
```

No test suite is configured.

## Architecture

**Whiskey Advent** is a private PWA advent calendar for whiskey tasting. Users rate each of 24 December pours, track flavor notes, and compare with the group.

### Stack
- React 19 + TypeScript, bundled with `rolldown-vite` (drop-in Vite replacement)
- MUI v7 (Material UI) — `useTheme()` for all color/spacing tokens
- Supabase — auth (Google OAuth + email/password) and Postgres DB
- React Router v7 (`BrowserRouter`, `Routes`/`Route`)
- `canvas-confetti` for celebration animations
- `recharts` for stats charts

### App shell (`src/App.tsx`)

Two main components in one file:

1. **`App`** — handles auth state, profile loading, year selection. Renders one of: loading spinner, login screen, `<AwaitingApproval>`, `<Onboarding>`, or `<AppShell>`.
2. **`AppShell`** — fixed header + bottom nav + `<Routes>`. Receives `isAdmin`, `userId`, `tastingPrefs`, `currentYear`, `availableYears` as props and passes them down to routes.

Year is selected via a header dropdown; `currentYear` flows down as a prop to `Home` and `Stats`.

### Routes

| Path | Component | Notes |
|---|---|---|
| `/` | `Home` | Advent calendar grid |
| `/year/:year/day/:dayNumber` | `DayDetail` | Rate a pour |
| `/whiskey/:whiskeyDayId` | `WhiskeyDetail` | Full whiskey detail + comments |
| `/stats` | `Stats` | Season stats with box-plot charts |
| `/profile/:userId` | `ProfileRouteHandler` | Own profile or admin viewing another |
| `/admin` | `AdminScreen` | Admin-only, guarded in route |

### Database tables (Supabase)

- **`profiles`** — `id`, `first_name`, `last_name`, `avatar_url`, `role` (`"user"|"admin"`), `status` (`"pending"|"active"|"previous"|"denied"|"blocked"`), `tasting_mode`, `reveal_preferences` (JSONB), `theme_mode`, `notifications_opt_in`. The `approved` column is legacy — `status` is the source of truth. `select("*")` on profiles is intentional to tolerate future migrations.
- **`seasons`** — `id`, `year`
- **`whiskey_days`** — `id`, `season_id`, `day_number`, `name`, `distillery`, `age`, `type`, `country`, `region`, `abv`, `blurb`, `info_url`, `image_url`
- **`tastings`** — `user_id`, `whiskey_day_id`, `rating` (0–5, 0.5 steps), `notes`, `revealed`, `tasting_sliders` (JSONB), `tags` (text[]). Upserted on `user_id,whiskey_day_id`.
- **`user_season_access`** — join table; controls which seasons a user can see
- **`notifications`** — `id`, `user_id`, `read`

### `src/api/` — Supabase query helpers

One file per domain, all import from `../supabaseClient`. Key files:
- `profiles.ts` — `Profile` type, `TastingMode` type, `getProfile()`
- `whiskeys.ts` — `Season` type, `getSeasonByYear()`, `getWhiskeysForSeason()`
- `tastings.ts` — `Tasting` type, `TastingSliderValues`, `defaultTastingSliders`, `getTastingForDay()`, `saveTasting()`
- `stats.ts` — `getSeasonStats()` computes box-plot stats client-side from raw tastings
- `admin.ts`, `avatars.ts`, `comments.ts`, `notifications.ts`, `pushSubscriptions.ts`

### `src/components/` — Reusable UI

- **`BottomNav`** — fixed bottom nav; Admin tab only shown when `isAdmin`; Profile tab renders a `UserAvatar`
- **`AppHeader`** — fixed top bar; year dropdown, theme toggle (system/light/dark), notification bell
- **`AdventCard`** — calendar grid card. `hideDetails` applies `filter: blur()` + `transform: scale(1.05)` (scale prevents edge artifacts at `overflow:hidden` boundary)
- **`CelebrationOverlay`** — full-screen confetti/fireworks overlay. Types: `streak_3|5|10|15|20|24|perfect_score|season_end`
- **`StreakPill`** — orange gradient pill with 🔥; `animKey` prop re-mounts the element to replay `@keyframes streakBounce`
- **`FlavorTagPicker`**, **`StatsChart`**, **`WhiskeyChart`**, **`WhiskeyRadarChart`**, **`UserHistoryChart`** — domain-specific

### `src/admin/` — Admin-only screens

`AdminUserDetail`, `SeasonManager`, `UserManager`, `WhiskeyDayEditor` — only reachable when `isAdmin`.

### Tasting modes (`src/modes.ts`)

Three modes with ranked strictness (`modeRank: purist=0, explorer=1, relaxed=2`):
- **Purist** — hides all whiskey details until the user explicitly reveals a day
- **Explorer** — shows region/type before reveal, full details after
- **Relaxed** — shows everything always

Mode controls visibility in both `Home` (calendar cards) and `DayDetail`/`WhiskeyDetail`. Admins are **not** exempt from their own tasting mode — it's about their tasting experience, not access control.

### Theme (`src/theme.tsx`)

`AppThemeProvider` wraps the whole app. Two static MUI themes (light/dark) are pre-built; the context holds `mode: "light"|"dark"|"system"`. Use `useTheme()` for color tokens, never hardcode colors. Primary is whiskey copper (`#B87333` light / `#E5A76D` dark). Fonts: Inter for UI, Fraunces serif for `h1`–`h5`.

### Key patterns

- **Buttons** use native `<button>` elements with inline styles, not MUI `<Button>`.
- **`isDirty`** state tracks unsaved changes on rating screens; Save is disabled when clean.
- **`hasCelebrationRef`** (useRef) coordinates async celebration + navigation: set to `true` synchronously before any `setCelebration()` call; after save, check it to decide whether to navigate immediately or wait for overlay dismissal.
- **`celebratedMilestones`** (useRef Set) prevents streak milestone celebrations from re-firing within a session.
- **Safe area insets** — `env(safe-area-inset-top/bottom)` used in header padding and bottom nav for Dynamic Island/notch support.
- **PWA service worker** (`src/sw.ts`) uses `injectManifest` strategy. Supabase API calls are `NetworkOnly` — never cached.
- **Supabase realtime** — `postgres_changes` subscriptions keep notification counts and pending-user badges live without polling.
