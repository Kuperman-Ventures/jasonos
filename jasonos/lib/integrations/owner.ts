import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

const ADVISORS_OWNER_EMAIL = "jason@kupermanadvisors.com";

/**
 * Single-user JasonOS owner id for OAuth token storage.
 *
 * Never use auth.admin.listUsers({ perPage: 1 }) alone — that returns an
 * unstable first page and has written personal-Gmail tokens onto the wrong
 * Auth user when family accounts exist in the same project.
 */
export async function resolveJasonosOwnerUserId(): Promise<string | null> {
  const sb = createServiceRoleClient();

  // Prefer whoever already holds Advisors Google — that's the live operator.
  const { data: advisorsRow } = await sb
    .from("user_integrations")
    .select("user_id")
    .eq("provider", "google")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (advisorsRow?.user_id) return advisorsRow.user_id as string;

  const { data: listed } = await sb.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const users = listed?.users ?? [];
  if (!users.length) return null;

  const advisors = users.find(
    (u) => (u.email ?? "").trim().toLowerCase() === ADVISORS_OWNER_EMAIL
  );
  if (advisors?.id) return advisors.id;

  // Oldest Auth user as last resort (stable across connects).
  const sorted = [...users].sort(
    (a, b) =>
      Date.parse(a.created_at ?? "") - Date.parse(b.created_at ?? "")
  );
  return sorted[0]?.id ?? null;
}
