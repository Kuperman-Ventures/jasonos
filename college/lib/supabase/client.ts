"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Browser Auth client for the login page only. Does not query college tables. */
export function createAuthBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase Auth is not configured");
  return createBrowserClient(url, anon);
}
