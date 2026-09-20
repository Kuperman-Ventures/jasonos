/** Ingest → suggested checklist steps. */

import { phases } from "@/lib/content";
import { isOwner, type Owner, type Phase } from "@/lib/types";

export type IngestRoute = "todo" | "note" | "drop";

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
};

export type PersistedProjectStep = {
  id: string;
  label: string;
  owner: Owner;
  parentId: string;
  dueDate: string | null;
  startDate: string | null;
  endDate: string | null;
  sourceId: string | null;
  createdAt: string;
};

export type PersistedIngestSource = {
  id: string;
  title: string;
  kind: "paste" | "url" | "file";
  excerpt: string;
  createdAt: string;
  stepCount: number;
  noteCount: number;
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

/** Local fallback when the AI gateway is unavailable. */
export function heuristicSuggestions(text: string, phaseList: Phase[] = phases): SuggestedStep[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s>*•\-–—\d.)]+/, "").trim())
    .filter((line) => line.length >= 12 && line.length <= 220)
    .filter((line) => !/^(http|https|www\.)/i.test(line));

  const unique: string[] = [];
  for (const line of lines) {
    if (unique.some((existing) => existing.toLowerCase() === line.toLowerCase())) continue;
    unique.push(line);
    if (unique.length >= 12) break;
  }

  return unique.map((label, index) => ({
    id: `draft-${index + 1}`,
    label,
    owner: guessOwner(label),
    parentId: guessParentId(label, phaseList),
    dueDate: null,
    startDate: null,
    endDate: null,
    route: "todo",
  }));
}

function aiAvailable(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.VERCEL,
  );
}

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
      .slice(0, 15)
      .map((row, index) => ({
        id: `draft-${index + 1}`,
        label: row.label!.trim(),
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
        route: "todo",
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
      system: `You extract concrete action items for a high-school college-admissions household (Jason parent/admin, Kat parent, Kyle student).
Return ONLY a JSON array. Each object: label (imperative sentence), owner (jason|kat|kyle), parentId (from the parent list or "inbox"), dueDate (YYYY-MM-DD or null), startDate (YYYY-MM-DD or null), endDate (YYYY-MM-DD or null).
Prefer specific next actions over vague goals. Do not invent facts not implied by the source. Max 12 items.`,
      prompt: `Parent checklist options:
${parents}

Source text:
${trimmed.slice(0, 12000)}`,
    });
    const suggestions = parseSuggestionJson(result.text);
    if (suggestions.length) return { suggestions, method: "ai" };
  } catch {
    // fall through
  }
  return { suggestions: heuristicSuggestions(trimmed, phaseList), method: "heuristic" };
}

export async function fetchUrlText(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: { "User-Agent": "KyleCollegePortal/0.1" },
  });
  if (!response.ok) throw new Error(`Could not fetch URL (${response.status})`);
  const contentType = response.headers.get("content-type") ?? "";
  const raw = await response.text();
  if (contentType.includes("html") || raw.includes("<html")) {
    return raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 20000);
  }
  return raw.trim().slice(0, 20000);
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
      parentId: item.parentId,
      dueDate: typeof item.dueDate === "string" ? item.dueDate : null,
      startDate: typeof item.startDate === "string" ? item.startDate : null,
      endDate: typeof item.endDate === "string" ? item.endDate : null,
      sourceId: typeof item.sourceId === "string" ? item.sourceId : null,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
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
    });
  }
  return out;
}
