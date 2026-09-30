import "server-only";

import { createPublicClient, createPublicServiceRoleClient } from "@/lib/supabase/server";
import { normalizeAboutJason } from "@/lib/outreach/about-jason";

async function candidateUserIds(
  supabase: ReturnType<typeof createPublicServiceRoleClient>
): Promise<string[]> {
  const ids: string[] = [];
  const push = (id: string | null | undefined) => {
    const trimmed = id?.trim();
    if (trimmed && !ids.includes(trimmed)) ids.push(trimmed);
  };

  push(process.env.JASONOS_OWNER_USER_ID);

  try {
    const publicClient = await createPublicClient();
    const { data } = await publicClient.auth.getUser();
    push(data.user?.id);
  } catch {
    // no session
  }

  const { data } = await supabase
    .from("user_preferences")
    .select("user_id")
    .order("updated_at", { ascending: false })
    .limit(5);
  for (const row of (data as { user_id?: string }[] | null) ?? []) {
    push(row.user_id);
  }

  return ids;
}

/** Stored About Jason blurb, or empty string when unset. */
export async function loadStoredAboutJason(): Promise<string> {
  try {
    const supabase = createPublicServiceRoleClient();
    const userIds = await candidateUserIds(supabase);
    for (const userId of userIds) {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("about_jason")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        console.error("[about-jason] load failed", error.message);
        continue;
      }
      const about = normalizeAboutJason(
        (data as { about_jason?: string | null } | null)?.about_jason
      );
      if (about) return about;
    }
    return "";
  } catch (err) {
    console.error("[about-jason] load failed", err);
    return "";
  }
}
