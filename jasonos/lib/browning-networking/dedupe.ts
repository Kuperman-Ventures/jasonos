// One open Browning card per person. Tracy's intro can land in Gmail and
// Outlook with different message ids; harvest used to create both.

import { canonicalEmail } from "@/lib/outreach/contact-lookup";
import { sameCandidate } from "./parse";
import type { HandoffStatus } from "./types";

export type DedupeHandoff = {
  id: string;
  contactName: string | null;
  contactEmail: string | null;
  existingContactId: string | null;
  createdContactId: string | null;
  callStartsAt: string | null;
  callEventId: string | null;
  status: HandoffStatus;
  receivedAt: string | null;
  createdAt?: string | null;
};

const STATUS_RANK: Record<HandoffStatus, number> = {
  thank_you_ready: 70,
  brief_ready: 60,
  booked: 50,
  follow_up: 30,
  acted_on: 20,
  draft_ready: 10,
  times_ready: 10,
  dismissed: 0,
};

export function handoffPersonKey(row: {
  contactEmail?: string | null;
  contactName?: string | null;
  existingContactId?: string | null;
  createdContactId?: string | null;
}): string | null {
  const email = row.contactEmail?.trim();
  if (email?.includes("@")) return `email:${canonicalEmail(email)}`;
  const contactId = row.existingContactId || row.createdContactId;
  if (contactId) return `contact:${contactId}`;
  const name = row.contactName?.trim();
  if (name && name.split(/\s+/).filter(Boolean).length >= 2) {
    return `name:${name.toLowerCase()}`;
  }
  return null;
}

export function sameHandoffPerson(
  a: {
    contactEmail?: string | null;
    contactName?: string | null;
    existingContactId?: string | null;
    createdContactId?: string | null;
    callEventId?: string | null;
  },
  b: {
    contactEmail?: string | null;
    contactName?: string | null;
    existingContactId?: string | null;
    createdContactId?: string | null;
    callEventId?: string | null;
  }
): boolean {
  if (a.callEventId && b.callEventId && a.callEventId === b.callEventId) {
    return true;
  }
  const aEmail = a.contactEmail?.trim();
  const bEmail = b.contactEmail?.trim();
  if (aEmail?.includes("@") && bEmail?.includes("@")) {
    return canonicalEmail(aEmail) === canonicalEmail(bEmail);
  }
  const aContact = a.existingContactId || a.createdContactId;
  const bContact = b.existingContactId || b.createdContactId;
  if (aContact && bContact && aContact === bContact) return true;
  if (a.contactName && b.contactName && sameCandidate(a.contactName, b.contactName)) {
    return true;
  }
  return false;
}

export function preferredHandoff(a: DedupeHandoff, b: DedupeHandoff): DedupeHandoff {
  const aBooked = Boolean(a.callStartsAt || a.callEventId);
  const bBooked = Boolean(b.callStartsAt || b.callEventId);
  if (aBooked !== bBooked) return aBooked ? a : b;

  const aRank = STATUS_RANK[a.status] ?? 0;
  const bRank = STATUS_RANK[b.status] ?? 0;
  if (aRank !== bRank) return aRank >= bRank ? a : b;

  const aEmail = Boolean(a.contactEmail?.includes("@"));
  const bEmail = Boolean(b.contactEmail?.includes("@"));
  if (aEmail !== bEmail) return aEmail ? a : b;

  const aName = Boolean(a.contactName?.trim());
  const bName = Boolean(b.contactName?.trim());
  if (aName !== bName) return aName ? a : b;

  const aWhen = Date.parse(a.receivedAt || a.createdAt || "") || 0;
  const bWhen = Date.parse(b.receivedAt || b.createdAt || "") || 0;
  return aWhen >= bWhen ? a : b;
}

/** Group open handoffs that are the same person; keep one, dismiss the rest. */
export function planDuplicateDismissals(rows: DedupeHandoff[]): {
  keepIds: string[];
  dismissIds: string[];
  merges: { keepId: string; patch: Partial<DedupeHandoff> }[];
} {
  const open = rows.filter((row) => row.status !== "dismissed");
  const assigned = new Set<string>();
  const keepIds: string[] = [];
  const dismissIds: string[] = [];
  const merges: { keepId: string; patch: Partial<DedupeHandoff> }[] = [];

  for (const row of open) {
    if (assigned.has(row.id)) continue;
    const group = [row];
    assigned.add(row.id);
    for (const other of open) {
      if (assigned.has(other.id)) continue;
      if (!sameHandoffPerson(row, other) && !group.some((member) => sameHandoffPerson(member, other))) {
        continue;
      }
      group.push(other);
      assigned.add(other.id);
    }

    let keep = group[0]!;
    for (let i = 1; i < group.length; i++) {
      keep = preferredHandoff(keep, group[i]!);
    }
    keepIds.push(keep.id);

    const patch: Partial<DedupeHandoff> = {};
    for (const member of group) {
      if (member.id === keep.id) continue;
      dismissIds.push(member.id);
      if (!keep.contactName && member.contactName) patch.contactName = member.contactName;
      if (!keep.contactEmail && member.contactEmail) patch.contactEmail = member.contactEmail;
      if (!keep.existingContactId && member.existingContactId) {
        patch.existingContactId = member.existingContactId;
      }
      if (!keep.callStartsAt && member.callStartsAt) {
        patch.callStartsAt = member.callStartsAt;
        patch.callEventId = member.callEventId;
        if (member.status === "booked" || member.status === "brief_ready" || member.status === "thank_you_ready") {
          patch.status = member.status;
        }
      }
    }
    if (Object.keys(patch).length) merges.push({ keepId: keep.id, patch });
  }

  return { keepIds, dismissIds, merges };
}

export function displayHandoffName(row: {
  contactName?: string | null;
  contactEmail?: string | null;
  callTitle?: string | null;
}): string {
  const name = row.contactName?.trim();
  if (name) return name;
  const email = row.contactEmail?.trim();
  if (email?.includes("@")) return email;
  const title = row.callTitle?.trim();
  if (title) return title;
  return "Unparsed contact";
}
