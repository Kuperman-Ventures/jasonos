"use server";

// Networking Activity — a thin, activity-only report broken out by week
// (Wednesday to Tuesday). Shows what you DID: conversations had, new contacts
// added, thank-yous sent, referrals received. No "what you didn't do" — no
// awaiting/overdue/drift. Current week on top, history below. Derived entirely
// from data already collected; nothing new to log.

import {
  createServiceRoleClient,
  createPublicServiceRoleClient,
} from "@/lib/supabase/server";
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

// NYUI business-hours entities (mirrors the NYUI tool). Kept here so the
// weekly report can show a per-entity split without importing client code.
const NYUI_ENTITIES = ["Kuperman Ventures LLC", "Kuperman Advisors LLC"];

// Default NYUI work-search tier by contact method, mirroring the NYUI tool.
// An explicit `activity_tier` on the row wins; otherwise we derive from method.
const NYUI_TIER_BY_METHOD: Record<string, "employer_contact" | "networking"> = {
  "Online Portal": "employer_contact",
  "Direct Email": "employer_contact",
  "Phone Call": "employer_contact",
  LinkedIn: "networking",
  "Networking Event": "networking",
  Interview: "employer_contact",
  "In-Person Meeting": "employer_contact",
  "Video Meeting": "employer_contact",
  "Recruiter / Headhunter Screen": "employer_contact",
  "Networking Contact": "networking",
  "Career-Center Advisor Meeting": "networking",
};

function nyuiTierOf(row: {
  activity_tier: string | null;
  contact_method: string | null;
}): "employer_contact" | "networking" {
  if (row.activity_tier === "employer_contact" || row.activity_tier === "networking") {
    return row.activity_tier;
  }
  return NYUI_TIER_BY_METHOD[row.contact_method ?? ""] ?? "employer_contact";
}

function emptyNyui(): NyuiWeekSummary {
  return {
    workSearches: 0,
    tierA: 0,
    tierB: 0,
    qualifyingDays: 0,
    businessMinutes: 0,
    businessByEntity: NYUI_ENTITIES.map((entity) => ({ entity, minutes: 0 })),
  };
}

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
  /** True when this is the first-ever logged communication with this contact
   *  (no earlier touch of any channel). A "new communication with a new
   *  contact". */
  isFirstContact: boolean;
  /** How many communications with this contact came before this one (any
   *  channel). 0 for a first contact; higher means "spoken to repeatedly". */
  priorContactCount: number;
}

export interface NsNewContact {
  id: string;
  name: string;
  firm: string | null;
  tier: RelevanceTier | null;
  degree: NetworkDegree | null;
}

/** NYS DOL (NYUI) activity that fell inside this reporting week. Aligned to
 *  the report's Wednesday→Tuesday week, not the official Sunday–Saturday claim
 *  week, so it reads on one timeline with the networking activity. */
export interface NyuiWeekSummary {
  workSearches: number;
  tierA: number; // employer contacts
  tierB: number; // networking / fruitful activity
  qualifyingDays: number; // unique calendar days with a work search
  businessMinutes: number;
  businessByEntity: { entity: string; minutes: number }[];
}

export interface WeekActivity {
  weekStart: string; // Wednesday (YYYY-MM-DD), inclusive
  weekEnd: string; // Tuesday (YYYY-MM-DD), inclusive
  isCurrent: boolean;
  conversations: NsConversation[];
  newContacts: NsNewContact[];
  stats: {
    conversations: number;
    newContacts: number;
    thankYous: number;
    referrals: number;
    /** Conversations that were a first-ever communication with the contact. */
    newConversations: number;
    /** Conversations with a contact already spoken to before. */
    repeatConversations: number;
  };
  nyui: NyuiWeekSummary;
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

// Wednesday-start week for any YYYY-MM-DD: the most recent Wednesday on/before
// it. Weeks run Wednesday → Tuesday, so Tuesday is the LAST day of the week
// that began the prior Wednesday.
function weekStartOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const back = (d.getUTCDay() - 3 + 7) % 7; // Wed = 3
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
          stats: {
            conversations: 0,
            newContacts: 0,
            thankYous: 0,
            referrals: 0,
            newConversations: 0,
            repeatConversations: 0,
          },
          nyui: emptyNyui(),
        },
      ],
    };
  }

  const sb = createServiceRoleClient();
  // work_searches / business_hours (NYUI) live in the public schema.
  const pub = createPublicServiceRoleClient();
  // NYUI history window — comfortably covers every week the report can show.
  const nyuiSince = addDaysStr(currentWeekStart, -400);
  const [
    people,
    touchesRes,
    browningIdsRes,
    contactsRes,
    referralsRes,
    workSearchRes,
    businessHoursRes,
  ] = await Promise.all([
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
    pub
      .from("work_searches")
      .select("date,contact_method,activity_tier")
      .gte("date", nyuiSince),
    pub
      .from("business_hours")
      .select("date,entity,hours,minutes")
      .gte("date", nyuiSince),
  ]);

  const touches = touchesRes.data ?? [];
  const browningIds = new Set(
    (browningIdsRes.data ?? []).map((r) => r.id as string)
  );
  const peopleById = new Map(people.map((p) => [p.id, p]));

  // ── New-vs-repeat ordinals ────────────────────────────────────────────────
  // For every contact, order ALL their touches (any channel) chronologically
  // and remember each touch's position. A conversation whose position is 0 is
  // the first-ever communication with that contact ("new"); a higher position
  // means we've spoken before ("repeat"), and the number itself shows how many
  // times prior — so "spoken to repeatedly" is legible.
  const priorCountByTouchId = new Map<string, number>();
  const touchesByContact = new Map<string, { id: string; ts: string }[]>();
  for (const t of touches) {
    const cid = t.contact_id as string;
    const list = touchesByContact.get(cid);
    const entry = { id: t.id as string, ts: (t.touched_at as string) ?? "" };
    if (list) list.push(entry);
    else touchesByContact.set(cid, [entry]);
  }
  for (const list of touchesByContact.values()) {
    list.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.id < b.id ? -1 : 1));
    list.forEach((entry, idx) => priorCountByTouchId.set(entry.id, idx));
  }

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
        stats: {
          conversations: 0,
          newContacts: 0,
          thankYous: 0,
          referrals: 0,
          newConversations: 0,
          repeatConversations: 0,
        },
        nyui: emptyNyui(),
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
      const priorContactCount = priorCountByTouchId.get(t.id as string) ?? 0;
      const isFirstContact = priorContactCount === 0;
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
        isFirstContact,
        priorContactCount,
      });
      wk.stats.conversations += 1;
      if (isFirstContact) wk.stats.newConversations += 1;
      else wk.stats.repeatConversations += 1;
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

  // ── NYUI (NYS DOL) activity, bucketed into the report's Wed→Tue weeks ──────
  // Work searches: count + Tier A/B split + unique qualifying days.
  const nyuiQualifyingDays = new Map<string, Set<string>>();
  for (const ws of workSearchRes.data ?? []) {
    const date = (ws.date as string | null) ?? null;
    if (!date) continue;
    const weekStart = weekStartOf(date);
    const wk = weekFor(weekStart);
    wk.nyui.workSearches += 1;
    if (
      nyuiTierOf({
        activity_tier: (ws.activity_tier as string | null) ?? null,
        contact_method: (ws.contact_method as string | null) ?? null,
      }) === "employer_contact"
    ) {
      wk.nyui.tierA += 1;
    } else {
      wk.nyui.tierB += 1;
    }
    let days = nyuiQualifyingDays.get(weekStart);
    if (!days) {
      days = new Set();
      nyuiQualifyingDays.set(weekStart, days);
    }
    days.add(date);
  }
  for (const [weekStart, days] of nyuiQualifyingDays) {
    weekFor(weekStart).nyui.qualifyingDays = days.size;
  }

  // Business hours: total + per-entity split.
  for (const bh of businessHoursRes.data ?? []) {
    const date = (bh.date as string | null) ?? null;
    if (!date) continue;
    const wk = weekFor(weekStartOf(date));
    const mins =
      ((bh.hours as number | null) ?? 0) * 60 + ((bh.minutes as number | null) ?? 0);
    wk.nyui.businessMinutes += mins;
    const entity = (bh.entity as string | null) ?? "Other";
    const row = wk.nyui.businessByEntity.find((e) => e.entity === entity);
    if (row) row.minutes += mins;
    else wk.nyui.businessByEntity.push({ entity, minutes: mins });
  }

  const ordered = [...weeks.values()].sort((a, b) =>
    a.weekStart < b.weekStart ? 1 : -1
  );

  // Keep the current week (always) plus any historical week with networking OR
  // NYUI activity — NYUI is now part of the report, so a week with only work
  // searches / business hours still earns its place.
  const hasActivity = (w: WeekActivity) =>
    w.stats.conversations > 0 ||
    w.stats.newContacts > 0 ||
    w.stats.thankYous > 0 ||
    w.stats.referrals > 0 ||
    w.nyui.workSearches > 0 ||
    w.nyui.businessMinutes > 0;
  const filtered = ordered.filter((w) => w.isCurrent || hasActivity(w));

  return { generatedAt: today, weeks: filtered };
}
