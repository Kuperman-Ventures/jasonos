// Server-only data layer for the /outreach surface.
// Reads from jasonos.contacts (Phase 1 unified fields) and enriches with
// rr_recruiters strategic data where a recruiter_pipeline_id link exists.

import "server-only";
import {
  createPublicServiceRoleClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { CADENCE_DAYS } from "@/lib/outreach/types";
import type {
  CadenceInterval,
  CadenceStage,
  ContactIntent,
  NetworkDegree,
  NetworkRole,
  RelationshipType,
  RelevanceTier,
} from "@/lib/outreach/types";
import type { ReplyStatusOverride } from "@/lib/outreach/reply-status";

export interface OutreachPerson {
  id: string;
  name: string;
  title: string | null;
  firm: string | null;
  firm_normalized: string | null;
  linkedin_url: string | null;
  primary_email: string | null;
  phone: string | null;
  vip: boolean;
  /** False = frequent/operational contact excluded from the networking report
   *  and funnel. Defaults true. */
  is_networking: boolean;
  relationship_type: RelationshipType | null;
  cadence_interval: CadenceInterval;
  /** Phase 5A: where in the arc (initial / followup_1 / followup_2 / ongoing). */
  cadence_stage: CadenceStage | null;
  /** Phase 5B / migration 0017: explicit queue-column pin. NULL means
   *  the queue-buckets derivation rules decide. */
  intent: ContactIntent | null;
  /** Relevance vector (migration 0025): A most relevant .. C least. */
  relevance_tier: RelevanceTier | null;
  /** Network degree (migration 0025): 1 know well, 2 intro'd by a 1, 3 by a 2. */
  network_degree: NetworkDegree | null;
  /** Network role (migration 0045): buyer / buyer_referrer / referrer. */
  network_role: NetworkRole | null;
  next_touch_date: string | null;
  /**
   * True when the user explicitly set next_touch_date (reschedule / snooze /
   * log override). Cadence edits must not overwrite it; queue bands use this
   * date over the cadence interval.
   */
  next_touch_is_manual: boolean;
  last_touch_date: string | null;
  last_touch_channel: string | null;
  /**
   * Manual reply-status light pin (migration 0039). null = derive from the
   * last logged touch. Used because texts aren't tracked automatically.
   */
  reply_status_override: ReplyStatusOverride;
  /** When the manual reply-status override was last set. */
  reply_status_override_at: string | null;
  tags: string[];
  /** Pulled from rr_recruiters when source_ids.recruiter_pipeline_id matches. */
  strategic_score: number | null;
  /** Optional firm focus rank from the recruiter pipeline (1 = anchor, etc.). */
  firm_focus_rank: number | null;
}

export interface OutreachFirm {
  firm: string;
  firm_normalized: string;
  count: number;
  avg_strategic_score: number | null;
  top_person: OutreachPerson;
  people: OutreachPerson[];
}

export interface OutreachSyncSnapshot {
  source: string;
  last_synced_at: string | null;
  last_result: Record<string, unknown> | null;
}

function hasServiceRole() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface RecruiterEnrichment {
  firm: string | null;
  firm_normalized: string | null;
  title: string | null;
  strategic_score: number | null;
  firm_focus_rank: number | null;
}

async function loadRecruiterEnrichment(
  recruiterIds: string[]
): Promise<Map<string, RecruiterEnrichment>> {
  if (!recruiterIds.length) return new Map();
  try {
    const sb = createPublicServiceRoleClient();
    const { data } = await sb
      .from("rr_recruiters")
      .select("id,firm,firm_normalized,title,strategic_score,firm_focus_rank")
      .in("id", recruiterIds);
    const map = new Map<string, RecruiterEnrichment>();
    for (const row of data ?? []) {
      map.set(row.id as string, {
        firm: (row.firm as string) ?? null,
        firm_normalized: (row.firm_normalized as string) ?? null,
        title: (row.title as string) ?? null,
        strategic_score: (row.strategic_score as number) ?? null,
        firm_focus_rank: (row.firm_focus_rank as number) ?? null,
      });
    }
    return map;
  } catch (err) {
    console.error("[outreach.loadRecruiterEnrichment]", err);
    return new Map();
  }
}

function inferFirmFromTags(tags: string[]): string | null {
  const firmTag = tags.find((t) => t.startsWith("firm:"));
  if (!firmTag) return null;
  return firmTag.slice("firm:".length).replace(/-/g, " ");
}

// ---------------------------------------------------------------------------
// getOutreachPeople — flat list, used by the People tab
// ---------------------------------------------------------------------------

export async function getOutreachPeople(): Promise<OutreachPerson[]> {
  if (!hasServiceRole()) return [];

  try {
    const sb = createServiceRoleClient();
    // Try the full select first. Two graceful fallbacks layered on top of
    // each other:
    //   - intent missing (migration 0017 not applied) -> drop intent
    //   - cadence_stage missing (migration 0015 not applied) -> drop both
    // Either way the People list keeps rendering instead of disappearing.
    const fullColumns = `id,name,emails,phone,linkedin_url,title,vip,tags,source_ids,company_id,is_networking,
       relationship_type,cadence_interval,cadence_stage,intent,relevance_tier,
       network_degree,network_role,next_touch_date,next_touch_is_manual,last_touch_date,last_touch_channel,
       reply_status_override,reply_status_override_at`;
    const noRoleColumns = `id,name,emails,phone,linkedin_url,title,vip,tags,source_ids,company_id,is_networking,
       relationship_type,cadence_interval,cadence_stage,intent,relevance_tier,
       network_degree,next_touch_date,next_touch_is_manual,last_touch_date,last_touch_channel,
       reply_status_override,reply_status_override_at`;
    const noManualColumns = `id,name,emails,phone,linkedin_url,title,vip,tags,source_ids,company_id,is_networking,
       relationship_type,cadence_interval,cadence_stage,intent,relevance_tier,
       network_degree,next_touch_date,last_touch_date,last_touch_channel,
       reply_status_override,reply_status_override_at`;
    const noOverrideColumns = `id,name,emails,phone,linkedin_url,title,vip,tags,source_ids,company_id,is_networking,
       relationship_type,cadence_interval,cadence_stage,intent,relevance_tier,
       network_degree,next_touch_date,last_touch_date,last_touch_channel`;
    const noIntentColumns = `id,name,emails,phone,linkedin_url,title,vip,tags,source_ids,company_id,is_networking,
       relationship_type,cadence_interval,cadence_stage,relevance_tier,
       network_degree,next_touch_date,last_touch_date,last_touch_channel`;
    const noStageColumns = `id,name,emails,phone,linkedin_url,title,vip,tags,source_ids,company_id,is_networking,
       relationship_type,cadence_interval,relevance_tier,network_degree,
       next_touch_date,last_touch_date,last_touch_channel`;

    let result = await sb
      .from("contacts")
      .select(fullColumns)
      .order("name", { ascending: true });

    if (result.error && /network_role/i.test(result.error.message)) {
      console.warn(
        "[outreach.getOutreachPeople] network_role missing — run migration 0045. Falling back."
      );
      result = (await sb
        .from("contacts")
        .select(noRoleColumns)
        .order("name", { ascending: true })) as typeof result;
    }

    if (result.error && /next_touch_is_manual/i.test(result.error.message)) {
      console.warn(
        "[outreach.getOutreachPeople] next_touch_is_manual missing — run migration 0044. Falling back."
      );
      result = (await sb
        .from("contacts")
        .select(noManualColumns)
        .order("name", { ascending: true })) as typeof result;
    }

    if (result.error && /reply_status_override/i.test(result.error.message)) {
      console.warn(
        "[outreach.getOutreachPeople] reply_status_override missing — run migration 0039. Falling back."
      );
      result = (await sb
        .from("contacts")
        .select(noOverrideColumns)
        .order("name", { ascending: true })) as typeof result;
    }

    if (result.error && /\bintent\b/i.test(result.error.message)) {
      console.warn(
        "[outreach.getOutreachPeople] intent missing — run migration 0017. Falling back."
      );
      result = (await sb
        .from("contacts")
        .select(noIntentColumns)
        .order("name", { ascending: true })) as typeof result;
    }

    if (result.error && /cadence_stage/i.test(result.error.message)) {
      console.warn(
        "[outreach.getOutreachPeople] cadence_stage missing — run migration 0015. Falling back."
      );
      result = (await sb
        .from("contacts")
        .select(noStageColumns)
        .order("name", { ascending: true })) as typeof result;
    }
    const { data, error } = result;

    if (error) {
      console.error("[outreach.getOutreachPeople]", error);
      return [];
    }

    const recruiterIds = (data ?? [])
      .map((row) => {
        const si = row.source_ids as Record<string, unknown> | null;
        const rpid = si?.recruiter_pipeline_id;
        return typeof rpid === "string" ? rpid : null;
      })
      .filter((id): id is string => Boolean(id));

    const enrichmentMap = await loadRecruiterEnrichment(recruiterIds);

    // Company names (exact casing) via company_id — preferred over the legacy
    // firm:<slug> tag so edited capitalization shows everywhere.
    const companyIds = Array.from(
      new Set(
        (data ?? [])
          .map((row) => (row as { company_id?: string | null }).company_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    const companyNameById = new Map<string, string>();
    if (companyIds.length) {
      const { data: companies } = await sb
        .from("companies")
        .select("id,name")
        .in("id", companyIds);
      for (const c of companies ?? []) {
        companyNameById.set(c.id as string, (c.name as string) ?? "");
      }
    }

    return (data ?? []).map((row): OutreachPerson => {
      const si = row.source_ids as Record<string, unknown> | null;
      const rpid = typeof si?.recruiter_pipeline_id === "string"
        ? si.recruiter_pipeline_id
        : null;
      const enrichment = rpid ? enrichmentMap.get(rpid) : undefined;
      const tags = (row.tags as string[] | null) ?? [];
      const companyId =
        (row as { company_id?: string | null }).company_id ?? null;
      const companyName = companyId
        ? companyNameById.get(companyId) ?? null
        : null;
      const firm = enrichment?.firm ?? companyName ?? inferFirmFromTags(tags);
      const firmNormalized =
        enrichment?.firm_normalized ?? (firm ? firm.toLowerCase() : null);
      const emails = (row.emails as string[] | null) ?? [];

      return {
        id: row.id as string,
        name: row.name as string,
        title: (row.title as string) ?? enrichment?.title ?? null,
        firm,
        firm_normalized: firmNormalized,
        linkedin_url: (row.linkedin_url as string) ?? null,
        primary_email: emails[0] ?? null,
        phone: ((row as { phone?: string | null }).phone as string | null) ?? null,
        vip: Boolean(row.vip),
        is_networking:
          ((row as { is_networking?: boolean | null }).is_networking ?? true) !==
          false,
        relationship_type:
          (row.relationship_type as RelationshipType | null) ?? null,
        cadence_interval:
          (row.cadence_interval as CadenceInterval | null) ?? "none",
        cadence_stage: (row.cadence_stage as CadenceStage | null) ?? null,
        intent:
          ((row as { intent?: ContactIntent | null }).intent as
            | ContactIntent
            | null) ?? null,
        relevance_tier:
          ((row as { relevance_tier?: RelevanceTier | null }).relevance_tier as
            | RelevanceTier
            | null) ?? null,
        network_degree:
          ((row as { network_degree?: NetworkDegree | null }).network_degree as
            | NetworkDegree
            | null) ?? null,
        network_role:
          ((row as { network_role?: NetworkRole | null }).network_role as
            | NetworkRole
            | null) ?? null,
        next_touch_date: (row.next_touch_date as string | null) ?? null,
        next_touch_is_manual: Boolean(
          (row as { next_touch_is_manual?: boolean | null }).next_touch_is_manual
        ),
        last_touch_date: (row.last_touch_date as string | null) ?? null,
        last_touch_channel: (row.last_touch_channel as string | null) ?? null,
        reply_status_override:
          ((row as { reply_status_override?: ReplyStatusOverride }).reply_status_override as
            | ReplyStatusOverride
            | undefined) ?? null,
        reply_status_override_at:
          ((row as { reply_status_override_at?: string | null }).reply_status_override_at as
            | string
            | null
            | undefined) ?? null,
        tags,
        strategic_score: enrichment?.strategic_score ?? null,
        firm_focus_rank: enrichment?.firm_focus_rank ?? null,
      };
    });
  } catch (err) {
    console.error("[outreach.getOutreachPeople]", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// getOutreachFirms — grouped by firm, used by the Firms tab
// ---------------------------------------------------------------------------

export async function getOutreachFirms(): Promise<OutreachFirm[]> {
  const people = await getOutreachPeople();
  const groups = new Map<string, OutreachFirm>();

  for (const person of people) {
    if (!person.firm) continue;
    const key = person.firm_normalized ?? person.firm.toLowerCase();
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        firm: person.firm,
        firm_normalized: key,
        count: 1,
        avg_strategic_score: person.strategic_score,
        top_person: person,
        people: [person],
      });
      continue;
    }
    existing.count += 1;
    existing.people.push(person);
    if (
      (person.strategic_score ?? 0) > (existing.top_person.strategic_score ?? 0)
    ) {
      existing.top_person = person;
    }
  }

  // Recompute avg_strategic_score across all members
  for (const firm of groups.values()) {
    const scored = firm.people.filter((p) => p.strategic_score !== null);
    firm.avg_strategic_score = scored.length
      ? Math.round(
          scored.reduce((sum, p) => sum + (p.strategic_score ?? 0), 0) /
            scored.length
        )
      : null;
    firm.people.sort(
      (a, b) => (b.strategic_score ?? 0) - (a.strategic_score ?? 0)
    );
  }

  return Array.from(groups.values()).sort((a, b) => {
    const av = a.avg_strategic_score ?? 0;
    const bv = b.avg_strategic_score ?? 0;
    if (bv !== av) return bv - av;
    return b.count - a.count;
  });
}

// ---------------------------------------------------------------------------
// getWarmthReminders — Phase 5A. Contacts whose cadence has drifted: their
// last_touch_date is well behind what the cadence_interval says it should
// be. Three urgency tiers based on how far overdue.
//
// Borrowed concept from EncoreOS WarmthMaintenanceReminders, adapted to use
// CoSA's per-contact cadence_interval rather than a fixed 60/90/120-day rule.
// ---------------------------------------------------------------------------

export type WarmthUrgency = "critical" | "high" | "medium";

export interface WarmthReminder {
  person: OutreachPerson;
  daysSinceTouch: number; // Infinity when never touched
  daysOverdue: number; // days_since - cadenceDays (clamped >= 0)
  urgency: WarmthUrgency;
  suggestedAction: string;
}

function urgencyFromOverdue(daysSinceTouch: number, cadenceDays: number): WarmthUrgency | null {
  const ratio = cadenceDays > 0 ? daysSinceTouch / cadenceDays : Infinity;
  if (ratio >= 2 || daysSinceTouch === Infinity) return "critical";
  if (ratio >= 1.5) return "high";
  if (ratio >= 1.25) return "medium";
  return null;
}

function suggestedActionFor(
  relationshipType: OutreachPerson["relationship_type"],
  urgency: WarmthUrgency
): string {
  if (urgency === "critical") {
    if (relationshipType === "personal") return "Send a personal note — no agenda.";
    if (relationshipType === "mentor_advisor")
      return "Re-open with a real update + one specific question.";
    return "Re-open authentically — acknowledge the gap, lead with value.";
  }
  if (urgency === "high") {
    if (relationshipType === "operator_peer")
      return "Share something you saw they'd find useful.";
    return "Send a short check-in with a fresh hook.";
  }
  // medium
  return "Quick value-share to stay on radar.";
}

export async function getWarmthReminders(limit = 20): Promise<WarmthReminder[]> {
  const people = await getOutreachPeople();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const reminders: WarmthReminder[] = [];

  for (const person of people) {
    // Backrow contacts are out of the queue — never nag about them.
    if (person.intent === "backrow") continue;
    if (!person.cadence_interval || person.cadence_interval === "none") continue;
    // An explicit next-touch date is authoritative: if it's today or in the
    // future, this contact is SCHEDULED, not drifting. (Manually pushing a
    // touch out to, say, October must remove them from cadence drift.) Only
    // contacts with no scheduled next touch, or a past-due one, can drift.
    if (person.next_touch_date && person.next_touch_date >= todayStr) continue;
    const cadenceDays = CADENCE_DAYS[person.cadence_interval as Exclude<CadenceInterval, "none">];
    if (!cadenceDays) continue;

    let daysSinceTouch: number;
    if (!person.last_touch_date) {
      daysSinceTouch = Infinity;
    } else {
      const [y, m, d] = person.last_touch_date.split("-").map(Number);
      const last = new Date(y, m - 1, d);
      daysSinceTouch = Math.floor((today.getTime() - last.getTime()) / 86_400_000);
    }

    const urgency = urgencyFromOverdue(daysSinceTouch, cadenceDays);
    if (!urgency) continue;

    const daysOverdue = daysSinceTouch === Infinity
      ? cadenceDays * 3
      : Math.max(0, daysSinceTouch - cadenceDays);

    reminders.push({
      person,
      daysSinceTouch,
      daysOverdue,
      urgency,
      suggestedAction: suggestedActionFor(person.relationship_type, urgency),
    });
  }

  const urgencyRank: Record<WarmthUrgency, number> = { critical: 0, high: 1, medium: 2 };
  reminders.sort((a, b) => {
    const ua = urgencyRank[a.urgency];
    const ub = urgencyRank[b.urgency];
    if (ua !== ub) return ua - ub;
    // VIPs ahead within same urgency
    if (a.person.vip !== b.person.vip) return a.person.vip ? -1 : 1;
    return b.daysOverdue - a.daysOverdue;
  });

  return reminders.slice(0, limit);
}

// ---------------------------------------------------------------------------
// getOutreachSyncState — read jasonos.outreach_sync_state for the tab nav
// "last synced" indicator. Returns empty array if the Phase 4 migration
// hasn't been applied yet (table missing → falls back gracefully).
// ---------------------------------------------------------------------------

export async function getOutreachSyncState(): Promise<OutreachSyncSnapshot[]> {
  if (!hasServiceRole()) return [];
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("outreach_sync_state")
      .select("source,last_synced_at,last_result")
      .order("source", { ascending: true });
    if (error) {
      // Table missing means the user hasn't applied 0014 yet; not a real
      // error worth surfacing.
      if (!/relation .+ does not exist/i.test(error.message)) {
        console.error("[outreach.getOutreachSyncState]", error);
      }
      return [];
    }
    return (data ?? []).map((row) => ({
      source: row.source as string,
      last_synced_at: (row.last_synced_at as string) ?? null,
      last_result: (row.last_result as Record<string, unknown> | null) ?? null,
    }));
  } catch (err) {
    console.error("[outreach.getOutreachSyncState]", err);
    return [];
  }
}
