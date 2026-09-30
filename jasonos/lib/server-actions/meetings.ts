"use server";

// Meetings — prep → held → debrief records for a single contact. Backs the
// contact card's Meeting tab. Marking a meeting held also writes a conversation
// touch (via the shared touch-capture helper) so it flows into the networking
// activity heatmap and funnel.

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { insertContactTouches, type TouchChannel } from "@/lib/outreach/touch-capture";
import type { TouchObjective } from "@/lib/outreach/types";
import { getContactResearch } from "@/lib/outreach/contact-research-store";

export type {
  IntroWishFields as IntroWish,
} from "@/lib/outreach/intro-email";

import {
  extractForwardBlock,
  introEmailSubject,
  introEmailSystemPrompt,
  introMailtoUrl,
  normalizeIntroWish,
  rationaleSystemPrompt,
  serializeIntroWishlist,
  type IntroWishFields,
} from "@/lib/outreach/intro-email";

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
  /** Meeting-scoped soft ask for forwardable intro emails. */
  prepShortAsk: string | null;
  debriefNotes: string | null;
  objectiveAchieved: TouchObjective | null;
  thankYouSent: boolean;
  nextStep: string | null;
  heldAt: string | null;
  prepResearch: string | null;
  prepResearchAt: string | null;
  introWishlist: IntroWishFields[];
  granolaNoteId: string | null;
  granolaUrl: string | null;
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
    prepShortAsk: (row.prep_short_ask as string | null) ?? null,
    debriefNotes: (row.debrief_notes as string | null) ?? null,
    objectiveAchieved: (row.objective_achieved as TouchObjective | null) ?? null,
    thankYouSent: Boolean(row.thank_you_sent),
    nextStep: (row.next_step as string | null) ?? null,
    heldAt: (row.held_at as string | null) ?? null,
    prepResearch: (row.prep_research as string | null) ?? null,
    prepResearchAt: (row.prep_research_at as string | null) ?? null,
    introWishlist: Array.isArray(row.intro_wishlist)
      ? (row.intro_wishlist as unknown[])
          .map((x) => normalizeIntroWish(x))
          .filter((w): w is IntroWishFields => Boolean(w))
      : [],
    granolaNoteId: (row.granola_note_id as string | null) ?? null,
    granolaUrl: (row.granola_url as string | null) ?? null,
    gcalEventId: (row.gcal_event_id as string | null) ?? null,
    calendarUrl: (row.calendar_url as string | null) ?? null,
    title: (row.title as string | null) ?? null,
  };
}

export type BrowningPrepView = {
  brief: string | null;
  resumeFilename: string | null;
};

export async function getBrowningPrep(contactId: string): Promise<BrowningPrepView> {
  const empty: BrowningPrepView = { brief: null, resumeFilename: null };
  if (!hasConfig() || !contactId) return empty;
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("contacts")
    .select("browning_prep")
    .eq("id", contactId)
    .maybeSingle();
  if (error) {
    console.error("[meetings.getBrowningPrep]", error);
    return empty;
  }
  const text = (data?.browning_prep as string | null)?.trim() || null;
  if (!/^[0-9a-f-]{36}$/i.test(contactId)) return { brief: text, resumeFilename: null };
  const handoff = await sb
    .from("browning_handoffs")
    .select("resume_filename")
    .or(`created_contact_id.eq.${contactId},existing_contact_id.eq.${contactId}`)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (handoff.error) {
    console.error("[meetings.getBrowningPrep.file]", handoff.error);
  }
  return {
    brief: text,
    resumeFilename: (handoff.data?.resume_filename as string | null) ?? null,
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
  const existingResearch = await getContactResearch(input.contactId);
  const { data, error } = await sb
    .from("meetings")
    .insert({
      contact_id: input.contactId,
      scheduled_at: input.scheduledAt,
      channel: input.channel ?? "video",
      status: "scheduled",
      prep_goal: input.prepGoal?.trim() || null,
      prep_notes: input.prepNotes?.trim() || null,
      prep_research: existingResearch.brief,
      prep_research_at: existingResearch.researchedAt,
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
    prepShortAsk?: string | null;
    introWishlist?: IntroWishFields[];
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
  if (patch.prepShortAsk !== undefined)
    payload.prep_short_ask = patch.prepShortAsk?.trim() || null;
  if (patch.introWishlist !== undefined) {
    payload.intro_wishlist = serializeIntroWishlist(patch.introWishlist);
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

// Run the contact-level person/company web search and copy it onto this meeting.
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

  const { runContactResearch } = await import("@/lib/outreach/person-research");
  const researched = await runContactResearch(mtg.contact_id as string);
  if (!researched.ok) return researched;

  const nowIso = researched.research.researchedAt ?? new Date().toISOString();
  const { data, error } = await sb
    .from("meetings")
    .update({
      prep_research: researched.research.brief,
      prep_research_at: nowIso,
      updated_at: nowIso,
    })
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

async function loadAboutJason(): Promise<string> {
  const { loadStoredAboutJason } = await import(
    "@/lib/outreach/about-jason-store"
  );
  return loadStoredAboutJason();
}

async function buildTargetOverview(wish: IntroWishFields): Promise<string> {
  const bits: string[] = [];
  if (wish.linkedinUrl) {
    try {
      const { getConnectionByLinkedInUrl } = await import(
        "@/lib/integrations/leaddelta"
      );
      const hit = await getConnectionByLinkedInUrl(wish.linkedinUrl);
      if (hit.data) {
        const c = hit.data;
        bits.push(
          [
            c.fullName,
            c.headline,
            c.company,
            c.linkedinUrl,
          ]
            .filter(Boolean)
            .join(" · ")
        );
      }
    } catch {
      /* optional */
    }
  }
  if (wish.name) {
    try {
      const { researchPersonNews } = await import("@/lib/ai/research");
      const news = await researchPersonNews({
        name: wish.name,
        firm: wish.company || null,
      });
      if (news.text?.trim()) bits.push(news.text.trim().slice(0, 1200));
    } catch {
      /* optional */
    }
  }
  if (!bits.length) {
    bits.push(
      [wish.name, wish.company, wish.linkedinUrl].filter(Boolean).join(" · ") ||
        "No overview available."
    );
  }
  return bits.join("\n\n");
}

/** AI: 1-2 sentence rationale for one intro wishlist row. */
export async function draftIntroRationale(
  meetingId: string,
  introIndex: number
): Promise<Result<{ meeting: Meeting; rationale: string }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured." };
  const sb = createServiceRoleClient();
  const { data: row, error } = await sb
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: "Meeting not found." };

  const meeting = rowToMeeting(row as Record<string, unknown>);
  const wish = meeting.introWishlist[introIndex];
  if (!wish?.name && !wish?.linkedinUrl) {
    return { ok: false, error: "Add a name or LinkedIn URL first." };
  }

  const aboutJason = await loadAboutJason();
  if (!aboutJason) {
    return {
      ok: false,
      error: "Add About Jason in Settings before drafting a rationale.",
    };
  }

  const overview = await buildTargetOverview(wish);
  const { generateText } = await import("ai");
  const { fastModel } = await import("@/lib/ai/models");
  const result = await generateText({
    model: fastModel(),
    system: rationaleSystemPrompt(),
    prompt: `ABOUT JASON:\n${aboutJason}\n\nTARGET:\nName: ${wish.name || "—"}\nCompany: ${wish.company || "—"}\nLinkedIn: ${wish.linkedinUrl || "—"}\n\nTARGET OVERVIEW:\n${overview}`,
  });
  const rationale = (result.text ?? "").trim();
  if (!rationale) return { ok: false, error: "Could not draft a rationale." };

  const next = meeting.introWishlist.map((item, i) =>
    i === introIndex
      ? { ...item, rationale, targetOverview: overview.slice(0, 2000) }
      : item
  );
  while (next.length <= introIndex) {
    next.push({ name: "", company: "", linkedinUrl: "", rationale: "" });
  }
  next[introIndex] = {
    ...(next[introIndex] ?? { name: "", company: "", linkedinUrl: "", rationale: "" }),
    name: wish.name,
    company: wish.company,
    linkedinUrl: wish.linkedinUrl,
    rationale,
    targetOverview: overview.slice(0, 2000),
    agreed: wish.agreed,
  };

  const { data, error: upErr } = await sb
    .from("meetings")
    .update({
      intro_wishlist: serializeIntroWishlist(next),
      updated_at: new Date().toISOString(),
    })
    .eq("id", meetingId)
    .select("*")
    .single();
  if (upErr) return { ok: false, error: upErr.message };
  revalidatePath("/activity");
  return { ok: true, meeting: rowToMeeting(data), rationale };
}

/** AI: full forwardable intro email for one agreed wishlist row. */
export async function generateIntroEmail(
  meetingId: string,
  introIndex: number
): Promise<
  Result<{
    meeting: Meeting;
    subject: string;
    body: string;
    forwardBlock: string | null;
    mailtoUrl: string | null;
    toEmail: string | null;
  }>
> {
  if (!hasConfig()) return { ok: false, error: "Not configured." };
  const sb = createServiceRoleClient();
  const { data: row, error } = await sb
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: "Meeting not found." };

  const meeting = rowToMeeting(row as Record<string, unknown>);
  if (meeting.status !== "held") {
    return { ok: false, error: "Import the Granola call (mark held) before generating intro emails." };
  }
  const wish = meeting.introWishlist[introIndex];
  if (!wish?.name) return { ok: false, error: "That intro row has no name." };
  if (!wish.agreed) {
    return { ok: false, error: "Mark They agreed on that intro first." };
  }
  if (!wish.linkedinUrl) {
    return { ok: false, error: "Add a LinkedIn URL for that person first." };
  }

  const aboutJason = await loadAboutJason();
  if (!aboutJason) {
    return { ok: false, error: "Add About Jason in Settings first." };
  }

  const { data: contact } = await sb
    .from("contacts")
    .select("name,emails")
    .eq("id", meeting.contactId)
    .maybeSingle();
  const contactName = (contact?.name as string | null) ?? "there";
  const emails = Array.isArray(contact?.emails) ? (contact!.emails as string[]) : [];
  const toEmail = emails.find((e) => e?.includes("@")) ?? null;
  const firstName = contactName.trim().split(/\s+/)[0] || "there";
  const targetFirst = wish.name.trim().split(/\s+/)[0] || wish.name;
  const shortAsk =
    meeting.prepShortAsk?.trim() ||
    "a 20–30 minute Zoom to compare notes";

  const overview =
    wish.targetOverview?.trim() || (await buildTargetOverview(wish));

  const { generateText } = await import("ai");
  const { heavyModel } = await import("@/lib/ai/models");
  const result = await generateText({
    model: heavyModel(),
    system: introEmailSystemPrompt(),
    prompt: `MEETING CONTACT: ${contactName} (first name ${firstName})
TARGET: ${wish.name} (first name ${targetFirst}) at ${wish.company || "—"}
LINKEDIN: ${wish.linkedinUrl}
RATIONALE: ${wish.rationale || "(none saved — infer carefully from overview + About Jason only)"}
SHORT ASK: ${shortAsk}

ABOUT JASON:
${aboutJason}

TARGET OVERVIEW:
${overview}`,
  });
  const body = (result.text ?? "").trim();
  if (!body) return { ok: false, error: "Could not draft the intro email." };
  const subject = introEmailSubject(wish.name);
  const forwardBlock = extractForwardBlock(body);
  const mailtoUrl = toEmail
    ? introMailtoUrl({ to: toEmail, subject, body })
    : null;

  const next = meeting.introWishlist.map((item, i) =>
    i === introIndex
      ? {
          ...item,
          introDraft: body,
          introDraftAt: new Date().toISOString(),
          targetOverview: overview.slice(0, 2000),
        }
      : item
  );
  const { data, error: upErr } = await sb
    .from("meetings")
    .update({
      intro_wishlist: serializeIntroWishlist(next),
      updated_at: new Date().toISOString(),
    })
    .eq("id", meetingId)
    .select("*")
    .single();
  if (upErr) return { ok: false, error: upErr.message };
  revalidatePath("/activity");
  return {
    ok: true,
    meeting: rowToMeeting(data),
    subject,
    body,
    forwardBlock,
    mailtoUrl,
    toEmail,
  };
}

/** Import Granola call notes for this meeting and mark it held. */
export async function importMeetingGranola(
  meetingId: string
): Promise<Result<{ meeting: Meeting }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured." };
  const sb = createServiceRoleClient();
  const { data: row, error } = await sb
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: "Meeting not found." };

  const meeting = rowToMeeting(row as Record<string, unknown>);
  const { data: contact } = await sb
    .from("contacts")
    .select("name,emails")
    .eq("id", meeting.contactId)
    .maybeSingle();
  const contactName = ((contact?.name as string | null) ?? "").trim();
  if (!contactName) return { ok: false, error: "Contact has no name to match in Granola." };
  const emails = Array.isArray(contact?.emails) ? (contact!.emails as string[]) : [];

  const { searchGranolaForContact } = await import("@/lib/integrations/granola");
  const note = await searchGranolaForContact({
    contactName,
    emails,
    aroundIso: meeting.scheduledAt,
    calendarEventId: meeting.gcalEventId,
    meetingTitle: meeting.title,
  });
  if (!note.found || !note.summary) {
    return { ok: false, error: note.error || "No Granola note for this call yet." };
  }

  const granolaId = note.meetings?.[0]?.id ?? null;
  const granolaUrl = note.url ?? note.meetings?.[0]?.notesUrl ?? null;

  // Persist Granola link fields, then reuse markMeetingHeld for touch + status.
  const { error: linkErr } = await sb
    .from("meetings")
    .update({
      granola_note_id: granolaId,
      granola_url: granolaUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", meetingId);
  if (linkErr) return { ok: false, error: linkErr.message };

  return markMeetingHeld(meetingId, {
    debriefNotes: note.summary,
    objectiveAchieved: null,
    thankYouSent: false,
    nextStep: null,
  });
}
