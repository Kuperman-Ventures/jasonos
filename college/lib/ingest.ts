/** Ingest → suggested checklist steps. */

import { phases } from "@/lib/content";
import { isOwner, type Owner, type Phase } from "@/lib/types";

export type IngestRoute = "todo" | "note" | "calendar" | "drop";

/** Hand a note (or other text) into Ingest at the Jobs step. */
export type IngestHandoff = {
  id: string;
  title: string;
  text: string;
  /** Which jobs start on. Note defaults off — the source is already a note. */
  jobs: { note: boolean; todo: boolean; cal: boolean };
  /** Optional link back to the pin that started this. */
  fromNoteId?: string;
};

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
  /** Model extraction extras (optional for legacy heuristic rows). */
  details?: string | null;
  category?: string | null;
  school?: string | null;
  dueDateBasis?: "explicit" | "inferred" | null;
  conditionalOn?: string | null;
  updatesExisting?: string | null;
  evidence?: string | null;
  confidence?: number | null;
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
  /** School this to-do was sent from (Project Management Notes). */
  schoolId?: string | null;
  /** Back-link to the school project note that created this to-do. */
  sourceNoteId?: string | null;
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
  context?: {
    sourceFilename?: string;
    sourceType?: "paste" | "url" | "file" | "pdf" | "word" | "image";
    schoolNames?: string[];
    openTodos?: { title: string; school: string | null; dueDate: string | null }[];
  },
): Promise<{
  suggestions: SuggestedStep[];
  method: "ai";
  documentSummary: string;
  error?: string;
}> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { suggestions: [], method: "ai", documentSummary: "Empty document." };
  }

  const { extractTodosFromText } = await import("@/lib/extract-todos");
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const result = await extractTodosFromText(trimmed, {
    today: todayIso,
    sourceFilename: context?.sourceFilename ?? "",
    sourceType: context?.sourceType ?? "paste",
    schoolNames: context?.schoolNames ?? [],
    openTodos: context?.openTodos ?? [],
  });

  if (!result.ok) {
    return {
      suggestions: [],
      method: "ai",
      documentSummary: "",
      error: result.error,
    };
  }

  const suggestions: SuggestedStep[] = result.todos.map((todo, index) => ({
    id: `draft-${index + 1}`,
    label: todo.title,
    owner: guessOwner(`${todo.title} ${todo.details}`),
    parentId: guessParentId(`${todo.title} ${todo.details} ${todo.school ?? ""}`, phaseList),
    dueDate: todo.due_date,
    startDate: null,
    endDate: null,
    route: "todo" as const,
    details: todo.details,
    category: todo.category,
    school: todo.school,
    dueDateBasis: todo.due_date_basis,
    conditionalOn: todo.conditional_on,
    updatesExisting: todo.updates_existing,
    evidence: todo.evidence,
    confidence: todo.confidence,
  }));

  return {
    suggestions,
    method: "ai",
    documentSummary: result.documentSummary,
  };
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
      schoolId: typeof item.schoolId === "string" && item.schoolId ? item.schoolId : null,
      sourceNoteId:
        typeof item.sourceNoteId === "string" && item.sourceNoteId ? item.sourceNoteId : null,
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
