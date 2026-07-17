"use server";

// Networking Activity — a thin, activity-only report broken out by week
// (Tuesday to Tuesday). Shows what you DID: conversations had, new contacts
// added, thank-yous sent, referrals received. No "what you didn't do" — no
// awaiting/overdue/drift. Current week on top, history below. Derived entirely
// from data already collected; nothing new to log.

import { createServiceRoleClient } from "@/lib/supabase/server";
import { getOutreachPeople } from "@/lib/outreach/data";
import type { NetworkDegree, RelevanceTier } from "@/lib/outreach/types";

// "Real conversation" channels — email/LinkedIn/text land the meeting, they
// aren't networking conversations, so they never appear as conversations.
const CONVERSATION_CHANNELS = new Set([
  "phone",
  "call",
  "video",
  "in_person",
  "calendar",
  "coffee_chat",
]);

export interface NsConversation {
  id: string;
  contactId: string;
  name: string;
  firm: string | null;
  date: string;
  channel: string;
  brief: string | null;
  outcome: string | null;
  browning: boolean;
  tier: RelevanceTier | null;
  degree: NetworkDegree | null;
}

export interface NsNewContact {
  id: string;
  name: string;
  firm: string | null;
  tier: RelevanceTier | null;
  degree: NetworkDegree | null;
}

export interface WeekActivity {
  weekStart: string; // Tuesday (YYYY-MM-DD), inclusive
  weekEnd: string; // Monday (YYYY-MM-DD), inclusive
  isCurrent: boolean;
  conversations: NsConversation[];
  newContacts: NsNewContact[];
  stats: {
    conversations: number;
    newContacts: number;
    thankYous: number;
    referrals: number;
  };
}

export interface NetworkingActivity {
  generatedAt: string;
  weeks: WeekActivity[];
}

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function ymd(d: Date): string {
  return d.toISOString().split("T")[0];
}

// Tuesday-start week for any YYYY-MM-DD: the most recent Tuesday on/before it.
function weekStartOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const back = (d.getUTCDay() - 2 + 7) % 7; // Tue = 2
  d.setUTCDate(d.getUTCDate() - back);
  return ymd(d);
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
}

function firmFromTags(tags: string[] | null): string | null {
  const t = (tags ?? []).find((x) => x.startsWith("firm:"));
  return t ? t.slice("firm:".length).replace(/-/g, " ") : null;
}

export async function getNetworkingActivity(): Promise<NetworkingActivity> {
  const today = ymd(new Date());
  const currentWeekStart = weekStartOf(today);
  if (!hasConfig()) {
    return {
      generatedAt: today,
      weeks: [
        {
          weekStart: currentWeekStart,
          weekEnd: addDaysStr(currentWeekStart, 6),
          isCurrent: true,
          conversations: [],
          newContacts: [],
          stats: { conversations: 0, newContacts: 0, thankYous: 0, referrals: 0 },
        },
      ],
    };
  }

  const sb = createServiceRoleClient();
  const [people, touchesRes, browningIdsRes, contactsRes, referralsRes] =
    await Promise.all([
      getOutreachPeople(),
      sb
        .from("contact_touches")
        .select("id,contact_id,channel,direction,touched_at,brief,outcome")
        .order("touched_at", { ascending: false })
        .limit(8000),
      sb.from("contacts").select("id").eq("browning_source", true),
      sb
        .from("contacts")
        .select("id,name,tags,relevance_tier,network_degree,created_at,intent")
        .order("created_at", { ascending: false }),
      sb.from("browning_conversations").select("referrals_received,conversation_date"),
    ]);

  const touches = touchesRes.data ?? [];
  const browningIds = new Set(
    (browningIdsRes.data ?? []).map((r) => r.id as string)
  );
  const peopleById = new Map(people.map((p) => [p.id, p]));

  // Ensure every week bucket exists lazily.
  const weeks = new Map<string, WeekActivity>();
  const weekFor = (weekStart: string): WeekActivity => {
    let w = weeks.get(weekStart);
    if (!w) {
      w = {
        weekStart,
        weekEnd: addDaysStr(weekStart, 6),
        isCurrent: weekStart === currentWeekStart,
        conversations: [],
        newContacts: [],
        stats: { conversations: 0, newContacts: 0, thankYous: 0, referrals: 0 },
      };
      weeks.set(weekStart, w);
    }
    return w;
  };
  // Always show the current week, even if quiet.
  weekFor(currentWeekStart);

  // Conversations + thank-yous from touches.
  for (const t of touches) {
    const date = (t.touched_at as string).slice(0, 10);
    const ch = (t.channel as string) ?? "";
    const wk = weekFor(weekStartOf(date));
    if (ch === "thank_you_note") {
      wk.stats.thankYous += 1;
      continue;
    }
    if (CONVERSATION_CHANNELS.has(ch)) {
      const cid = t.contact_id as string;
      const p = peopleById.get(cid);
      // Backburner (Backrow) contacts never appear in reports.
      if (p?.intent === "backrow") continue;
      wk.conversations.push({
        id: t.id as string,
        contactId: cid,
        name: p?.name ?? "Unknown contact",
        firm: p?.firm ?? null,
        date,
        channel: ch,
        brief: (t.brief as string | null) ?? null,
        outcome: (t.outcome as string | null) ?? null,
        browning: browningIds.has(cid),
        tier: p?.relevance_tier ?? null,
        degree: p?.network_degree ?? null,
      });
      wk.stats.conversations += 1;
    }
  }

  // New contacts added, by created_at week.
  for (const c of contactsRes.data ?? []) {
    if ((c.intent as string) === "backrow") continue;
    const created = c.created_at ? (c.created_at as string).slice(0, 10) : null;
    if (!created) continue;
    const wk = weekFor(weekStartOf(created));
    const p = peopleById.get(c.id as string);
    wk.newContacts.push({
      id: c.id as string,
      name: (c.name as string) ?? "Unknown",
      firm: p?.firm ?? firmFromTags(c.tags as string[] | null),
      tier: (c.relevance_tier as RelevanceTier | null) ?? null,
      degree: (c.network_degree as NetworkDegree | null) ?? null,
    });
    wk.stats.newContacts += 1;
  }

  // Referrals received, by browning conversation_date week.
  for (const r of referralsRes.data ?? []) {
    const date = r.conversation_date as string | null;
    if (!date) continue;
    const wk = weekFor(weekStartOf(date.slice(0, 10)));
    wk.stats.referrals += (r.referrals_received as number | null) ?? 0;
  }

  const ordered = [...weeks.values()].sort((a, b) =>
    a.weekStart < b.weekStart ? 1 : -1
  );

  // Keep the current week (always) plus any historical week that has activity.
  const hasActivity = (w: WeekActivity) =>
    w.stats.conversations > 0 ||
    w.stats.newContacts > 0 ||
    w.stats.thankYous > 0 ||
    w.stats.referrals > 0;
  const filtered = ordered.filter((w) => w.isCurrent || hasActivity(w));

  return { generatedAt: today, weeks: filtered };
}
