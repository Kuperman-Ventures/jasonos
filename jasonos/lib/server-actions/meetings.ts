"use server";

// Meetings — prep → held → debrief records for a single contact. Backs the
// contact card's Meeting tab. Marking a meeting held also writes a conversation
// touch (via the shared touch-capture helper) so it flows into the networking
// activity heatmap and funnel.

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { insertContactTouches, type TouchChannel } from "@/lib/outreach/touch-capture";
import type { TouchObjective } from "@/lib/outreach/types";
import { researchPersonNews } from "@/lib/ai/research";

export interface IntroWish {
  name: string;
  company: string;
}

export type MeetingChannel = "call" | "video" | "in_person" | "coffee_chat";
export type MeetingStatus = "scheduled" | "held" | "cancelled";

export interface Meeting {
  id: string;
  contactId: string;
  scheduledAt: string; // ISO
  channel: MeetingChannel;
  status: MeetingStatus;
  prepGoal: string | null;
  prepNotes: string | null;
  debriefNotes: string | null;
  objectiveAchieved: TouchObjective | null;
  thankYouSent: boolean;
  nextStep: string | null;
  heldAt: string | null;
  prepResearch: string | null;
  prepResearchAt: string | null;
  introWishlist: IntroWish[];
  /** Google Calendar event id when this row was created/updated by calendar sync. */
  gcalEventId: string | null;
  calendarUrl: string | null;
  title: string | null;
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
type OkResult = { ok: true } | { ok: false; error: string };

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function rowToMeeting(row: Record<string, unknown>): Meeting {
  return {
    id: row.id as string,
    contactId: row.contact_id as string,
    scheduledAt: row.scheduled_at as string,
    channel: ((row.channel as string) ?? "video") as MeetingChannel,
    status: ((row.status as string) ?? "scheduled") as MeetingStatus,
    prepGoal: (row.prep_goal as string | null) ?? null,
    prepNotes: (row.prep_notes as string | null) ?? null,
    debriefNotes: (row.debrief_notes as string | null) ?? null,
    objectiveAchieved: (row.objective_achieved as TouchObjective | null) ?? null,
    thankYouSent: Boolean(row.thank_you_sent),
    nextStep: (row.next_step as string | null) ?? null,
    heldAt: (row.held_at as string | null) ?? null,
    prepResearch: (row.prep_research as string | null) ?? null,
    prepResearchAt: (row.prep_research_at as string | null) ?? null,
    introWishlist: Array.isArray(row.intro_wishlist)
      ? (row.intro_wishlist as unknown[])
          .map((x) => {
            const o = (x ?? {}) as { name?: unknown; company?: unknown };
            return {
              name: typeof o.name === "string" ? o.name : "",
              company: typeof o.company === "string" ? o.company : "",
            };
          })
          .filter((w) => w.name || w.company)
      : [],
    gcalEventId: (row.gcal_event_id as string | null) ?? null,
    calendarUrl: (row.calendar_url as string | null) ?? null,
    title: (row.title as string | null) ?? null,
  };
}

export async function getMeetingsForContact(contactId: string): Promise<Meeting[]> {
  if (!hasConfig() || !contactId) return [];
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meetings")
    .select("*")
    .eq("contact_id", contactId)
    .order("scheduled_at", { ascending: false });
  if (error) {
    console.error("[meetings.getMeetingsForContact]", error);
    return [];
  }
  return (data ?? []).map(rowToMeeting);
}

export async function createMeeting(input: {
  contactId: string;
  scheduledAt: string;
  channel?: MeetingChannel;
  prepGoal?: string | null;
  prepNotes?: string | null;
}): Promise<Result<{ meeting: Meeting }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured." };
  if (!input.contactId) return { ok: false, error: "contactId is required." };
  if (!input.scheduledAt) return { ok: false, error: "A date/time is required." };

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meetings")
    .insert({
      contact_id: input.contactId,
      scheduled_at: input.scheduledAt,
      channel: input.channel ?? "video",
      status: "scheduled",
      prep_goal: input.prepGoal?.trim() || null,
      prep_notes: input.prepNotes?.trim() || null,
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/activity");
  return { ok: true, meeting: rowToMeeting(data) };
}

export async function updateMeetingPrep(
  id: string,
  patch: {
    scheduledAt?: string;
    channel?: MeetingChannel;
    prepGoal?: string | null;
    prepNotes?: string | null;
    introWishlist?: IntroWish[];
  }
): Promise<Result<{ meeting: Meeting }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured." };
  if (!id) return { ok: false, error: "id is required." };

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.scheduledAt) payload.scheduled_at = patch.scheduledAt;
  if (patch.channel) payload.channel = patch.channel;
  if (patch.prepGoal !== undefined) payload.prep_goal = patch.prepGoal?.trim() || null;
  if (patch.prepNotes !== undefined)
    payload.prep_notes = patch.prepNotes?.trim() || null;
  if (patch.introWishlist !== undefined) {
    payload.intro_wishlist = patch.introWishlist
      .map((w) => ({ name: (w.name ?? "").trim(), company: (w.company ?? "").trim() }))
      .filter((w) => w.name || w.company);
  }

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meetings")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/activity");
  return { ok: true, meeting: rowToMeeting(data) };
}

// Mark a meeting held + record the debrief. Also writes a conversation touch so
// the meeting shows up in the activity heatmap and funnel.
export async function markMeetingHeld(
  id: string,
  debrief: {
    debriefNotes?: string | null;
    objectiveAchieved?: TouchObjective | null;
    thankYouSent?: boolean;
    nextStep?: string | null;
  }
): Promise<Result<{ meeting: Meeting }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured." };
  if (!id) return { ok: false, error: "id is required." };

  const sb = createServiceRoleClient();
  const { data: existing, error: readErr } = await sb
    .from("meetings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!existing) return { ok: false, error: "Meeting not found." };

  const contactId = existing.contact_id as string;
  const channel = ((existing.channel as string) ?? "video") as TouchChannel;
  const heldAtIso = (existing.scheduled_at as string) ?? new Date().toISOString();

  // Log the meeting as a conversation touch (feeds heatmap + funnel + cadence).
  const linkedTouchId: string | null =
    (existing.linked_touch_id as string | null) ?? null;
  if (!linkedTouchId) {
    const touchResult = await insertContactTouches([
      {
        contact_id: contactId,
        channel,
        direction: "outbound",
        touched_at: heldAtIso,
        source: "manual",
        brief: existing.prep_goal ? `Meeting: ${existing.prep_goal as string}` : "Meeting",
        objective_achieved: debrief.objectiveAchieved ?? null,
        outcome: debrief.nextStep?.trim() || debrief.debriefNotes?.trim() || null,
      },
    ]);
    if (touchResult.errors.length) {
      // Non-fatal: still record the debrief even if the touch insert failed.
      console.error("[meetings.markMeetingHeld.touch]", touchResult.errors);
    }
  }

  const { data, error } = await sb
    .from("meetings")
    .update({
      status: "held",
      held_at: new Date().toISOString(),
      debrief_notes: debrief.debriefNotes?.trim() || null,
      objective_achieved: debrief.objectiveAchieved ?? null,
      thank_you_sent: Boolean(debrief.thankYouSent),
      next_step: debrief.nextStep?.trim() || null,
      linked_touch_id: linkedTouchId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/activity");
  return { ok: true, meeting: rowToMeeting(data) };
}

// Run an AI web-search brief for a meeting's contact (recent news about the
// person + their company) and store it on the meeting.
export async function runMeetingResearch(
  id: string
): Promise<Result<{ meeting: Meeting }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured." };
  if (!id) return { ok: false, error: "id is required." };

  const sb = createServiceRoleClient();
  const { data: mtg, error: mErr } = await sb
    .from("meetings")
    .select("contact_id")
    .eq("id", id)
    .maybeSingle();
  if (mErr) return { ok: false, error: mErr.message };
  if (!mtg) return { ok: false, error: "Meeting not found." };

  const { data: contact } = await sb
    .from("contacts")
    .select("name,tags,company_id")
    .eq("id", mtg.contact_id as string)
    .maybeSingle();
  const name = (contact?.name as string) ?? "";
  if (!name) return { ok: false, error: "Contact has no name to research." };

  // Resolve firm: company_id → companies.name, else firm:<slug> tag.
  let firm: string | null = null;
  const companyId = (contact?.company_id as string | null) ?? null;
  if (companyId) {
    const { data: co } = await sb
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();
    firm = (co?.name as string | null) ?? null;
  }
  if (!firm) {
    const tag = ((contact?.tags as string[] | null) ?? []).find((t) =>
      t.startsWith("firm:")
    );
    if (tag) firm = tag.slice("firm:".length).replace(/-/g, " ");
  }

  let brief: string;
  try {
    const res = await researchPersonNews({ name, firm });
    const sourceLines = res.sources.length
      ? "\n\nSources:\n" +
        res.sources
          .slice(0, 8)
          .map((s) => `- ${s.title ? `${s.title} — ` : ""}${s.url}`)
          .join("\n")
      : "";
    brief =
      (res.searched
        ? res.text
        : `${res.text}\n\n(Note: live web search returned no sources — treat the above as unverified.)`) +
      sourceLines;
  } catch (err) {
    console.error("[meetings.runMeetingResearch]", err);
    const message =
      err instanceof Error && err.message.trim()
        ? err.message.trim()
        : "Couldn't run the web search.";
    return { ok: false, error: message };
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from("meetings")
    .update({ prep_research: brief, prep_research_at: nowIso, updated_at: nowIso })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/activity");
  return { ok: true, meeting: rowToMeeting(data) };
}

export async function setMeetingStatus(
  id: string,
  status: MeetingStatus
): Promise<OkResult> {
  if (!hasConfig()) return { ok: false, error: "Not configured." };
  if (!id) return { ok: false, error: "id is required." };
  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("meetings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/activity");
  return { ok: true };
}

export async function deleteMeeting(id: string): Promise<OkResult> {
  if (!hasConfig()) return { ok: false, error: "Not configured." };
  if (!id) return { ok: false, error: "id is required." };
  const sb = createServiceRoleClient();
  const { error } = await sb.from("meetings").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/activity");
  return { ok: true };
}
