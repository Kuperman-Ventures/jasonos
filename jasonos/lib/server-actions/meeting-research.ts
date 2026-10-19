"use server";

import { revalidatePath } from "next/cache";
import {
  buildResearchBriefModel,
  serializeResearchBrief,
  type PersonCompanyResearch,
  type ResearchBriefModel,
  type ResearchSource,
} from "@/lib/ai/research-brief";
import { isContactThin } from "@/lib/meeting-prep/research-policy";
import { createServiceRoleClient } from "@/lib/supabase/server";

export interface MeetingResearchResult {
  researched: string[];
  skipped: string[];
  errors: string[];
}

type ActionResult = ({ ok: true } & MeetingResearchResult) | { ok: false; error: string };

const researchInflight = new Set<string>();

interface ContactRow {
  id: string;
  name: string | null;
  title: string | null;
  company_id: string | null;
  linkedin_url: string | null;
  research_at: string | null;
  emails: string[] | null;
}

function hasConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function asAttendeeContactIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const id = (item as { contact_id?: unknown }).contact_id;
    if (typeof id === "string" && id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function attendeeEmail(attendees: unknown, contactId: string, fallback: string[] | null): string | null {
  if (Array.isArray(attendees)) {
    for (const item of attendees) {
      if (!item || typeof item !== "object") continue;
      if ((item as { contact_id?: unknown }).contact_id !== contactId) continue;
      const email = (item as { email?: unknown }).email;
      if (typeof email === "string" && email.includes("@")) return email.trim().toLowerCase();
    }
  }
  const first = fallback?.find((email) => email.includes("@"));
  return first ? first.trim().toLowerCase() : null;
}

function mergeNews(
  person: ResearchBriefModel,
  text: string,
  sources: ResearchSource[],
  searched: boolean
): ResearchBriefModel {
  const news = buildResearchBriefModel({
    text,
    sources,
    searched,
    emptyFallback: "",
  });
  if (news.empty) return person;
  const bullets = [...person.bullets];
  for (const bullet of news.bullets) {
    if (!bullets.includes(bullet)) bullets.push(bullet);
  }
  const nextSources = [...person.sources];
  for (const source of news.sources) {
    if (!nextSources.some((item) => item.url === source.url)) nextSources.push(source);
  }
  return {
    ...person,
    lead: person.lead || news.lead,
    bullets: bullets.slice(0, 8),
    sources: nextSources.slice(0, 8),
    empty: false,
  };
}

async function companyIdByName(
  sb: ReturnType<typeof createServiceRoleClient>,
  name: string
): Promise<string | null> {
  const pattern = name.replace(/[%_]/g, "").trim();
  if (!pattern) return null;
  const { data, error } = await sb.from("companies").select("id, name").ilike("name", pattern).limit(15);
  if (error) throw new Error(error.message);
  const target = name.trim().toLowerCase();
  const match = (data ?? []).find((row) => String(row.name ?? "").trim().toLowerCase() === target);
  return match ? String(match.id) : null;
}

async function storeCompany(
  sb: ReturnType<typeof createServiceRoleClient>,
  input: {
    existingCompanyId: string | null;
    research: PersonCompanyResearch;
    now: string;
  }
): Promise<string | null> {
  const brief = serializeResearchBrief(input.research.company);
  const description = (input.research.company.lead || input.research.company.bullets[0] || "").slice(0, 500);
  const patch: Record<string, unknown> = {
    research_brief: brief,
    research_at: input.now,
    updated_at: input.now,
  };
  if (description) patch.description = description;
  if (input.research.website) patch.website = input.research.website;

  const hasCompanyFacts = !input.research.company.empty || Boolean(input.research.companyName?.trim());
  if (input.existingCompanyId) {
    if (!input.research.company.empty) {
      const { error } = await sb.from("companies").update(patch).eq("id", input.existingCompanyId);
      if (error) throw new Error(error.message);
    }
    return input.existingCompanyId;
  }

  const name = input.research.companyName?.trim();
  if (!name || !hasCompanyFacts) return null;
  const existing = await companyIdByName(sb, name);
  if (existing) {
    const { error } = await sb.from("companies").update(patch).eq("id", existing);
    if (error) throw new Error(error.message);
    return existing;
  }
  const { data, error } = await sb
    .from("companies")
    .insert({ name, ...patch })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return String(data.id);
}

export async function runMeetingResearch(
  prepId: string,
  options?: { force?: boolean }
): Promise<ActionResult> {
  if (!hasConfig()) return { ok: false, error: "Not configured" };
  const id = prepId.trim();
  if (!id) return { ok: false, error: "Meeting prep not found." };
  const force = Boolean(options?.force);
  if (!force && researchInflight.has(id)) {
    return { ok: true, researched: [], skipped: [], errors: [] };
  }
  researchInflight.add(id);
  try {
  const sb = createServiceRoleClient();
  const { data: prep, error: prepError } = await sb
    .from("meeting_preps")
    .select("id, attendees")
    .eq("id", id)
    .maybeSingle();
  if (prepError) return { ok: false, error: prepError.message };
  if (!prep) return { ok: false, error: "Meeting prep not found." };

  const contactIds = asAttendeeContactIds(prep.attendees);
  const researched: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  if (contactIds.length) {
    const { data: contacts, error: contactError } = await sb
      .from("contacts")
      .select("id, name, title, company_id, linkedin_url, research_at, emails, companies(name)")
      .in("id", contactIds);
    if (contactError) return { ok: false, error: contactError.message };
    const byId = new Map<string, ContactRow & { companyName: string | null }>();
    for (const raw of contacts ?? []) {
      const row = raw as ContactRow & { companies?: { name?: string } | { name?: string }[] | null };
      const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
      byId.set(row.id, { ...row, companyName: company?.name?.trim() || null });
    }

    const { researchPersonAndCompany, researchPersonNews } = await import("@/lib/ai/research");

    for (const contactId of contactIds) {
      const contact = byId.get(contactId);
      const label = contact?.name?.trim() || contactId;
      if (!contact) {
        errors.push(`${label}: contact not found.`);
        continue;
      }
      const thin = isContactThin({
        title: contact.title,
        companyId: contact.company_id,
        linkedinUrl: contact.linkedin_url,
        researchAt: contact.research_at,
      });
      if (!force && !thin) {
        skipped.push(label);
        continue;
      }
      try {
        const email = attendeeEmail(prep.attendees, contactId, contact.emails);
        const found = await researchPersonAndCompany({
          name: label,
          email,
          company: contact.companyName,
          linkedinUrl: contact.linkedin_url,
        });
        let person = found.person;
        if (!contact.research_at) {
          try {
            const news = await researchPersonNews({
              name: label,
              firm: found.companyName || contact.companyName,
            });
            person = mergeNews(person, news.text, news.sources, news.searched);
          } catch (err) {
            const message = err instanceof Error ? err.message : "Recent news search failed.";
            errors.push(`${label}: ${message}`);
          }
        }
        const now = new Date().toISOString();
        const companyId = await storeCompany(sb, {
          existingCompanyId: contact.company_id,
          research: { ...found, person },
          now,
        });
        const patch: Record<string, unknown> = {
          research_brief: serializeResearchBrief(person),
          research_at: now,
          updated_at: now,
        };
        if (!contact.title?.trim() && found.title) patch.title = found.title;
        if (!contact.linkedin_url?.trim() && found.linkedinUrl) patch.linkedin_url = found.linkedinUrl;
        if (!contact.company_id && companyId) patch.company_id = companyId;
        const { error: updateError } = await sb.from("contacts").update(patch).eq("id", contactId);
        if (updateError) throw new Error(updateError.message);
        researched.push(label);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Research failed.";
        errors.push(`${label}: ${message}`);
      }
    }
  }

  const finishedAt = new Date().toISOString();
  const { error } = await sb
    .from("meeting_preps")
    .update({ research_ran_at: finishedAt, updated_at: finishedAt })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath(`/meetings/${id}`);
  return { ok: true, researched, skipped, errors };
  } finally {
    researchInflight.delete(id);
  }
}
