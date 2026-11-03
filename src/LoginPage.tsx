import type { FormEvent, MouseEvent } from "react";
import { useBodyBackground } from "./hooks/useBodyBackground";
import { getStoredInvite } from "./utils/invite";
import "./HomePage.css";

type LoginPageProps = {
  email: string;
  password: string;
  error: string | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onGoogleSignIn: () => void;
  onEmailSignIn: (e: FormEvent) => void;
  /** Back to the public homepage without a full page load. */
  onHome: () => void;
};

/**
 * Sign-in screen for signed-out visitors on any path other than "/". Styled
 * to match the homepage (shares HomePage.css), not the app's theme.
 */
export default function LoginPage({
  email,
  password,
  error,
  onEmailChange,
  onPasswordChange,
  onGoogleSignIn,
  onEmailSignIn,
  onHome,
}: LoginPageProps) {
  useBodyBackground("#120C08");
  const invited = getStoredInvite() !== null;

  const handleHome = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onHome();
  };

  return (
    <div className="hp hp-login">
      <header className="hp-header">
        <nav aria-label="Main" className="hp-wrap hp-nav">
          <a href="/" onClick={handleHome} className="hp-brand">
            <svg aria-hidden="true" width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#D08A4A" strokeWidth="1.6">
              <path d="M5 6h18l-2 17H7L5 6z" />
              <path d="M6.2 15h15.6" />
            </svg>
            <span className="hp-brand-name">Whiskey Advent</span>
          </a>
          <a href="/" onClick={handleHome} className="hp-login-back">Back to home</a>
        </nav>
      </header>

      <main className="hp-login-main">
        <div className="hp-login-card">
          <p className="hp-eyebrow">By invitation</p>
          <h1 className="hp-login-title">Sign <em>in.</em></h1>
          <p className="hp-login-intro">
            {invited
              ? "You've been invited. Continue with Google and you'll go straight in."
              : "New here? Sign in with the account you were invited with, and an admin will let you in."}
          </p>

          <button type="button" onClick={onGoogleSignIn} className="hp-login-google">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
              <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7l7.9-6.1z" />
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
            </svg>
            Continue with Google
          </button>

          <div className="hp-login-divider"><span>or sign in with email</span></div>

          <form onSubmit={onEmailSignIn} className="hp-login-form">
            <label className="hp-login-label">
              Email
              <input
                type="email"
                autoComplete="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                className="hp-login-input"
              />
            </label>
            <label className="hp-login-label">
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                className="hp-login-input"
              />
            </label>
            <button type="submit" className="hp-btn hp-btn-primary hp-login-submit">
              Continue with email
            </button>
          </form>

          {error && <p role="alert" className="hp-login-error">{error}</p>}
        </div>

        {/* Google's OAuth verification requires the privacy policy to be
            reachable from the sign-in screen. */}
        <p className="hp-login-links">
          <a href="/" onClick={handleHome}>Home</a>
          <span aria-hidden="true"> · </span>
          <a href="/privacy">Privacy</a>
          <span aria-hidden="true"> · </span>
          <a href="/terms">Terms</a>
        </p>
      </main>
    </div>
  );
}
