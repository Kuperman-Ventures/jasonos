import "server-only";

// Read the person/company research brief stored on the contact (or the newest
// meeting copy). Kept free of AI SDK imports so opening the Meetings tab
// cannot fail just because the research generator module failed to load.

import { createServiceRoleClient } from "@/lib/supabase/server";

export type ContactResearch = {
  brief: string | null;
  researchedAt: string | null;
};

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function getContactResearch(
  contactId: string
): Promise<ContactResearch> {
  if (!hasConfig() || !contactId) return { brief: null, researchedAt: null };
  try {
    const sb = createServiceRoleClient();
    const { data: contact, error } = await sb
      .from("contacts")
      .select("research_brief, research_at")
      .eq("id", contactId)
      .maybeSingle();
    if (error) {
      console.error("[contact-research-store.get]", error.message);
      return { brief: null, researchedAt: null };
    }
    if (contact?.research_brief) {
      return {
        brief: contact.research_brief as string,
        researchedAt: (contact.research_at as string | null) ?? null,
      };
    }

    const { data: mtg, error: mtgErr } = await sb
      .from("meetings")
      .select("prep_research, prep_research_at")
      .eq("contact_id", contactId)
      .not("prep_research", "is", null)
      .order("prep_research_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (mtgErr) {
      console.error("[contact-research-store.meetingFallback]", mtgErr.message);
      return { brief: null, researchedAt: null };
    }
    if (mtg?.prep_research) {
      return {
        brief: mtg.prep_research as string,
        researchedAt: (mtg.prep_research_at as string | null) ?? null,
      };
    }
    return { brief: null, researchedAt: null };
  } catch (err) {
    console.error("[contact-research-store.get]", err);
    return { brief: null, researchedAt: null };
  }
}
