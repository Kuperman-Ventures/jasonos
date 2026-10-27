"use server";

import { revalidatePath } from "next/cache";
import { lookupRecruiterName, recordUserAction } from "@/lib/actions/action-log";
import { formatCalendarDay } from "@/lib/actions/action-log-format";
import { createPublicServiceRoleClient } from "@/lib/supabase/server";
import { RECRUITER_STATUS_LABELS } from "@/lib/reconnect/constants";
import type { RecruiterStatus } from "@/lib/reconnect/types";

type ActionResult = { ok: true; persisted: boolean } | { ok: false; message: string };

function paths() {
  revalidatePath("/reconnect");
  revalidatePath("/reconnect/contacts");
}

async function tryPersistStatus(
  recruiterId: string,
  status: RecruiterStatus,
  extra?: Record<string, string | boolean | null>
): Promise<ActionResult> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    paths();
    return { ok: true, persisted: false };
  }

  try {
    const sb = createPublicServiceRoleClient();
    const { error } = await sb
      .from("rr_contact_state")
      .update({ status, status_updated_at: new Date().toISOString(), ...extra })
      .eq("contact_id", recruiterId);

    if (error) return { ok: false, message: error.message };
    const due = extra?.next_action_due_date;
    await recordUserAction({
      verb: RECRUITER_STATUS_LABELS[status] ?? status,
      area: "Reconnect",
      subject: (await lookupRecruiterName(recruiterId)) ?? "Contact",
      detail: typeof due === "string" && due ? `back ${formatCalendarDay(due.slice(0, 10))}` : null,
      targetTable: "rr_recruiters",
      targetId: recruiterId,
    });
    paths();
    return { ok: true, persisted: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Reconnect action failed",
    };
  }
}

async function tryAddTouch(
  recruiterId: string,
  direction: "outbound" | "inbound",
  body: string
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const sb = createPublicServiceRoleClient();
  await sb.from("rr_touches").insert({
    contact_id: recruiterId,
    channel: "linkedin",
    direction,
    brief: body,
  });
}

export async function markReconnectSent(recruiterId: string): Promise<ActionResult> {
  await tryAddTouch(recruiterId, "outbound", "Marked sent from Reconnect queue.");
  return tryPersistStatus(recruiterId, "sent");
}

export async function markReconnectReplied(recruiterId: string): Promise<ActionResult> {
  await tryAddTouch(recruiterId, "inbound", "Marked reply received from Reconnect queue.");
  return tryPersistStatus(recruiterId, "replied");
}

export async function snoozeReconnectContact(recruiterId: string): Promise<ActionResult> {
  const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return tryPersistStatus(recruiterId, "snoozed", { next_action_due_date: due });
}

export async function setReconnectStatus(
  recruiterId: string,
  status: RecruiterStatus,
  note?: string
): Promise<ActionResult> {
  if (note && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const sb = createPublicServiceRoleClient();
    await sb.from("rr_notes").insert({ contact_id: recruiterId, body: note });
  }
  return tryPersistStatus(recruiterId, status);
}

export async function addReconnectNote(
  recruiterId: string,
  body: string
): Promise<ActionResult> {
  if (!body.trim()) return { ok: false, message: "Note cannot be empty" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    paths();
    return { ok: true, persisted: false };
  }

  try {
    const sb = createPublicServiceRoleClient();
    const { error } = await sb.from("rr_notes").insert({
      contact_id: recruiterId,
      body: body.trim(),
    });
    if (error) return { ok: false, message: error.message };
    await recordUserAction({
      verb: "Note",
      area: "Reconnect",
      subject: (await lookupRecruiterName(recruiterId)) ?? "Contact",
      detail: body.trim().slice(0, 160),
      targetTable: "rr_recruiters",
      targetId: recruiterId,
    });
    paths();
    return { ok: true, persisted: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not add note",
    };
  }
}
