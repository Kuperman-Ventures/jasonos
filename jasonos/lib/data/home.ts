// Home dashboard data — intentionally minimal.
//   Top: overdue + due-soon + cadence drift / needs-scheduling across the
//   three outreach columns. Below: pre-launch site traffic.

import "server-only";
import { getOutreachPeople, getWarmthReminders } from "@/lib/outreach/data";
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

/** Local calendar YYYY-MM-DD — avoids UTC day-shift from toISOString(). */
function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Coming Friday (inclusive), local calendar. Weekend → next Friday. */
function endOfWorkWeekYmd(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const daysUntilFriday = (5 - dt.getDay() + 7) % 7;
  dt.setDate(dt.getDate() + daysUntilFriday);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

const QUEUE_INTENTS: ContactIntent[] = [
  "network_growth",
  "network_maintenance",
  "browning_cold",
];

function toAttention(
  p: {
    id: string;
    name: string;
    firm: string | null;
    title: string | null;
    relevance_tier: RelevanceTier | null;
    network_degree: NetworkDegree | null;
    intent: ContactIntent | null;
    next_touch_date: string | null;
    last_touch_date: string | null;
  },
  daysOverdue: number,
  note?: string
): AttentionContact {
  return {
    id: p.id,
    name: p.name,
    firm: p.firm,
    title: p.title,
    tier: p.relevance_tier,
    degree: p.network_degree,
    column: (p.intent as ContactIntent) ?? "network_maintenance",
    nextTouch: p.next_touch_date ?? null,
    lastTouch: p.last_touch_date ?? null,
    daysOverdue,
    note,
  };
}

export async function getHomeData(): Promise<HomeData> {
  const today = todayYmd();
  const weekEnd = endOfWorkWeekYmd(today);

  const [people, drift, gtmtools, heavenly, encoreos] = await Promise.all([
    getOutreachPeople(),
    getWarmthReminders(40),
    getSiteTraffic({ projectId: process.env.VERCEL_PROJECT_GTMTOOLS, sinceDays: 30 }),
    getSiteTraffic({ projectId: process.env.VERCEL_PROJECT_HEAVENLY, sinceDays: 30 }),
    getSiteTraffic({ projectId: process.env.VERCEL_PROJECT_ENCOREOS, sinceDays: 30 }),
  ]);

  const inQueue = people.filter(
    (p) =>
      p.intent !== null &&
      p.intent !== "backrow" &&
      QUEUE_INTENTS.includes(p.intent)
  );

  // Red bucket: scheduled next-touch strictly in the past.
  const overdue: AttentionContact[] = inQueue
    .filter((p) => p.next_touch_date != null && p.next_touch_date < today)
    .map((p) => toAttention(p, daysBetween(p.next_touch_date!, today)))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  // Due soon: today through Friday — matches the queue's "Due this week" band
  // so a contact that lands on the queue after a log also surfaces here.
  const dueSoon: AttentionContact[] = inQueue
    .filter(
      (p) =>
        p.next_touch_date != null &&
        p.next_touch_date >= today &&
        p.next_touch_date <= weekEnd
    )
    .map((p) =>
      toAttention(
        p,
        0,
        p.next_touch_date === today ? "Due today" : `Due ${p.next_touch_date}`
      )
    )
    .sort((a, b) => (a.nextTouch ?? "").localeCompare(b.nextTouch ?? ""));

  const overdueIds = new Set(overdue.map((c) => c.id));
  const dueSoonIds = new Set(dueSoon.map((c) => c.id));

  // Cadence drift from the warmth engine (no future next-touch, cadence lapsed).
  const driftFromWarmth: AttentionContact[] = drift
    .filter(
      (r) =>
        !r.person.next_touch_date &&
        !overdueIds.has(r.person.id) &&
        !dueSoonIds.has(r.person.id)
    )
    .map((r) =>
      toAttention(
        {
          id: r.person.id,
          name: r.person.name,
          firm: r.person.firm,
          title: r.person.title,
          relevance_tier: r.person.relevance_tier,
          network_degree: r.person.network_degree,
          intent: r.person.intent,
          next_touch_date: null,
          last_touch_date: r.person.last_touch_date,
        },
        r.daysOverdue,
        r.suggestedAction
      )
    );

  // Needs scheduling: classified into a queue column but no next-touch date.
  // These show in the queue's bottom band and used to be invisible on Home
  // (warmth reminders skip cadence = none).
  const driftIds = new Set(driftFromWarmth.map((c) => c.id));
  const needsScheduling: AttentionContact[] = inQueue
    .filter(
      (p) =>
        !p.next_touch_date &&
        !driftIds.has(p.id) &&
        !overdueIds.has(p.id) &&
        !dueSoonIds.has(p.id)
    )
    .map((p) =>
      toAttention(p, 0, "Set a next-touch date to put them on the calendar")
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const driftContacts = [...driftFromWarmth, ...needsScheduling];

  const sites: SitePanel[] = [
    { key: "gtmtools", label: "GTMTools.io", url: "https://gtmtools.io", traffic: gtmtools },
    { key: "heavenly", label: "Heavenly", url: null, traffic: heavenly },
    { key: "encoreos", label: "EncoreOS", url: null, traffic: encoreos },
  ];

  return { overdue, dueSoon, drift: driftContacts, sites };
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T00:00:00`).getTime();
  const b = new Date(`${toYmd}T00:00:00`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}
