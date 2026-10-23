"use server";

import { revalidatePath } from "next/cache";
import { loadMeetingContext } from "@/lib/meeting-prep/context";
import { buildEmailContext, ensureEmailContext } from "@/lib/meeting-prep/email-context";
import { emailContextIsStale } from "@/lib/meeting-prep/email-context-text";
import { isContactThin } from "@/lib/meeting-prep/research-policy";
import {
  acceptAdaptation,
  attachPlanToMeeting,
  proposeAdaptation,
  type MeetingAdaptation,
} from "@/lib/server-actions/live-scripts";
import { draftMeetingPoints } from "@/lib/server-actions/meeting-points";
import { getMeetingPrep } from "@/lib/server-actions/meeting-prep";
import { runMeetingResearch } from "@/lib/server-actions/meeting-research";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type PlanSource = "playbook" | "guide" | "blank" | "chat";

type PlanResult<T> = ({ ok: true } & T) | { ok: false; error: string };

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function revalidateMeeting(prepId: string) {
  revalidatePath("/");
  revalidatePath("/live");
  revalidatePath(`/meetings/${prepId}`);
  revalidatePath("/meetings/[id]", "page");
}

export async function markPlanBuilt(
  prepId: string,
  source: PlanSource
): Promise<PlanResult<{ planBuiltAt: string; planSource: PlanSource }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };
  const now = new Date().toISOString();
  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("meeting_preps")
    .update({
      plan_built_at: now,
      plan_source: source,
      updated_at: now,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateMeeting(id);
  return { ok: true, planBuiltAt: now, planSource: source };
}

/** Research + email when stale; Used / Missing for Research, Email thread, Brief. */
export async function ensureResearchAndEmail(prepId: string): Promise<
  PlanResult<{
    contextUsed: string[];
    contextMissing: string[];
    researchVerified: boolean;
  }>
> {
  const prepResult = await getMeetingPrep(prepId);
  if (!prepResult.ok) return prepResult;
  const prep = prepResult.prep;

  let context;
  try {
    context = await loadMeetingContext(prepId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const thin = context.people.some((person) =>
    isContactThin({
      title: person.title,
      companyId: person.company ? "linked" : null,
      linkedinUrl: person.linkedinUrl,
      researchAt: person.researchAt,
    })
  );
  if (!prep.researchRanAt || thin) {
    const research = await runMeetingResearch(prepId, { force: !prep.researchRanAt || thin });
    if (!research.ok) return { ok: false, error: research.error };
  }

  if (!prep.emailContext?.trim() || emailContextIsStale(prep.emailContextAt)) {
    try {
      await buildEmailContext({
        id: prep.id,
        attendees: prep.attendees,
      });
    } catch (err) {
      console.error("[buildMeetingPlan] email context", err);
    }
  } else {
    try {
      await ensureEmailContext({
        id: prep.id,
        attendees: prep.attendees,
        emailContext: prep.emailContext,
        emailContextAt: prep.emailContextAt,
      });
    } catch (err) {
      console.error("[buildMeetingPlan] ensure email context", err);
    }
  }

  // Reload context for Used / Missing after research + email.
  try {
    context = await loadMeetingContext(prepId);
  } catch {
    /* keep prior */
  }
  const refreshed = await getMeetingPrep(prepId);
  const researchVerified = !(refreshed.ok && refreshed.prep.researchUnverified);
  const contextUsed: string[] = [];
  const contextMissing: string[] = [];
  if (context.people.some((person) => person.researchLead || person.researchBullets.length)) {
    contextUsed.push("Research");
  } else {
    contextMissing.push("Research");
  }
  if (refreshed.ok && refreshed.prep.emailContext?.trim()) {
    contextUsed.push("Email thread");
  } else {
    contextMissing.push("Email thread");
  }
  if (context.brief.summary?.trim()) contextUsed.push("Brief");
  else contextMissing.push("Brief");

  return { ok: true, contextUsed, contextMissing, researchVerified };
}

export async function buildMeetingPlan(input: {
  prepId: string;
  from: { kind: "playbook" | "guide" | "blank"; scriptId?: string | null };
}): Promise<
  PlanResult<{
    proposal?: MeetingAdaptation;
    written?: { added: number };
    contextUsed: string[];
    contextMissing: string[];
    researchVerified: boolean;
  }>
> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const prepId = input.prepId.trim();
  if (!prepId) return { ok: false, error: "Meeting prep not found." };
  const kind = input.from.kind;
  if (kind !== "playbook" && kind !== "guide" && kind !== "blank") {
    return { ok: false, error: "Pick how to build the plan." };
  }
  const scriptId = input.from.scriptId?.trim() || "";
  if ((kind === "playbook" || kind === "guide") && !scriptId) {
    return { ok: false, error: kind === "playbook" ? "Pick a playbook." : "Pick a guide." };
  }

  const prepared = await ensureResearchAndEmail(prepId);
  if (!prepared.ok) return prepared;

  if (kind === "playbook") {
    const proposed = await proposeAdaptation({ scriptId, prepId });
    if (!proposed.ok) return proposed;
    return {
      ok: true,
      proposal: proposed.adaptation,
      contextUsed: prepared.contextUsed,
      contextMissing: prepared.contextMissing,
      researchVerified: prepared.researchVerified,
    };
  }

  if (kind === "guide") {
    const attached = await attachPlanToMeeting({ scriptId, prepId, mode: "replace" });
    if (!attached.ok) return attached;
    const marked = await markPlanBuilt(prepId, "guide");
    if (!marked.ok) return marked;
    return {
      ok: true,
      written: { added: attached.added },
      contextUsed: prepared.contextUsed,
      contextMissing: prepared.contextMissing,
      researchVerified: prepared.researchVerified,
    };
  }

  const drafted = await draftMeetingPoints(prepId);
  if (!drafted.ok) return drafted;
  const marked = await markPlanBuilt(prepId, "blank");
  if (!marked.ok) return marked;
  return {
    ok: true,
    written: { added: drafted.added },
    contextUsed: drafted.contextUsed.length ? drafted.contextUsed : prepared.contextUsed,
    contextMissing: drafted.contextMissing.length ? drafted.contextMissing : prepared.contextMissing,
    researchVerified: prepared.researchVerified,
  };
}

/** Accept a playbook proposal. `acceptAdaptation` sets plan_built_at and plan_source. */
export async function acceptMeetingPlan(input: {
  adaptationId: string;
  mode?: "add" | "replace";
}): Promise<PlanResult<{ added: number }>> {
  const mode = input.mode === "add" ? "add" : "replace";
  return acceptAdaptation({ adaptationId: input.adaptationId, mode });
}

/** Force attendee research and refresh email context for the Who step. */
export async function recheckMeetingWho(prepId: string): Promise<
  PlanResult<{ researched: string[]; errors: string[] }>
> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };

  const research = await runMeetingResearch(id, { force: true });
  if (!research.ok) return research;

  const prepResult = await getMeetingPrep(id);
  if (!prepResult.ok) return prepResult;
  const prep = prepResult.prep;

  try {
    if (!prep.emailContext?.trim() || emailContextIsStale(prep.emailContextAt)) {
      await buildEmailContext({
        id: prep.id,
        attendees: prep.attendees,
      });
    } else {
      await ensureEmailContext({
        id: prep.id,
        attendees: prep.attendees,
        emailContext: prep.emailContext,
        emailContextAt: prep.emailContextAt,
      });
    }
  } catch (err) {
    console.error("[recheckMeetingWho] email context", err);
  }

  revalidateMeeting(id);
  return { ok: true, researched: research.researched, errors: research.errors };
}
