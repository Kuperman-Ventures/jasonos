"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  CADENCE_DAYS,
  CADENCE_OBJECT_TYPE,
  type CadenceCardBody,
  type CadenceInterval,
  type CadenceScheduleOption,
} from "@/lib/cadence/types";

interface AddCadenceContactInput {
  name: string;
  firm?: string;
  title?: string;
  linkedinUrl?: string;
  email?: string;
  cadence: CadenceInterval;
  notes?: string;
}

type AddResult =
  | { ok: true; contactId: string; cardId: string }
  | { ok: false; error: string };

type VoidResult = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasSupabaseServiceRole() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function addTags(existing: string[], tags: string[]) {
  return [...new Set([...existing, ...tags])];
}

function todayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

function addDaysISO(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function nextTouchFromCadence(cadence: CadenceInterval): string | null {
  if (cadence === "none") return null;
  return addDaysISO(todayISO(), CADENCE_DAYS[cadence]);
}

function dueDateFromOption(option: CadenceScheduleOption, customDate?: string): string {
  switch (option) {
    case "asap":
      return todayISO();
    case "next_week":
      return addDaysISO(todayISO(), 7);
    case "2_weeks":
      return addDaysISO(todayISO(), 14);
    case "1_month":
      return addDaysISO(todayISO(), 30);
    case "3_months":
      return addDaysISO(todayISO(), 90);
    case "custom":
      return customDate ?? addDaysISO(todayISO(), 14);
  }
}

function revalidate() {
  revalidatePath("/contacts");
  revalidatePath("/communications");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// addCadenceContact — upsert contact + create/refresh cadence card
// ---------------------------------------------------------------------------

export async function addCadenceContact(input: AddCadenceContactInput): Promise<AddResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name is required." };
  if (!hasSupabaseServiceRole()) {
    return { ok: false, error: "Supabase service role is not configured." };
  }

  const sb = createServiceRoleClient();
  const linkedinUrl = input.linkedinUrl?.trim() || null;
  const email = input.email?.trim() || null;
  const firm = input.firm?.trim() || null;
  const firmTag = firm ? `firm:${slugify(firm)}` : null;
  const cadenceTag = `cadence:${input.cadence}`;
  const roleTag = "role:cadence_contact";

  // Dedupe lookup: prefer linkedin_url, fall back to (name + firm tag) match.
  const existingLookup = linkedinUrl
    ? await sb.from("contacts").select("id,tags,emails").eq("linkedin_url", linkedinUrl).maybeSingle()
    : firmTag
      ? await sb
          .from("contacts")
          .select("id,tags,emails")
          .eq("name", name)
          .contains("tags", [firmTag])
          .maybeSingle()
      : await sb.from("contacts").select("id,tags,emails").eq("name", name).maybeSingle();

  if (existingLookup.error) return { ok: false, error: existingLookup.error.message };

  let contactId: string;
  const newTags = [roleTag, cadenceTag, ...(firmTag ? [firmTag] : [])];
  // Phase 1 dual-write: cadence_interval + next_touch_date are now first-class
  // fields on jasonos.contacts (migration 0013). Existing cards stay in sync
  // for now; Phase 2/3 will read from contacts directly and we can drop the
  // card-body mirror.
  const contactCadence = input.cadence;
  const contactNextTouch = nextTouchFromCadence(contactCadence);

  if (existingLookup.data) {
    contactId = existingLookup.data.id as string;
    const tags = addTags((existingLookup.data.tags as string[] | null) ?? [], newTags)
      // Strip any prior cadence:* tag so the latest pick wins.
      .filter((t) => t === cadenceTag || !t.startsWith("cadence:"));

    const existingEmails = (existingLookup.data.emails as string[] | null) ?? [];
    const mergedEmails = email
      ? Array.from(new Set([email, ...existingEmails]))
      : undefined;

    const { error } = await sb
      .from("contacts")
      .update({
        name,
        title: input.title?.trim() || null,
        linkedin_url: linkedinUrl,
        emails: mergedEmails,
        tracks: ["personal"],
        tags,
        cadence_interval: contactCadence,
        next_touch_date: contactNextTouch,
      })
      .eq("id", contactId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: newContact, error } = await sb
      .from("contacts")
      .insert({
        name,
        title: input.title?.trim() || null,
        linkedin_url: linkedinUrl,
        emails: email ? [email] : [],
        tracks: ["personal"],
        tags: newTags,
        cadence_interval: contactCadence,
        next_touch_date: contactNextTouch,
        // Quick-add doesn't ask for relationship_type yet; user classifies in
        // the People view (Phase 2). Left null on purpose.
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    contactId = newContact.id as string;
  }

  // Look for an open cadence card already linked to this contact.
  const existingCard = await sb
    .from("cards")
    .select("id,body,state")
    .eq("module", "reconnect")
    .eq("object_type", CADENCE_OBJECT_TYPE)
    .eq("linked_object_ids->>contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const cardBody: CadenceCardBody = {
    cadence_interval: input.cadence,
    next_touch_date: nextTouchFromCadence(input.cadence),
    notes: input.notes?.trim() || null,
    firm,
  };

  const cardTitle = firm ? `${name} (${firm})` : name;

  if (existingCard.data?.id) {
    // Merge into existing — preserve a future next_touch_date if the user
    // already scheduled one, unless the cadence interval changed.
    const prior = (existingCard.data.body as Partial<CadenceCardBody> | null) ?? {};
    const cadenceChanged = prior.cadence_interval !== input.cadence;
    const keepPriorDue =
      !cadenceChanged && typeof prior.next_touch_date === "string" && prior.next_touch_date >= todayISO();
    const mergedBody: CadenceCardBody = {
      ...cardBody,
      next_touch_date: keepPriorDue ? prior.next_touch_date! : cardBody.next_touch_date,
      notes: cardBody.notes ?? prior.notes ?? null,
    };

    const { error } = await sb
      .from("cards")
      .update({
        title: cardTitle,
        subtitle: input.title?.trim() || null,
        body: mergedBody,
        state: "open",
      })
      .eq("id", existingCard.data.id);
    if (error) return { ok: false, error: error.message };

    revalidate();
    return { ok: true, contactId, cardId: existingCard.data.id as string };
  }

  const { data: newCard, error: cardError } = await sb
    .from("cards")
    .insert({
      track: "personal",
      module: "reconnect",
      object_type: CADENCE_OBJECT_TYPE,
      title: cardTitle,
      subtitle: input.title?.trim() || null,
      body: cardBody,
      linked_object_ids: { contact_id: contactId },
      state: "open",
      priority_score: 0,
      verbs: ["draft", "send", "snooze", "message"],
    })
    .select("id")
    .single();

  if (cardError) return { ok: false, error: cardError.message };

  revalidate();
  return { ok: true, contactId, cardId: newCard.id as string };
}

// ---------------------------------------------------------------------------
// scheduleCadenceTouch — set the next_touch_date on a cadence card
// ---------------------------------------------------------------------------

export async function scheduleCadenceTouch(
  cardId: string,
  option: CadenceScheduleOption,
  customDate?: string
): Promise<VoidResult> {
  if (!hasSupabaseServiceRole()) {
    return { ok: false, error: "Supabase service role is not configured." };
  }

  const sb = createServiceRoleClient();
  const { data: card, error: readError } = await sb
    .from("cards")
    .select("id,body,linked_object_ids")
    .eq("id", cardId)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };
  if (!card) return { ok: false, error: "Card not found." };

  const prior = (card.body as Partial<CadenceCardBody> | null) ?? {};
  const newDueDate = dueDateFromOption(option, customDate);
  const nextBody: CadenceCardBody = {
    cadence_interval: (prior.cadence_interval as CadenceInterval) ?? "none",
    next_touch_date: newDueDate,
    notes: prior.notes ?? null,
    firm: prior.firm ?? null,
  };

  const { error } = await sb
    .from("cards")
    .update({ body: nextBody, state: "open" })
    .eq("id", cardId);

  if (error) return { ok: false, error: error.message };

  // Phase 1 dual-write: keep jasonos.contacts.next_touch_date in sync with
  // the card body so the unified queries in Phase 2 read consistent data.
  const linked = card.linked_object_ids as Record<string, unknown> | null;
  const contactId = typeof linked?.contact_id === "string" ? linked.contact_id : null;
  if (contactId) {
    await sb
      .from("contacts")
      .update({ next_touch_date: newDueDate })
      .eq("id", contactId);
  }

  revalidatePath("/communications");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// dismissCadenceContact — archive the cadence card
// ---------------------------------------------------------------------------

export async function dismissCadenceContact(cardId: string): Promise<VoidResult> {
  if (!hasSupabaseServiceRole()) {
    return { ok: false, error: "Supabase service role is not configured." };
  }
  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("cards")
    .update({ state: "archived" })
    .eq("id", cardId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/communications");
  return { ok: true };
}
