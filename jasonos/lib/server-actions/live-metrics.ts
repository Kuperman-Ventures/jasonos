"use server";

import { countSecondCalls } from "@/lib/meeting-prep/people";
import {
  computeCallMetrics,
  computeRelationshipMetrics,
  metricsWindow,
  type CallMetrics,
  type MetricCommitment,
  type MetricContact,
  type MetricMeeting,
  type RelationshipMetrics,
} from "@/lib/meeting-prep/metrics";
import { createServiceRoleClient } from "@/lib/supabase/server";

type MetricsResult<T> = ({ ok: true } & T) | { ok: false; error: string };

function hasConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function etDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function etBound(ymd: string, endOfDay: boolean): string {
  const clock = endOfDay ? "23:59:59.999" : "00:00:00.000";
  for (const offset of ["-04:00", "-05:00"]) {
    const date = new Date(`${ymd}T${clock}${offset}`);
    if (etDateKey(date.toISOString()) !== ymd) continue;
    const hour = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(date);
    if ((endOfDay && hour === "23") || (!endOfDay && hour === "00")) return date.toISOString();
  }
  return new Date(`${ymd}T${endOfDay ? "23:59:59.999" : "05:00:00.000"}Z`).toISOString();
}

function markOf(value: unknown): MetricMeeting["outcomeMark"] {
  return value === "hit" || value === "partial" || value === "missed" ? value : null;
}

function directionOf(value: unknown): "mine" | "theirs" {
  return value === "mine" ? "mine" : "theirs";
}

function iso(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function contactIdOf(prep: Record<string, unknown>): string | null {
  const primary = prep.primary_contact_id as string | null;
  if (primary) return primary;
  for (const attendee of Array.isArray(prep.attendees) ? (prep.attendees as Array<{ contact_id?: string | null }>) : []) {
    if (attendee?.contact_id) return attendee.contact_id;
  }
  return null;
}

async function loadCallMetrics(
  sb: ReturnType<typeof createServiceRoleClient>,
  fromIso: string,
  toIso: string,
  asks: Array<{ state?: unknown; confirmed_state?: unknown }>
): Promise<MetricsResult<{ calls: CallMetrics }>> {
  const [logsRes, referralsRes, bookedRes] = await Promise.all([
    sb
      .from("relationship_log")
      .select("contact_id, prep_id, occurred_at, contacts_received, thank_you_sent_at")
      .gte("occurred_at", fromIso)
      .lte("occurred_at", toIso),
    sb
      .from("contacts")
      .select("referral_received_at, first_contact_at")
      .gte("referral_received_at", fromIso)
      .lte("referral_received_at", toIso),
    sb
      .from("meeting_preps")
      .select("id, starts_at, primary_contact_id, attendees")
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
  ]);
  const failed = logsRes.error || referralsRes.error || bookedRes.error;
  if (failed) return { ok: false, error: failed.message };
  const logs = (logsRes.data ?? []) as Array<Record<string, unknown>>;

  const prepIds = [...new Set(logs.map((log) => log.prep_id as string | null).filter((id): id is string => Boolean(id)))];
  const endsAt = new Map<string, string>();
  if (prepIds.length) {
    const { data, error } = await sb.from("meeting_preps").select("id, ends_at").in("id", prepIds);
    if (error) return { ok: false, error: error.message };
    for (const row of data ?? []) if (row.ends_at) endsAt.set(String(row.id), String(row.ends_at));
  }

  const booked = ((bookedRes.data ?? []) as Array<Record<string, unknown>>)
    .map((prep) => ({ id: String(prep.id), startsAt: String(prep.starts_at), contactId: contactIdOf(prep) }))
    .filter((row): row is { id: string; startsAt: string; contactId: string } => Boolean(row.contactId));
  let secondCalls = 0;
  if (booked.length) {
    const { data, error } = await sb
      .from("relationship_log")
      .select("contact_id, prep_id, occurred_at")
      .in("contact_id", [...new Set(booked.map((row) => row.contactId))]);
    if (error) return { ok: false, error: error.message };
    secondCalls = countSecondCalls(
      booked,
      (data ?? []).map((row) => ({
        contactId: String(row.contact_id),
        prepId: (row.prep_id as string | null) ?? null,
        occurredAt: String(row.occurred_at),
      }))
    );
  }

  return {
    ok: true,
    calls: computeCallMetrics({
      logs: logs.map((log) => ({
        contactId: String(log.contact_id),
        endsAt: endsAt.get(String(log.prep_id)) ?? String(log.occurred_at),
        thankYouSentAt: iso(log.thank_you_sent_at),
        contactsReceived: Array.isArray(log.contacts_received) ? log.contacts_received.length : 0,
      })),
      referrals: ((referralsRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        receivedAt: String(row.referral_received_at),
        firstContactAt: iso(row.first_contact_at),
      })),
      asks: asks.map((row) => ({ state: String(row.confirmed_state || row.state || "open") })),
      secondCallsScheduled: secondCalls,
    }),
  };
}

export async function getRelationshipMetrics(
  days: number
): Promise<MetricsResult<{ metrics: RelationshipMetrics; calls: CallMetrics }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const window = metricsWindow(days, today);
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("meeting_preps")
    .select("id, starts_at, primary_contact_id, script_id, outcome_mark")
    .not("live_ended_at", "is", null)
    .gte("starts_at", etBound(window.from, false))
    .lte("starts_at", etBound(window.to, true));
  if (error) return { ok: false, error: error.message };
  const preps = data ?? [];
  const prepIds = preps.map((row) => row.id as string);
  const contactIds = [...new Set(preps.map((row) => row.primary_contact_id).filter((id): id is string => Boolean(id)))];
  const scriptIds = [...new Set(preps.map((row) => row.script_id).filter((id): id is string => Boolean(id)))];

  const [contacts, touches, briefs, scripts, reviews, asks] = await Promise.all([
    contactIds.length
      ? sb
          .from("contacts")
          .select("id, name, cadence_interval, last_touch_date, next_touch_date, companies(name)")
          .in("id", contactIds)
      : Promise.resolve({ data: [], error: null }),
    contactIds.length
      ? sb
          .from("contact_touches")
          .select("contact_id, touched_at")
          .in("contact_id", contactIds)
          .in("channel", ["calendar", "phone", "in_person"])
      : Promise.resolve({ data: [], error: null }),
    contactIds.length
      ? sb.from("contact_relationship_briefs").select("contact_id, commitments").in("contact_id", contactIds)
      : Promise.resolve({ data: [], error: null }),
    scriptIds.length
      ? sb.from("live_scripts").select("id, name").in("id", scriptIds)
      : Promise.resolve({ data: [], error: null }),
    prepIds.length
      ? sb.from("meeting_reviews").select("prep_id, suggested_mark").in("prep_id", prepIds)
      : Promise.resolve({ data: [], error: null }),
    prepIds.length
      ? sb
          .from("meeting_points")
          .select("prep_id, state, confirmed_state")
          .in("prep_id", prepIds)
          .eq("kind", "ask")
      : Promise.resolve({ data: [], error: null }),
  ]);
  const lookupError =
    contacts.error || touches.error || briefs.error || scripts.error || reviews.error || asks.error;
  if (lookupError) return { ok: false, error: lookupError.message };

  const suggested = new Map((reviews.data ?? []).map((row) => [row.prep_id as string, markOf(row.suggested_mark)]));
  const askTally = new Map<string, { covered: number; total: number }>();
  for (const row of asks.data ?? []) {
    const tally = askTally.get(row.prep_id as string) ?? { covered: 0, total: 0 };
    tally.total += 1;
    const confirmed = (row as { confirmed_state?: string | null }).confirmed_state;
    const effective = confirmed || (row.state as string);
    if (effective === "covered") tally.covered += 1;
    askTally.set(row.prep_id as string, tally);
  }
  const commitments: MetricCommitment[] = [];
  for (const brief of briefs.data ?? []) {
    if (!Array.isArray(brief.commitments)) continue;
    for (const item of brief.commitments) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      commitments.push({
        contactId: brief.contact_id as string,
        direction: directionOf(row.direction),
        status: typeof row.status === "string" ? row.status : "open",
        createdAt: iso(row.createdAt ?? row.created_at),
        doneAt: iso(row.doneAt ?? row.done_at),
      });
    }
  }

  const meetings: MetricMeeting[] = preps.map((row) => {
    const tally = askTally.get(row.id as string) ?? { covered: 0, total: 0 };
    return {
      id: row.id as string,
      startsAt: row.starts_at as string,
      primaryContactId: (row.primary_contact_id as string | null) ?? null,
      strategyId: (row.script_id as string | null) ?? null,
      outcomeMark: markOf(row.outcome_mark),
      suggestedMark: suggested.has(row.id as string) ? suggested.get(row.id as string) ?? null : null,
      asksCovered: tally.covered,
      asksTotal: tally.total,
    };
  });
  const people: MetricContact[] = (contacts.data ?? []).map((row) => {
    const company = (row as { companies?: { name?: string } | { name?: string }[] | null }).companies;
    const companyRow = Array.isArray(company) ? company[0] : company;
    return {
      id: row.id as string,
      name: String(row.name),
      company: companyRow?.name?.trim() || null,
      cadence: typeof row.cadence_interval === "string" ? row.cadence_interval : null,
      lastTouchDate: typeof row.last_touch_date === "string" ? row.last_touch_date : null,
      nextTouchDate: typeof row.next_touch_date === "string" ? row.next_touch_date : null,
    };
  });

  const calls = await loadCallMetrics(sb, etBound(window.from, false), etBound(window.to, true), asks.data ?? []);
  if (!calls.ok) return calls;

  return {
    ok: true,
    calls: calls.calls,
    metrics: computeRelationshipMetrics({
      from: window.from,
      to: window.to,
      today,
      meetings,
      contacts: people,
      touches: (touches.data ?? []).map((row) => ({
        contactId: row.contact_id as string,
        touchedAt: row.touched_at as string,
      })),
      commitments,
      strategies: (scripts.data ?? []).map((row) => ({ id: row.id as string, name: String(row.name) })),
    }),
  };
}
