"use client";

import { createBrowserClient } from "@supabase/ssr";

const passkeyAuth = { experimental: { passkey: true as const } };

function requireAuthEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase Auth is not configured");
  return { url, anon };
}

// Browser-side Supabase client, scoped to the `jasonos` Postgres schema.
// Add `jasonos` to Supabase Dashboard → API → Exposed schemas for this to work.
export function createClient() {
  const { url, anon } = requireAuthEnv();
  return createBrowserClient(url, anon, {
    db: { schema: "jasonos" },
    auth: passkeyAuth,
  });
}

/** Browser Auth client for login and passkeys. Does not query jasonos tables. */
export function createAuthBrowserClient() {
  const { url, anon } = requireAuthEnv();
  return createBrowserClient(url, anon, { auth: passkeyAuth });
}
