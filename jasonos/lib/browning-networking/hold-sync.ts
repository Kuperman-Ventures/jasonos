import "server-only";

import {
  createTentativeHold,
  deletePrimaryCalendarEvent,
  listHandoffHoldEvents,
  updateTentativeHold,
} from "@/lib/integrations/google-calendar";
import { ADVISORS_ACCOUNT_EMAIL, listGoogleAccessTokens } from "@/lib/integrations/google-tokens";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  asStoredHolds,
  holdsLookCurrent,
  holdTitle,
  reconcileHolds,
  shouldKeepTentativeHolds,
  type StoredHold,
} from "./holds";
import type { HandoffSlot } from "./types";

type Sb = ReturnType<typeof createServiceRoleClient>;

export type HoldSyncResult =
  | { ok: true; changed: number; warning?: string }
  | { ok: false; error: string };

export async function syncOpenHandoffHolds(sb: Sb, maxToWrite = 10): Promise<HoldSyncResult> {
  const token = await advisorsCalendarToken();
  if (!token) {
    return {
      ok: false,
      error: "Advisors Google is not connected, so tentative holds stay on this page only.",
    };
  }

  const { data, error } = await sb
    .from("browning_handoffs")
    .select("id, contact_name, slots, status, call_starts_at, hold_events")
    .limit(200);
  if (error) {
    if (/hold_events/.test(error.message)) {
      return { ok: false, error: "Calendar holds are not in the database yet." };
    }
    return { ok: false, error: error.message };
  }

  let changed = 0;
  let warning: string | undefined;
  let wrote = 0;
  for (const row of data ?? []) {
    if (wrote >= maxToWrite) break;
    const record = row as Record<string, unknown>;
    const slots = asSlots(record.slots);
    const stored = asStoredHolds(record.hold_events);
    const keep = shouldKeepTentativeHolds({
      status: String(record.status ?? ""),
      callStartsAt: (record.call_starts_at as string | null) ?? null,
    });
    if (holdsLookCurrent({ slots, stored, keep })) continue;
    wrote += 1;
    try {
      const result = await syncRow(sb, token, record, false);
      if (!result.ok) {
        if (result.needsReconnect) return { ok: false, error: result.error };
        warning = result.error;
        continue;
      }
      if (result.changed) changed += 1;
      if (result.warning) warning = result.warning;
    } catch (err) {
      warning = err instanceof Error ? err.message : "Could not save a tentative hold.";
    }
  }
  return warning ? { ok: true, changed, warning } : { ok: true, changed };
}

export async function syncHandoffHolds(
  sb: Sb,
  handoffId: string,
  opts?: { force?: boolean }
): Promise<HoldSyncResult> {
  const token = await advisorsCalendarToken();
  if (!token) {
    return {
      ok: false,
      error: "Advisors Google is not connected, so tentative holds stay on this page only.",
    };
  }
  const { data, error } = await sb
    .from("browning_handoffs")
    .select("id, contact_name, slots, status, call_starts_at, hold_events")
    .eq("id", handoffId)
    .maybeSingle();
  if (error) {
    if (/hold_events/.test(error.message)) {
      return { ok: false, error: "Calendar holds are not in the database yet." };
    }
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: "Handoff not found." };
  const result = await syncRow(sb, token, data as Record<string, unknown>, Boolean(opts?.force));
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    changed: result.changed ? 1 : 0,
    ...(result.warning ? { warning: result.warning } : {}),
  };
}

async function syncRow(
  sb: Sb,
  token: string,
  row: Record<string, unknown>,
  force: boolean
): Promise<
  | { ok: true; changed: boolean; warning?: string }
  | { ok: false; error: string; needsReconnect?: boolean }
> {
  const handoffId = String(row.id);
  const slots = asSlots(row.slots);
  const stored = asStoredHolds(row.hold_events);
  const keep = shouldKeepTentativeHolds({
    status: String(row.status ?? ""),
    callStartsAt: (row.call_starts_at as string | null) ?? null,
  });
  if (!force && holdsLookCurrent({ slots, stored, keep })) {
    return { ok: true, changed: false };
  }

  const listed = await listHandoffHoldEvents({ token, handoffId });
  if (!listed.ok) return { ok: false, error: listed.error, needsReconnect: listed.needsReconnect };

  const plan = reconcileHolds({
    slots,
    listed: listed.events.flatMap((event) => {
      if (!event.id) return [];
      return [
        {
          eventId: event.id,
          slotId: event.extendedProperties?.private?.slotId ?? null,
          start: event.start?.dateTime ?? "",
          end: event.end?.dateTime ?? "",
        },
      ];
    }),
    stored,
    keep,
  });

  const name = (row.contact_name as string | null) ?? null;
  const summary = holdTitle(name);
  const next: StoredHold[] = [...plan.keep];
  let warning: string | undefined;

  for (const slot of plan.create) {
    const created = await createTentativeHold({
      token,
      summary,
      startIso: slot.start,
      endIso: slot.end,
      handoffId,
      slotId: slot.id,
      organizerEmail: ADVISORS_ACCOUNT_EMAIL,
    });
    if (!created.ok) {
      if (created.needsReconnect) return { ok: false, error: created.error, needsReconnect: true };
      warning = created.error;
      continue;
    }
    next.push({
      slotId: slot.id,
      eventId: created.eventId,
      start: slot.start,
      end: slot.end,
    });
  }

  for (const change of plan.update) {
    const updated = await updateTentativeHold({
      token,
      eventId: change.eventId,
      summary,
      startIso: change.slot.start,
      endIso: change.slot.end,
      handoffId,
      slotId: change.slot.id,
      organizerEmail: ADVISORS_ACCOUNT_EMAIL,
    });
    if (!updated.ok) {
      if (updated.needsReconnect) return { ok: false, error: updated.error, needsReconnect: true };
      warning = updated.error;
      next.push(change.previous);
      continue;
    }
    next.push({
      slotId: change.slot.id,
      eventId: change.eventId,
      start: change.slot.start,
      end: change.slot.end,
    });
  }

  for (const eventId of plan.deleteIds) {
    const removed = await deletePrimaryCalendarEvent(token, eventId);
    if (!removed.ok) {
      if (removed.needsReconnect) return { ok: false, error: removed.error, needsReconnect: true };
      warning = removed.error;
    }
  }

  const changed = !sameHolds(stored, next);
  if (changed) {
    const { error } = await sb
      .from("browning_handoffs")
      .update({ hold_events: next })
      .eq("id", handoffId);
    if (error) return { ok: false, error: error.message };
  }
  return warning ? { ok: true, changed, warning } : { ok: true, changed };
}

async function advisorsCalendarToken(): Promise<string | null> {
  const tokens = await listGoogleAccessTokens();
  return tokens.find((account) => account.accountEmail === ADVISORS_ACCOUNT_EMAIL)?.token ?? null;
}

function asSlots(value: unknown): HandoffSlot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.start !== "string" || typeof row.end !== "string") {
      return [];
    }
    return [{ id: row.id, start: row.start, end: row.end }];
  });
}

function sameHolds(left: StoredHold[], right: StoredHold[]): boolean {
  const key = (holds: StoredHold[]) =>
    holds
      .map((hold) => `${hold.slotId}|${hold.eventId}|${hold.start}|${hold.end}`)
      .sort()
      .join("\n");
  return key(left) === key(right);
}
