// Home dashboard data — intentionally minimal.
//   Top: overdue + due-soon + cadence drift / needs-scheduling across the
//   three outreach columns. Below: pre-launch site traffic.
//
// Overdue / Due this week use the same people set and Eastern "today" as the
// Outreach Queue bands so the three surfaces stay consistent overnight.

import "server-only";
import { daysBetweenYmd, etEndOfWorkWeekYmd, etToday } from "@/lib/dates";
import { getWarmthReminders } from "@/lib/outreach/data";
import { getThreeColumnQueue, type QueueCard } from "@/lib/outreach/queue-buckets";
import { getSiteTraffic, type SiteTraffic } from "@/lib/integrations/vercel-analytics";
import type {
  ContactIntent,
  NetworkDegree,
  RelevanceTier,
} from "@/lib/outreach/types";

export interface AttentionContact {
  id: string;
  name: string;
  firm: string | null;
  title: string | null;
  tier: RelevanceTier | null;
  degree: NetworkDegree | null;
  column: ContactIntent; // network_growth | network_maintenance | browning_cold
  nextTouch: string | null;
  lastTouch: string | null;
  daysOverdue: number; // 0 for due-today / drift-without-date
  note?: string; // suggested action (drift only)
}

export interface SitePanel {
  key: string;
  label: string;
  url: string | null;
  traffic: SiteTraffic;
}

export interface HomeData {
  overdue: AttentionContact[];
  /** Next touch is today through end of the current work week (Friday). */
  dueSoon: AttentionContact[];
  drift: AttentionContact[];
  sites: SitePanel[];
}

function cardToAttention(
  c: QueueCard,
  daysOverdue: number,
  note?: string
): AttentionContact | null {
  // Home attention cards open OutreachModal by contact id — skip orphan
  // recruiter rows that have no jasonos.contacts mapping yet.
  if (!c.contactId) return null;
  return {
    id: c.contactId,
    name: c.name,
    firm: c.firm,
    title: c.title,
    tier: c.relevance_tier,
    degree: c.network_degree,
    column: c.column,
    nextTouch: c.next_touch_date ?? null,
    lastTouch: c.last_touch_date ?? null,
    daysOverdue,
    note,
  };
}

function isEngagedToday(lastTouch: string | null, today: string): boolean {
  return Boolean(lastTouch && lastTouch.slice(0, 10) === today);
}

export async function getHomeData(): Promise<HomeData> {
  const today = etToday();
  const weekEnd = etEndOfWorkWeekYmd(today);

  const [queue, drift, gtmtools, heavenly, encoreos] = await Promise.all([
    getThreeColumnQueue(),
    getWarmthReminders(40),
    getSiteTraffic({ projectId: process.env.VERCEL_PROJECT_GTMTOOLS, sinceDays: 30 }),
    getSiteTraffic({ projectId: process.env.VERCEL_PROJECT_HEAVENLY, sinceDays: 30 }),
    getSiteTraffic({ projectId: process.env.VERCEL_PROJECT_ENCOREOS, sinceDays: 30 }),
  ]);

  // Same membership as the queue columns (pinned intent OR derived).
  const cards = [
    ...queue.network_growth,
    ...queue.network_maintenance,
    ...queue.browning_cold,
  ];

  // Red bucket: past next-touch, and not already engaged today (matches Queue
  // Overdue band — Engaged Today wins there).
  const overdue: AttentionContact[] = cards
    .filter(
      (c) =>
        c.next_touch_date != null &&
        c.next_touch_date < today &&
        !isEngagedToday(c.last_touch_date, today)
    )
    .map((c) =>
      cardToAttention(c, daysBetweenYmd(c.next_touch_date!, today))
    )
    .filter((c): c is AttentionContact => Boolean(c))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  // Due soon: today through Friday — same band as the queue.
  const dueSoon: AttentionContact[] = cards
    .filter(
      (c) =>
        c.next_touch_date != null &&
        c.next_touch_date >= today &&
        c.next_touch_date <= weekEnd &&
        !isEngagedToday(c.last_touch_date, today)
    )
    .map((c) =>
      cardToAttention(
        c,
        0,
        c.next_touch_date === today ? "Due today" : `Due ${c.next_touch_date}`
      )
    )
    .filter((c): c is AttentionContact => Boolean(c))
    .sort((a, b) => (a.nextTouch ?? "").localeCompare(b.nextTouch ?? ""));

  const overdueIds = new Set(overdue.map((c) => c.id));
  const dueSoonIds = new Set(dueSoon.map((c) => c.id));
  const queueContactIds = new Set(
    cards.map((c) => c.contactId).filter((id): id is string => Boolean(id))
  );

  // Cadence drift from the warmth engine (no next-touch, cadence lapsed).
  // Restricted to people who actually appear on the queue columns.
  const driftFromWarmth: AttentionContact[] = drift
    .filter(
      (r) =>
        !r.person.next_touch_date &&
        queueContactIds.has(r.person.id) &&
        !overdueIds.has(r.person.id) &&
        !dueSoonIds.has(r.person.id) &&
        !isEngagedToday(r.person.last_touch_date, today)
    )
    .map((r) => ({
      id: r.person.id,
      name: r.person.name,
      firm: r.person.firm,
      title: r.person.title,
      tier: r.person.relevance_tier,
      degree: r.person.network_degree,
      column: (r.person.intent as ContactIntent) ?? "network_maintenance",
      nextTouch: null,
      lastTouch: r.person.last_touch_date,
      daysOverdue: r.daysOverdue,
      note: r.suggestedAction,
    }));

  // Needs scheduling: on a queue column but no next-touch date (and not
  // already covered by warmth cadence-lapse).
  const driftIds = new Set(driftFromWarmth.map((c) => c.id));
  const needsScheduling: AttentionContact[] = cards
    .filter(
      (c) =>
        !c.next_touch_date &&
        c.contactId != null &&
        !driftIds.has(c.contactId) &&
        !overdueIds.has(c.contactId) &&
        !dueSoonIds.has(c.contactId) &&
        !isEngagedToday(c.last_touch_date, today)
    )
    .map((c) =>
      cardToAttention(c, 0, "Set a next-touch date to put them on the calendar")
    )
    .filter((c): c is AttentionContact => Boolean(c))
    .sort((a, b) => a.name.localeCompare(b.name));

  const driftContacts = [...driftFromWarmth, ...needsScheduling];

  const sites: SitePanel[] = [
    { key: "gtmtools", label: "GTMTools.io", url: "https://gtmtools.io", traffic: gtmtools },
    { key: "heavenly", label: "Heavenly", url: null, traffic: heavenly },
    { key: "encoreos", label: "EncoreOS", url: null, traffic: encoreos },
  ];

  return { overdue, dueSoon, drift: driftContacts, sites };
}
