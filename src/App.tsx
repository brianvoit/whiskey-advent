import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import "./App.css";

const ensureProfile = async (user: User) => {
  // Try to get some reasonable defaults from Google metadata
  const fullName =
    (user.user_metadata.full_name as string | undefined) ??
    (user.user_metadata.name as string | undefined) ??
    "";
  let firstName: string | null = null;
  let lastName: string | null = null;

  if (fullName) {
    const parts = fullName.split(" ");
    firstName = parts[0] ?? null;
    const rest = parts.slice(1).join(" ");
    lastName = rest || null;
  }

  const avatarUrl =
    (user.user_metadata.avatar_url as string | undefined) ??
    (user.user_metadata.picture as string | undefined) ??
    null;

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,          // must match auth.users id
      first_name: firstName,
      last_name: lastName,
      avatar_url: avatarUrl,
    },
    {
      onConflict: "id",
    }
  );

  if (error) {
    console.error("Error upserting profile", error);
  }
};

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const getSession = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("Error getting session", error);
    } else {
      const currentSession = data.session;
      setSession(currentSession);
      if (currentSession?.user) {
        // Make sure this user has a profile row
        void ensureProfile(currentSession.user);
      }
    }
    setLoading(false);
  };

  getSession();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, newSession) => {
    setSession(newSession);
    if (newSession?.user) {
      // Keep profile in sync on sign-in
      void ensureProfile(newSession.user);
    }
  });

  return () => {
    subscription.unsubscribe();
  };
}, []);

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "http://localhost:5173",
      },
    });
    if (error) {
      console.error("Error signing in", error);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out", error);
    }
  };

  if (loading) {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }

  if (!session) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Whiskey Advent</h1>
        <p>Sign in to get started.</p>
        <button onClick={handleSignIn}>Continue with Google</button>
      </div>
    );
  }

  const user = session.user;

  return (
    <div style={{ padding: 24 }}>
      <h1>Whiskey Advent</h1>
      <p>Signed in as {user.email}</p>
      <button onClick={handleSignOut}>Sign out</button>
    </div>
  );
}

export default App;