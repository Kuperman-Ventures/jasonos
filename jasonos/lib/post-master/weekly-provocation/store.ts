import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  isProvocationSender,
  normalizeRfc822,
} from "@/lib/post-master/weekly-provocation/match";
import type {
  ProvocationCandidate,
  ProvocationQuestion,
  ProvocationSource,
  WeeklyProvocationListItem,
  WeeklyProvocationSourceName,
  WeeklyProvocationStatus,
} from "@/lib/post-master/weekly-provocation/types";

const BODY_CAP = 40_000;

type Row = {
  id: string;
  source: WeeklyProvocationSourceName;
  account_email: string;
  external_id: string;
  thread_id: string | null;
  rfc822_message_id: string | null;
  from_name: string;
  from_email: string;
  subject: string;
  received_at: string | null;
  thread_url: string | null;
  body_text: string;
  tldr: string | null;
  questions: unknown;
  status: WeeklyProvocationStatus;
  error: string | null;
  updated_at: string;
};

function asStatus(value: unknown): WeeklyProvocationStatus {
  if (
    value === "detected" ||
    value === "researching" ||
    value === "ready" ||
    value === "failed"
  ) {
    return value;
  }
  return "detected";
}

function asSources(value: unknown): ProvocationSource[] {
  if (!Array.isArray(value)) return [];
  const out: ProvocationSource[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const url = (item as { url?: unknown }).url;
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) continue;
    const title = (item as { title?: unknown }).title;
    out.push({
      title: typeof title === "string" && title.trim() ? title.trim() : null,
      url: url.trim(),
    });
  }
  return out;
}

export function asQuestions(value: unknown): ProvocationQuestion[] {
  if (!Array.isArray(value)) return [];
  const out: ProvocationQuestion[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const prompt = (item as { prompt?: unknown }).prompt;
    if (typeof prompt !== "string" || !prompt.trim()) continue;
    const id = (item as { id?: unknown }).id;
    const background = (item as { background?: unknown }).background;
    out.push({
      id: typeof id === "string" && id.trim() ? id.trim() : `q${out.length + 1}`,
      prompt: prompt.trim(),
      background: typeof background === "string" ? background.trim() : "",
      sources: asSources((item as { sources?: unknown }).sources),
    });
  }
  return out;
}

function toListItem(row: Row): WeeklyProvocationListItem {
  return {
    id: row.id,
    source: row.source,
    fromName: row.from_name,
    fromEmail: row.from_email,
    subject: row.subject,
    receivedAt: row.received_at,
    threadUrl: row.thread_url,
    tldr: row.tldr,
    questions: asQuestions(row.questions),
    status: asStatus(row.status),
    error: row.error,
    updatedAt: row.updated_at,
  };
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

export async function listWeeklyProvocationRows(): Promise<WeeklyProvocationListItem[]> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("weekly_provocations")
    .select(
      "id, source, from_name, from_email, subject, received_at, thread_url, tldr, questions, status, error, updated_at"
    )
    .order("received_at", { ascending: false, nullsFirst: false })
    .limit(40);
  if (error) {
    console.error("[weekly-provocation.list]", error);
    return [];
  }
  return ((data ?? []) as Row[]).map(toListItem);
}

export async function loadWeeklyProvocation(id: string): Promise<Row | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("weekly_provocations")
    .select(
      "id, source, account_email, external_id, thread_id, rfc822_message_id, from_name, from_email, subject, received_at, thread_url, body_text, tldr, questions, status, error, updated_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[weekly-provocation.load]", error);
    return null;
  }
  return (data as Row | null) ?? null;
}

export async function loadExtraProvocationEmails(): Promise<string[]> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("contacts")
    .select("name, emails")
    .or("name.ilike.%rover%,name.ilike.%duffy%");
  if (error) {
    console.error("[weekly-provocation.senders]", error);
    return [];
  }
  const emails: string[] = [];
  for (const row of data ?? []) {
    const name = typeof row.name === "string" ? row.name : "";
    const list = Array.isArray(row.emails) ? row.emails : [];
    const header = list[0] ? `${name} <${list[0]}>` : name;
    if (!isProvocationSender(header)) continue;
    for (const email of list) {
      if (typeof email === "string" && email.includes("@")) emails.push(email);
    }
  }
  return emails;
}

export async function insertProvocationIfNew(
  candidate: ProvocationCandidate
): Promise<"inserted" | "duplicate"> {
  const sb = createServiceRoleClient();
  const rfc822 = normalizeRfc822(candidate.rfc822MessageId);
  const accountEmail = candidate.accountEmail.trim().toLowerCase();
  const externalId = candidate.externalId.trim();
  if (!externalId) return "duplicate";

  const { data: existing, error: existingError } = await sb
    .from("weekly_provocations")
    .select("id")
    .eq("source", candidate.source)
    .eq("account_email", accountEmail)
    .eq("external_id", externalId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return "duplicate";

  if (rfc822) {
    const { data: byRfc, error: rfcError } = await sb
      .from("weekly_provocations")
      .select("id")
      .eq("rfc822_message_id", rfc822)
      .maybeSingle();
    if (rfcError) throw new Error(rfcError.message);
    if (byRfc) return "duplicate";
  }

  const { error } = await sb.from("weekly_provocations").insert({
    source: candidate.source,
    account_email: accountEmail,
    external_id: externalId,
    thread_id: candidate.threadId,
    rfc822_message_id: rfc822,
    from_name: candidate.fromName.slice(0, 200),
    from_email: candidate.fromEmail.slice(0, 320),
    subject: candidate.subject.slice(0, 500),
    received_at: candidate.receivedAt,
    thread_url: candidate.threadUrl,
    body_text: candidate.bodyText.slice(0, BODY_CAP),
    status: "detected",
  });
  if (error) {
    if (isUniqueViolation(error)) return "duplicate";
    throw new Error(error.message);
  }
  return "inserted";
}

const RESEARCH_LOCK_MS = 12 * 60 * 1000;

export async function claimWeeklyProvocation(
  id: string,
  force: boolean
): Promise<"claimed" | "busy" | "missing" | "ready"> {
  const row = await loadWeeklyProvocation(id);
  if (!row) return "missing";
  if (!force && row.status === "ready") return "ready";
  if (!force && row.status === "researching") {
    const age = Date.now() - new Date(row.updated_at).getTime();
    if (Number.isFinite(age) && age < RESEARCH_LOCK_MS) return "busy";
  }
  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("weekly_provocations")
    .update({
      status: "researching",
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return "claimed";
}

export async function saveWeeklyProvocationProgress(input: {
  id: string;
  tldr?: string | null;
  questions?: ProvocationQuestion[];
  status?: WeeklyProvocationStatus;
  error?: string | null;
  researchedAt?: string | null;
}): Promise<void> {
  const sb = createServiceRoleClient();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.tldr !== undefined) patch.tldr = input.tldr;
  if (input.questions !== undefined) patch.questions = input.questions;
  if (input.status !== undefined) patch.status = input.status;
  if (input.error !== undefined) patch.error = input.error;
  if (input.researchedAt !== undefined) patch.researched_at = input.researchedAt;
  const { error } = await sb.from("weekly_provocations").update(patch).eq("id", input.id);
  if (error) throw new Error(error.message);
}

export async function listDetectedProvocationIds(limit: number): Promise<string[]> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("weekly_provocations")
    .select("id")
    .eq("status", "detected")
    .order("received_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id as string);
}

export function rowToListItem(row: Row): WeeklyProvocationListItem {
  return toListItem(row);
}
