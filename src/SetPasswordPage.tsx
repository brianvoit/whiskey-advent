import { useState, type FormEvent } from "react";
import { useSiteTheme } from "./hooks/useSiteTheme";
import { MIN_PASSWORD_LENGTH, setNewPassword } from "./api/auth";
import "./HomePage.css";

/**
 * Shown after opening a password-reset link (Supabase's PASSWORD_RECOVERY
 * event): the link signs the person in, and this asks for the new password
 * before the app continues.
 */
export default function SetPasswordPage({ onDone }: { onDone: () => void }) {
  const theme = useSiteTheme();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await setNewPassword(password);
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="hp hp-login" data-theme={theme}>
      <main className="hp-wrap hp-login-main hp-login-main-single">
        <div className="hp-login-card">
          <p className="hp-eyebrow">Whiskey Advent</p>
          <h1 className="hp-login-title">Choose a new <em>password.</em></h1>
          <p className="hp-login-intro">You'll use it the next time you sign in with your email.</p>
          <form onSubmit={handleSubmit} className="hp-login-form">
            <label className="hp-login-label">
              New password (at least {MIN_PASSWORD_LENGTH} characters)
              <input
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="hp-login-input"
              />
            </label>
            <label className="hp-login-label">
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="hp-login-input"
              />
            </label>
            <button type="submit" disabled={busy} className="hp-btn hp-btn-primary hp-login-submit">
              {busy ? "Saving…" : "Save password"}
            </button>
          </form>
          {error && <p role="alert" className="hp-login-error">{error}</p>}
        </div>
      </main>
    </div>
  );
}
