"use server";

// Identity-only contact creation for the unified Add Contact flow.
//
// Every contact created through the in-app modal starts unclassified — no
// relationship_type, no cadence rhythm, no intent pin, no auto-enrolled
// First-Contact Sequence, and no recruiter pipeline card. The user
// classifies the contact afterwards via the contact card (Intent control,
// Relationship picker, Cadence). The CSV importer is the only exempt path
// because it brings its own classification mapping (see
// `bulkInsertContacts`).
//
// This action replaces `addCadenceContact` and `addColdTarget` for the UI
// create-contact flow. Those legacy actions still exist (marked
// @deprecated) so server-side callers that genuinely need the
// auto-classification can keep working until they are migrated.

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { BrowningSource } from "@/lib/browning/types";
import type { NetworkDegree, RelevanceTier } from "@/lib/outreach/types";

interface CreateContactUnclassifiedInput {
  name: string;
  title?: string | null;
  firm?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  /**
   * Browning classification set at creation time: 'my_list' (a contact from
   * my own network) or 'browning_referral' (someone Browning connected me to).
   * null = not a Browning contact. Setting it enrolls the contact in Browning.
   */
  browning_source?: BrowningSource | null;
  /** Relevance vector A/B/C (optional at creation). */
  relevance_tier?: RelevanceTier | null;
  /** Network degree 1/2/3 (optional at creation). */
  network_degree?: NetworkDegree | null;
}

type CreateContactUnclassifiedResult =
  | { ok: true; contactId: string }
  | { ok: false; error: string };

function hasSupabaseServiceRole() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function revalidate() {
  revalidatePath("/outreach/queue");
  revalidatePath("/outreach/people");
  revalidatePath("/outreach/schedule");
}

export async function createContactUnclassified(
  input: CreateContactUnclassifiedInput
): Promise<CreateContactUnclassifiedResult> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name is required." };
  if (!hasSupabaseServiceRole()) {
    return { ok: false, error: "Supabase service role is not configured." };
  }

  const sb = createServiceRoleClient();
  const title = input.title?.trim() || null;
  const firm = input.firm?.trim() || null;
  const email = input.email?.trim() || null;
  const linkedinUrl = input.linkedin_url?.trim() || null;

  // The firm tag is the only metadata we attach automatically. It carries
  // no classification weight — it just powers downstream firm matching
  // (e.g. ensureContactForRecruiter, firms tab, dedupe). The user still
  // classifies relationship_type, cadence, and intent themselves.
  const tags: string[] = [];
  if (firm) tags.push(`firm:${slugify(firm)}`);

  const browningSource = input.browning_source ?? null;
  const relevanceTier = input.relevance_tier ?? null;
  const networkDegree = input.network_degree ?? null;

  const { data, error } = await sb
    .from("contacts")
    .insert({
      name,
      title,
      linkedin_url: linkedinUrl,
      emails: email ? [email] : [],
      tags,
      relationship_type: null,
      cadence_interval: "none",
      intent: null,
      vip: false,
      browning_source: browningSource,
      relevance_tier: relevanceTier,
      network_degree: networkDegree,
    })
    .select("id")
    .single();

  if (error) {
    if (/\bintent\b/i.test(error.message)) {
      // Migration 0017 not applied yet — retry without the explicit
      // `intent: null`, since the column genuinely isn't there.
      const fallback = await sb
        .from("contacts")
        .insert({
          name,
          title,
          linkedin_url: linkedinUrl,
          emails: email ? [email] : [],
          tags,
          relationship_type: null,
          cadence_interval: "none",
          vip: false,
          browning_source: browningSource,
          relevance_tier: relevanceTier,
          network_degree: networkDegree,
        })
        .select("id")
        .single();
      if (fallback.error) return { ok: false, error: fallback.error.message };
      revalidate();
      return { ok: true, contactId: fallback.data.id as string };
    }
    return { ok: false, error: error.message };
  }

  revalidate();
  return { ok: true, contactId: data.id as string };
}
