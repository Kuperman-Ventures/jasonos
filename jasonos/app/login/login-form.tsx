"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/jasonos/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  function callbackUrl(extra: Record<string, string> = {}) {
    const params = new URLSearchParams({ next: nextPath, ...extra });
    return `${window.location.origin}/auth/callback?${params.toString()}`;
  }

  async function stampAndGo() {
    const stamp = await fetch("/auth/stamp", { method: "POST" });
    if (!stamp.ok) {
      const body = (await stamp.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error === "not_jason" ? "This account cannot open JasonOS." : "Could not finish sign-in.");
    }
    router.replace(nextPath);
    router.refresh();
  }

  async function unlockWithPasskey() {
    setBusy(true);
    setMessage("");
    try {
      const supabase = createAuthBrowserClient();
      const { error } = await supabase.auth.signInWithPasskey();
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
      const { error } = await supabase.auth.registerPasskey();
      if (error) {
        setMessage(error.message || "Could not add Face ID / Touch ID.");
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
      const supabase = createAuthBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl({ enroll: "1" }) },
      });
      if (error) setMessage(error.message);
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
      const supabase = createAuthBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: callbackUrl({ enroll: "1" }) },
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
          ? "This computer will remember you for 7 days. You can add a phone and a Mac separately."
          : "Face ID or Touch ID on this device. Google is only for the first time or a new computer."}
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

      {enroll ? (
        <button
          type="button"
          className="mt-4 text-sm text-muted-foreground hover:underline"
          disabled={busy}
          onClick={() => router.replace(nextPath)}
        >
          Skip for now
        </button>
      ) : null}

      {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
