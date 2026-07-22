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

function emptyNyui(): NyuiWeekSummary {
  return { applicationCount: 0, applications: [] };
}

// Weekly fresh-outreach goal: reach out to this many people you haven't been in
// contact with in the last FRESH_WINDOW_DAYS days.
const WEEKLY_OUTREACH_GOAL = 10;
const FRESH_WINDOW_DAYS = 30;

function emptyFunnel(): WeekFunnel {
  return {
    reachedOut: 0,
    replied: 0,
    metHeld: 0,
    freshOutreach: 0,
    newReferrals: 0,
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

/** Job applications (NYUI work searches) logged inside this reporting week.
 *  Aligned to the report's Wednesday→Tuesday week, not the official
 *  Sunday–Saturday claim week, so it reads on one timeline with the
 *  networking activity. Business hours are intentionally excluded. */
export interface NyuiWeekSummary {
  applicationCount: number;
  applications: {
    date: string;
    company: string;
    position: string;
    method: string;
    result: string;
  }[];
}

/** Outreach funnel counts for a single reporting week — distinct networking
 *  contacts (operational contacts already excluded). */
export interface WeekFunnel {
  /** Distinct networking contacts you sent an outbound touch to. */
  reachedOut: number;
  /** Distinct networking contacts who replied (an inbound touch). */
  replied: number;
  /** Distinct networking contacts you had a call/meeting with (held). */
  metHeld: number;
  /** Goal numerator: distinct networking contacts you made FRESH outreach to —
   *  people you hadn't contacted in the previous 30 days. */
  freshOutreach: number;
  /** New people a contact introduced you to this week (referrals recorded). */
  newReferrals: number;
}

/** All-time coverage funnel across the networking list. */
export interface CumulativeFunnel {
  listSize: number; // networking contacts (not backrow)
  reachedOut: number;
  replied: number;
  metHeld: number;
  /** People introduced to you via a referral (referred_by set). */
  referred: number;
  /** Of the referred people, how many you've reached out to / met. */
  referredReached: number;
  referredMet: number;
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
  funnel: WeekFunnel;
  nyui: NyuiWeekSummary;
}

export interface NetworkingActivity {
  generatedAt: string;
  weeks: WeekActivity[];
  cumulative: CumulativeFunnel;
  /** Weekly fresh-outreach target (people not contacted in the last 30 days). */
  goalTarget: number;
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
          funnel: emptyFunnel(),
          nyui: emptyNyui(),
        },
      ],
      cumulative: {
        listSize: 0,
        reachedOut: 0,
        replied: 0,
        metHeld: 0,
        referred: 0,
        referredReached: 0,
        referredMet: 0,
      },
      goalTarget: WEEKLY_OUTREACH_GOAL,
    };
  }

  const sb = createServiceRoleClient();
  // work_searches (NYUI job applications) live in the public schema.
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
    companiesRes,
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
      .select("id,name,tags,relevance_tier,network_degree,created_at,intent,company_id,is_networking,referred_by_contact_id,referred_at")
      .order("created_at", { ascending: false })
      .limit(20000),
    sb.from("browning_conversations").select("referrals_received,conversation_date"),
    pub
      .from("work_searches")
      .select("date,company_name,position_applied,contact_method,result")
      .gte("date", nyuiSince)
      .order("date", { ascending: true }),
    sb.from("companies").select("id,name"),
  ]);

  const touches = touchesRes.data ?? [];
  const browningIds = new Set(
    (browningIdsRes.data ?? []).map((r) => r.id as string)
  );
  const peopleById = new Map(people.map((p) => [p.id, p]));

  // Company-the-contact-works-at, resolved via contacts.company_id →
  // companies.name. Used as a fallback when the outreach layer's firm (from
  // tags / recruiter enrichment) is empty, so "the company they work at" shows
  // whenever it's recorded anywhere.
  const companyNameById = new Map(
    (companiesRes.data ?? []).map((c) => [c.id as string, (c.name as string) ?? null])
  );
  const companyByContact = new Map<string, string | null>();
  for (const c of contactsRes.data ?? []) {
    const cid = c.id as string;
    const companyId = (c.company_id as string | null) ?? null;
    companyByContact.set(cid, companyId ? companyNameById.get(companyId) ?? null : null);
  }
  const firmForContact = (cid: string): string | null =>
    peopleById.get(cid)?.firm ?? companyByContact.get(cid) ?? null;

  // ── New-vs-repeat ordinals ────────────────────────────────────────────────
  // For every contact, order ALL their touches (any channel) chronologically
  // and remember each touch's position. A conversation whose position is 0 is
  // the first-ever communication with that contact ("new"); a higher position
  // means we've spoken before ("repeat"), and the number itself shows how many
  // times prior — so "spoken to repeatedly" is legible.
  const priorCountByTouchId = new Map<string, number>();
  // Also remember the timestamp of the immediately-preceding touch for each
  // touch, so we can tell "fresh" outreach (no contact in the last 30 days)
  // from ongoing back-and-forth.
  const prevTsByTouchId = new Map<string, string | null>();
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
    list.forEach((entry, idx) => {
      priorCountByTouchId.set(entry.id, idx);
      prevTsByTouchId.set(entry.id, idx > 0 ? list[idx - 1].ts : null);
    });
  }

  // ── Outreach funnel accumulators ──────────────────────────────────────────
  // Distinct networking contacts per week (and cumulatively) at each stage.
  type FunnelSets = {
    reached: Set<string>;
    replied: Set<string>;
    met: Set<string>;
    fresh: Set<string>;
  };
  const weeklyFunnel = new Map<string, FunnelSets>();
  const funnelSetsFor = (weekStart: string): FunnelSets => {
    let s = weeklyFunnel.get(weekStart);
    if (!s) {
      s = { reached: new Set(), replied: new Set(), met: new Set(), fresh: new Set() };
      weeklyFunnel.set(weekStart, s);
    }
    return s;
  };
  const cumReached = new Set<string>();
  const cumReplied = new Set<string>();
  const cumMet = new Set<string>();
  const freshWindowMs = FRESH_WINDOW_DAYS * 86_400_000;

  // Referral funnel: networking contacts introduced to you by someone else.
  const referredIds = new Set<string>();
  const weeklyReferralIds = new Map<string, Set<string>>();

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
        funnel: emptyFunnel(),
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
    // Backrow (archived) and Network Maintenance contacts never appear in the
    // networking report — for any channel.
    const tp = peopleById.get(t.contact_id as string);
    if (tp?.intent === "backrow" || tp?.intent === "network_maintenance")
      continue;

    // Funnel accumulation (all channels; networking contacts only).
    const fcid = t.contact_id as string;
    const dir = (t.direction as string) ?? "outbound";
    const fSets = funnelSetsFor(weekStartOf(date));
    if (dir === "outbound") {
      fSets.reached.add(fcid);
      cumReached.add(fcid);
      // "Fresh" = no prior touch with this contact in the last 30 days.
      const prevTs = prevTsByTouchId.get(t.id as string) ?? null;
      const isFresh =
        !prevTs ||
        new Date(t.touched_at as string).getTime() -
          new Date(prevTs).getTime() >
          freshWindowMs;
      if (isFresh) fSets.fresh.add(fcid);
    }
    if (dir === "inbound") {
      fSets.replied.add(fcid);
      cumReplied.add(fcid);
    }
    if (CONVERSATION_CHANNELS.has(ch)) {
      fSets.met.add(fcid);
      cumMet.add(fcid);
    }

    if (ch === "thank_you_note") {
      wk.stats.thankYous += 1;
      continue;
    }
    if (CONVERSATION_CHANNELS.has(ch)) {
      const cid = t.contact_id as string;
      const p = peopleById.get(cid);
      const priorContactCount = priorCountByTouchId.get(t.id as string) ?? 0;
      const isFirstContact = priorContactCount === 0;
      wk.conversations.push({
        id: t.id as string,
        contactId: cid,
        name: p?.name ?? "Unknown contact",
        firm: firmForContact(cid),
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
    if ((c.intent as string) === "network_maintenance") continue;
    const created = c.created_at ? (c.created_at as string).slice(0, 10) : null;
    if (!created) continue;
    const wk = weekFor(weekStartOf(created));
    const p = peopleById.get(c.id as string);
    wk.newContacts.push({
      id: c.id as string,
      name: (c.name as string) ?? "Unknown",
      firm:
        p?.firm ??
        companyByContact.get(c.id as string) ??
        firmFromTags(c.tags as string[] | null),
      tier: (c.relevance_tier as RelevanceTier | null) ?? null,
      degree: (c.network_degree as NetworkDegree | null) ?? null,
    });
    wk.stats.newContacts += 1;

    // Referral: introduced to you by another contact.
    if ((c as { referred_by_contact_id?: string | null }).referred_by_contact_id) {
      const rid = c.id as string;
      referredIds.add(rid);
      const refAt =
        ((c as { referred_at?: string | null }).referred_at as string | null) ??
        created;
      const refWeek = weekStartOf(refAt);
      let set = weeklyReferralIds.get(refWeek);
      if (!set) {
        set = new Set();
        weeklyReferralIds.set(refWeek, set);
      }
      set.add(rid);
    }
  }

  // Referrals received, by browning conversation_date week.
  for (const r of referralsRes.data ?? []) {
    const date = r.conversation_date as string | null;
    if (!date) continue;
    const wk = weekFor(weekStartOf(date.slice(0, 10)));
    wk.stats.referrals += (r.referrals_received as number | null) ?? 0;
  }

  // ── Job applications (NYUI work searches), bucketed into Wed→Tue weeks ─────
  // Only the count + the company/position for each logged application; no
  // business hours, no tier split (per the networking report's scope).
  for (const ws of workSearchRes.data ?? []) {
    const date = (ws.date as string | null) ?? null;
    if (!date) continue;
    const wk = weekFor(weekStartOf(date));
    wk.nyui.applicationCount += 1;
    wk.nyui.applications.push({
      date,
      company: (ws.company_name as string | null) ?? "—",
      position: (ws.position_applied as string | null) ?? "—",
      method: (ws.contact_method as string | null) ?? "—",
      result: (ws.result as string | null) ?? "—",
    });
  }

  // Materialize any week that only has referral activity so it still shows.
  for (const wk of weeklyReferralIds.keys()) weekFor(wk);

  // Assign per-week funnel counts from the accumulated sets.
  for (const w of weeks.values()) {
    const s = weeklyFunnel.get(w.weekStart);
    w.funnel = {
      reachedOut: s?.reached.size ?? 0,
      replied: s?.replied.size ?? 0,
      metHeld: s?.met.size ?? 0,
      freshOutreach: s?.fresh.size ?? 0,
      newReferrals: weeklyReferralIds.get(w.weekStart)?.size ?? 0,
    };
  }

  const ordered = [...weeks.values()].sort((a, b) =>
    a.weekStart < b.weekStart ? 1 : -1
  );

  // Keep the current week (always) plus any historical week with networking OR
  // job-application activity — a week with only job applications still earns
  // its place in the report.
  const hasActivity = (w: WeekActivity) =>
    w.stats.conversations > 0 ||
    w.stats.newContacts > 0 ||
    w.stats.thankYous > 0 ||
    w.stats.referrals > 0 ||
    w.nyui.applicationCount > 0 ||
    w.funnel.reachedOut > 0 ||
    w.funnel.newReferrals > 0;
  const filtered = ordered.filter((w) => w.isCurrent || hasActivity(w));

  // Cumulative coverage across the networking list (operational + backrow out).
  const listSize = people.filter(
    (p) => p.intent !== "network_maintenance" && p.intent !== "backrow"
  ).length;
  let referredReached = 0;
  let referredMet = 0;
  for (const id of referredIds) {
    if (cumReached.has(id)) referredReached += 1;
    if (cumMet.has(id)) referredMet += 1;
  }

  return {
    generatedAt: today,
    weeks: filtered,
    cumulative: {
      listSize,
      reachedOut: cumReached.size,
      replied: cumReplied.size,
      metHeld: cumMet.size,
      referred: referredIds.size,
      referredReached,
      referredMet,
    },
    goalTarget: WEEKLY_OUTREACH_GOAL,
  };
}
