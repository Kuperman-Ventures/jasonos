// Home dashboard data — overdue contacts that need a touch, plus site traffic.
// Overdue uses the same people set and Eastern "today" as the Outreach Queue.

import "server-only";
import { daysBetweenYmd, etToday } from "@/lib/dates";
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
  column: ContactIntent;
  nextTouch: string | null;
  lastTouch: string | null;
  daysOverdue: number;
  email: string | null;
  phone: string | null;
}

export interface SitePanel {
  key: string;
  label: string;
  url: string | null;
  traffic: SiteTraffic;
}

export interface HomeData {
  overdue: AttentionContact[];
  sites: SitePanel[];
}

function cardToAttention(
  c: QueueCard,
  daysOverdue: number
): AttentionContact | null {
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
    email: c.primary_email,
    phone: c.phone,
  };
}

function isEngagedToday(lastTouch: string | null, today: string): boolean {
  return Boolean(lastTouch && lastTouch.slice(0, 10) === today);
}

export async function getHomeData(): Promise<HomeData> {
  const today = etToday();

  const [queue, gtmtools, heavenly, encoreos] = await Promise.all([
    getThreeColumnQueue(),
    getSiteTraffic({ projectId: process.env.VERCEL_PROJECT_GTMTOOLS, sinceDays: 30 }),
    getSiteTraffic({ projectId: process.env.VERCEL_PROJECT_HEAVENLY, sinceDays: 30 }),
    getSiteTraffic({ projectId: process.env.VERCEL_PROJECT_ENCOREOS, sinceDays: 30 }),
  ]);

  const cards = [
    ...queue.network_growth,
    ...queue.network_maintenance,
    ...queue.browning_cold,
  ];

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

  const sites: SitePanel[] = [
    { key: "gtmtools", label: "GTMTools.io", url: "https://gtmtools.io", traffic: gtmtools },
    { key: "heavenly", label: "Heavenly", url: null, traffic: heavenly },
    { key: "encoreos", label: "EncoreOS", url: null, traffic: encoreos },
  ];

  return { overdue, sites };
}
