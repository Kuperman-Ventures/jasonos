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
import { getUpcomingCalendarMeetings } from "@/lib/server-actions/outreach-sync";
import { NETWORK_ROLE_SHORT } from "@/lib/outreach/types";
import type {
  NetworkDegree,
  NetworkRole,
  RelevanceTier,
} from "@/lib/outreach/types";

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
// Recency window for "have we communicated recently?" — used both for the
// fresh-outreach goal and for flagging referrals that still need follow-up.
const FRESH_WINDOW_DAYS = 90;

function emptyFunnel(): WeekFunnel {
  return {
    reachedOut: 0,
    replied: 0,
    metHeld: 0,
    freshOutreach: 0,
    freshToMeeting: 0,
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
  /** Who introduced you to this contact, when recorded. */
  referredBy: string | null;
}

export interface NsReferral {
  id: string;
  name: string;
  firm: string | null;
  referredBy: string;
  referredAt: string;
  tier: RelevanceTier | null;
  /** How far this person is from you (2 = intro from a 1, 3 = intro from a 2). */
  degree: NetworkDegree | null;
  /** Introducer's degree — kept for sorting/filters; UI prefers referralChain. */
  referrerDegree: NetworkDegree | null;
  /**
   * Introduction path from the root contact you already know through to this
   * person, e.g. ["Barbara Piermont", "Libby Topel", "Will Duffy"].
   */
  referralChain: string[];
}

/** A named fresh outreach this week — the people behind the funnel count.
 *  Never includes message body / email content — name + channel + date only. */
export interface NsFreshOutreach {
  contactId: string;
  name: string;
  firm: string | null;
  date: string;
  channel: string;
  tier: RelevanceTier | null;
  degree: NetworkDegree | null;
  /** True when this fresh outreach also had a call/meeting this week. */
  ledToMeeting: boolean;
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
  /** Distinct networking contacts you made FRESH outreach to — people you
   *  hadn't contacted in the previous 90 days. */
  freshOutreach: number;
  /**
   * Fresh outreaches that turned into a call/meeting this week — the middle
   * of the path Fresh → Meeting → Referral. Distinct contacts who had a
   * held conversation this week that started from a fresh engagement
   * (no prior touch in 90 days, or a fresh outbound earlier the same week).
   */
  freshToMeeting: number;
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
  /** Named introductions recorded this week (Growth / Cold only). */
  newReferrals: NsReferral[];
  /** Named fresh outreaches this week (the people in funnel.freshOutreach). */
  freshOutreaches: NsFreshOutreach[];
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
  /** Weekly fresh-outreach target (people not contacted in the last 90 days). */
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

/**
 * Weekly Report only includes Network Growth and Cold.
 * Maintenance, Backrow, and unset intent do not belong on the report.
 */
function countsOnWeeklyReport(intent: string | null | undefined): boolean {
  return intent === "network_growth" || intent === "browning_cold";
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
          newReferrals: [],
          freshOutreaches: [],
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
      // Never pull future-dated applications into the weekly report.
      .lte("date", today)
      .order("date", { ascending: true }),
    sb.from("companies").select("id,name"),
  ]);

  const touches = touchesRes.data ?? [];
  const browningIds = new Set(
    (browningIdsRes.data ?? []).map((r) => r.id as string)
  );
  const peopleById = new Map(people.map((p) => [p.id, p]));
  // Prefer the contacts-table intent (source of truth for Growth / Cold /
  // Maintenance) over any derived outreach view.
  const intentById = new Map<string, string | null>();
  for (const c of contactsRes.data ?? []) {
    intentById.set(c.id as string, (c.intent as string | null) ?? null);
  }
  for (const p of people) {
    if (!intentById.has(p.id)) intentById.set(p.id, p.intent ?? null);
  }

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
  // touch, so we can tell "fresh" outreach (no contact in the last 90 days)
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
  const contactNameById = new Map<string, string>();
  const contactDegreeById = new Map<string, NetworkDegree | null>();
  const referredById = new Map<string, string | null>();
  for (const c of contactsRes.data ?? []) {
    const id = c.id as string;
    contactNameById.set(id, (c.name as string) ?? "Unknown");
    contactDegreeById.set(
      id,
      (c.network_degree as NetworkDegree | null) ?? null
    );
    referredById.set(
      id,
      (c.referred_by_contact_id as string | null) ?? null
    );
  }

  /**
   * Introduction breadcrumb IDs ending at this person (Degree-1 root → … → tip).
   * Stops at the Degree-1 root — same scope as the names shown in the UI.
   */
  const referralChainIdsFor = (contactId: string): string[] => {
    const ids: string[] = [];
    const seen = new Set<string>();
    let cur: string | null = contactId;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      ids.unshift(cur);
      const parent: string | null = referredById.get(cur) ?? null;
      if (!parent) break;
      // Parent is the Degree-1 root — include them, then stop.
      if (contactDegreeById.get(parent) === 1) {
        ids.unshift(parent);
        break;
      }
      cur = parent;
    }
    return ids;
  };

  const referralChainFor = (contactId: string): string[] =>
    referralChainIdsFor(contactId).map(
      (id) => contactNameById.get(id) ?? "Unknown"
    );

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
        newReferrals: [],
        freshOutreaches: [],
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

  // Named fresh-outreach rows keyed by week → contact (earliest outbound wins).
  const freshByWeek = new Map<string, Map<string, NsFreshOutreach>>();

  // Conversations + thank-yous from touches.
  for (const t of touches) {
    const date = (t.touched_at as string).slice(0, 10);
    const ch = (t.channel as string) ?? "";
    const wk = weekFor(weekStartOf(date));
    // Only Network Growth and Cold count — Maintenance, Backrow, and
    // unset intent never appear on the weekly report.
    const cid = t.contact_id as string;
    const tp = peopleById.get(cid);
    if (!countsOnWeeklyReport(intentById.get(cid) ?? tp?.intent)) continue;

    // Funnel accumulation (all channels; Growth / Cold only).
    const dir = (t.direction as string) ?? "outbound";
    const weekKey = weekStartOf(date);
    const fSets = funnelSetsFor(weekKey);
    if (dir === "outbound") {
      fSets.reached.add(cid);
      cumReached.add(cid);
      // "Fresh" = no prior touch with this contact in the last 90 days.
      const prevTs = prevTsByTouchId.get(t.id as string) ?? null;
      const isFresh =
        !prevTs ||
        new Date(t.touched_at as string).getTime() -
          new Date(prevTs).getTime() >
          freshWindowMs;
      if (isFresh) {
        fSets.fresh.add(cid);
        let byContact = freshByWeek.get(weekKey);
        if (!byContact) {
          byContact = new Map();
          freshByWeek.set(weekKey, byContact);
        }
        const existing = byContact.get(cid);
        if (!existing || date < existing.date) {
          byContact.set(cid, {
            contactId: cid,
            name: tp?.name ?? contactNameById.get(cid) ?? "Unknown contact",
            firm: firmForContact(cid),
            date,
            channel: ch,
            tier: tp?.relevance_tier ?? null,
            degree: tp?.network_degree ?? null,
            ledToMeeting: false,
          });
        }
      }
    }
    if (dir === "inbound") {
      fSets.replied.add(cid);
      cumReplied.add(cid);
    }
    if (CONVERSATION_CHANNELS.has(ch)) {
      fSets.met.add(cid);
      cumMet.add(cid);
    }

    if (ch === "thank_you_note") {
      wk.stats.thankYous += 1;
      continue;
    }
    if (CONVERSATION_CHANNELS.has(ch)) {
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
    if (!countsOnWeeklyReport(c.intent as string | null)) continue;
    const created = c.created_at ? (c.created_at as string).slice(0, 10) : null;
    if (!created) continue;
    const wk = weekFor(weekStartOf(created));
    const p = peopleById.get(c.id as string);
    const referrerId =
      (c as { referred_by_contact_id?: string | null }).referred_by_contact_id ??
      null;
    wk.newContacts.push({
      id: c.id as string,
      name: (c.name as string) ?? "Unknown",
      firm:
        p?.firm ??
        companyByContact.get(c.id as string) ??
        firmFromTags(c.tags as string[] | null),
      tier: (c.relevance_tier as RelevanceTier | null) ?? null,
      degree: (c.network_degree as NetworkDegree | null) ?? null,
      referredBy: referrerId ? contactNameById.get(referrerId) ?? null : null,
    });
    wk.stats.newContacts += 1;

    // Referral: introduced to you by another contact.
    if (referrerId) {
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

  // Named referral rows for each week (Growth / Cold only).
  // When the same introduction path has multiple people dated this week
  // (e.g. Libby and Will), keep only the furthest tip — Will already
  // shows as Barbara → Libby → Will, so listing Libby again is noise.
  for (const [refWeek, ids] of weeklyReferralIds) {
    const wk = weekFor(refWeek);
    const eligible: string[] = [];
    for (const id of ids) {
      const c = (contactsRes.data ?? []).find((row) => row.id === id);
      if (!c || !countsOnWeeklyReport(c.intent as string | null)) continue;
      const referrerId = c.referred_by_contact_id as string | null;
      if (!referrerId || !contactNameById.get(referrerId)) continue;
      eligible.push(id);
    }
    // Drop anyone who already appears on a longer tip's *displayed*
    // breadcrumb (e.g. drop Libby when Will is Barbara → Libby → Will).
    // Do NOT walk past the Degree-1 root — Michael→…→Will ancestry must
    // not hide Andy → Michael as its own intro this week.
    const tips = eligible.filter(
      (id) =>
        !eligible.some(
          (other) =>
            other !== id && referralChainIdsFor(other).includes(id)
        )
    );
    for (const id of tips) {
      const c = (contactsRes.data ?? []).find((row) => row.id === id)!;
      const referrerId = c.referred_by_contact_id as string;
      const referredBy = contactNameById.get(referrerId)!;
      const p = peopleById.get(id);
      wk.newReferrals.push({
        id,
        name: (c.name as string) ?? "Unknown",
        firm:
          p?.firm ??
          companyByContact.get(id) ??
          firmFromTags(c.tags as string[] | null),
        referredBy,
        referredAt:
          ((c.referred_at as string | null) ??
            (c.created_at as string).slice(0, 10)),
        tier: (c.relevance_tier as RelevanceTier | null) ?? null,
        degree: (c.network_degree as NetworkDegree | null) ?? null,
        referrerDegree: contactDegreeById.get(referrerId) ?? null,
        referralChain: referralChainFor(id),
      });
    }
    wk.newReferrals.sort((a, b) =>
      a.referredAt < b.referredAt ? -1 : a.referredAt > b.referredAt ? 1 : 0
    );
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
  // Future-dated apps are excluded — this report is what already happened.
  for (const ws of workSearchRes.data ?? []) {
    const date = (ws.date as string | null) ?? null;
    if (!date || date > today) continue;
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
  // newReferrals matches the deduped tip list shown in the UI.
  // freshToMeeting = calls/meetings that came from a fresh engagement.
  for (const w of weeks.values()) {
    const s = weeklyFunnel.get(w.weekStart);
    const fresh = s?.fresh ?? new Set<string>();
    const met = s?.met ?? new Set<string>();
    const freshToMeeting = new Set<string>();
    for (const cid of met) {
      if (fresh.has(cid)) freshToMeeting.add(cid);
    }
    // A call/meeting that itself opens a cold streak also counts, even when
    // no separate "outbound" was logged the same week.
    for (const conv of w.conversations) {
      const prevTs = prevTsByTouchId.get(conv.id) ?? null;
      const convMs = new Date(`${conv.date}T12:00:00`).getTime();
      const isFresh =
        !prevTs || convMs - new Date(prevTs).getTime() > freshWindowMs;
      if (isFresh) freshToMeeting.add(conv.contactId);
    }
    w.funnel = {
      reachedOut: s?.reached.size ?? 0,
      replied: s?.replied.size ?? 0,
      metHeld: met.size,
      freshOutreach: fresh.size,
      freshToMeeting: freshToMeeting.size,
      newReferrals: w.newReferrals.length,
    };

    const named = freshByWeek.get(w.weekStart);
    if (named) {
      w.freshOutreaches = [...named.values()]
        .map((row) => ({
          ...row,
          ledToMeeting: freshToMeeting.has(row.contactId),
        }))
        .sort((a, b) =>
          a.date < b.date ? -1 : a.date > b.date ? 1 : a.name.localeCompare(b.name)
        );
    }
  }

  const ordered = [...weeks.values()].sort((a, b) =>
    a.weekStart < b.weekStart ? 1 : -1
  );

  // Keep the current week (always) plus any historical week with networking OR
  // job-application activity — a week with only job applications still earns
  // its place in the report. Never show future weeks.
  const hasActivity = (w: WeekActivity) =>
    w.stats.conversations > 0 ||
    w.stats.newContacts > 0 ||
    w.stats.thankYous > 0 ||
    w.stats.referrals > 0 ||
    w.nyui.applicationCount > 0 ||
    w.funnel.reachedOut > 0 ||
    w.funnel.newReferrals > 0;
  const filtered = ordered.filter(
    (w) =>
      w.weekStart <= currentWeekStart && (w.isCurrent || hasActivity(w))
  );

  // Cumulative coverage: Growth + Cold only.
  const listSize = people.filter((p) =>
    countsOnWeeklyReport(intentById.get(p.id) ?? p.intent)
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

// ─────────────────────────────────────────────────────────────────────────────
// Networking Activity Report — the single-week, print-ready "paper" document.
//
// Distinct from getNetworkingActivity above (which powers the multi-week
// heatmap/funnel view): this returns exactly the slots the report layout needs
// for the CURRENT Wednesday→Tuesday week. Same underlying data, presentation
// shaped for the report. It answers, in order:
//   1. Who did I reach out to this week (against a 10-person goal)?
//   2. Who did I actually meet or speak with?
//   3. What referrals came out of those relationships, and did I follow up?
// Everything else (applications filed, contacts added without an introduction)
// is secondary.
// ─────────────────────────────────────────────────────────────────────────────

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  phone: "Phone",
  call: "Call",
  video: "Video",
  in_person: "In person",
  coffee_chat: "Coffee",
  calendar: "Meeting",
  text: "Text",
  thank_you_note: "Thank-you",
  value_sharing: "Value-share",
  other: "Other",
};

function channelLabel(c: string | null | undefined): string {
  if (!c) return "Other";
  return CHANNEL_LABEL[c] ?? c.charAt(0).toUpperCase() + c.slice(1);
}

// The report reads in Jason's timezone (Eastern). Timestamps are stored in UTC,
// so a late-evening ET touch lands on the next UTC day — deriving the calendar
// day in ET keeps "reached out yesterday" from showing as today.
const APP_TZ = "America/New_York";

// A full ISO timestamp → the local (ET) calendar day, "YYYY-MM-DD".
function tsToLocalYmd(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: APP_TZ });
}

// Today's local (ET) calendar day, "YYYY-MM-DD".
function todayLocalYmd(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: APP_TZ });
}

// A timestamp → { date: "Aug 3", time: "2:00 PM" } in ET, for upcoming meetings.
function localDateTimeParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: APP_TZ,
    }),
    time: d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: APP_TZ,
    }),
  };
}

// "Jul 22" from a date-only "YYYY-MM-DD" (rendered in UTC at noon so the day
// never shifts).
function shortDate(ymdStr: string): string {
  return new Date(`${ymdStr}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// ISO-8601 week number (the "issue number" in the masthead).
function isoWeekNumber(ymdStr: string): number {
  const d = new Date(`${ymdStr}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - day + 3); // Thursday of this ISO week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const ft = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ft + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T00:00:00Z`).getTime() -
      new Date(`${a}T00:00:00Z`).getTime()) /
      86_400_000
  );
}

// "Wednesday 22 – Tuesday 28 July 2026" — weeks always run Wed→Tue.
function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const s = new Date(`${weekStart}T12:00:00Z`);
  const e = new Date(`${weekEnd}T12:00:00Z`);
  const sMonth = s.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const eMonth = e.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const sDay = s.getUTCDate();
  const eDay = e.getUTCDate();
  const sYear = s.getUTCFullYear();
  const eYear = e.getUTCFullYear();
  if (sMonth === eMonth && sYear === eYear)
    return `Wednesday ${sDay} \u2013 Tuesday ${eDay} ${eMonth} ${eYear}`;
  if (sYear === eYear)
    return `Wednesday ${sDay} ${sMonth} \u2013 Tuesday ${eDay} ${eMonth} ${eYear}`;
  return `Wednesday ${sDay} ${sMonth} ${sYear} \u2013 Tuesday ${eDay} ${eMonth} ${eYear}`;
}

export interface ReportOutreach {
  name: string;
  company: string | null;
  channel: string;
  date: string; // "Jul 22"
  /** Buyer / Buyer · Referrer / Referrer, if classified. */
  role: string | null;
}

export interface ReportMeeting {
  name: string;
  company: string | null;
  medium: string;
  notes: string | null;
  referralsProduced: number;
}

export interface ReportUpcomingMeeting {
  name: string;
  company: string | null;
  medium: string;
  date: string; // "Aug 3"
  time: string; // "2:00 PM"
}

export interface ReportReferral {
  name: string;
  company: string | null;
  /** Chain of introducers, top-of-chain first: ["Barbara", "Libby"] → "via Barbara → Libby". */
  chain: string[];
  followUpText: string;
  followUpActioned: boolean;
  date: string; // "Jul 26"
  /** Buyer / Buyer · Referrer / Referrer, if classified. */
  role: string | null;
}

export interface ReportAddedContact {
  name: string;
  ranking: string | null; // e.g. "A1"
}

export interface ReportApplication {
  company: string;
  role: string;
  date: string; // "Jul 22"
}

export interface NetworkingReport {
  weekStart: string;
  weekEnd: string;
  weekLabel: string; // "Wednesday 22 – Tuesday 28 July 2026"
  issueNumber: number; // ISO week number, shown as "No. 30"
  /** True when this is the Wednesday→Tuesday week that contains "today" (ET). */
  isCurrentWeek: boolean;
  /** Wednesday of the prior reporting week (for ← navigation). */
  prevWeekStart: string;
  /** Wednesday of the next reporting week, or null when already on the current week. */
  nextWeekStart: string | null;
  goalTarget: number;
  reachedOut: number;
  metWith: number;
  referralsGiven: number;
  reachedQualifier: string;
  metQualifier: string;
  referralsQualifier: string;
  summary: string; // "Reached 6 · Met 0 · Referred 3"
  outreach: ReportOutreach[];
  meetings: ReportMeeting[];
  upcomingMeetings: ReportUpcomingMeeting[];
  addedWithoutIntro: ReportAddedContact[];
  referrals: ReportReferral[];
  tally: {
    allTime: number;
    ofThoseMet: number;
    topConnectorName: string | null;
    topConnectorCount: number;
  };
  applications: ReportApplication[];
}

/** YYYY-MM-DD only — rejects anything that isn't a plain calendar day. */
function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * Single-week networking report. Pass `week` as any date in the desired
 * Wednesday→Tuesday window (usually the Wednesday); it is normalized and
 * clamped so you cannot navigate past the current week.
 */
export async function getNetworkingReport(opts?: {
  week?: string | null;
}): Promise<NetworkingReport> {
  const today = todayLocalYmd();
  const currentWeekStart = weekStartOf(today);
  let weekStart = currentWeekStart;
  if (opts?.week && isYmd(opts.week)) {
    const requested = weekStartOf(opts.week);
    // Never show a future reporting week — clamp to the current one.
    weekStart = requested > currentWeekStart ? currentWeekStart : requested;
  }
  const weekEnd = addDaysStr(weekStart, 6);
  const isCurrentWeek = weekStart === currentWeekStart;
  // Compare an already-normalized "YYYY-MM-DD" (ET) against the week window.
  const inWeek = (ymdStr: string | null | undefined): boolean =>
    !!ymdStr && ymdStr >= weekStart && ymdStr <= weekEnd;

  const report: NetworkingReport = {
    weekStart,
    weekEnd,
    weekLabel: formatWeekLabel(weekStart, weekEnd),
    issueNumber: isoWeekNumber(weekStart),
    isCurrentWeek,
    prevWeekStart: addDaysStr(weekStart, -7),
    nextWeekStart: isCurrentWeek ? null : addDaysStr(weekStart, 7),
    goalTarget: WEEKLY_OUTREACH_GOAL,
    reachedOut: 0,
    metWith: 0,
    referralsGiven: 0,
    reachedQualifier: `of a ${WEEKLY_OUTREACH_GOAL} goal \u2014 ${WEEKLY_OUTREACH_GOAL} to go`,
    metQualifier: "no calls logged",
    referralsQualifier: "none this week",
    summary: "Reached 0 \u00b7 Met 0 \u00b7 Referred 0",
    outreach: [],
    meetings: [],
    upcomingMeetings: [],
    addedWithoutIntro: [],
    referrals: [],
    tally: { allTime: 0, ofThoseMet: 0, topConnectorName: null, topConnectorCount: 0 },
    applications: [],
  };
  if (!hasConfig()) return report;

  const sb = createServiceRoleClient();
  const pub = createPublicServiceRoleClient();

  const [
    people,
    touchesRes,
    contactsRes,
    meetingsRes,
    workSearchRes,
    companiesRes,
    upcomingCal,
  ] = await Promise.all([
      getOutreachPeople(),
      sb
        .from("contact_touches")
        .select("id,contact_id,channel,direction,touched_at,brief,outcome")
        .order("touched_at", { ascending: false })
        .limit(12000),
      sb
        .from("contacts")
        .select(
          "id,name,tags,relevance_tier,network_degree,network_role,created_at,intent,company_id,referred_by_contact_id,referred_at"
        )
        .limit(20000),
      sb
        .from("meetings")
        .select(
          "id,contact_id,channel,status,scheduled_at,held_at,debrief_notes"
        ),
      pub
        .from("work_searches")
        .select("date,company_name,position_applied")
        .gte("date", weekStart)
        .lte("date", weekEnd)
        .order("date", { ascending: true }),
      sb.from("companies").select("id,name"),
      getUpcomingCalendarMeetings({ daysAhead: 30 }),
    ]);

  const touches = touchesRes.data ?? [];
  const contacts = contactsRes.data ?? [];
  const meetings = meetingsRes.data ?? [];
  const peopleById = new Map(people.map((p) => [p.id, p]));

  const companyNameById = new Map(
    (companiesRes.data ?? []).map((c) => [
      c.id as string,
      (c.name as string) ?? null,
    ])
  );

  interface ContactInfo {
    name: string;
    referredBy: string | null;
    referredAt: string | null;
    createdAt: string | null;
    tier: RelevanceTier | null;
    degree: NetworkDegree | null;
    role: NetworkRole | null;
    intent: string | null;
    company: string | null;
    tags: string[] | null;
  }
  const contactById = new Map<string, ContactInfo>();
  for (const c of contacts) {
    const companyId = (c.company_id as string | null) ?? null;
    contactById.set(c.id as string, {
      name: (c.name as string) ?? "Unknown",
      referredBy: (c.referred_by_contact_id as string | null) ?? null,
      referredAt: (c.referred_at as string | null) ?? null,
      createdAt: (c.created_at as string | null) ?? null,
      tier: (c.relevance_tier as RelevanceTier | null) ?? null,
      degree: (c.network_degree as NetworkDegree | null) ?? null,
      role: (c.network_role as NetworkRole | null) ?? null,
      intent: (c.intent as string | null) ?? null,
      company: companyId ? companyNameById.get(companyId) ?? null : null,
      tags: (c.tags as string[] | null) ?? null,
    });
  }

  const roleLabelForContact = (cid: string): string | null => {
    const r = contactById.get(cid)?.role ?? null;
    return r ? NETWORK_ROLE_SHORT[r] : null;
  };

  const firmForContact = (cid: string): string | null => {
    const p = peopleById.get(cid);
    if (p?.firm) return p.firm;
    const c = contactById.get(cid);
    return c?.company ?? firmFromTags(c?.tags ?? null);
  };
  const nameForContact = (cid: string): string =>
    peopleById.get(cid)?.name ?? contactById.get(cid)?.name ?? "Unknown";
  const isNetworkingContact = (cid: string): boolean => {
    const intent = peopleById.get(cid)?.intent ?? contactById.get(cid)?.intent ?? null;
    return intent !== "backrow" && intent !== "network_maintenance";
  };

  // ── Group touches: outbound (for outreach + follow-up) and conversations
  //    (for "met with"). markMeetingHeld writes a conversation touch, so
  //    conversation touches are the single source of truth for who was met.
  const outboundByContact = new Map<string, { ts: string; ch: string }[]>();
  const convoByContact = new Map<
    string,
    { ts: string; ch: string; note: string | null }[]
  >();
  for (const t of touches) {
    const cid = t.contact_id as string;
    const ts = (t.touched_at as string) ?? "";
    const ch = (t.channel as string) ?? "";
    const dir = (t.direction as string) ?? "outbound";
    if (dir === "outbound") {
      const list = outboundByContact.get(cid);
      if (list) list.push({ ts, ch });
      else outboundByContact.set(cid, [{ ts, ch }]);
    }
    if (CONVERSATION_CHANNELS.has(ch)) {
      const note = (t.outcome as string | null) || (t.brief as string | null) || null;
      const list = convoByContact.get(cid);
      const entry = { ts, ch, note };
      if (list) list.push(entry);
      else convoByContact.set(cid, [entry]);
    }
  }
  for (const list of outboundByContact.values())
    list.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  for (const list of convoByContact.values())
    list.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));

  // Referrals a given contact produced THIS week (contacts they introduced).
  const referredByCountThisWeek = new Map<string, number>();
  for (const c of contactById.values()) {
    if (c.referredBy && inWeek(c.referredAt) && c.intent !== "backrow" && c.intent !== "network_maintenance") {
      referredByCountThisWeek.set(
        c.referredBy,
        (referredByCountThisWeek.get(c.referredBy) ?? 0) + 1
      );
    }
  }

  // ── 1. OUTREACH — networking contacts reached out to this week (earliest
  //    outbound touch of the week supplies the channel + date). ────────────────
  const outreachRaw: (ReportOutreach & { raw: string })[] = [];
  for (const [cid, list] of outboundByContact) {
    if (!isNetworkingContact(cid)) continue;
    // Show the MOST RECENT engagement of the week (list is sorted ascending),
    // so a later call/meeting supersedes an earlier text/email that week.
    const inWk = list.filter((t) => inWeek(tsToLocalYmd(t.ts)));
    if (!inWk.length) continue;
    const latest = inWk[inWk.length - 1];
    const latestYmd = tsToLocalYmd(latest.ts);
    outreachRaw.push({
      name: nameForContact(cid),
      company: firmForContact(cid),
      channel: channelLabel(latest.ch),
      date: shortDate(latestYmd),
      role: roleLabelForContact(cid),
      raw: latestYmd,
    });
  }
  outreachRaw.sort((a, b) => (a.raw < b.raw ? -1 : a.raw > b.raw ? 1 : 0));
  report.reachedOut = outreachRaw.length;
  report.outreach = outreachRaw.map((o) => ({
    name: o.name,
    company: o.company,
    channel: o.channel,
    date: o.date,
    role: o.role,
  }));

  // ── 2. MEETINGS — who was met/spoken with this week. Built from conversation
  //    touches (which every held meeting also writes), enriched with the
  //    meeting record's debrief notes when one exists. ─────────────────────────
  const meetingRecordByContact = new Map<
    string,
    { channel: string; notes: string | null; heldAt: string }
  >();
  for (const m of meetings) {
    const heldAt = (m.held_at as string | null) ?? null;
    if (!inWeek(heldAt ? tsToLocalYmd(heldAt) : null)) continue;
    meetingRecordByContact.set(m.contact_id as string, {
      channel: (m.channel as string) ?? "video",
      notes: (m.debrief_notes as string | null) ?? null,
      heldAt: heldAt as string,
    });
  }
  const metRaw: (ReportMeeting & { raw: string })[] = [];
  const metSeen = new Set<string>();
  for (const [cid, list] of convoByContact) {
    if (!isNetworkingContact(cid)) continue;
    const inWk = list.filter((t) => inWeek(tsToLocalYmd(t.ts)));
    if (!inWk.length) continue;
    const latest = inWk[inWk.length - 1];
    const rec = meetingRecordByContact.get(cid);
    metSeen.add(cid);
    metRaw.push({
      name: nameForContact(cid),
      company: firmForContact(cid),
      medium: channelLabel(rec?.channel ?? latest.ch),
      notes: rec?.notes ?? latest.note,
      referralsProduced: referredByCountThisWeek.get(cid) ?? 0,
      raw: latest.ts,
    });
  }
  // Held meetings this week without a conversation touch (older records).
  for (const [cid, rec] of meetingRecordByContact) {
    if (metSeen.has(cid) || !isNetworkingContact(cid)) continue;
    metRaw.push({
      name: nameForContact(cid),
      company: firmForContact(cid),
      medium: channelLabel(rec.channel),
      notes: rec.notes,
      referralsProduced: referredByCountThisWeek.get(cid) ?? 0,
      raw: rec.heldAt,
    });
  }
  metRaw.sort((a, b) => (a.raw < b.raw ? -1 : a.raw > b.raw ? 1 : 0));
  report.metWith = metRaw.length;
  report.meetings = metRaw.map((m) => ({
    name: m.name,
    company: m.company,
    medium: m.medium,
    notes: m.notes,
    referralsProduced: m.referralsProduced,
  }));

  // ── UPCOMING MEETINGS — only on the current week (they're "from now").
  //    Past weeks omit this list so a historical report stays about that week.
  if (isCurrentWeek) {
    const nowMs = Date.now();
    const upcomingRaw: { contactId: string; ts: string; channel: string }[] = [];
    for (const m of meetings) {
      if ((m.status as string) !== "scheduled") continue;
      const sched = (m.scheduled_at as string | null) ?? null;
      if (!sched || new Date(sched).getTime() < nowMs) continue;
      upcomingRaw.push({
        contactId: m.contact_id as string,
        ts: sched,
        channel: (m.channel as string) ?? "calendar",
      });
    }
    for (const u of upcomingCal) {
      upcomingRaw.push({
        contactId: u.contactId,
        ts: u.startISO,
        channel: "calendar",
      });
    }
    upcomingRaw.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
    const upcomingSeen = new Set<string>();
    const upcoming: ReportUpcomingMeeting[] = [];
    for (const u of upcomingRaw) {
      if (!isNetworkingContact(u.contactId)) continue;
      const dayKey = `${u.contactId}::${tsToLocalYmd(u.ts)}`;
      if (upcomingSeen.has(dayKey)) continue; // same contact same day → once
      upcomingSeen.add(dayKey);
      const { date, time } = localDateTimeParts(u.ts);
      upcoming.push({
        name: nameForContact(u.contactId),
        company: firmForContact(u.contactId),
        medium: channelLabel(u.channel),
        date,
        time,
      });
    }
    report.upcomingMeetings = upcoming;
  } else {
    report.upcomingMeetings = [];
  }

  // ── 3. REFERRALS — introductions that still need follow-up: people who were
  //    referred to you and whom you have either never contacted, or not
  //    communicated with in the last FRESH_WINDOW_DAYS (90) days. Most urgent
  //    first (never-contacted, then longest since contact). ────────────────────
  const chainFor = (referrerId: string | null): string[] => {
    const names: string[] = [];
    const seen = new Set<string>();
    let cur = referrerId;
    while (cur && !seen.has(cur) && names.length < 4) {
      seen.add(cur);
      const c = contactById.get(cur);
      if (!c) break;
      names.push(c.name);
      cur = c.referredBy;
    }
    return names.reverse();
  };

  const referralsRaw: (ReportReferral & { sortDays: number })[] = [];
  for (const [id, c] of contactById) {
    if (!c.referredBy) continue;
    if (c.intent === "backrow" || c.intent === "network_maintenance") continue;
    const outs = outboundByContact.get(id) ?? [];
    const lastOut = outs.length ? outs[outs.length - 1] : null; // sorted ascending
    let followUpText: string;
    let sortDays: number;
    if (!lastOut) {
      followUpText = "Not yet contacted";
      sortDays = Number.MAX_SAFE_INTEGER;
    } else {
      const daysSince = daysBetween(tsToLocalYmd(lastOut.ts), today);
      if (daysSince <= FRESH_WINDOW_DAYS) continue; // contacted recently — no follow-up needed
      followUpText = `Last contacted ${daysSince} days ago`;
      sortDays = daysSince;
    }
    const refAt = c.referredAt
      ? c.referredAt.slice(0, 10)
      : c.createdAt
      ? tsToLocalYmd(c.createdAt)
      : today;
    referralsRaw.push({
      name: c.name,
      company: firmForContact(id),
      chain: chainFor(c.referredBy),
      followUpText,
      followUpActioned: false,
      date: shortDate(refAt),
      role: roleLabelForContact(id),
      sortDays,
    });
  }
  referralsRaw.sort((a, b) => b.sortDays - a.sortDays);
  report.referrals = referralsRaw.map((r) => ({
    name: r.name,
    company: r.company,
    chain: r.chain,
    followUpText: r.followUpText,
    followUpActioned: r.followUpActioned,
    date: r.date,
    role: r.role,
  }));

  // Referral tally (all time) + strongest connector.
  let allTime = 0;
  let ofThoseMet = 0;
  const byConnector = new Map<string, number>();
  for (const [id, c] of contactById) {
    if (!c.referredBy) continue;
    if (c.intent === "backrow" || c.intent === "network_maintenance") continue;
    allTime += 1;
    byConnector.set(c.referredBy, (byConnector.get(c.referredBy) ?? 0) + 1);
    const met =
      (convoByContact.get(id)?.length ?? 0) > 0 ||
      meetings.some((m) => (m.contact_id as string) === id && m.held_at);
    if (met) ofThoseMet += 1;
  }
  let topConnectorName: string | null = null;
  let topConnectorCount = 0;
  for (const [rid, n] of byConnector) {
    if (n > topConnectorCount) {
      topConnectorCount = n;
      topConnectorName = nameForContact(rid);
    }
  }
  report.tally = { allTime, ofThoseMet, topConnectorName, topConnectorCount };

  // ── 4. ADDED WITHOUT AN INTRODUCTION — contacts created this week with no
  //    referrer. Secondary. ──────────────────────────────────────────────────
  const added: ReportAddedContact[] = [];
  for (const [, c] of contactById) {
    if (c.referredBy) continue;
    if (!inWeek(c.createdAt ? tsToLocalYmd(c.createdAt) : null)) continue;
    if (c.intent === "backrow" || c.intent === "network_maintenance") continue;
    const rk = `${c.tier ?? ""}${c.degree ?? ""}`.trim();
    added.push({ name: c.name, ranking: rk || null });
  }
  added.sort((a, b) => a.name.localeCompare(b.name));
  report.addedWithoutIntro = added;

  // ── 5. APPLICATIONS FILED — NYUI job applications this week. Secondary. ──────
  report.applications = (workSearchRes.data ?? []).map((ws) => ({
    company: (ws.company_name as string | null) ?? "\u2014",
    role: (ws.position_applied as string | null) ?? "\u2014",
    date: shortDate((ws.date as string).slice(0, 10)),
  }));

  // ── Three-figure qualifiers + masthead summary. ─────────────────────────────
  if (report.reachedOut >= report.goalTarget) {
    report.reachedQualifier = "goal met";
  } else if (isCurrentWeek) {
    report.reachedQualifier = `of a ${report.goalTarget} goal \u2014 ${
      report.goalTarget - report.reachedOut
    } to go`;
  } else {
    // Closed week — don't imply there's still time left.
    report.reachedQualifier = `of a ${report.goalTarget} goal`;
  }
  report.metQualifier =
    report.metWith === 0 ? "no calls logged" : `${report.metWith} logged`;

  // The "Referrals given" figure stays a weekly-activity count (introductions
  // recorded this week), independent of the follow-up list shown below it.
  let weeklyReferrals = 0;
  const weekByConnector = new Map<string, number>();
  for (const [, c] of contactById) {
    if (!c.referredBy || !inWeek(c.referredAt)) continue;
    if (c.intent === "backrow" || c.intent === "network_maintenance") continue;
    weeklyReferrals += 1;
    weekByConnector.set(c.referredBy, (weekByConnector.get(c.referredBy) ?? 0) + 1);
  }
  report.referralsGiven = weeklyReferrals;
  let weekTopCount = 0;
  for (const n of weekByConnector.values()) if (n > weekTopCount) weekTopCount = n;
  if (report.referralsGiven === 0) report.referralsQualifier = "none this week";
  else if (weekTopCount >= 2)
    report.referralsQualifier = `${weekTopCount} of them from one person`;
  else
    report.referralsQualifier = `${report.referralsGiven} new introduction${
      report.referralsGiven === 1 ? "" : "s"
    }`;

  report.summary = `Reached ${report.reachedOut} \u00b7 Met ${report.metWith} \u00b7 Referred ${report.referralsGiven}`;
  return report;
}
