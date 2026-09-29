"use server";

import { revalidatePath } from "next/cache";
import { etYmd } from "@/lib/dates";
import { loadBusy } from "@/lib/browning-networking/data";
import { canEditOfferedTimes } from "@/lib/browning-networking/lanes";
import { connectMeetingTitle, thankYouDraft } from "@/lib/browning-networking/draft";
import { persistDraft, runBrowningNetworking } from "@/lib/browning-networking/run";
import { createGoogleMeetInvite } from "@/lib/integrations/google-calendar";
import { ADVISORS_ACCOUNT_EMAIL, listGoogleAccessTokens } from "@/lib/integrations/google-tokens";
import { addCalendarDays, firstEligibleYmd } from "@/lib/browning-networking/slots";
import type { HandoffSlot, HandoffStatus } from "@/lib/browning-networking/types";
import { setCadence } from "@/lib/server-actions/outreach";
import { appendSyncLog } from "@/lib/outreach/sync-log";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { CadenceInterval } from "@/lib/outreach/types";

type ActionResult = { ok: true } | { ok: false; error: string };

function configured(): { ok: false; error: string } | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "Supabase is not configured." };
  }
  return null;
}

function revalidate() {
  revalidatePath("/outreach/browning-networking");
  revalidatePath("/");
}

export async function checkBrowningHandoffs(runId?: string): Promise<
  { ok: true; created: number; found: number; followUps: number; olderFound: number; preps: number } | { ok: false; error: string }
> {
  const result = await runBrowningNetworking();
  await appendSyncLog(
    "browning",
    {
      ok: result.ok,
      created: result.created,
      followUps: result.followUps,
      preps: result.preps,
      found: result.found,
      error: result.error,
    },
    runId
  );
  revalidate();
  if (!result.ok) return { ok: false, error: result.error || "Check failed." };
  return {
    ok: true,
    created: result.created,
    found: result.found,
    followUps: result.followUps,
    olderFound: result.olderFound,
    preps: result.preps,
  };
}

export async function saveHandoffSlots(
  handoffId: string,
  slots: HandoffSlot[]
): Promise<ActionResult> {
  const guard = configured();
  if (guard) return guard;
  const cleaned = sanitizeSlots(slots);
  if (!cleaned.ok) return cleaned;
  const sb = createServiceRoleClient();
  const { data: existing, error: existingError } = await sb
    .from("browning_handoffs")
    .select("status, call_starts_at")
    .eq("id", handoffId)
    .maybeSingle();
  if (existingError || !existing) {
    return { ok: false, error: existingError?.message || "Handoff not found." };
  }
  if (
    !canEditOfferedTimes({
      status: existing.status as HandoffStatus,
      callStartsAt: (existing.call_starts_at as string | null) ?? null,
    })
  ) {
    return { ok: false, error: "This meeting is already set." };
  }
  const { error } = await sb
    .from("browning_handoffs")
    .update({ slots: cleaned.slots })
    .eq("id", handoffId);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function openHandoffReply(
  handoffId: string,
  slots: HandoffSlot[]
): Promise<{ ok: true; url: string; savedInGmail: boolean } | { ok: false; error: string }> {
  const guard = configured();
  if (guard) return guard;
  const cleaned = sanitizeSlots(slots);
  if (!cleaned.ok) return cleaned;
  const result = await persistDraft({ handoffId, slots: cleaned.slots });
  revalidate();
  return result;
}

export async function markHandoffActedOn(handoffId: string): Promise<ActionResult> {
  const guard = configured();
  if (guard) return guard;
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("browning_handoffs")
    .select("status, call_starts_at, card_id")
    .eq("id", handoffId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message || "Handoff not found." };
  const alreadyBooked =
    Boolean(data.call_starts_at) ||
    data.status === "booked" ||
    data.status === "brief_ready" ||
    data.status === "thank_you_ready";
  if (alreadyBooked) {
    return { ok: false, error: "This meeting is already on your calendar." };
  }
  const { error: updateError } = await sb
    .from("browning_handoffs")
    .update({ status: "acted_on" })
    .eq("id", handoffId);
  if (updateError) return { ok: false, error: updateError.message };
  if (data.card_id) {
    await sb.from("cards").update({ state: "actioned" }).eq("id", data.card_id as string);
  }
  revalidate();
  return { ok: true };
}

export async function setHandoffCadence(
  handoffId: string,
  cadence: CadenceInterval
): Promise<ActionResult> {
  const guard = configured();
  if (guard) return guard;
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("browning_handoffs")
    .select("created_contact_id, existing_contact_id")
    .eq("id", handoffId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message || "Handoff not found." };
  if (data.existing_contact_id) {
    return {
      ok: false,
      error: "This person is already in your contacts. This page will not change that record.",
    };
  }
  if (!data.created_contact_id) {
    return { ok: false, error: "No contact was created for this handoff." };
  }
  const result = await setCadence(data.created_contact_id as string, cadence);
  revalidate();
  return result;
}

export async function draftThankYouFromNotes(
  handoffId: string,
  notes: string
): Promise<ActionResult> {
  const guard = configured();
  if (guard) return guard;
  const summary = notes.trim();
  if (summary.length < 20) {
    return { ok: false, error: "Paste a few lines from the call first." };
  }
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("browning_handoffs")
    .select("contact_name")
    .eq("id", handoffId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message || "Handoff not found." };
  const body = thankYouDraft({
    name: (data.contact_name as string | null) ?? null,
    summary,
  });
  const { error: updateError } = await sb
    .from("browning_handoffs")
    .update({
      thank_you_body: body,
      thank_you_source: "notes",
      status: "thank_you_ready",
    })
    .eq("id", handoffId);
  if (updateError) return { ok: false, error: updateError.message };
  revalidate();
  return { ok: true };
}

export async function sendMeetInvite(
  handoffId: string,
  slotStart: string
): Promise<{ ok: true; meetUrl: string | null } | { ok: false; error: string }> {
  const guard = configured();
  if (guard) return guard;
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("browning_handoffs")
    .select("contact_name, contact_email, slots, call_starts_at, brief")
    .eq("id", handoffId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message || "Handoff not found." };
  if (data.call_starts_at) return { ok: false, error: "This meeting is already on the calendar." };
  const email = (data.contact_email as string | null) ?? "";
  if (!email) return { ok: false, error: "No email address for this person." };
  const slots = Array.isArray(data.slots) ? (data.slots as HandoffSlot[]) : [];
  const slot = slots.find((item) => item?.start && Date.parse(item.start) === Date.parse(slotStart));
  if (!slot?.start || !slot.end) return { ok: false, error: "Pick one of the times you offered." };
  if (Date.parse(slot.start) < Date.now() - 5 * 60 * 1000) {
    return { ok: false, error: "That time has already passed." };
  }
  const tokens = await listGoogleAccessTokens();
  const token = tokens.find((account) => account.accountEmail === ADVISORS_ACCOUNT_EMAIL)?.token;
  if (!token) return { ok: false, error: "Advisors Google is not connected." };
  const name = ((data.contact_name as string | null) ?? "").trim();
  const title = connectMeetingTitle(name);
  const created = await createGoogleMeetInvite({
    token,
    summary: title,
    startIso: new Date(slot.start).toISOString(),
    endIso: new Date(slot.end).toISOString(),
    attendeeEmail: email,
  });
  if (!created.ok) return { ok: false, error: created.error };
  const { error: updateError } = await sb
    .from("browning_handoffs")
    .update({
      call_event_id: created.eventId,
      call_title: title,
      call_starts_at: new Date(slot.start).toISOString(),
      call_ends_at: new Date(slot.end).toISOString(),
      status: data.brief ? "brief_ready" : "booked",
    })
    .eq("id", handoffId);
  if (updateError) return { ok: false, error: updateError.message };
  revalidate();
  return { ok: true, meetUrl: created.meetUrl };
}

export async function loadCalendarBusy(fromYmd: string, toYmd: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(toYmd)) {
    return [];
  }
  return loadBusy(fromYmd, toYmd);
}

function sanitizeSlots(
  slots: HandoffSlot[]
): { ok: true; slots: HandoffSlot[] } | { ok: false; error: string } {
  if (!Array.isArray(slots) || slots.length > 8) {
    return { ok: false, error: "Keep it to eight times or fewer." };
  }
  const earliest = firstEligibleYmd(new Date());
  const latest = addCalendarDays(earliest, 45);
  const cleaned: HandoffSlot[] = [];
  for (const slot of slots) {
    if (!slot?.id || !slot.start || !slot.end) {
      return { ok: false, error: "A time is missing a start." };
    }
    const start = Date.parse(slot.start);
    const end = Date.parse(slot.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return { ok: false, error: "A time is not a real range." };
    }
    const day = etYmd(slot.start);
    if (day < earliest) {
      return { ok: false, error: "That time is inside the 3 business day window." };
    }
    if (day > latest) {
      return { ok: false, error: "That time is too far out." };
    }
    cleaned.push({
      id: slot.id,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
    });
  }
  return { ok: true, slots: cleaned };
}
