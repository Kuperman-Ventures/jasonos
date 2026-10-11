"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/jasonos/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  registerPlatformPasskey,
  signInWithPlatformPasskey,
} from "@/lib/auth/passkeys-browser";
import { authCallbackUrl } from "@/lib/auth/session";
import { createAuthBrowserClient } from "@/lib/supabase/client";

export function LoginForm({
  nextPath,
  errorText,
  enroll,
}: {
  nextPath: string;
  errorText: string | null;
  enroll: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("jason@kupermanadvisors.com");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function rememberReturnPath() {
    await fetch("/auth/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ next: nextPath }),
    });
  }

  async function stampAndGo() {
    const stamp = await fetch("/auth/stamp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!stamp.ok) {
      const body = (await stamp.json().catch(() => null)) as { error?: string } | null;
      if (body?.error === "not_jason") throw new Error("This account cannot open JasonOS.");
      if (body?.error === "unlock_secret_missing") {
        throw new Error("Unlock secret is not configured on this deployment.");
      }
      if (body?.error === "passkey_required") {
        throw new Error(
          "Face ID / Touch ID did not create a passkey session. Try Add Face ID or Touch ID again."
        );
      }
      throw new Error("Could not finish sign-in.");
    }
    router.replace(nextPath);
    router.refresh();
  }

  async function unlockWithPasskey() {
    setBusy(true);
    setMessage("");
    try {
      const supabase = createAuthBrowserClient();
      const { error } = await signInWithPlatformPasskey(supabase);
      if (error) {
        setMessage(error.message || "Face ID / Touch ID did not complete.");
        return;
      }
      await stampAndGo();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Face ID / Touch ID did not complete.");
    } finally {
      setBusy(false);
    }
  }

  async function addPasskey() {
    setBusy(true);
    setMessage("");
    try {
      const supabase = createAuthBrowserClient();
      const { error: registerError } = await registerPlatformPasskey(supabase);
      if (registerError) {
        setMessage(registerError.message || "Could not add Face ID / Touch ID.");
        return;
      }
      // Registration alone leaves the Google/oauth session. Unlock requires a
      // recent `passkey` amr claim — sign in with the new credential next.
      const { error: signInError } = await signInWithPlatformPasskey(supabase);
      if (signInError) {
        setMessage(
          signInError.message ||
            "Passkey was added, but Face ID / Touch ID sign-in did not finish. Tap Unlock and try again."
        );
        return;
      }
      await stampAndGo();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add Face ID / Touch ID.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setMessage("");
    try {
      await rememberReturnPath();
      const supabase = createAuthBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: authCallbackUrl(window.location.origin) },
      });
      if (error) {
        setMessage(error.message);
        setBusy(false);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start Google sign-in");
      setBusy(false);
    }
  }

  async function sendLink(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await rememberReturnPath();
      const supabase = createAuthBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: authCallbackUrl(window.location.origin) },
      });
      if (error) setMessage(error.message);
      else setMessage("Check your email for a sign-in link.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send the link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-[420px] rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Logo size={28} priority />
        <p className="text-sm font-semibold tracking-tight">JasonOS</p>
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">
        {enroll ? "Add Face ID or Touch ID" : "Unlock JasonOS"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {enroll
          ? "Add Face ID or Touch ID on this Mac or phone. That unlocks JasonOS for 7 days. Google alone does not."
          : "Face ID or Touch ID on this device. Google is only to get you to the passkey screen."}
      </p>

      {errorText ? <p className="mt-3 text-sm text-destructive">{errorText}</p> : null}

      {enroll ? (
        <Button className="mt-5 w-full" disabled={busy} onClick={() => void addPasskey()}>
          {busy ? "Waiting for this device…" : "Add Face ID or Touch ID"}
        </Button>
      ) : (
        <Button className="mt-5 w-full" disabled={busy} onClick={() => void unlockWithPasskey()}>
          {busy ? "Waiting for this device…" : "Unlock with Face ID or Touch ID"}
        </Button>
      )}

      <button
        type="button"
        className="mt-3 w-full text-sm font-medium text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
        disabled={busy}
        onClick={() => void signInWithGoogle()}
      >
        Use Google instead
      </button>

      <form className="mt-6 space-y-2" onSubmit={(event) => void sendLink(event)}>
        <label className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Email a sign-in link
          <Input
            className="mt-1"
            type="email"
            autoComplete="username webauthn"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <Button type="submit" variant="outline" className="w-full" disabled={busy}>
          {busy ? "Sending…" : "Email me a link"}
        </Button>
      </form>

      {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
