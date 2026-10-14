"use server";

import { z } from "zod";
import { libraryBodyHash } from "@/lib/library/hash";
import {
  defaultLibraryTitle,
  isLibraryYmd,
  storedLibraryBody,
  todayYmd,
  type LibraryChannel,
} from "@/lib/library/text";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type { LibraryChannel };

export type LibraryContact = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
};

export type LibraryItem = {
  id: string;
  title: string;
  body: string;
  channel: LibraryChannel;
  subject: string | null;
  kind: string | null;
  company: string | null;
  contacts: LibraryContact[];
  sentOn: string;
  copyCount: number;
  lastCopiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LibraryKind = {
  id: string;
  name: string;
};

export type LibraryItemInput = {
  title?: string;
  body: string;
  channel: LibraryChannel;
  subject?: string | null;
  kind?: string | null;
  company?: string | null;
  contactIds?: string[];
  sentOn?: string;
};

type ActionError = { ok: false; error: string };

function ensureConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function firmFromTags(tags: string[]): string | null {
  const tag = tags.find((entry) => entry.startsWith("firm:"));
  if (!tag) return null;
  return tag.slice("firm:".length).replace(/-/g, " ");
}

function embeddedCompanyName(value: unknown): string | null {
  const company = value as { name?: string } | { name?: string }[] | null;
  const name = Array.isArray(company) ? company[0]?.name : company?.name;
  const trimmed = name?.trim();
  return trimmed ? trimmed : null;
}

function contactCompany(row: { companies?: unknown; tags?: unknown }): string | null {
  return (
    embeddedCompanyName(row.companies) ??
    firmFromTags((row.tags as string[] | null) ?? [])
  );
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

const inputSchema = z.object({
  title: z.string().optional(),
  body: z.string(),
  channel: z.enum(["email", "linkedin", "text"]),
  subject: z.string().nullable().optional(),
  kind: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  contactIds: z.array(z.string().uuid()).optional(),
  sentOn: z.string().optional(),
});

type Db = ReturnType<typeof createServiceRoleClient>;

type ItemRow = {
  id: string;
  title: string;
  body: string;
  channel: LibraryChannel;
  subject: string | null;
  kind: string | null;
  company: string | null;
  contact_ids: string[] | null;
  sent_on: string;
  copy_count: number;
  last_copied_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapItem(row: ItemRow, contacts: Map<string, LibraryContact>): LibraryItem {
  const ids = Array.isArray(row.contact_ids) ? row.contact_ids : [];
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    channel: row.channel,
    subject: row.subject,
    kind: row.kind,
    company: row.company,
    contacts: ids.flatMap((id) => {
      const contact = contacts.get(id);
      return contact ? [contact] : [];
    }),
    sentOn: row.sent_on,
    copyCount: row.copy_count ?? 0,
    lastCopiedAt: row.last_copied_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadContacts(sb: Db, ids: string[]): Promise<Map<string, LibraryContact>> {
  const unique = [...new Set(ids)];
  const map = new Map<string, LibraryContact>();
  if (unique.length === 0) return map;
  const { data, error } = await sb
    .from("contacts")
    .select("id,name,emails,tags,company_id,companies(name)")
    .in("id", unique);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const emails = (row.emails as string[] | null) ?? [];
    map.set(row.id as string, {
      id: row.id as string,
      name: (row.name as string) || "Unknown",
      email: emails[0]?.trim() || null,
      company: contactCompany(row),
    });
  }
  return map;
}

async function resolveKind(sb: Db, kind: string | null): Promise<string | null | ActionError> {
  if (!kind) return null;
  const { data, error } = await sb.from("library_kinds").select("name");
  if (error) return { ok: false, error: error.message };
  const match = (data ?? []).find(
    (row) => (row.name as string).toLowerCase() === kind.toLowerCase()
  );
  if (!match) return { ok: false, error: "Pick a saved kind, or add it first." };
  return match.name as string;
}

function dedupeCompanies(values: Array<string | null | undefined>): string[] {
  const byKey = new Map<string, string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, trimmed);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export async function listLibraryItems(): Promise<
  { ok: true; items: LibraryItem[] } | ActionError
> {
  if (!ensureConfigured()) return { ok: false, error: "Not configured." };
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("library_items")
      .select(
        "id,title,body,channel,subject,kind,company,contact_ids,sent_on,copy_count,last_copied_at,created_at,updated_at"
      )
      .order("sent_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message };
    const rows = (data ?? []) as ItemRow[];
    const contacts = await loadContacts(
      sb,
      rows.flatMap((row) => row.contact_ids ?? [])
    );
    return { ok: true, items: rows.map((row) => mapItem(row, contacts)) };
  } catch (err) {
    console.error("[library.list]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't load the library." };
  }
}

export async function listLibraryKinds(): Promise<
  { ok: true; kinds: LibraryKind[] } | ActionError
> {
  if (!ensureConfigured()) return { ok: false, error: "Not configured." };
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("library_kinds")
      .select("id,name")
      .order("name", { ascending: true });
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      kinds: (data ?? []).map((row) => ({ id: row.id as string, name: row.name as string })),
    };
  } catch (err) {
    console.error("[library.kinds]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't load kinds." };
  }
}

export async function listLibraryCompanies(): Promise<
  { ok: true; companies: string[] } | ActionError
> {
  if (!ensureConfigured()) return { ok: false, error: "Not configured." };
  try {
    const sb = createServiceRoleClient();
    const [items, companies] = await Promise.all([
      sb.from("library_items").select("company"),
      sb.from("companies").select("name"),
    ]);
    if (items.error) return { ok: false, error: items.error.message };
    if (companies.error) return { ok: false, error: companies.error.message };
    return {
      ok: true,
      companies: dedupeCompanies([
        ...(items.data ?? []).map((row) => row.company as string | null),
        ...(companies.data ?? []).map((row) => row.name as string | null),
      ]),
    };
  } catch (err) {
    console.error("[library.companies]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't load companies." };
  }
}

async function writeItem(
  sb: Db,
  id: string | null,
  raw: LibraryItemInput
): Promise<{ ok: true; item: LibraryItem } | ActionError> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const input = parsed.data;
  const body = storedLibraryBody(input.body);
  if (!body.trim()) return { ok: false, error: "Paste the message before saving." };
  const sentOn = input.sentOn?.trim() || todayYmd();
  if (!isLibraryYmd(sentOn)) return { ok: false, error: "Sent on needs a real date." };

  const kindResult = await resolveKind(sb, blankToNull(input.kind));
  if (kindResult && typeof kindResult === "object" && "ok" in kindResult) return kindResult;

  const requested = [...new Set(input.contactIds ?? [])];
  const contacts = await loadContacts(sb, requested);
  const contactIds = requested.filter((contactId) => contacts.has(contactId));
  const title = blankToNull(input.title) ?? defaultLibraryTitle(body);
  const payload = {
    title,
    body,
    channel: input.channel,
    subject: input.channel === "email" ? blankToNull(input.subject) : null,
    kind: kindResult,
    company: blankToNull(input.company),
    contact_ids: contactIds,
    sent_on: sentOn,
    body_hash: libraryBodyHash(body),
  };

  const query = id
    ? sb.from("library_items").update(payload).eq("id", id)
    : sb.from("library_items").insert(payload);
  const { data, error } = await query
    .select(
      "id,title,body,channel,subject,kind,company,contact_ids,sent_on,copy_count,last_copied_at,created_at,updated_at"
    )
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, item: mapItem(data as ItemRow, contacts) };
}

export async function createLibraryItem(
  input: LibraryItemInput
): Promise<{ ok: true; item: LibraryItem } | ActionError> {
  if (!ensureConfigured()) return { ok: false, error: "Not configured." };
  try {
    return await writeItem(createServiceRoleClient(), null, input);
  } catch (err) {
    console.error("[library.create]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Save failed." };
  }
}

export async function updateLibraryItem(
  id: string,
  input: LibraryItemInput
): Promise<{ ok: true; item: LibraryItem } | ActionError> {
  if (!ensureConfigured()) return { ok: false, error: "Not configured." };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Missing message." };
  try {
    return await writeItem(createServiceRoleClient(), id, input);
  } catch (err) {
    console.error("[library.update]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Save failed." };
  }
}

export async function deleteLibraryItem(
  id: string
): Promise<{ ok: true } | ActionError> {
  if (!ensureConfigured()) return { ok: false, error: "Not configured." };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Missing message." };
  try {
    const sb = createServiceRoleClient();
    const { error } = await sb.from("library_items").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    console.error("[library.delete]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Delete failed." };
  }
}

export async function recordLibraryCopy(
  id: string
): Promise<{ ok: true; copyCount: number; lastCopiedAt: string } | ActionError> {
  if (!ensureConfigured()) return { ok: false, error: "Not configured." };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Missing message." };
  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("library_items")
      .select("copy_count")
      .eq("id", id)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Message not found." };
    const lastCopiedAt = new Date().toISOString();
    const copyCount = ((data.copy_count as number | null) ?? 0) + 1;
    const { error: updateError } = await sb
      .from("library_items")
      .update({ copy_count: copyCount, last_copied_at: lastCopiedAt })
      .eq("id", id);
    if (updateError) return { ok: false, error: updateError.message };
    return { ok: true, copyCount, lastCopiedAt };
  } catch (err) {
    console.error("[library.copy]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't record the copy." };
  }
}

export async function findDuplicateLibraryItem(
  body: string,
  excludeId?: string
): Promise<{ ok: true; duplicate: { id: string; title: string } | null } | ActionError> {
  if (!ensureConfigured()) return { ok: false, error: "Not configured." };
  try {
    const sb = createServiceRoleClient();
    let query = sb
      .from("library_items")
      .select("id,title")
      .eq("body_hash", libraryBodyHash(body))
      .order("sent_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);
    if (excludeId && z.string().uuid().safeParse(excludeId).success) {
      query = query.neq("id", excludeId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: true, duplicate: null };
    return { ok: true, duplicate: { id: data.id as string, title: data.title as string } };
  } catch (err) {
    console.error("[library.duplicate]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't check for a duplicate." };
  }
}

export async function addLibraryKind(
  name: string
): Promise<{ ok: true; kind: LibraryKind; kinds: LibraryKind[] } | ActionError> {
  if (!ensureConfigured()) return { ok: false, error: "Not configured." };
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return { ok: false, error: "Name the kind." };
  try {
    const sb = createServiceRoleClient();
    const existing = await listLibraryKinds();
    if (!existing.ok) return existing;
    const match = existing.kinds.find((kind) => kind.name.toLowerCase() === trimmed.toLowerCase());
    if (match) return { ok: true, kind: match, kinds: existing.kinds };
    const { data, error } = await sb
      .from("library_kinds")
      .insert({ name: trimmed })
      .select("id,name")
      .single();
    if (error) {
      if (error.code === "23505") {
        const again = await listLibraryKinds();
        if (!again.ok) return again;
        const raced = again.kinds.find((kind) => kind.name.toLowerCase() === trimmed.toLowerCase());
        if (raced) return { ok: true, kind: raced, kinds: again.kinds };
      }
      return { ok: false, error: error.message };
    }
    const kind = { id: data.id as string, name: data.name as string };
    const kinds = [...existing.kinds, kind].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    return { ok: true, kind, kinds };
  } catch (err) {
    console.error("[library.addKind]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't add that kind." };
  }
}
