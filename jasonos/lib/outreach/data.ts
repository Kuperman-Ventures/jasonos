// Server-only data layer for the /outreach surface.
// Reads from jasonos.contacts (Phase 1 unified fields) and enriches with
// rr_recruiters strategic data where a recruiter_pipeline_id link exists.

import "server-only";
import {
  createPublicServiceRoleClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import type { CadenceInterval, RelationshipType } from "@/lib/outreach/types";

export interface OutreachPerson {
  id: string;
  name: string;
  title: string | null;
  firm: string | null;
  firm_normalized: string | null;
  linkedin_url: string | null;
  primary_email: string | null;
  vip: boolean;
  relationship_type: RelationshipType | null;
  cadence_interval: CadenceInterval;
  next_touch_date: string | null;
  last_touch_date: string | null;
  last_touch_channel: string | null;
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
    const { data, error } = await sb
      .from("contacts")
      .select(
        `id,name,emails,linkedin_url,title,vip,tags,source_ids,
         relationship_type,cadence_interval,next_touch_date,
         last_touch_date,last_touch_channel`
      )
      .order("name", { ascending: true });

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

    return (data ?? []).map((row): OutreachPerson => {
      const si = row.source_ids as Record<string, unknown> | null;
      const rpid = typeof si?.recruiter_pipeline_id === "string"
        ? si.recruiter_pipeline_id
        : null;
      const enrichment = rpid ? enrichmentMap.get(rpid) : undefined;
      const tags = (row.tags as string[] | null) ?? [];
      const firm = enrichment?.firm ?? inferFirmFromTags(tags);
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
        vip: Boolean(row.vip),
        relationship_type:
          (row.relationship_type as RelationshipType | null) ?? null,
        cadence_interval:
          (row.cadence_interval as CadenceInterval | null) ?? "none",
        next_touch_date: (row.next_touch_date as string | null) ?? null,
        last_touch_date: (row.last_touch_date as string | null) ?? null,
        last_touch_channel: (row.last_touch_channel as string | null) ?? null,
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
