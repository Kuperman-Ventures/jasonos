import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * MCP-safe Supabase clients. Do not import `lib/supabase/server.ts` from the
 * stdio process — that file pulls in Next.js cookies.
 */

export function hasSupabaseConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function requireSupabaseConfig(): void {
  if (!hasSupabaseConfig()) {
    throw new Error(
      "JasonOS MCP is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
  }
}

export function jasonosDb(): SupabaseClient {
  requireSupabaseConfig();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "jasonos" }, auth: { persistSession: false } }
  );
}

export function publicDb(): SupabaseClient {
  requireSupabaseConfig();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
