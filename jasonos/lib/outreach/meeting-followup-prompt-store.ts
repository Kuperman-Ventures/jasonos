import "server-only";

import { createPublicClient, createPublicServiceRoleClient } from "@/lib/supabase/server";
import {
  normalizeMeetingFollowupPrompt,
  resolveMeetingFollowupPrompt,
} from "@/lib/outreach/meeting-followup-prompt";

async function ownerUserId(
  supabase: ReturnType<typeof createPublicServiceRoleClient>
): Promise<string | null> {
  const configured = process.env.JASONOS_OWNER_USER_ID?.trim();
  if (configured) return configured;

  try {
    const publicClient = await createPublicClient();
    const { data } = await publicClient.auth.getUser();
    if (data.user?.id) return data.user.id;
  } catch {
    // no session
  }

  const { data } = await supabase
    .from("user_preferences")
    .select("user_id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { user_id?: string } | null)?.user_id ?? null;
}

/** Stored override, or null when using the in-code default. */
export async function loadStoredMeetingFollowupPrompt(): Promise<string | null> {
  try {
    const supabase = createPublicServiceRoleClient();
    const userId = await ownerUserId(supabase);
    if (!userId) return null;
    const { data, error } = await supabase
      .from("user_preferences")
      .select("meeting_followup_prompt")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("[meeting-followup-prompt] load failed", error.message);
      return null;
    }
    return normalizeMeetingFollowupPrompt(
      (data as { meeting_followup_prompt?: string | null } | null)
        ?.meeting_followup_prompt
    );
  } catch (err) {
    console.error("[meeting-followup-prompt] load failed", err);
    return null;
  }
}

/** Guidance text used at compose time (stored override or default). */
export async function loadMeetingFollowupPromptGuidance(): Promise<string> {
  const stored = await loadStoredMeetingFollowupPrompt();
  return resolveMeetingFollowupPrompt(stored);
}
