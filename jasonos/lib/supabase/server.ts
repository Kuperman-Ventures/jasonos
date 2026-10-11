import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const passkeyAuth = { experimental: { passkey: true as const } };

// Server-side Supabase client (use inside Server Components, Server Actions,
// or Route Handlers). Scoped to the `jasonos` schema.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "jasonos" },
      auth: passkeyAuth,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignored — happens when called from a Server Component
          }
        },
      },
    }
  );
}

// Auth-aware public schema client for bridge tables that intentionally live
// outside the JasonOS schema.
export async function createPublicClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: passkeyAuth,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignored — happens when called from a Server Component
          }
        },
      },
    }
  );
}

/** Auth-only server client for login callback, stamp, and sign-out. */
export async function createAuthServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase Auth is not configured");
  const cookieStore = await cookies();
  return createServerClient(url, anon, {
    auth: passkeyAuth,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // ignored — happens when called from a Server Component
        }
      },
    },
  });
}

// Service-role client for trusted background work (BNA runs, integrations).
// Never expose this to the browser.
export function createServiceRoleClient() {
  return createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "jasonos" }, auth: { persistSession: false } }
  );
}

// Reconnect's rr_ tables currently live in the public schema.
export function createPublicServiceRoleClient() {
  return createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "public" }, auth: { persistSession: false } }
  );
}
