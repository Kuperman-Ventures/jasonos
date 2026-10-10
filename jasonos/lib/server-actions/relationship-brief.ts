"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/ai/models";
import { NO_AI_SLOP_WRITING_RULES } from "@/lib/ai/no-ai-slop";
import { loadStoredAboutJason } from "@/lib/outreach/about-jason-store";
import {
  fillBriefPrompt,
  mergeDoneCommitments,
  missingRequiredBriefVariables,
  resolveRelationshipBriefPrompt,
  type BriefSectionFlags,
} from "@/lib/outreach/relationship-brief";
import { loadRelationshipBriefPromptState } from "@/lib/outreach/relationship-brief-store";
import type {
  BriefCitedItem,
  BriefCommitment,
  BriefNextMove,
  BriefSourceRef,
  BriefStats,
  RelationshipBrief,
} from "@/lib/outreach/relationship-brief-types";
import { getMeetingsForContact } from "@/lib/server-actions/meetings";
import { NETWORK_ROLE_LABELS, type NetworkRole } from "@/lib/outreach/types";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

function hasConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseSource(raw: unknown): BriefSourceRef | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const type = rec.type;
  const id = typeof rec.id === "string" ? rec.id.trim() : "";
  const date = typeof rec.date === "string" ? rec.date.trim() : "";
  if (
    (type === "email" || type === "meeting" || type === "note" || type === "crm") &&
    id &&
    date
  ) {
    return { type, id, date };
  }
  return null;
}

function parseCited(raw: unknown): BriefCitedItem | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const text = typeof rec.text === "string" ? rec.text.trim() : "";
  const source = parseSource(rec.source);
  if (!text || !source) return null;
  return { text, source };
}

function parseCommitment(raw: unknown): BriefCommitment | null {
  const base = parseCited(raw);
  if (!base) return null;
  const rec = asRecord(raw);
  if (!rec) return null;
  const direction = rec.direction === "mine" ? "mine" : "theirs";
  const status =
    rec.status === "awaiting" ||
    rec.status === "open" ||
    rec.status === "overdue" ||
    rec.status === "done"
      ? rec.status
      : "open";
  const due = typeof rec.due === "string" ? rec.due : null;
  return { ...base, direction, status, due };
}

function parseNextMove(raw: unknown): BriefNextMove | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const text = typeof rec.text === "string" ? rec.text.trim() : "";
  if (!text) return null;
  const tone =
    rec.tone === "magenta" || rec.tone === "cyan" || rec.tone === "yellow"
      ? rec.tone
      : "yellow";
  const jump = rec.jump === "generate_intro" ? "generate_intro" : "log_touch";
  return { text: text.slice(0, 220), tone, jump };
}

function rowToBrief(
  contactId: string,
  row: Record<string, unknown>
): RelationshipBrief {
  const helped = Array.isArray(row.helped)
    ? row.helped.map(parseCited).filter((x): x is BriefCitedItem => Boolean(x))
    : [];
  const topics = Array.isArray(row.topics)
    ? row.topics.map(parseCited).filter((x): x is BriefCitedItem => Boolean(x))
    : [];
  const commitments = Array.isArray(row.commitments)
    ? row.commitments
        .map(parseCommitment)
        .filter((x): x is BriefCommitment => Boolean(x))
    : [];
  const remember = Array.isArray(row.remember)
    ? row.remember.map(parseCited).filter((x): x is BriefCitedItem => Boolean(x))
    : [];
  return {
    contactId,
    generatedAt: String(row.generated_at ?? ""),
    promptVersion: Number(row.prompt_version) || 0,
    sources: Array.isArray(row.sources)
      ? row.sources.filter((s): s is string => typeof s === "string")
      : [],
    summary: typeof row.summary === "string" ? row.summary : null,
    helped,
    topics,
    commitments,
    remember,
    nextMove: parseNextMove(row.next_move),
    stale: Boolean(row.stale),
  };
}

export async function getRelationshipBrief(
  contactId: string
): Promise<{
  brief: RelationshipBrief | null;
  stats: BriefStats;
  hasMaterial: boolean;
  promptVersion: number;
}> {
  const stats: BriefStats = {
    meetingsHeld: 0,
    introsOffered: 0,
    introsMade: 0,
    daysSinceLastTouch: null,
  };
  if (!hasConfig() || !contactId) {
    return { brief: null, stats, hasMaterial: false, promptVersion: 0 };
  }

  const [statsLive, briefRow, promptState, material] = await Promise.all([
    computeBriefStats(contactId),
    loadBriefRow(contactId),
    loadRelationshipBriefPromptState(),
    hasBriefMaterial(contactId),
  ]);
  return {
    brief: briefRow,
    stats: statsLive,
    hasMaterial: material,
    promptVersion: promptState.version,
  };
}

async function hasBriefMaterial(contactId: string): Promise<boolean> {
  const sb = createServiceRoleClient();
  const [{ count: touchCount }, { count: meetingCount }] = await Promise.all([
    sb
      .from("contact_touches")
      .select("id", { count: "exact", head: true })
      .eq("contact_id", contactId),
    sb
      .from("meetings")
      .select("id", { count: "exact", head: true })
      .eq("contact_id", contactId),
  ]);
  return (touchCount ?? 0) > 0 || (meetingCount ?? 0) > 0;
}

async function loadBriefRow(
  contactId: string
): Promise<RelationshipBrief | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("contact_relationship_briefs")
    .select("*")
    .eq("contact_id", contactId)
    .maybeSingle();
  if (error) {
    console.error("[relationship-brief] load", error.message);
    return null;
  }
  if (!data) return null;
  return rowToBrief(contactId, data as Record<string, unknown>);
}

async function computeBriefStats(contactId: string): Promise<BriefStats> {
  const sb = createServiceRoleClient();
  const meetings = await getMeetingsForContact(contactId);
  const held = meetings.filter((m) => m.status === "held");
  let introsOffered = 0;
  let introsMade = 0;
  for (const meeting of meetings) {
    for (const wish of meeting.introWishlist) {
      if (wish.name || wish.linkedinUrl) introsOffered += 1;
      if (wish.introMade) introsMade += 1;
    }
  }
  const { data: lastTouch } = await sb
    .from("contact_touches")
    .select("touched_at")
    .eq("contact_id", contactId)
    .order("touched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let daysSinceLastTouch: number | null = null;
  const touchedAt = (lastTouch as { touched_at?: string } | null)?.touched_at;
  if (touchedAt) {
    const then = Date.parse(touchedAt);
    if (Number.isFinite(then)) {
      daysSinceLastTouch = Math.max(
        0,
        Math.round((Date.now() - then) / 86_400_000)
      );
    }
  }
  return {
    meetingsHeld: held.length,
    introsOffered,
    introsMade,
    daysSinceLastTouch,
  };
}

export async function markRelationshipBriefStale(
  contactId: string
): Promise<void> {
  if (!hasConfig() || !contactId) return;
  const sb = createServiceRoleClient();
  await sb
    .from("contact_relationship_briefs")
    .update({ stale: true, updated_at: new Date().toISOString() })
    .eq("contact_id", contactId);
}

export async function markBriefCommitmentDone(input: {
  contactId: string;
  text: string;
}): Promise<Result<{ brief: RelationshipBrief }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured." };
  const brief = await loadBriefRow(input.contactId);
  if (!brief) return { ok: false, error: "No brief to update." };
  const next = brief.commitments.map((item) =>
    item.text.trim() === input.text.trim()
      ? { ...item, status: "done" as const }
      : item
  );
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("contact_relationship_briefs")
    .update({
      commitments: next,
      updated_at: new Date().toISOString(),
    })
    .eq("contact_id", input.contactId)
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save." };
  }
  return {
    ok: true,
    brief: rowToBrief(input.contactId, data as Record<string, unknown>),
  };
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    return asRecord(parsed);
  } catch {
    return null;
  }
}

function assembleBriefFromModel(
  contactId: string,
  promptVersion: number,
  sources: string[],
  sections: BriefSectionFlags,
  raw: Record<string, unknown>
): RelationshipBrief {
  return {
    contactId,
    generatedAt: new Date().toISOString(),
    promptVersion,
    sources,
    summary: sections.summary
      ? typeof raw.summary === "string"
        ? raw.summary.trim() || null
        : null
      : null,
    helped: sections.helped
      ? Array.isArray(raw.helped)
        ? raw.helped.map(parseCited).filter((x): x is BriefCitedItem => Boolean(x))
        : []
      : [],
    topics: sections.topics
      ? Array.isArray(raw.topics)
        ? raw.topics.map(parseCited).filter((x): x is BriefCitedItem => Boolean(x))
        : []
      : [],
    commitments: sections.commitments
      ? Array.isArray(raw.commitments)
        ? raw.commitments
            .map(parseCommitment)
            .filter((x): x is BriefCommitment => Boolean(x))
        : []
      : [],
    remember: sections.remember
      ? Array.isArray(raw.remember)
        ? raw.remember
            .map(parseCited)
            .filter((x): x is BriefCitedItem => Boolean(x))
        : []
      : [],
    nextMove: sections.next_move ? parseNextMove(raw.next_move) : null,
    stale: false,
  };
}

export async function generateRelationshipBrief(input: {
  contactId: string;
  promptOverride?: string | null;
  persist?: boolean;
}): Promise<Result<{ brief: RelationshipBrief; stats: BriefStats }>> {
  if (!hasConfig()) return { ok: false, error: "Not configured." };
  const contactId = input.contactId;
  if (!contactId) return { ok: false, error: "Need a contact." };

  const sb = createServiceRoleClient();
  const { data: contact, error: contactErr } = await sb
    .from("contacts")
    .select("id,name,emails,company_id,network_role,last_touch_date,referred_by_contact_id")
    .eq("id", contactId)
    .maybeSingle();
  if (contactErr || !contact) {
    return { ok: false, error: contactErr?.message ?? "Contact not found." };
  }

  const [meetings, touchesRes, referredByRes, introsRes, aboutJason, promptState, companyRes] =
    await Promise.all([
      getMeetingsForContact(contactId),
      sb
        .from("contact_touches")
        .select("id,channel,direction,touched_at,brief,outcome")
        .eq("contact_id", contactId)
        .order("touched_at", { ascending: false })
        .limit(40),
      (async () => {
        const referrerId = (contact as { referred_by_contact_id?: string | null })
          .referred_by_contact_id;
        if (!referrerId) return null;
        const { data } = await sb
          .from("contacts")
          .select("id,name")
          .eq("id", referrerId)
          .maybeSingle();
        return data as { id: string; name: string } | null;
      })(),
      sb
        .from("contacts")
        .select("id,name")
        .eq("referred_by_contact_id", contactId)
        .order("created_at", { ascending: false }),
      loadStoredAboutJason(),
      loadRelationshipBriefPromptState(),
      (async () => {
        const companyId = (contact as { company_id?: string | null }).company_id;
        if (!companyId) return null;
        const { data } = await sb
          .from("companies")
          .select("name")
          .eq("id", companyId)
          .maybeSingle();
        return (data as { name?: string } | null)?.name ?? null;
      })(),
    ]);

  const touches = (touchesRes.data ?? []) as {
    id: string;
    channel: string;
    direction: string;
    touched_at: string;
    brief: string | null;
    outcome: string | null;
  }[];

  const knownIds = new Set<string>();
  const emailLines: string[] = [];
  for (const t of touches) {
    knownIds.add(t.id);
    const day = t.touched_at.slice(0, 10);
    emailLines.push(
      `[${t.id} ${day} ${t.channel} ${t.direction}] ${t.brief ?? ""} ${t.outcome ?? ""}`.trim()
    );
  }
  const meetingLines: string[] = [];
  for (const m of meetings) {
    knownIds.add(m.id);
    const day = m.scheduledAt.slice(0, 10);
    const intros = m.introWishlist
      .map((w) => `${w.name}${w.introMade ? " (intro made)" : ""}`)
      .filter(Boolean)
      .join("; ");
    meetingLines.push(
      `[${m.id} ${day} ${m.status} ${m.channel}] ${m.title ?? "Meeting"} notes: ${m.debriefNotes ?? m.prepNotes ?? ""} intros: ${intros}`
    );
  }

  const hasMaterial = emailLines.length > 0 || meetingLines.length > 0;
  if (!hasMaterial) {
    return {
      ok: false,
      error:
        "Needs at least one email or meeting. Load latest context on Engage first.",
    };
  }

  const role = (contact as { network_role?: NetworkRole | null }).network_role;
  const vars = {
    contact_name: String((contact as { name?: string }).name ?? ""),
    company: companyRes ?? "",
    role_in_search: role ? NETWORK_ROLE_LABELS[role] : "",
    emails: emailLines.join("\n") || "(none)",
    meetings: meetingLines.join("\n") || "(none)",
    referrals: [
      referredByRes ? `Referred by ${referredByRes.name}` : "",
      (introsRes.data ?? []).length
        ? `Introduced Jason to ${(introsRes.data as { name: string }[]).map((r) => r.name).join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join(". ") || "(none)",
    commitments: "(from meetings and emails above)",
    about_jason: aboutJason || "(none)",
    today: new Date().toISOString().slice(0, 10),
  };

  const template = resolveRelationshipBriefPrompt(
    input.promptOverride?.trim()
      ? input.promptOverride
      : promptState.stored
  );
  const missing = missingRequiredBriefVariables(template);
  const filled = fillBriefPrompt(template, vars);
  const sections = promptState.sections;

  const schemaHint = `Return strict JSON only:
{
  "summary": "string, max 3 sentences",
  "helped": [{"text":"...","source":{"type":"email|meeting|note|crm","id":"id from brackets","date":"YYYY-MM-DD"}}],
  "topics": [...same...],
  "commitments": [{"text":"...","source":{...},"direction":"theirs|mine","status":"awaiting|open|overdue|done","due":"YYYY-MM-DD or null"}],
  "remember": [...same as helped...],
  "next_move": {"text":"max two lines","tone":"yellow|cyan|magenta","jump":"log_touch|generate_intro"}
}
Use only ids from the material. Drop any item without a valid source id. Omit empty arrays. ${missing.length ? `Prompt is missing ${missing.join(", ")}.` : ""}
Sections to fill: ${Object.entries(sections)
    .filter(([, on]) => on)
    .map(([k]) => k)
    .join(", ")}.`;

  const runModel = async () =>
    callClaude({
      model: "claude-sonnet-4-6",
      maxTokens: 2500,
      system: `You write Jason's relationship briefs. ${NO_AI_SLOP_WRITING_RULES}\n${schemaHint}`,
      messages: [{ role: "user", content: filled }],
    });

  let parsed = extractJsonObject(await runModel());
  if (!parsed) {
    parsed = extractJsonObject(await runModel());
  }
  if (!parsed) {
    return { ok: false, error: "Brief failed. The model did not return valid JSON." };
  }

  const filtered = assembleBriefFromModel(
    contactId,
    promptState.version,
    [
      emailLines.length ? "email" : "",
      meetingLines.length ? "meetings" : "",
      aboutJason ? "about Jason" : "",
    ].filter(Boolean),
    sections,
    parsed
  );

  const dropUnknown = <T extends BriefCitedItem>(items: T[]) =>
    items.filter((item) => knownIds.has(item.source.id));
  filtered.helped = dropUnknown(filtered.helped);
  filtered.topics = dropUnknown(filtered.topics);
  filtered.commitments = dropUnknown(filtered.commitments);
  filtered.remember = dropUnknown(filtered.remember);

  const previous = await loadBriefRow(contactId);
  filtered.commitments = mergeDoneCommitments(
    filtered.commitments,
    previous?.commitments
  );

  const stats = await computeBriefStats(contactId);
  if (input.persist === false) {
    return { ok: true, brief: filtered, stats };
  }

  const { data, error } = await sb
    .from("contact_relationship_briefs")
    .upsert(
      {
        contact_id: contactId,
        generated_at: filtered.generatedAt,
        prompt_version: filtered.promptVersion,
        sources: filtered.sources,
        summary: filtered.summary,
        helped: filtered.helped,
        topics: filtered.topics,
        commitments: filtered.commitments,
        remember: filtered.remember,
        next_move: filtered.nextMove,
        stale: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "contact_id" }
    )
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save the brief." };
  }
  return {
    ok: true,
    brief: rowToBrief(contactId, data as Record<string, unknown>),
    stats,
  };
}
