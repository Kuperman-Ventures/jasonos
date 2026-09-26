"use client";

import { type FormEvent, useState } from "react";
import Image from "next/image";
import { createAuthBrowserClient } from "@/lib/supabase/client";

export function LoginForm({
  nextPath,
  errorCode,
}: {
  nextPath: string;
  errorCode: string | null;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const errorText =
    errorCode === "auth_not_configured"
      ? "Login is not fully configured on this deployment yet."
      : errorCode === "not_a_member"
        ? "That account is not on the household list for The Track."
        : errorCode === "not_active"
          ? "That account exists but is not turned on for this site yet."
          : errorCode === "auth"
            ? "Sign-in did not finish. Try again."
            : null;

  async function sendLink(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = createAuthBrowserClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Check your email for a sign-in link.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send the link");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setMessage("");
    try {
      const supabase = createAuthBrowserClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (error) setMessage(error.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start Google sign-in");
      setBusy(false);
    }
  }

  return (
    <div className="login-card">
      <div className="lockup">
        <Image src="/logo.png" alt="" width={62} height={46} className="site-logo" priority />
        <p className="lockup-name">The Track</p>
      </div>
      <h1>Sign in</h1>
      <p className="section-sub">Kyle, Jason, and Kat share this plan. Sign in with your household account.</p>

      {errorText ? <p className="login-error">{errorText}</p> : null}

      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void signInWithGoogle()}>
        Continue with Google
      </button>

      <p className="login-or">or email a sign-in link</p>

      <form className="login-form" onSubmit={(event) => void sendLink(event)}>
        <label className="stack-field">
          <span className="label">Email</span>
          <input
            className="field"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <button type="submit" className="btn btn-secondary" disabled={busy}>
          {busy ? "Sending..." : "Email me a link"}
        </button>
      </form>

      {message ? <p className="login-message">{message}</p> : null}
    </div>
  );
}
