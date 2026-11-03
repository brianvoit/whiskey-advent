import { supabase } from "../supabaseClient";

/**
 * Email + password accounts. Confirmation and reset emails are sent by
 * Supabase through the project's SMTP settings (Resend, from
 * whiskey-advent.com). Links come back to this site, which must be in the
 * Supabase Redirect URLs.
 */

/** Supabase's error messages, said the way the app says things. */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match. Forgot your password?";
  if (m.includes("email not confirmed")) return "Confirm your email first: check your inbox for the link we sent.";
  if (m.includes("already registered")) return "There's already an account with that email. Sign in instead.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many tries. Wait a minute and try again.";
  if (m.includes("password should be") || m.includes("weak password")) return "Choose a longer password: at least 8 characters.";
  return message;
}

export const MIN_PASSWORD_LENGTH = 8;

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(friendlyAuthError(error.message));
}

/**
 * Creates an account and sends the confirmation email. The name goes into the
 * profile (handle_new_user reads full_name). Supabase reports success even if
 * the address already has an account, so it can't be used to probe addresses.
 */
export async function signUpWithEmail(name: string, email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { full_name: name.trim() },
      emailRedirectTo: window.location.origin,
    },
  });
  if (error) throw new Error(friendlyAuthError(error.message));
}

/** Sends a reset link. Opening it fires PASSWORD_RECOVERY, which shows SetPasswordPage. */
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin,
  });
  if (error) throw new Error(friendlyAuthError(error.message));
}

export async function setNewPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(friendlyAuthError(error.message));
}
