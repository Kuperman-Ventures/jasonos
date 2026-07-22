// Home dashboard data — intentionally minimal.
//   Top: overdue (red-bucket) contacts + cadence drift across warm/specific/cold.
//   Below: pre-launch site traffic for GTMTools.io, Heavenly, EncoreOS.

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
  column: ContactIntent; // warm | specific | cold
  nextTouch: string | null;
  lastTouch: string | null;
  daysOverdue: number; // 0 for drift (no scheduled date)
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
  drift: AttentionContact[];
  sites: SitePanel[];
}

function todayYmd(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

const QUEUE_INTENTS: ContactIntent[] = [
  "network_growth",
  "network_maintenance",
  "browning_cold",
];

export async function getHomeData(): Promise<HomeData> {
  const today = todayYmd();

  const [people, drift, gtmtools, heavenly, encoreos] = await Promise.all([
    getOutreachPeople(),
    getWarmthReminders(40),
    getSiteTraffic({ projectId: process.env.VERCEL_PROJECT_GTMTOOLS, sinceDays: 30 }),
    getSiteTraffic({ projectId: process.env.VERCEL_PROJECT_HEAVENLY, sinceDays: 30 }),
    getSiteTraffic({ projectId: process.env.VERCEL_PROJECT_ENCOREOS, sinceDays: 30 }),
  ]);

  // Red bucket: a scheduled next-touch that's now in the past, in the queue.
  const overdue: AttentionContact[] = people
    .filter(
      (p) =>
        p.intent !== null &&
        p.intent !== "backrow" &&
        QUEUE_INTENTS.includes(p.intent) &&
        p.next_touch_date != null &&
        p.next_touch_date < today
    )
    .map((p) => ({
      id: p.id,
      name: p.name,
      firm: p.firm,
      title: p.title,
      tier: p.relevance_tier,
      degree: p.network_degree,
      column: p.intent as ContactIntent,
      nextTouch: p.next_touch_date ?? null,
      lastTouch: p.last_touch_date ?? null,
      daysOverdue: daysBetween(p.next_touch_date!, today),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  // Cadence drift: no scheduled next touch, but the cadence has lapsed. (Those
  // with a scheduled-but-past date are already in `overdue`; exclude them here
  // so a contact never appears twice.)
  const driftContacts: AttentionContact[] = drift
    .filter((r) => !r.person.next_touch_date)
    .map((r) => ({
      id: r.person.id,
      name: r.person.name,
      firm: r.person.firm,
      title: r.person.title,
      tier: r.person.relevance_tier,
      degree: r.person.network_degree,
      column: (r.person.intent as ContactIntent) ?? "network_maintenance",
      nextTouch: null,
      lastTouch: r.person.last_touch_date ?? null,
      daysOverdue: r.daysOverdue,
      note: r.suggestedAction,
    }));

  const sites: SitePanel[] = [
    { key: "gtmtools", label: "GTMTools.io", url: "https://gtmtools.io", traffic: gtmtools },
    { key: "heavenly", label: "Heavenly", url: null, traffic: heavenly },
    { key: "encoreos", label: "EncoreOS", url: null, traffic: encoreos },
  ];

  return { overdue, drift: driftContacts, sites };
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T00:00:00Z`).getTime();
  const b = new Date(`${toYmd}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}
