import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import Home from "./Home";
import DayDetail from "./DayDetail";
import WhiskeyDetail from "./WhiskeyDetail";
import Stats from "./Stats";
import ProfileScreen from "./ProfileScreen";
import Onboarding from "./Onboarding";
import AwaitingApproval from "./AwaitingApproval";
import AdminScreen from "./AdminScreen";
import AppHeader from "./components/AppHeader";
import BottomNav from "./components/BottomNav";
import PWAUpdatePrompt from "./components/PWAUpdatePrompt";
import InstallBanner from "./components/InstallBanner";
import { Menu, MenuItem } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useAppTheme, type ThemeMode } from "./theme";
import type { Profile, TastingMode } from "./api/profiles";

// Computed tasting preferences passed to child components
type TastingPrefs = {
  mode: TastingMode;
  see_group_averages_pre_reveal: boolean;
};

function App() {
  const theme = useTheme();
  const { setMode } = useAppTheme();

  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Sync saved theme preference from profile into the theme context
  useEffect(() => {
    if (profile?.theme_mode) {
      setMode(profile.theme_mode as ThemeMode);
    }
  }, [profile?.theme_mode, setMode]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";
  const actualCurrentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(actualCurrentYear);

  const avatarUrl =
    profile?.avatar_url ??
    ((session?.user?.user_metadata as any)?.avatar_url ||
      (session?.user?.user_metadata as any)?.picture ||
      undefined);


  const firstName = profile?.first_name ?? ((session?.user?.user_metadata as any)?.given_name || (session?.user?.user_metadata as any)?.first_name || undefined);
  const lastName = profile?.last_name ?? ((session?.user?.user_metadata as any)?.family_name || (session?.user?.user_metadata as any)?.last_name || undefined);

  // tasting_mode is the single source of truth (lowercase)
  const effectiveMode: TastingMode = profile?.tasting_mode ?? "purist";

  const tastingPrefs: TastingPrefs = {
    mode: effectiveMode,
    see_group_averages_pre_reveal:
      profile?.reveal_preferences?.see_group_averages_pre_reveal ?? false,
  };

  const profileType =
    effectiveMode === "purist" ? "Purist" :
    effectiveMode === "explorer" ? "Explorer" :
    effectiveMode === "relaxed" ? "Relaxed" : "";

  // ---------------------------------------------------------
  // Auth + profile loading
  // ---------------------------------------------------------
  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session ?? null);

      if (session?.user) {
        await loadProfile(session.user.id, session);
      }

      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
      if (newSession?.user) {
        loadProfile(newSession.user.id, newSession);
      } else {
        setProfile(null);
      }
    });

    init();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadProfile = async (userId: string, oauthSession?: Session | null) => {
    setProfileError(null);
    // select("*") is intentional — tolerates columns added via migrations
    // that haven't been applied yet, rather than hard-failing on a missing field.
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error loading profile", error);
      setProfileError(error.message);
      return;
    }

    const profile = data as Profile;

    // One-time sync: if the profiles row has no avatar_url but the OAuth
    // session carries a Google profile picture, write it to the profiles table.
    // This makes the avatar available everywhere (comments, whiskey detail, etc.)
    // without requiring a manual upload. The write is idempotent.
    if (!profile.avatar_url && oauthSession?.user?.user_metadata) {
      const meta = oauthSession.user.user_metadata as Record<string, unknown>;
      const oauthAvatar =
        (meta.avatar_url as string | undefined) ||
        (meta.picture as string | undefined) ||
        null;
      if (oauthAvatar) {
        await supabase
          .from("profiles")
          .update({ avatar_url: oauthAvatar })
          .eq("id", userId);
        profile.avatar_url = oauthAvatar;
      }
    }

    setProfile(profile);
  };

  // ---------------------------------------------------------
  // Auth handlers
  // ---------------------------------------------------------
  const handleGoogleSignIn = async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
    });
    if (error) {
      console.error(error);
      setAuthError(error.message);
    }
  };

  const handleEmailPasswordSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error(error);
      setAuthError(error.message);
      return;
    }

    setSession(data.session ?? null);
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.palette.background.default,
          color: theme.palette.text.primary,
        }}
      >
        Loading…
      </div>
    );
  }

  // ---------------------------------------------------------
  // Unauthenticated view (login screen)
  // ---------------------------------------------------------
  if (!session) {
    return (
      <div
        style={{
          maxWidth: 420,
          margin: "0 auto",
          padding: "40px 16px",
          textAlign: "center",
          minHeight: "100vh",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          backgroundColor: theme.palette.background.default,
          color: theme.palette.text.primary,
        }}
      >
        <div style={{ fontSize: "2.8rem", marginBottom: 12, lineHeight: 1 }}>🥃</div>
        <h1 style={{ marginBottom: 8, fontSize: "1.8rem" }}>Whiskey Advent</h1>
        <p style={{ marginBottom: 8, lineHeight: 1.6, color: theme.palette.text.primary }}>
          A private advent calendar for serious (and not-so-serious) whiskey tasters.
          Rate each day&apos;s pour, track your flavor notes, and compare with the group.
        </p>
        <p style={{
          marginBottom: 28,
          fontSize: "0.82rem",
          color: theme.palette.text.secondary,
          fontStyle: "italic",
        }}>
          Access is by invitation — sign in below or ask an admin to add you.
        </p>

        <button
          onClick={handleGoogleSignIn}
          style={{
            display: "block",
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: `1px solid ${theme.palette.divider}`,
            marginBottom: 16,
            cursor: "pointer",
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
          }}
        >
          Continue with Google
        </button>

        <div
          style={{
            margin: "16px 0",
            fontSize: "0.8rem",
            color: theme.palette.text.secondary,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          or sign in with email address
        </div>

        <form onSubmit={handleEmailPasswordSignIn}>
          <input
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              marginBottom: 8,
              borderRadius: 6,
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              marginBottom: 12,
              borderRadius: 6,
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
            }}
          />
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
            }}
          >
            Continue with Email
          </button>
        </form>

        {authError && (
          <div
            style={{
              marginTop: 12,
              color: theme.palette.error.main,
              fontSize: "0.85rem",
            }}
          >
            {authError}
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------
  // Logged-in but profile not yet loaded (or failed to load)
  // ---------------------------------------------------------
  if (!profile) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          backgroundColor: theme.palette.background.default,
          color: theme.palette.text.primary,
          padding: 24,
          textAlign: "center",
        }}
      >
        {profileError ? (
          <>
            <p style={{ color: theme.palette.error.main, maxWidth: 420 }}>
              Could not load your profile. This can happen if a database
              migration hasn't been applied yet.
            </p>
            <p style={{ fontSize: "0.85rem", color: theme.palette.text.secondary, maxWidth: 420 }}>
              Error: {profileError}
            </p>
            <button
              onClick={() => session?.user && loadProfile(session.user.id)}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                border: `1px solid ${theme.palette.divider}`,
                background: theme.palette.background.paper,
                color: theme.palette.text.primary,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              style={{
                padding: "4px 12px",
                border: "none",
                background: "none",
                color: theme.palette.error.main,
                cursor: "pointer",
                fontSize: "0.85rem",
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <p>Loading profile…</p>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------
  // Logged-in but not yet approved by an admin
  // ---------------------------------------------------------
  if (profile.approved === false) {
    return (
      <AwaitingApproval
        userEmail={session.user.email ?? ""}
        onRefresh={() => loadProfile(session.user.id)}
      />
    );
  }

  // ---------------------------------------------------------
  // Logged-in but onboarding not complete
  // ---------------------------------------------------------
  const needsOnboarding = !profile.onboarding_complete;

  if (needsOnboarding) {
    return (
      <Onboarding
        profile={profile as any}
        onComplete={(updated) => setProfile(updated as Profile)}
      />
    );
  }

  // ---------------------------------------------------------
  // Authenticated + onboarding complete (router shell)
  // ---------------------------------------------------------
  const hasEmailAuth =
    session.user.identities?.some((i) => i.provider === "email") ?? false;

  return (
    <BrowserRouter>
      <AppShell
        isAdmin={isAdmin}
        userId={session.user.id}
        tastingPrefs={tastingPrefs}
        profile={profile}
        currentYear={selectedYear}
        avatarUrl={avatarUrl}
        profileType={profileType}
        userEmail={session.user.email ?? ""}
        hasEmailAuth={hasEmailAuth}
        onProfileUpdated={(updated) => setProfile(updated)}
        onYearChange={(year) => setSelectedYear(year)}
        firstName={firstName}
        lastName={lastName}
      />
    </BrowserRouter>
  );
}

type AppShellProps = {
  isAdmin: boolean;
  userId: string;
  tastingPrefs: TastingPrefs;
  profile: Profile | null;
  currentYear: number;
  avatarUrl?: string;
  profileType: string;
  userEmail: string;
  hasEmailAuth: boolean;
  onProfileUpdated: (profile: Profile) => void;
  onYearChange: (year: number) => void;
  firstName?: string;
  lastName?: string;
};

function AppShell({
  isAdmin,
  userId,
  tastingPrefs,
  profile,
  currentYear,
  avatarUrl,
  profileType,
  userEmail,
  hasEmailAuth,
  onProfileUpdated,
  onYearChange,
  firstName,
  lastName,
}: AppShellProps) {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [yearMenuAnchorEl, setYearMenuAnchorEl] = useState<null | HTMLElement>(null);
  const isYearMenuOpen = Boolean(yearMenuAnchorEl);

  const handleYearClick = (event: MouseEvent<HTMLElement>) => {
    setYearMenuAnchorEl(event.currentTarget);
  };

  const handleYearMenuClose = () => {
    setYearMenuAnchorEl(null);
  };

  const handleYearSelect = (year: number) => {
    onYearChange(year);
    setYearMenuAnchorEl(null);
  };

  const availableYears = [2024, 2025, 2026];

  const tastingMode = tastingPrefs.mode;

  const goTo = (path: string) => {
    if (location.pathname !== path) {
      navigate(path);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        backgroundColor: theme.palette.background.default,
        overflowX: "hidden",
      }}
    >
      {/* Top header + year menu */}
      <AppHeader
        currentYear={currentYear}
        profileType={profileType}
        onYearClick={handleYearClick}
      />

      <Menu
        anchorEl={yearMenuAnchorEl}
        open={isYearMenuOpen}
        onClose={handleYearMenuClose}
      >
        {availableYears.map((year) => (
          <MenuItem
            key={year}
            selected={year === currentYear}
            onClick={() => handleYearSelect(year)}
          >
            {year}
          </MenuItem>
        ))}
      </Menu>

      <div
        style={{
          maxWidth: 1500,
          margin: "0 auto",
          paddingTop: "max(68px, calc(env(safe-area-inset-top) + 56px))",
          paddingLeft: 16,
          paddingRight: 16,
          paddingBottom: "calc(80px + env(safe-area-inset-bottom, 16px))",
          boxSizing: "border-box",
          minWidth: 0,
          width: "100%",
        }}
      >
        {/* Main content */}
        <main style={{ paddingBottom: 16 }}>
          <Routes>
            <Route
              path="/"
              element={
                <Home
                  isAdmin={isAdmin}
                  userId={userId}
                  revealPreferences={tastingPrefs}
                  currentYear={currentYear}
                />
              }
            />
            <Route
              path="/year/:year/day/:dayNumber"
              element={
                <DayDetail
                  isAdmin={isAdmin}
                  userId={userId}
                  avatarUrl={avatarUrl}
                  firstName={firstName}
                  lastName={lastName}
                />
              }
            />
            <Route
              path="/stats"
              element={
                <Stats
                  isAdmin={isAdmin}
                  userId={userId}
                  currentYear={currentYear}
                />
              }
            />
            <Route
              path="/whiskey/:whiskeyDayId"
              element={
                <WhiskeyDetail
                  userId={userId}
                  isAdmin={isAdmin}
                  tastingMode={tastingMode}
                  avatarUrl={avatarUrl}
                  firstName={firstName}
                  lastName={lastName}
                />
              }
            />
            <Route
              path="/profile"
              element={
                profile && (
                  <ProfileScreen
                    profile={profile}
                    userId={userId}
                    userEmail={userEmail}
                    hasEmailAuth={hasEmailAuth}
                    onProfileUpdated={(updated) => onProfileUpdated(updated)}
                  />
                )
              }
            />
            <Route
              path="/admin"
              element={
                isAdmin
                  ? <AdminScreen userId={userId} />
                  : <Navigate to="/" replace />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Bottom navigation bar */}
        <BottomNav
          currentPath={location.pathname}
          onNavigate={goTo}
          avatarUrl={avatarUrl}
          avatarFirstName={firstName}
          avatarLastName={lastName}
          avatarEmail={userEmail}
          isAdmin={isAdmin}
        />

        {/* Add-to-home-screen banner (mobile only, dismissed persistently) */}
        <InstallBanner />

        {/* PWA update notification */}
        <PWAUpdatePrompt />
      </div>
    </div>
  );
}

export default App;