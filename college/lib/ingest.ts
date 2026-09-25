/** Ingest → suggested checklist steps. */

import { phases } from "@/lib/content";
import { isOwner, type Owner, type Phase } from "@/lib/types";

export type IngestRoute = "todo" | "note" | "calendar" | "drop";

export type SuggestedStep = {
  id: string;
  label: string;
  owner: Owner;
  parentId: string;
  dueDate: string | null;
  startDate: string | null;
  endDate: string | null;
  /** Where this row goes on confirm. Trash removes the row; Drop keeps it visible but discarded. */
  route: IngestRoute;
};

export type IngestSourceDraft = {
  id: string;
  title: string;
  kind: "paste" | "url" | "file";
  text: string;
  createdAt: string;
  assetUrl?: string | null;
  assetPath?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  /** Open Graph image when kind is url. */
  previewImageUrl?: string | null;
  /** Short page summary for Notes detail. */
  previewSummary?: string | null;
  previewSiteName?: string | null;
};

export type PersistedProjectStep = {
  id: string;
  label: string;
  owner: Owner;
  /** Who put this on the owner's list. Null for seed/system rows. */
  assignedBy: Owner | null;
  parentId: string;
  dueDate: string | null;
  startDate: string | null;
  endDate: string | null;
  sourceId: string | null;
  createdAt: string;
  assetUrl?: string | null;
};

export type PersistedIngestSource = {
  id: string;
  title: string;
  kind: "paste" | "url" | "file";
  excerpt: string;
  createdAt: string;
  stepCount: number;
  noteCount: number;
  calendarCount?: number;
  assetUrl?: string | null;
  assetPath?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
};

export const INBOX_PARENT_ID = "inbox";

export function checklistParents(phaseList: Phase[] = phases): {
  id: string;
  label: string;
  phase: string;
}[] {
  const rows: { id: string; label: string; phase: string }[] = [
    {
      id: INBOX_PARENT_ID,
      label: "Inbox — file under a runway item later",
      phase: "Inbox",
    },
  ];
  for (const phase of phaseList) {
    for (const item of phase.items) {
      rows.push({ id: item.id, label: item.text, phase: phase.phase });
    }
  }
  return rows;
}

function guessOwner(label: string): Owner {
  const lower = label.toLowerCase();
  if (/\bkyle\b/.test(lower) || /practice|register for|essays?|sat|act|psat|visit campus/.test(lower)) {
    return "kyle";
  }
  if (/\bkat\b/.test(lower) || /drive|pack|schedule|appointment|doctor|teacher/.test(lower)) {
    return "kat";
  }
  return "jason";
}

function guessParentId(label: string, phaseList: Phase[] = phases): string {
  const lower = label.toLowerCase();
  const scored = phaseList.flatMap((phase) =>
    phase.items.map((item) => {
      const hay = `${phase.phase} ${item.text}`.toLowerCase();
      let score = 0;
      for (const token of lower.split(/\W+/).filter((t) => t.length > 4)) {
        if (hay.includes(token)) score += 1;
      }
      return { id: item.id, score };
    }),
  );
  scored.sort((a, b) => b.score - a.score);
  return scored[0] && scored[0].score > 0 ? scored[0].id : INBOX_PARENT_ID;
}

const ACTION_VERB =
  /^(register|sign\s*up|schedule|book|complete|finish|submit|send|email|call|text|ask|follow\s*up|confirm|review|check|pay|download|upload|create|update|apply|practice|visit|meet|attend|order|buy|print|fill\s*out|log\s*in|login|open|start|set\s*up|prepare|draft|write|revise|request|remind|cancel|reschedule)\b/i;

const OBLIGATION =
  /\b(need(?:s)?\s+to|should|must|have\s+to|has\s+to|remember\s+to|don'?t\s+forget\s+to|make\s+sure\s+to|be\s+sure\s+to|action\s+item|to-?do)\b/i;

/** Greetings, headers, schedule lines, and other non-task text — never a to-do. */
export function isJunkTodoLabel(label: string): boolean {
  const text = label.replace(/^[\s>*•\-–—\d.)]+/, "").trim();
  if (text.length < 10 || text.length > 220) return true;
  if (/^(https?:\/\/|www\.)/i.test(text)) return true;
  if (/^(dear|hi\b|hello|hey|good\s+(morning|afternoon|evening)|regards|sincerely|thanks|thank you|best,|cheers,)/i.test(text)) {
    return true;
  }
  if (/^(step\s+\w+|part\s+\w+|phase\s+\w+|section\s+\w+|timeline|agenda|subject|from|to|cc|re:|fwd:)\b/i.test(text)) {
    return true;
  }
  if (/^[A-Z][A-Za-z0-9 /&+-]{2,60}:\s*$/.test(text)) return true;
  if (/^(mon|tue|wed|thu|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(text) && /:\s/.test(text)) {
    return true;
  }
  if (/^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?\b/.test(text)) return true;
  if (/^(this is (the )?link|here is (the )?link|please (see|find|note)|attached is|see below|as follows)\b/i.test(text)) {
    return true;
  }
  if (/^(students|parents|families|applicants|you will|one must)\b/i.test(text) && !OBLIGATION.test(text)) {
    return true;
  }
  return false;
}

/** Heuristic: line must look like a next action, not narration. */
export function isActionableTodoLabel(label: string): boolean {
  if (isJunkTodoLabel(label)) return false;
  const text = label.replace(/^[\s>*•\-–—\d.)]+/, "").trim();
  const stripped = text.replace(/^(please|kindly)\s+/i, "");
  if (ACTION_VERB.test(stripped)) return true;
  if (OBLIGATION.test(text)) return true;
  // "Kat can schedule…", "Ask Kyle to register…"
  if (
    /\b(can|will|to)\s+(register|sign\s*up|schedule|book|complete|finish|submit|send|email|call|pay|download|upload|apply|practice|visit|meet|attend|request|follow\s*up)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  return false;
}

/** Trim ingest line noise for a to-do label. */
export function normalizeTodoLabel(label: string): string {
  return label.replace(/^[\s>*•\-–—\d.)]+/, "").replace(/\s+/g, " ").trim();
}

/** Local fallback when the AI gateway is unavailable. */
export function heuristicSuggestions(text: string, phaseList: Phase[] = phases): SuggestedStep[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeTodoLabel(line))
    .filter((line) => isActionableTodoLabel(line));

  const unique: string[] = [];
  for (const line of lines) {
    if (unique.some((existing) => existing.toLowerCase() === line.toLowerCase())) continue;
    unique.push(line);
    if (unique.length >= 8) break;
  }

  return unique.map((label, index) => ({
    id: `draft-${index + 1}`,
    label,
    owner: guessOwner(label),
    parentId: guessParentId(label, phaseList),
    dueDate: null,
    startDate: null,
    endDate: null,
    route: "todo" as const,
  }));
}

function aiAvailable(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.VERCEL,
  );
}

const INGEST_TODO_SYSTEM = `You extract ONLY real to-dos from ingested text (email, notes, PDF, paste, URL) for a high-school college-admissions household (Jason parent/admin, Kat parent, Kyle student).

A to-do is a concrete next action someone on the household must do. Write each label as a short imperative sentence (e.g. "Register Kyle for AP exams on College Board by Oct 31").

INCLUDE when the source clearly asks for or implies work such as: register, sign up, schedule, pay, submit, email, call, complete a form, practice, visit, apply, follow up, confirm, request, upload, download.

EXCLUDE (do not return these at all — not even as notes):
- Greetings and sign-offs ("Dear AP Students and Parents,", "Thanks,")
- Section headers and step labels ("STEP TWO:", "AP Registration Timeline:")
- Pure schedule / fee lines that are not themselves an action ("Sep 17, 2026 08:00 AM: …", "LATE REGISTRATION FEE:")
- Link blurbs ("This is the link students can use…")
- Background narration ("Students log into the College Board website…") unless rewritten into an imperative to-do the household should perform
- Vague goals with no next step
- Duplicate or near-duplicate actions

Return ONLY a JSON array. Each object:
{ "label": string, "owner": "jason"|"kat"|"kyle", "parentId": string, "dueDate": "YYYY-MM-DD"|null, "startDate": "YYYY-MM-DD"|null, "endDate": "YYYY-MM-DD"|null }

Rules:
- Prefer fewer high-quality to-dos over many weak ones. Zero items is correct when the text has no real to-dos.
- Do not invent facts not implied by the source. Max 8 items.
- parentId must be from the parent list or "inbox".`;

function parseSuggestionJson(raw: string): SuggestedStep[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as Array<{
      label?: string;
      owner?: string;
      parentId?: string;
      dueDate?: string | null;
      startDate?: string | null;
      endDate?: string | null;
    }>;
    return parsed
      .filter((row) => typeof row.label === "string" && row.label.trim().length >= 8)
      .map((row) => ({ ...row, label: normalizeTodoLabel(row.label!) }))
      .filter((row) => !isJunkTodoLabel(row.label!))
      .slice(0, 8)
      .map((row, index) => ({
        id: `draft-${index + 1}`,
        label: row.label!,
        owner: row.owner && isOwner(row.owner) ? row.owner : guessOwner(row.label!),
        parentId:
          typeof row.parentId === "string" && row.parentId
            ? row.parentId
            : guessParentId(row.label!),
        dueDate: typeof row.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.dueDate) ? row.dueDate : null,
        startDate:
          typeof row.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.startDate)
            ? row.startDate
            : null,
        endDate:
          typeof row.endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.endDate) ? row.endDate : null,
        route: "todo" as const,
      }));
  } catch {
    return [];
  }
}

/** Append-ready block for Notes tab from ingest rows routed as notes. */
export function formatIngestNotesBlock(input: {
  title: string;
  createdAt: string;
  notes: string[];
}): string {
  const lines = input.notes.map((note) => note.trim()).filter(Boolean);
  if (!lines.length) return "";
  const when = new Date(input.createdAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const title = input.title.trim() || "Ingest";
  return [`From Ingest · ${title} · ${when}`, ...lines.map((line) => `• ${line}`)].join("\n");
}

export function appendIngestNotes(existing: string, block: string): string {
  const next = block.trim();
  if (!next) return existing;
  const current = existing.trim();
  return current ? `${current}\n\n${next}` : next;
}

export async function suggestStepsFromText(
  text: string,
  phaseList: Phase[] = phases,
): Promise<{ suggestions: SuggestedStep[]; method: "ai" | "heuristic" }> {
  const trimmed = text.trim();
  if (!trimmed) return { suggestions: [], method: "heuristic" };

  if (!aiAvailable()) {
    return { suggestions: heuristicSuggestions(trimmed, phaseList), method: "heuristic" };
  }

  try {
    const parents = checklistParents(phaseList)
      .slice(0, 40)
      .map((row) => `${row.id} | ${row.phase} | ${row.label}`)
      .join("\n");
    const { generateText } = await import("ai");
    const { gateway } = await import("@ai-sdk/gateway");
    const result = await generateText({
      model: gateway("anthropic/claude-sonnet-4-6"),
      system: INGEST_TODO_SYSTEM,
      prompt: `Parent checklist options:
${parents}

Source text (any ingest: email, paste, file, or URL extract):
${trimmed.slice(0, 12000)}`,
    });
    // Empty array is a valid answer — do not fall back to the line-splitting heuristic.
    return { suggestions: parseSuggestionJson(result.text), method: "ai" };
  } catch {
    // fall through
  }
  return { suggestions: heuristicSuggestions(trimmed, phaseList), method: "heuristic" };
}

export async function fetchUrlText(url: string): Promise<string> {
  const { fetchLinkPreview } = await import("@/lib/link-preview");
  const preview = await fetchLinkPreview(url);
  return preview.text;
}

export function normalizePersistedSteps(raw: unknown): PersistedProjectStep[] {
  if (!Array.isArray(raw)) return [];
  const out: PersistedProjectStep[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    if (typeof item.id !== "string" || typeof item.label !== "string") continue;
    if (typeof item.parentId !== "string") continue;
    const owner = typeof item.owner === "string" && isOwner(item.owner) ? item.owner : "jason";
    out.push({
      id: item.id,
      label: item.label,
      owner,
      assignedBy:
        typeof item.assignedBy === "string" && isOwner(item.assignedBy) ? item.assignedBy : null,
      parentId: item.parentId,
      dueDate: typeof item.dueDate === "string" ? item.dueDate : null,
      startDate: typeof item.startDate === "string" ? item.startDate : null,
      endDate: typeof item.endDate === "string" ? item.endDate : null,
      sourceId: typeof item.sourceId === "string" ? item.sourceId : null,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
      assetUrl: typeof item.assetUrl === "string" && item.assetUrl ? item.assetUrl : null,
    });
  }
  return out;
}

export function normalizeIngestSources(raw: unknown): PersistedIngestSource[] {
  if (!Array.isArray(raw)) return [];
  const out: PersistedIngestSource[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    if (!id) continue;
    const kind: PersistedIngestSource["kind"] =
      item.kind === "url" || item.kind === "file" ? item.kind : "paste";
    out.push({
      id,
      title: typeof item.title === "string" && item.title ? item.title : "Untitled",
      kind,
      excerpt: String(item.excerpt ?? "").slice(0, 280),
      createdAt:
        typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
      stepCount: Number(item.stepCount) || 0,
      noteCount: Number(item.noteCount) || 0,
      calendarCount: Number(item.calendarCount) || 0,
      assetUrl: typeof item.assetUrl === "string" && item.assetUrl ? item.assetUrl : null,
      assetPath: typeof item.assetPath === "string" && item.assetPath ? item.assetPath : null,
      mimeType: typeof item.mimeType === "string" && item.mimeType ? item.mimeType : null,
      fileName: typeof item.fileName === "string" && item.fileName ? item.fileName : null,
    });
  }
  return out;
}
