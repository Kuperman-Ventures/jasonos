"use server";

// Networking Status — a cumulative, all-time view of the network, derived
// entirely from data already collected in the outreach feature (contacts,
// contact_touches, browning_conversations). Mirrors the manual "activity log"
// spreadsheet: roster by relevance/closeness, real conversations, awaiting-
// response, and headline KPIs. No new data entry required.

import { createServiceRoleClient } from "@/lib/supabase/server";
import { getOutreachPeople } from "@/lib/outreach/data";
import type { NetworkDegree, RelevanceTier } from "@/lib/outreach/types";

// "Real conversation" channels — email/LinkedIn/text are how you land the
// meeting, not networking itself, so they never count as a conversation.
const CONVERSATION_CHANNELS = new Set([
  "phone",
  "call",
  "video",
  "in_person",
  "calendar",
  "coffee_chat",
]);

export type NsStatus =
  | "spoke"
  | "scheduled"
  | "overdue"
  | "awaiting"
  | "contacted"
  | "new";

export interface NsRosterEntry {
  id: string;
  name: string;
  firm: string | null;
  title: string | null;
  tier: RelevanceTier | null;
  degree: NetworkDegree | null;
  code: string;
  lastTouch: string | null;
  nextTouch: string | null;
  status: NsStatus;
  browning: boolean;
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
}

export interface NsNoResponse {
  id: string;
  name: string;
  firm: string | null;
  lastOutreach: string;
  channel: string;
}

export interface NetworkingStatus {
  generatedAt: string;
  kpis: {
    total: number;
    spoke: number;
    awaiting: number;
    thankYous: number;
    referrals: number;
    tierMatrix: { code: string; count: number }[];
  };
  roster: NsRosterEntry[];
  conversations: NsConversation[];
  noResponse: NsNoResponse[];
}

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function todayYmd(): string {
  return new Date().toISOString().split("T")[0];
}

// Sort key so A1, A2, A3, A, B1… order correctly and unclassified sinks last.
function sortCode(code: string): number {
  if (!code) return 9999;
  const tier = code[0];
  const deg = code.slice(1);
  const tierRank = tier === "A" ? 0 : tier === "B" ? 100 : tier === "C" ? 200 : 900;
  const degRank = deg ? parseInt(deg, 10) || 8 : 9;
  return tierRank + degRank;
}

export async function getNetworkingStatus(): Promise<NetworkingStatus> {
  const today = todayYmd();
  const empty: NetworkingStatus = {
    generatedAt: today,
    kpis: { total: 0, spoke: 0, awaiting: 0, thankYous: 0, referrals: 0, tierMatrix: [] },
    roster: [],
    conversations: [],
    noResponse: [],
  };
  if (!hasConfig()) return empty;

  const sb = createServiceRoleClient();
  const [people, touchesRes, browningIdsRes, referralsRes] = await Promise.all([
    getOutreachPeople(),
    sb
      .from("contact_touches")
      .select("id,contact_id,channel,direction,touched_at,brief,outcome")
      .order("touched_at", { ascending: false })
      .limit(5000),
    sb.from("contacts").select("id").eq("browning_source", true),
    sb.from("browning_conversations").select("referrals_received"),
  ]);

  const touches = touchesRes.data ?? [];
  const browningIds = new Set(
    (browningIdsRes.data ?? []).map((r) => r.id as string)
  );
  const referrals = (referralsRes.data ?? []).reduce(
    (s, r) => s + ((r.referrals_received as number | null) ?? 0),
    0
  );

  // Per-contact touch aggregates for status + no-response detection.
  type Agg = {
    hasConversation: boolean;
    hasInbound: boolean;
    hasOutbound: boolean;
    lastOutreach: { date: string; channel: string } | null;
  };
  const agg = new Map<string, Agg>();
  for (const t of touches) {
    const cid = t.contact_id as string | null;
    if (!cid) continue;
    const a =
      agg.get(cid) ??
      ({ hasConversation: false, hasInbound: false, hasOutbound: false, lastOutreach: null } as Agg);
    const ch = (t.channel as string) ?? "";
    const dir = (t.direction as string) ?? "outbound";
    if (CONVERSATION_CHANNELS.has(ch)) a.hasConversation = true;
    if (dir === "inbound") {
      a.hasInbound = true;
    } else {
      a.hasOutbound = true;
      // touches come newest-first, so the first outbound outreach we see is the
      // most recent one (used for the "awaiting response" list).
      if (!CONVERSATION_CHANNELS.has(ch) && ch !== "thank_you_note" && !a.lastOutreach) {
        a.lastOutreach = { date: (t.touched_at as string).slice(0, 10), channel: ch };
      }
    }
    agg.set(cid, a);
  }

  const peopleById = new Map(people.map((p) => [p.id, p]));

  const roster: NsRosterEntry[] = people
    .filter((p) => p.intent !== "backrow")
    .map((p) => {
      const a = agg.get(p.id);
      const code = `${p.relevance_tier ?? ""}${p.network_degree ?? ""}`;
      let status: NsStatus;
      if (a?.hasConversation) status = "spoke";
      else if (p.next_touch_date && p.next_touch_date < today) status = "overdue";
      else if (p.next_touch_date) status = "scheduled";
      else if (a?.hasOutbound && !a.hasInbound) status = "awaiting";
      else if (a?.hasOutbound) status = "contacted";
      else status = "new";
      return {
        id: p.id,
        name: p.name,
        firm: p.firm,
        title: p.title,
        tier: p.relevance_tier,
        degree: p.network_degree,
        code,
        lastTouch: p.last_touch_date ?? null,
        nextTouch: p.next_touch_date ?? null,
        status,
        browning: browningIds.has(p.id),
      };
    })
    .sort(
      (a, b) => sortCode(a.code) - sortCode(b.code) || a.name.localeCompare(b.name)
    );

  const conversations: NsConversation[] = touches
    .filter((t) => CONVERSATION_CHANNELS.has((t.channel as string) ?? ""))
    .slice(0, 400)
    .map((t) => {
      const cid = t.contact_id as string;
      const p = peopleById.get(cid);
      return {
        id: t.id as string,
        contactId: cid,
        name: p?.name ?? "Unknown contact",
        firm: p?.firm ?? null,
        date: (t.touched_at as string).slice(0, 10),
        channel: (t.channel as string) ?? "",
        brief: (t.brief as string | null) ?? null,
        outcome: (t.outcome as string | null) ?? null,
        browning: browningIds.has(cid),
      };
    });

  const noResponse: NsNoResponse[] = roster
    .filter((r) => r.status === "awaiting")
    .map((r) => {
      const a = agg.get(r.id);
      return {
        id: r.id,
        name: r.name,
        firm: r.firm,
        lastOutreach: a?.lastOutreach?.date ?? r.lastTouch ?? today,
        channel: a?.lastOutreach?.channel ?? "email",
      };
    })
    .sort((a, b) => a.lastOutreach.localeCompare(b.lastOutreach));

  const thankYous = touches.filter(
    (t) => (t.channel as string) === "thank_you_note"
  ).length;

  const tierCounts = new Map<string, number>();
  for (const r of roster) {
    const c = r.code || "—";
    tierCounts.set(c, (tierCounts.get(c) ?? 0) + 1);
  }
  const tierMatrix = [...tierCounts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => sortCode(a.code === "—" ? "" : a.code) - sortCode(b.code === "—" ? "" : b.code));

  return {
    generatedAt: today,
    kpis: {
      total: roster.length,
      spoke: roster.filter((r) => r.status === "spoke").length,
      awaiting: noResponse.length,
      thankYous,
      referrals,
      tierMatrix,
    },
    roster,
    conversations,
    noResponse,
  };
}
