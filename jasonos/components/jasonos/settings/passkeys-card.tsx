"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  passkeyErrorMessage,
  registerPlatformPasskey,
  signInWithPlatformPasskey,
} from "@/lib/auth/passkeys-browser";
import { createAuthBrowserClient } from "@/lib/supabase/client";

type PasskeyRow = {
  id: string;
  friendly_name?: string | null;
  created_at?: string;
  last_used_at?: string | null;
};

export function PasskeysCard() {
  const [rows, setRows] = useState<PasskeyRow[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setMessage("");
    try {
      const supabase = createAuthBrowserClient();
      const { data, error } = await supabase.auth.passkey.list();
      if (error) {
        setMessage(error.message);
        setRows([]);
        return;
      }
      setRows((data ?? []) as PasskeyRow[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not list passkeys.");
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
        setMessage(passkeyErrorMessage(registerError));
        return;
      }
      // Refresh the session amr so a later unlock stamp can see passkey.
      const { error: signInError } = await signInWithPlatformPasskey(supabase);
      if (signInError) {
        setMessage(
          `Passkey added. Sign-in with it failed (${signInError.message}). Unlock may need a fresh Face ID / Touch ID.`
        );
      }
      await load();
    } catch (error) {
      setMessage(passkeyErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function removePasskey(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const supabase = createAuthBrowserClient();
      const { error } = await supabase.auth.passkey.delete({ passkeyId: id });
      if (error) {
        setMessage(error.message);
        return;
      }
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove that passkey.");
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Face ID / Touch ID</h2>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            Unlock JasonOS with this phone or Mac. Add one per device. Google is only the backup.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void load()}>
            {rows ? "Refresh" : "Show passkeys"}
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => void addPasskey()}>
            Add this device
          </Button>
        </div>
      </div>
      {rows ? (
        <ul className="mt-3 space-y-2">
          {rows.length === 0 ? (
            <li className="text-xs text-muted-foreground">No passkeys on this account yet.</li>
          ) : (
            rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 text-xs">
                <span>{row.friendly_name?.trim() || "Passkey"}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => void removePasskey(row.id)}
                >
                  Remove
                </Button>
              </li>
            ))
          )}
        </ul>
      ) : null}
      {message ? <p className="mt-3 text-xs text-muted-foreground">{message}</p> : null}
    </section>
  );
}
