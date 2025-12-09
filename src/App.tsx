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
import Profile from "./ProfileScreen";
import Onboarding from "./Onboarding";
import AppHeader from "./components/AppHeader";
import BottomNav from "./components/BottomNav";
import { Menu, MenuItem } from "@mui/material";
import { useTheme } from "@mui/material/styles";

type RevealMode = "PURIST" | "EXPLORER" | "RELAXED";

type ProfileRecord = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "admin" | "user" | null;
  reveal_mode: RevealMode | null;
  see_group_averages_pre_reveal: boolean | null;
  onboarding_complete?: boolean | null;
};

type RevealPreferences = {
  mode: RevealMode;
  see_group_averages_pre_reveal?: boolean;
} | null;

function App() {
  const theme = useTheme();

  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);

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

  const effectiveMode: RevealMode =
    profile?.reveal_mode === "PURIST" ||
    profile?.reveal_mode === "EXPLORER" ||
    profile?.reveal_mode === "RELAXED"
      ? profile.reveal_mode
      : "PURIST";

  const revealPreferences: RevealPreferences = {
    mode: effectiveMode,
    see_group_averages_pre_reveal:
      profile?.see_group_averages_pre_reveal ?? false,
  };

  let profileType = "";
  if (effectiveMode === "PURIST") {
    profileType = "Purist";
  } else if (effectiveMode === "EXPLORER") {
    profileType = "Explorer";
  } else if (effectiveMode === "RELAXED") {
    profileType = "Relaxed";
  }

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
        await loadProfile(session.user.id);
      }

      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
      if (newSession?.user) {
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    init();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error loading profile", error);
      return;
    }

    setProfile(data as ProfileRecord);
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
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
        <h1 style={{ marginBottom: 8 }}>Whiskey Advent</h1>
        <p style={{ marginBottom: 24 }}>
          Sign in to rate each day&apos;s whiskey.
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
  // Logged-in but profile not yet loaded
  // ---------------------------------------------------------
  if (!profile) {
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
        Loading profile…
      </div>
    );
  }

  // ---------------------------------------------------------
  // Logged-in but onboarding not complete
  // (for now we treat missing reveal_mode as "needs onboarding")
  // ---------------------------------------------------------
  const needsOnboarding =
    !profile.onboarding_complete && !profile.reveal_mode;

  if (needsOnboarding) {
    return <Onboarding profile={profile} />;
  }

  // ---------------------------------------------------------
  // Authenticated + onboarding complete (router shell)
  // ---------------------------------------------------------
  return (
    <BrowserRouter>
      <AppShell
        isAdmin={isAdmin}
        userId={session.user.id}
        revealPreferences={revealPreferences}
        profile={profile}
        currentYear={selectedYear}
        avatarUrl={avatarUrl}
        profileType={profileType}
        userEmail={session.user.email ?? ""}
        onProfileUpdated={(updated) => setProfile(updated)}
        onYearChange={(year) => setSelectedYear(year)}
      />
    </BrowserRouter>
  );
}

type AppShellProps = {
  isAdmin: boolean;
  userId: string;
  revealPreferences: RevealPreferences;
  profile: ProfileRecord | null;
  currentYear: number;
  avatarUrl?: string;
  profileType: string;
  userEmail: string;
  onProfileUpdated: (profile: ProfileRecord) => void;
  onYearChange: (year: number) => void;
};

function AppShell({
  isAdmin,
  userId,
  revealPreferences,
  profile,
  currentYear,
  avatarUrl,
  profileType,
  userEmail,
  onProfileUpdated,
  onYearChange,
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
          padding: "16px 16px 72px",
          boxSizing: "border-box",
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
                  revealPreferences={revealPreferences}
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
                  revealPreferences={revealPreferences}
                  currentYear={currentYear}
                />
              }
            />
            <Route
              path="/stats"
              element={
                <Stats
                  isAdmin={isAdmin}
                  userId={userId}
                  revealPreferences={revealPreferences}
                  currentYear={currentYear}
                />
              }
            />
            <Route 
              path="/whiskey/:whiskeyDayId" 
              element={
                <WhiskeyDetail 

                />
              } 
            />
            <Route
              path="/profile"
              element={
                profile && (
                  <Profile
                    profile={profile as any}
                    userEmail={userEmail}
                    onProfileUpdated={(updated) =>
                      onProfileUpdated(updated as ProfileRecord)
                    }
                  />
                )
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
        />
      </div>
    </div>
  );
}

export default App;