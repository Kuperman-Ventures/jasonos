"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Weekly Activity Log — a Browning-advisor-facing recap combining outreach
// activity (touches, new contacts, coverage) with the Browning coaching loop
// (scored conversations, reflections, gates, deliverables). Read-only, derived
// entirely from data already captured elsewhere; nothing new to log.
//
// Weeks run Saturday → Friday (ending Friday) to match the Browning module's
// week_ending_friday KPI bucketing and a "send the advisor a Friday recap"
// rhythm.
// ---------------------------------------------------------------------------

export interface EngagedTouch {
  contactId: string;
  name: string;
  firm: string | null;
  channel: string;
  direction: string;
  date: string;
  brief: string | null;
  outcome: string | null;
}

export interface CoachingNote {
  name: string;
  avgQuality: number | null;
  whatWasHard: string | null;
  whatToDoDifferently: string | null;
}

export interface GateMoved {
  gateCode: string;
  description: string;
  status: string;
  completedDate: string | null;
}

export interface WeeklyActivityLog {
  weekStart: string; // last Tuesday (YYYY-MM-DD) — first day covered
  weekEnd: string; // the following Monday (YYYY-MM-DD) — last day covered
  /** The Tuesday this report is anchored to ("this Tuesday"). */
  anchor: string;
  /** Anchor Tuesdays for navigation (passed as ?week=). */
  prevWeek: string;
  nextWeek: string;
  isCurrentWeek: boolean;
  outreach: {
    touchCount: number;
    prevTouchCount: number;
    byChannel: { channel: string; count: number }[];
    outbound: number;
    inbound: number;
    engaged: EngagedTouch[];
    newContacts: {
      name: string;
      firm: string | null;
      relationship_type: string | null;
      /** Who introduced you to this contact, when known. */
      referredBy: string | null;
    }[];
    overdueCount: number;
    dueNext7Count: number;
  };
  browning: {
    conversations: number;
    prevConversations: number;
    target: number;
    avgWarmth: number | null;
    avgQuality: number | null;
    referralsReceived: number;
    /** Named people introduced to you this week (from contact referral links). */
    newReferrals: { name: string; firm: string | null; referredBy: string; referredAt: string }[];
    thankYousSent: number;
    leadsProduced: number;
    coachingNotes: CoachingNote[];
    gatesMoved: GateMoved[];
    nextGate: { gateCode: string; description: string; status: string; targetDate: string | null } | null;
    deliverables: { promised: string; deliveredStatus: string | null; escalate: boolean }[];
  };
}

const BROWNING_WEEKLY_TARGET = 5;

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function ymd(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
}

// The most recent Tuesday on or before `ref`. The report is "Tuesday to
// Tuesday": generated on a Tuesday, it covers the 7 days ending the day
// before (last Tue → this Mon), i.e. the week that just completed.
function tuesdayAnchor(ref: string): string {
  const d = new Date(`${ref}T00:00:00Z`);
  const back = (d.getUTCDay() - 2 + 7) % 7; // Tue = 2
  d.setUTCDate(d.getUTCDate() - back);
  return ymd(d);
}

function firmFromTags(tags: string[] | null): string | null {
  const t = (tags ?? []).find((x) => x.startsWith("firm:"));
  return t ? t.slice("firm:".length).replace(/-/g, " ") : null;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
}

/**
 * People who count on the Browning weekly report: Network Growth and
 * Cold only. Maintenance, Backrow, and unset intent never appear.
 */
function countsOnReport(intent: string | null | undefined): boolean {
  return intent === "network_growth" || intent === "browning_cold";
}

export async function getWeeklyActivityLog(
  weekParam?: string
): Promise<WeeklyActivityLog> {
  const todayYmd = ymd(new Date());
  const ref = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? weekParam : todayYmd;
  const anchor = tuesdayAnchor(ref); // "this Tuesday"
  const weekStart = addDays(anchor, -7); // last Tuesday (first day covered)
  const weekEnd = addDays(anchor, -1); // Monday (last day covered)
  const prevWeek = addDays(anchor, -7);
  const nextWeek = addDays(anchor, 7);
  const isCurrentWeek = anchor === tuesdayAnchor(todayYmd);

  const empty: WeeklyActivityLog = {
    weekStart,
    weekEnd,
    anchor,
    prevWeek,
    nextWeek,
    isCurrentWeek,
    outreach: {
      touchCount: 0,
      prevTouchCount: 0,
      byChannel: [],
      outbound: 0,
      inbound: 0,
      engaged: [],
      newContacts: [],
      overdueCount: 0,
      dueNext7Count: 0,
    },
    browning: {
      conversations: 0,
      prevConversations: 0,
      target: BROWNING_WEEKLY_TARGET,
      avgWarmth: null,
      avgQuality: null,
      referralsReceived: 0,
      newReferrals: [],
      thankYousSent: 0,
      leadsProduced: 0,
      coachingNotes: [],
      gatesMoved: [],
      nextGate: null,
      deliverables: [],
    },
  };
  if (!hasConfig()) return empty;

  const sb = createServiceRoleClient();
  const startISO = `${weekStart}T00:00:00`;
  const endISO = `${weekEnd}T23:59:59`;
  const prevStartISO = `${addDays(weekStart, -7)}T00:00:00`;
  const prevEndISO = `${addDays(weekEnd, -7)}T23:59:59`;

  const [
    touchesRes,
    prevTouchesRes,
    newContactsRes,
    referredContactsRes,
    overdueRes,
    dueNextRes,
    convRes,
    prevConvRes,
    gatesRes,
    deliverablesRes,
  ] = await Promise.all([
    sb
      .from("contact_touches")
      .select("contact_id,channel,direction,touched_at,brief,outcome")
      .gte("touched_at", startISO)
      .lte("touched_at", endISO)
      .order("touched_at", { ascending: true }),
    sb
      .from("contact_touches")
      .select("id", { count: "exact", head: true })
      .gte("touched_at", prevStartISO)
      .lte("touched_at", prevEndISO),
    sb
      .from("contacts")
      .select(
        "id,name,tags,relationship_type,created_at,referred_by_contact_id,referred_at,intent"
      )
      .gte("created_at", startISO)
      .lte("created_at", endISO),
    // Referrals recorded this week (even if the contact row was created earlier).
    sb
      .from("contacts")
      .select(
        "id,name,tags,relationship_type,referred_by_contact_id,referred_at,intent"
      )
      .not("referred_by_contact_id", "is", null)
      .gte("referred_at", weekStart)
      .lte("referred_at", weekEnd),
    sb
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .not("next_touch_date", "is", null)
      .lte("next_touch_date", todayYmd)
      .neq("intent", "backrow")
      .neq("intent", "network_maintenance"),
    sb
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .gt("next_touch_date", todayYmd)
      .lte("next_touch_date", addDays(todayYmd, 7))
      .neq("intent", "backrow")
      .neq("intent", "network_maintenance"),
    sb
      .from("browning_conversations")
      .select(
        "contact_id,warmth,avg_quality,referrals_received,thank_you_sent,produced_lead,what_was_hard,what_to_do_differently"
      )
      .gte("conversation_date", weekStart)
      .lte("conversation_date", weekEnd),
    sb
      .from("browning_conversations")
      .select("id", { count: "exact", head: true })
      .gte("conversation_date", addDays(weekStart, -7))
      .lte("conversation_date", addDays(weekEnd, -7)),
    sb.from("browning_gates").select("*"),
    sb
      .from("browning_deliverables")
      .select("promised,delivered_status,escalate,month")
      .eq("month", `${weekEnd.slice(0, 7)}-01`),
  ]);

  const touches = touchesRes.data ?? [];
  // Growth + Cold only — never Maintenance / Backrow.
  const newContacts = (newContactsRes.data ?? []).filter((c) =>
    countsOnReport(c.intent as string | null)
  );
  const referredContacts = (referredContactsRes.data ?? []).filter((c) =>
    countsOnReport(c.intent as string | null)
  );
  const conversations = convRes.data ?? [];

  // Resolve contact names/firms/intent for touched + browning + referrer contacts.
  const idSet = new Set<string>();
  for (const t of touches) idSet.add(t.contact_id as string);
  for (const c of conversations) idSet.add(c.contact_id as string);
  for (const c of newContacts) {
    const rid = c.referred_by_contact_id as string | null;
    if (rid) idSet.add(rid);
  }
  for (const c of referredContacts) {
    const rid = c.referred_by_contact_id as string | null;
    if (rid) idSet.add(rid);
  }
  const contactMap = new Map<
    string,
    {
      name: string;
      firm: string | null;
      relationship_type: string | null;
      intent: string | null;
    }
  >();
  if (idSet.size) {
    const { data: contactRows } = await sb
      .from("contacts")
      .select("id,name,tags,relationship_type,intent")
      .in("id", Array.from(idSet));
    for (const r of contactRows ?? []) {
      contactMap.set(r.id as string, {
        name: r.name as string,
        firm: firmFromTags(r.tags as string[] | null),
        relationship_type: (r.relationship_type as string | null) ?? null,
        intent: (r.intent as string | null) ?? null,
      });
    }
  }

  // ---- Outreach aggregation ----
  const byChannel = new Map<string, number>();
  let outbound = 0;
  let inbound = 0;
  const engaged: EngagedTouch[] = [];
  for (const t of touches) {
    const info = contactMap.get(t.contact_id as string);
    if (!countsOnReport(info?.intent)) continue;
    const ch = (t.channel as string) ?? "other";
    byChannel.set(ch, (byChannel.get(ch) ?? 0) + 1);
    if (t.direction === "inbound") inbound += 1;
    else outbound += 1;
    engaged.push({
      contactId: t.contact_id as string,
      name: info?.name ?? "Unknown",
      firm: info?.firm ?? null,
      channel: ch,
      direction: (t.direction as string) ?? "outbound",
      date: (t.touched_at as string).split("T")[0],
      brief: (t.brief as string | null) ?? null,
      outcome: (t.outcome as string | null) ?? null,
    });
  }

  // ---- Browning aggregation ----
  const warmths = conversations
    .map((c) => c.warmth as number | null)
    .filter((n): n is number => typeof n === "number");
  const quals = conversations
    .map((c) => Number(c.avg_quality))
    .filter((n) => Number.isFinite(n));
  const coachingNotes: CoachingNote[] = conversations
    .filter((c) => c.what_was_hard || c.what_to_do_differently)
    .map((c) => ({
      name: contactMap.get(c.contact_id as string)?.name ?? "Unknown",
      avgQuality: Number.isFinite(Number(c.avg_quality)) ? Number(c.avg_quality) : null,
      whatWasHard: (c.what_was_hard as string | null) ?? null,
      whatToDoDifferently: (c.what_to_do_differently as string | null) ?? null,
    }));

  const gates = gatesRes.data ?? [];
  const gatesMoved: GateMoved[] = gates
    .filter((g) => {
      const completed = g.completed_date as string | null;
      const updated = (g.updated_at as string | null)?.split("T")[0] ?? null;
      return (
        (completed && completed >= weekStart && completed <= weekEnd) ||
        (updated && updated >= weekStart && updated <= weekEnd)
      );
    })
    .map((g) => ({
      gateCode: g.gate_code as string,
      description: g.description as string,
      status: g.status as string,
      completedDate: (g.completed_date as string | null) ?? null,
    }));
  const nextGateRow = gates
    .filter((g) => g.status !== "completed")
    .sort(
      (a, b) =>
        (a.step_number as number) - (b.step_number as number) ||
        (a.gate_code as string).localeCompare(b.gate_code as string)
    )[0];

  const scoredReferrals = conversations.reduce(
    (s, c) => s + ((c.referrals_received as number | null) ?? 0),
    0
  );

  // Named referrals from the contact graph (who was introduced, by whom).
  // Prefer referred_at-week rows; also include newly created contacts that
  // already have a referrer even if referred_at is missing.
  const referralById = new Map<
    string,
    { name: string; firm: string | null; referredBy: string; referredAt: string }
  >();
  for (const c of referredContacts) {
    const referrerId = c.referred_by_contact_id as string | null;
    const referrerName = referrerId ? contactMap.get(referrerId)?.name : null;
    if (!referrerName) continue;
    referralById.set(c.id as string, {
      name: c.name as string,
      firm: firmFromTags(c.tags as string[] | null),
      referredBy: referrerName,
      referredAt: (c.referred_at as string) ?? weekStart,
    });
  }
  for (const c of newContacts) {
    const id = c.id as string;
    if (referralById.has(id)) continue;
    const referrerId = c.referred_by_contact_id as string | null;
    const referrerName = referrerId ? contactMap.get(referrerId)?.name : null;
    if (!referrerName) continue;
    referralById.set(id, {
      name: c.name as string,
      firm: firmFromTags(c.tags as string[] | null),
      referredBy: referrerName,
      referredAt:
        ((c.referred_at as string | null) ?? (c.created_at as string).slice(0, 10)),
    });
  }
  const newReferrals = Array.from(referralById.values()).sort((a, b) =>
    a.referredAt < b.referredAt ? -1 : 1
  );

  return {
    weekStart,
    weekEnd,
    anchor,
    prevWeek,
    nextWeek,
    isCurrentWeek,
    outreach: {
      touchCount: engaged.length,
      prevTouchCount: prevTouchesRes.count ?? 0,
      byChannel: Array.from(byChannel.entries())
        .map(([channel, count]) => ({ channel, count }))
        .sort((a, b) => b.count - a.count),
      outbound,
      inbound,
      engaged,
      newContacts: newContacts.map((c) => {
        const referrerId = c.referred_by_contact_id as string | null;
        return {
          name: c.name as string,
          firm: firmFromTags(c.tags as string[] | null),
          relationship_type: (c.relationship_type as string | null) ?? null,
          referredBy: referrerId
            ? contactMap.get(referrerId)?.name ?? null
            : null,
        };
      }),
      overdueCount: overdueRes.count ?? 0,
      dueNext7Count: dueNextRes.count ?? 0,
    },
    browning: {
      conversations: conversations.length,
      prevConversations: prevConvRes.count ?? 0,
      target: BROWNING_WEEKLY_TARGET,
      avgWarmth: avg(warmths),
      avgQuality: avg(quals),
      // Prefer named contact referrals when present — conversation scores alone
      // often miss introductions logged on the contact card.
      referralsReceived: Math.max(scoredReferrals, newReferrals.length),
      newReferrals,
      thankYousSent: conversations.filter((c) => c.thank_you_sent === "yes").length,
      leadsProduced: conversations.filter((c) => c.produced_lead === true).length,
      coachingNotes,
      gatesMoved,
      nextGate: nextGateRow
        ? {
            gateCode: nextGateRow.gate_code as string,
            description: nextGateRow.description as string,
            status: nextGateRow.status as string,
            targetDate: (nextGateRow.target_date as string | null) ?? null,
          }
        : null,
      deliverables: (deliverablesRes.data ?? []).map((d) => ({
        promised: d.promised as string,
        deliveredStatus: (d.delivered_status as string | null) ?? null,
        escalate: (d.escalate as boolean | null) ?? false,
      })),
    },
  };
}
