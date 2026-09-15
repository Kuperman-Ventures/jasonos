// Shared overdue / due-week banding for Home and the Networking queue.
// Keep these in one place so the Home overdue count cannot drift from
// the queue Overdue band.

import { etEndOfWorkWeekYmd, etToday } from "@/lib/dates";
import type { QueueCard, QueueColumnKey } from "@/lib/outreach/queue-buckets";

export type QueueUrgencyKey =
  | "engaged_today"
  | "overdue"
  | "due_this_week"
  | "scheduled"
  | "needs_scheduling";

export type QueueUrgencyComm = {
  urgency?:
    | "sent_today"
    | "due_today"
    | "this_week"
    | "scheduled"
    | "needs_scheduling";
  nextActionDueDate?: string | null;
};

export type ScheduleQueueRow = {
  id: string;
  contactId?: string | null;
  name: string;
  title: string | null;
  firm: string | null;
  nextActionDueDate: string | null;
  lastTouch: { touched_at: string | null } | null;
  source?: string | null;
};

/** Fields the Schedule union copies onto a synthesized queue card. */
export type QueueUnionPerson = {
  intent?: string | null;
  vip?: boolean;
  relationship_type?: QueueCard["relationship_type"];
  relevance_tier?: QueueCard["relevance_tier"];
  network_degree?: QueueCard["network_degree"];
  primary_email?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  cadence_interval?: QueueCard["cadence_interval"];
  cadence_stage?: QueueCard["cadence_stage"];
  next_touch_date?: string | null;
  last_touch_date?: string | null;
  reply_status_override?: QueueCard["reply_status_override"];
  reply_status_override_at?: string | null;
};

export function deriveQueueUrgency(
  card: Pick<QueueCard, "next_touch_date" | "last_touch_date">,
  comm?: QueueUrgencyComm | null,
  today: string = etToday()
): QueueUrgencyKey {
  if (comm?.urgency === "sent_today") return "engaged_today";
  if (card.last_touch_date && card.last_touch_date.slice(0, 10) === today) {
    return "engaged_today";
  }

  const nextTouch = card.next_touch_date ?? comm?.nextActionDueDate ?? null;
  if (nextTouch) {
    if (nextTouch < today) return "overdue";
    if (nextTouch <= etEndOfWorkWeekYmd(today)) return "due_this_week";
    return "scheduled";
  }

  if (comm?.urgency === "due_today") return "overdue";
  if (comm?.urgency === "this_week") return "due_this_week";
  if (comm?.urgency === "scheduled") return "scheduled";
  if (comm?.urgency === "needs_scheduling") return "needs_scheduling";
  return "needs_scheduling";
}

export type QueueColumns = Record<QueueColumnKey, QueueCard[]>;

/**
 * The queue page also shows Schedule contacts that never made a classified
 * column. Typical case: next-touch date is set, but intent is still null and
 * cadence_stage is still `initial` (Warm requires followup_2 / ongoing;
 * Growth requires a Specific trigger). Home used to skip those, so Overdue
 * counted 10 while the queue showed 14.
 */
export function unionScheduleIntoQueueColumns(
  columns: QueueColumns,
  scheduleContacts: ScheduleQueueRow[],
  peopleById: { get(id: string): QueueUnionPerson | undefined }
): QueueColumns {
  const seen = new Set<string>();
  const result: QueueColumns = {
    network_growth: [...columns.network_growth],
    network_maintenance: [...columns.network_maintenance],
    browning_cold: [...columns.browning_cold],
  };
  for (const colKey of [
    "network_growth",
    "network_maintenance",
    "browning_cold",
  ] as const) {
    for (const card of result[colKey]) {
      if (card.contactId) seen.add(card.contactId);
      if (card.recruiterId) seen.add(card.recruiterId);
    }
  }
  for (const cc of scheduleContacts) {
    if (seen.has(cc.id)) continue;
    if (cc.contactId && seen.has(cc.contactId)) continue;
    seen.add(cc.id);
    if (cc.contactId) seen.add(cc.contactId);
    const person = peopleById.get(cc.contactId || cc.id) ?? peopleById.get(cc.id);
    const column: QueueColumnKey =
      person?.intent === "network_maintenance" ||
      person?.intent === "browning_cold"
        ? person.intent
        : "network_growth";
    result[column].push({
      key: `sched-${cc.id}`,
      column,
      name: cc.name,
      title: cc.title,
      firm: cc.firm,
      vip: person?.vip ?? false,
      relationship_type: person?.relationship_type ?? null,
      relevance_tier: person?.relevance_tier ?? null,
      network_degree: person?.network_degree ?? null,
      primary_email: person?.primary_email ?? null,
      phone: person?.phone ?? null,
      linkedin_url: person?.linkedin_url ?? null,
      cadence_interval: person?.cadence_interval ?? "none",
      cadence_stage: person?.cadence_stage ?? null,
      next_touch_date: person?.next_touch_date ?? cc.nextActionDueDate,
      last_touch_date:
        person?.last_touch_date ??
        cc.lastTouch?.touched_at?.slice(0, 10) ??
        null,
      reply_status_override: person?.reply_status_override ?? null,
      reply_status_override_at: person?.reply_status_override_at ?? null,
      reason: "Scheduled touch",
      sequenceStageLabel: null,
      contactId: cc.contactId || cc.id,
      recruiterId: cc.source === "recruiter" ? cc.id : null,
    });
  }
  return result;
}

export function flattenQueueColumns(columns: QueueColumns): QueueCard[] {
  return [
    ...columns.network_growth,
    ...columns.network_maintenance,
    ...columns.browning_cold,
  ];
}

export function indexQueueComms(
  scheduleContacts: Array<
    QueueUrgencyComm & { id: string; contactId?: string | null }
  >
): Map<string, QueueUrgencyComm> {
  const map = new Map<string, QueueUrgencyComm>();
  for (const c of scheduleContacts) {
    map.set(c.contactId || c.id, c);
    if (c.contactId && c.contactId !== c.id) map.set(c.id, c);
  }
  return map;
}

export function selectOverdueQueueCards(
  columns: QueueColumns,
  commByContactId: Map<string, QueueUrgencyComm> = new Map(),
  today: string = etToday()
): QueueCard[] {
  const overdue: QueueCard[] = [];
  const seen = new Set<string>();
  for (const card of flattenQueueColumns(columns)) {
    const comm = card.contactId
      ? commByContactId.get(card.contactId)
      : undefined;
    if (deriveQueueUrgency(card, comm, today) !== "overdue") continue;
    const id = card.contactId ?? card.recruiterId ?? card.key;
    if (seen.has(id)) continue;
    seen.add(id);
    overdue.push(card);
  }
  return overdue;
}
