import "server-only";

import { createPublicClient, createPublicServiceRoleClient } from "@/lib/supabase/server";
import {
  DEFAULT_BRIEF_SECTIONS,
  normalizeRelationshipBriefPrompt,
  parseBriefSections,
  resolveRelationshipBriefPrompt,
  type BriefSectionFlags,
} from "@/lib/outreach/relationship-brief";

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

export async function loadRelationshipBriefPromptState(): Promise<{
  prompt: string;
  stored: string | null;
  version: number;
  sections: BriefSectionFlags;
  updatedAt: string | null;
}> {
  const empty = {
    prompt: resolveRelationshipBriefPrompt(null),
    stored: null as string | null,
    version: 0,
    sections: { ...DEFAULT_BRIEF_SECTIONS },
    updatedAt: null as string | null,
  };
  try {
    const supabase = createPublicServiceRoleClient();
    const userId = await ownerUserId(supabase);
    if (!userId) return empty;
    const { data, error } = await supabase
      .from("user_preferences")
      .select(
        "relationship_brief_prompt,relationship_brief_prompt_version,relationship_brief_sections,relationship_brief_prompt_updated_at"
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("[relationship-brief] load prompt failed", error.message);
      return empty;
    }
    const row = data as {
      relationship_brief_prompt?: string | null;
      relationship_brief_prompt_version?: number | null;
      relationship_brief_sections?: unknown;
      relationship_brief_prompt_updated_at?: string | null;
    } | null;
    const stored = normalizeRelationshipBriefPrompt(
      row?.relationship_brief_prompt
    );
    return {
      prompt: resolveRelationshipBriefPrompt(stored),
      stored,
      version: Number(row?.relationship_brief_prompt_version) || 0,
      sections: parseBriefSections(row?.relationship_brief_sections),
      updatedAt: row?.relationship_brief_prompt_updated_at ?? null,
    };
  } catch (err) {
    console.error("[relationship-brief] load prompt failed", err);
    return empty;
  }
}
