// Home dashboard data — overdue contacts that need a touch, plus site traffic.
// Overdue uses the same people set and Eastern "today" as the Outreach Queue,
// including Schedule contacts that never landed in a classified column.

import "server-only";
import { daysBetweenYmd, etToday } from "@/lib/dates";
import { getThreeColumnQueue, type QueueCard } from "@/lib/outreach/queue-buckets";
import {
  selectOverdueQueueCards,
  unionScheduleIntoQueueColumns,
  indexQueueComms,
} from "@/lib/outreach/queue-urgency";
import { getCommunicationsData } from "@/lib/server-actions/communications";
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

export async function getHomeData(): Promise<HomeData> {
  const today = etToday();

  const [queue, scheduleContacts, gtmtools, heavenly, encoreos] =
    await Promise.all([
      getThreeColumnQueue(),
      getCommunicationsData(),
      getSiteTraffic({
        projectId: process.env.VERCEL_PROJECT_GTMTOOLS,
        sinceDays: 30,
      }),
      getSiteTraffic({
        projectId: process.env.VERCEL_PROJECT_HEAVENLY,
        sinceDays: 30,
      }),
      getSiteTraffic({
        projectId: process.env.VERCEL_PROJECT_ENCOREOS,
        sinceDays: 30,
      }),
    ]);

  const peopleById = new Map(
    queue.outreachPeople.map((person) => [person.id, person])
  );
  const columns = unionScheduleIntoQueueColumns(
    {
      network_growth: queue.network_growth,
      network_maintenance: queue.network_maintenance,
      browning_cold: queue.browning_cold,
    },
    scheduleContacts,
    peopleById
  );
  const commByContactId = indexQueueComms(scheduleContacts);

  const overdue: AttentionContact[] = selectOverdueQueueCards(
    columns,
    commByContactId,
    today
  )
    .map((c) => {
      const nextTouch =
        c.next_touch_date ??
        (c.contactId
          ? commByContactId.get(c.contactId)?.nextActionDueDate
          : null) ??
        today;
      return cardToAttention(c, daysBetweenYmd(nextTouch.slice(0, 10), today));
    })
    .filter((c): c is AttentionContact => Boolean(c))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const sites: SitePanel[] = [
    {
      key: "gtmtools",
      label: "GTMTools.io",
      url: "https://gtmtools.io",
      traffic: gtmtools,
    },
    { key: "heavenly", label: "Heavenly", url: null, traffic: heavenly },
    { key: "encoreos", label: "EncoreOS", url: null, traffic: encoreos },
  ];

  return { overdue, sites };
}
