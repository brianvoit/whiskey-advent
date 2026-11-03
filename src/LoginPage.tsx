import { useState, type FormEvent, type MouseEvent } from "react";
import { useSiteTheme } from "./hooks/useSiteTheme";
import { appNow } from "./utils/clock";
import { getTodayDoor } from "./utils/heroCalendar";
import { getStoredInvite } from "./utils/invite";
import { MIN_PASSWORD_LENGTH, sendPasswordReset, signInWithEmail, signUpWithEmail } from "./api/auth";
import { HeroDoors, SiteFooter, SiteHeader } from "./SiteChrome";
import "./HomePage.css";

type LoginPageProps = {
  /** Error from the Google sign-in, which App starts. */
  googleError: string | null;
  onGoogleSignIn: () => void;
  /** To the public homepage (a section of it, or "top"), without a full page load. */
  onGoTo: (sectionId: string) => void;
};

type Mode = "signin" | "signup" | "forgot" | "confirm-sent" | "reset-sent";

/**
 * Sign-in screen for signed-out visitors on any path other than "/": Google,
 * or email + password (sign in, create an account, reset a password). Styled
 * to match the homepage (shares HomePage.css), not the app's theme. A
 * successful email sign-in is picked up by App's auth listener.
 */
export default function LoginPage({ googleError, onGoogleSignIn, onGoTo }: LoginPageProps) {
  const theme = useSiteTheme();
  const invited = getStoredInvite() !== null;
  const [exampleDay] = useState(() => 1 + Math.floor(Math.random() * 24));
  const now = appNow();
  const todayDoor = getTodayDoor(now, exampleDay);
  const inSeason = now.getMonth() === 11 && now.getDate() <= 24;

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchTo = (next: Mode) => (e?: MouseEvent) => {
    e?.preventDefault();
    setError(null);
    setPassword("");
    setMode(next);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(email, password);
      } else if (mode === "signup") {
        await signUpWithEmail(name, email, password);
        setMode("confirm-sent");
      } else if (mode === "forgot") {
        await sendPasswordReset(email);
        setMode("reset-sent");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === "signup" ? <>Create an <em>account.</em></> :
    mode === "forgot" ? <>Reset your <em>password.</em></> :
    mode === "confirm-sent" || mode === "reset-sent" ? <>Check your <em>email.</em></> :
    <>Sign <em>in.</em></>;

  const intro =
    mode === "signup" ? "Use any email address. We'll send a link to confirm it's yours." :
    mode === "forgot" ? "Enter the email you signed up with and we'll send you a link to choose a new password." :
    mode === "confirm-sent" ? `We sent a confirmation link to ${email.trim()}. Open it on this device to finish creating your account.` :
    mode === "reset-sent" ? `If ${email.trim()} has an account, a link to choose a new password is on its way.` :
    invited ? "You've been invited. Sign in or create an account and you'll go straight in." :
    "New here? Sign in with the account you were invited with, and an admin will let you in.";

  const sent = mode === "confirm-sent" || mode === "reset-sent";

  return (
    <div className="hp hp-login" data-theme={theme}>
      <SiteHeader page="login" onGoTo={onGoTo} />

      <main className="hp-wrap hp-login-main">
        <section className="hp-login-aside" aria-label="About Whiskey Advent">
          <p className="hp-eyebrow">By invitation · December 1–24</p>
          <h2 className="hp-login-aside-title">
            {inSeason ? <>Day {now.getDate()} is <em>waiting.</em></> : <>Your door is <em>waiting.</em></>}
          </h2>
          <p className="hp-login-aside-lede">
            Twenty-four pours, one a day. Rate each one, keep your tasting notes, and see how your
            palate compares with the group.
          </p>
          <HeroDoors todayDoor={todayDoor} compact />
        </section>

        <div className="hp-login-card">
          <p className="hp-eyebrow">By invitation</p>
          <h1 className="hp-login-title">{title}</h1>
          <p className="hp-login-intro">{intro}</p>

          {sent ? (
            <button type="button" onClick={switchTo("signin")} className="hp-btn hp-btn-primary hp-login-submit">
              Back to sign in
            </button>
          ) : (
            <>
              {(mode === "signin" || mode === "signup") && (
                <>
                  <button type="button" onClick={onGoogleSignIn} className="hp-login-google">
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
                      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7l7.9-6.1z" />
                      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
                    </svg>
                    Continue with Google
                  </button>
                  {googleError && <p role="alert" className="hp-login-error">{googleError}</p>}
                  <div className="hp-login-divider">
                    <span>{mode === "signup" ? "or create one with email" : "or sign in with email"}</span>
                  </div>
                </>
              )}

              <form onSubmit={handleSubmit} className="hp-login-form">
                {mode === "signup" && (
                  <label className="hp-login-label">
                    Your name
                    <input
                      type="text"
                      autoComplete="name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="hp-login-input"
                    />
                  </label>
                )}
                <label className="hp-login-label">
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="hp-login-input"
                  />
                </label>
                {mode !== "forgot" && (
                  <label className="hp-login-label">
                    {mode === "signup" ? `Password (at least ${MIN_PASSWORD_LENGTH} characters)` : "Password"}
                    <input
                      type="password"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="hp-login-input"
                    />
                  </label>
                )}
                <button type="submit" disabled={busy} className="hp-btn hp-btn-primary hp-login-submit">
                  {busy ? "One moment…" :
                    mode === "signup" ? "Create account" :
                    mode === "forgot" ? "Send reset link" :
                    "Sign in"}
                </button>
              </form>

              {error && <p role="alert" className="hp-login-error">{error}</p>}

              <p className="hp-login-switch">
                {mode === "signin" && (
                  <>
                    <a href="#forgot" onClick={switchTo("forgot")}>Forgot password?</a>
                    <span aria-hidden="true"> · </span>
                    <a href="#signup" onClick={switchTo("signup")}>Create an account</a>
                  </>
                )}
                {mode === "signup" && (
                  <>Already have an account? <a href="#signin" onClick={switchTo("signin")}>Sign in</a></>
                )}
                {mode === "forgot" && <a href="#signin" onClick={switchTo("signin")}>Back to sign in</a>}
              </p>
            </>
          )}
        </div>

      </main>

      {/* Includes the Privacy link, which Google's OAuth verification requires
          on the sign-in screen. */}
      <SiteFooter />
    </div>
  );
}
