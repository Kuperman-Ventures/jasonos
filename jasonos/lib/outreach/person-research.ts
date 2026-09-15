import "server-only";

// Person + company web-search brief, stored on the contact so it can run
// without a scheduled meeting. Meeting prep copies the same brief.

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  buildResearchBriefModel,
  serializeResearchBrief,
} from "@/lib/ai/research-brief";
import { resolveContactFirm } from "@/lib/outreach/contact-firm";
import type { ContactResearch } from "@/lib/outreach/contact-research-store";

export type { ContactResearch };

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function revalidate() {
  revalidatePath("/activity");
  revalidatePath("/outreach");
}

async function loadNameAndFirm(
  sb: ReturnType<typeof createServiceRoleClient>,
  contactId: string
): Promise<{ name: string; firm: string | null } | { error: string }> {
  const { data: contact, error } = await sb
    .from("contacts")
    .select("name,tags,company_id")
    .eq("id", contactId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!contact) return { error: "Contact not found." };

  const name = (contact.name as string) ?? "";
  if (!name.trim()) return { error: "Contact has no name to research." };

  let companyName: string | null = null;
  const companyId = (contact.company_id as string | null) ?? null;
  if (companyId) {
    const { data: co } = await sb
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();
    companyName = (co?.name as string | null) ?? null;
  }

  return {
    name,
    firm: resolveContactFirm(companyName, (contact.tags as string[] | null) ?? []),
  };
}

async function buildBrief(name: string, firm: string | null): Promise<string> {
  const { researchPersonNews } = await import("@/lib/ai/research");
  const res = await researchPersonNews({ name, firm });
  const who = firm ? `${name} (${firm})` : name;
  const model = buildResearchBriefModel({
    text: res.text,
    sources: res.sources,
    searched: res.searched,
    emptyFallback: `No notable recent public news found for ${who}. Check LinkedIn activity, the company site, and Crunchbase/PitchBook directly.`,
  });
  return serializeResearchBrief(
    !res.searched && !model.empty
      ? {
          ...model,
          notes: [
            ...model.notes,
            "Live web search returned no sources — treat the above as unverified.",
          ],
        }
      : model
  );
}

export async function runContactResearch(
  contactId: string
): Promise<Result<{ research: ContactResearch }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured." };
  if (!contactId) return { ok: false, error: "contactId is required." };

  const sb = createServiceRoleClient();
  const loaded = await loadNameAndFirm(sb, contactId);
  if ("error" in loaded) return { ok: false, error: loaded.error };

  let brief: string;
  try {
    brief = await buildBrief(loaded.name, loaded.firm);
  } catch (err) {
    console.error("[person-research.runContactResearch]", err);
    const message =
      err instanceof Error && err.message.trim()
        ? err.message.trim()
        : "Couldn't run the web search.";
    return { ok: false, error: message };
  }

  const nowIso = new Date().toISOString();
  const { error } = await sb
    .from("contacts")
    .update({ research_brief: brief, research_at: nowIso, updated_at: nowIso })
    .eq("id", contactId);
  if (error) return { ok: false, error: error.message };

  // Keep upcoming meeting prep in sync so a later calendar event still has the brief.
  const { error: mtgErr } = await sb
    .from("meetings")
    .update({
      prep_research: brief,
      prep_research_at: nowIso,
      updated_at: nowIso,
    })
    .eq("contact_id", contactId)
    .eq("status", "scheduled");
  if (mtgErr) {
    console.error("[person-research.copyToMeetings]", mtgErr);
  }

  revalidate();
  return { ok: true, research: { brief, researchedAt: nowIso } };
}
