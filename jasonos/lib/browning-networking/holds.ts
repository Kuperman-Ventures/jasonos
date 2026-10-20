// Tentative holds for times offered in a Browning reply.
// They stay grey on the calendar until a meeting is set, so the next
// handoff does not take the same slot.

import { etYmd } from "@/lib/dates";
import type { BusyBlock, HandoffSlot, HandoffStatus } from "./types";

const OPEN_HOLD_STATUSES = new Set<HandoffStatus>([
  "times_ready",
  "draft_ready",
  "acted_on",
  "follow_up",
]);

export type StoredHold = {
  slotId: string;
  eventId: string;
  start: string;
  end: string;
};

export type ListedHold = {
  eventId: string;
  slotId: string | null;
  start: string;
  end: string;
};

export type HoldPlan = {
  keep: StoredHold[];
  create: HandoffSlot[];
  update: { eventId: string; slot: HandoffSlot; previous: StoredHold }[];
  deleteIds: string[];
};

export function holdTitle(name: string | null | undefined): string {
  const cleaned = (name ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Hold · Browning reply";
  return `Hold · ${cleaned.slice(0, 80)}`;
}

export function shouldKeepTentativeHolds(row: {
  status: string;
  callStartsAt: string | null;
}): boolean {
  if (row.callStartsAt) return false;
  return OPEN_HOLD_STATUSES.has(row.status as HandoffStatus);
}

export function asStoredHolds(value: unknown): StoredHold[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (
      typeof row.slotId !== "string" ||
      typeof row.eventId !== "string" ||
      typeof row.start !== "string" ||
      typeof row.end !== "string"
    ) {
      return [];
    }
    return [
      {
        slotId: row.slotId,
        eventId: row.eventId,
        start: row.start,
        end: row.end,
      },
    ];
  });
}

export function holdsLookCurrent(input: {
  slots: HandoffSlot[];
  stored: StoredHold[];
  keep: boolean;
}): boolean {
  if (!input.keep) return input.stored.length === 0;
  if (input.stored.length !== input.slots.length) return false;
  const bySlot = new Map(input.stored.map((hold) => [hold.slotId, hold]));
  return input.slots.every((slot) => {
    const hold = bySlot.get(slot.id);
    return Boolean(
      hold && sameTime(hold.start, slot.start) && sameTime(hold.end, slot.end)
    );
  });
}

export function reconcileHolds(input: {
  slots: HandoffSlot[];
  listed: ListedHold[];
  stored: StoredHold[];
  keep: boolean;
}): HoldPlan {
  if (!input.keep) {
    return {
      keep: [],
      create: [],
      update: [],
      deleteIds: uniqueIds([
        ...input.listed.map((row) => row.eventId),
        ...input.stored.map((row) => row.eventId),
      ]),
    };
  }

  const listedBySlot = new Map<string, ListedHold[]>();
  const deleteIds: string[] = [];
  for (const row of input.listed) {
    if (!row.slotId) {
      deleteIds.push(row.eventId);
      continue;
    }
    const group = listedBySlot.get(row.slotId) ?? [];
    group.push(row);
    listedBySlot.set(row.slotId, group);
  }

  const slotIds = new Set(input.slots.map((slot) => slot.id));
  for (const hold of input.stored) {
    if (!slotIds.has(hold.slotId)) deleteIds.push(hold.eventId);
  }
  for (const [slotId, rows] of listedBySlot) {
    if (!slotIds.has(slotId)) {
      for (const row of rows) deleteIds.push(row.eventId);
    }
  }

  const keep: StoredHold[] = [];
  const create: HandoffSlot[] = [];
  const update: HoldPlan["update"] = [];

  for (const slot of input.slots) {
    const matches = listedBySlot.get(slot.id) ?? [];
    const primary = matches[0];
    for (const extra of matches.slice(1)) deleteIds.push(extra.eventId);
    if (!primary) {
      create.push(slot);
      continue;
    }
    const previous: StoredHold = {
      slotId: slot.id,
      eventId: primary.eventId,
      start: primary.start,
      end: primary.end,
    };
    if (!sameTime(primary.start, slot.start) || !sameTime(primary.end, slot.end)) {
      update.push({ eventId: primary.eventId, slot, previous });
    } else {
      keep.push({
        slotId: slot.id,
        eventId: primary.eventId,
        start: slot.start,
        end: slot.end,
      });
    }
  }

  return { keep, create, update, deleteIds: uniqueIds(deleteIds) };
}

/** Calendar blocks for one handoff: real events, plus other replies' offered times. */
export function busyForHandoff(
  calendarBusy: BusyBlock[],
  handoffs: {
    id: string;
    contactName: string | null;
    status: HandoffStatus;
    callStartsAt: string | null;
    slots: HandoffSlot[];
  }[],
  handoffId: string
): BusyBlock[] {
  const self = handoffs.find((row) => row.id === handoffId);
  const ownTitle = holdTitle(self?.contactName).toLowerCase();
  const withoutOwnHolds = calendarBusy.filter((block) => {
    if (block.holdHandoffId === handoffId) return false;
    const title = block.title.trim().toLowerCase();
    return !(title.startsWith("hold ·") && title === ownTitle);
  });
  const coveredStarts = new Set(
    withoutOwnHolds
      .filter((block) => !block.allDay)
      .map((block) => Date.parse(block.start))
      .filter((ms) => Number.isFinite(ms))
  );
  const extra: BusyBlock[] = [];
  for (const handoff of handoffs) {
    if (handoff.id === handoffId) continue;
    if (!shouldKeepTentativeHolds(handoff)) continue;
    for (const slot of handoff.slots) {
      const start = Date.parse(slot.start);
      if (!Number.isFinite(start) || coveredStarts.has(start)) continue;
      coveredStarts.add(start);
      extra.push({
        title: holdTitle(handoff.contactName),
        start: slot.start,
        end: slot.end,
        tentativeHold: true,
        holdHandoffId: handoff.id,
      });
    }
  }
  return [...withoutOwnHolds, ...extra];
}

export function placementBlockReason(
  startIso: string,
  endIso: string,
  busy: BusyBlock[]
): string | null {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const day = etYmd(startIso);
  for (const block of busy) {
    if (block.allDay) {
      if (!allDayHits(block, day)) continue;
      return block.tentativeHold || block.holdHandoffId
        ? `${block.title} is a tentative hold. Pick another time.`
        : `${block.title} blocks that day.`;
    }
    const blockStart = Date.parse(block.start);
    const blockEnd = Date.parse(block.end);
    if (!Number.isFinite(blockStart) || !Number.isFinite(blockEnd)) continue;
    if (start < blockEnd && end > blockStart) {
      return block.tentativeHold || block.holdHandoffId
        ? `${block.title} is a tentative hold. Pick another time.`
        : `${block.title} is already on your calendar.`;
    }
  }
  return null;
}

function allDayHits(block: BusyBlock, ymd: string): boolean {
  const start = block.start.slice(0, 10);
  const end = block.end.slice(0, 10);
  if (!block.start.includes("T")) return ymd >= start && ymd < end;
  return etYmd(block.start) === ymd;
}

function sameTime(left: string, right: string): boolean {
  const a = Date.parse(left);
  const b = Date.parse(right);
  return Number.isFinite(a) && a === b;
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}
