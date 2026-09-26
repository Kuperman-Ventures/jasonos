/** Model-based to-do extraction from ingested document text. */

import { z } from "zod";

export const EXTRACTION_CATEGORIES = [
  "deadline",
  "submission",
  "document_request",
  "essay",
  "financial_aid",
  "visit_event",
  "payment",
  "account_setup",
  "follow_up",
  "decision",
] as const;

export type ExtractionCategory = (typeof EXTRACTION_CATEGORIES)[number];

export const extractedTodoSchema = z.object({
  title: z.string().min(1).max(200),
  details: z.string().min(1).max(2000),
  category: z.enum(EXTRACTION_CATEGORIES),
  school: z.string().nullable(),
  due_date: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]),
  due_date_basis: z.union([z.enum(["explicit", "inferred"]), z.null()]),
  conditional_on: z.string().nullable(),
  updates_existing: z.string().nullable(),
  evidence: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export const extractionResultSchema = z.object({
  document_summary: z.string().min(1),
  todos: z.array(extractedTodoSchema),
});

export type ExtractedTodo = z.infer<typeof extractedTodoSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;

export type ExtractTodosContext = {
  today: string;
  sourceFilename: string;
  sourceType: "paste" | "url" | "file" | "pdf" | "word" | "image";
  schoolNames: string[];
  openTodos: { title: string; school: string | null; dueDate: string | null }[];
};

export type ExtractTodosSuccess = {
  ok: true;
  documentSummary: string;
  todos: ExtractedTodo[];
};

export type ExtractTodosFailure = {
  ok: false;
  error: string;
};

const CHUNK_LIMIT = 60_000;
const CHUNK_OVERLAP = 2_000;

/** System prompt — keep word-for-word with the product brief. */
export const EXTRACT_TODOS_SYSTEM_PROMPT = `You help a family manage one high school student's college search and applications. You will receive the text of a document (an email, school web page, PDF, counselor handout, portal notice, or notes) plus context about the schools being tracked and the to-dos that already exist.

Read the entire document first. Work out what it is, who it is for, and what it means for this student. Then list the concrete things the family needs to do because of it.

What counts as a to-do:
- An action a family member can complete, with a clear finish line.
- Actions the document implies, not only ones it states as instructions. Example: "Early Decision applications are due November 1" becomes "Submit Early Decision application to [school] by Nov 1". Example: "The CSS Profile is required for institutional aid" becomes "Complete CSS Profile for [school]".
- One to-do per outcome. If five sentences describe one task, return one to-do.

What does not count:
- Descriptions, statistics, marketing copy, or policy explanations that require no action.
- Instructions for other audiences (counselors, transfer applicants, international students, parents of admitted students) unless the document indicates they apply to this student.
- Anything the document says is already done or received.
- Anything that duplicates an existing to-do in the context. If the document adds a new date or detail to an existing to-do, return it with "updates_existing" set to that to-do's title.
- Generic advice ("start early", "stay organized").

Conditional actions: if an action applies only under a condition (for example, "if applying for merit scholarships"), include it and state the condition in "conditional_on".

Types of to-do to look for: application deadlines, forms and submissions, requesting documents (transcripts, recommendations, test scores), essays and supplements, financial aid and scholarships, visits, interviews, and event registrations, fees and payments, portal or account setup, follow-ups with a named person or office, and decisions or research the family needs to make.

Aim for the list a careful parent would write after reading this document. If you are less than 50% confident something is a real to-do for this student, leave it out. If there is nothing actionable, return an empty list.

Return only JSON in this shape:
{
  "document_summary": "one sentence on what this document is and who it is for",
  "todos": [
    {
      "title": "imperative, under 12 words",
      "details": "one or two sentences with the specifics needed to act",
      "category": "deadline | submission | document_request | essay | financial_aid | visit_event | payment | account_setup | follow_up | decision",
      "school": "school name from the tracked list, or null",
      "due_date": "YYYY-MM-DD or null",
      "due_date_basis": "explicit | inferred | null",
      "conditional_on": "condition text or null",
      "updates_existing": "existing to-do title or null",
      "evidence": "exact quote from the document that supports this to-do",
      "confidence": 0.0
    }
  ]
}`;

function normalizeForEvidence(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function evidenceInSource(evidence: string, sourceText: string): boolean {
  const needle = normalizeForEvidence(evidence);
  if (needle.length < 8) return false;
  const hay = normalizeForEvidence(sourceText);
  if (hay.includes(needle)) return true;
  // Allow short evidence that is a contiguous substring after stripping punctuation noise.
  const looseNeedle = needle.replace(/[^a-z0-9 ]/g, "");
  const looseHay = hay.replace(/[^a-z0-9 ]/g, "");
  return looseNeedle.length >= 12 && looseHay.includes(looseNeedle);
}

function normalizeTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchSchool(name: string | null, schoolNames: string[]): string | null {
  if (!name?.trim()) return null;
  const needle = name.trim().toLowerCase();
  const exact = schoolNames.find((school) => school.toLowerCase() === needle);
  if (exact) return exact;
  const partial = schoolNames.find(
    (school) =>
      school.toLowerCase().includes(needle) || needle.includes(school.toLowerCase()),
  );
  return partial ?? null;
}

/** Post-model checks from the product brief (code, not prompt). */
export function refineExtractionResult(
  result: ExtractionResult,
  sourceText: string,
  schoolNames: string[],
): ExtractionResult {
  const todos: ExtractedTodo[] = [];
  const seen = new Set<string>();

  for (const todo of result.todos) {
    if (todo.confidence < 0.5) continue;
    if (!evidenceInSource(todo.evidence, sourceText)) continue;
    const school = matchSchool(todo.school, schoolNames);
    const key = `${school ?? ""}::${normalizeTitleKey(todo.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    todos.push({ ...todo, school });
  }

  return { document_summary: result.document_summary, todos };
}

function splitIntoChunks(text: string): string[] {
  if (text.length <= CHUNK_LIMIT) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + CHUNK_LIMIT, text.length);
    if (end < text.length) {
      const window = text.slice(start, end);
      const breakAt = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf("\n"),
        window.lastIndexOf(". "),
      );
      if (breakAt > CHUNK_LIMIT * 0.5) end = start + breakAt + 1;
    }
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = Math.max(0, end - CHUNK_OVERLAP);
  }
  return chunks;
}

function mergeChunkResults(parts: ExtractionResult[]): ExtractionResult {
  if (!parts.length) {
    return { document_summary: "No actionable content found.", todos: [] };
  }
  const summary = parts.map((part) => part.document_summary).filter(Boolean)[0] ?? parts[0]!.document_summary;
  const todos: ExtractedTodo[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    for (const todo of part.todos) {
      const key = `${todo.school ?? ""}::${normalizeTitleKey(todo.title)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      todos.push(todo);
    }
  }
  return { document_summary: summary, todos };
}

function parseJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1]!.trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model did not return a JSON object");
  return JSON.parse(body.slice(start, end + 1));
}

function buildUserPrompt(text: string, context: ExtractTodosContext): string {
  const schools =
    context.schoolNames.length > 0
      ? context.schoolNames.map((name) => `- ${name}`).join("\n")
      : "- (none tracked yet)";
  const open =
    context.openTodos.length > 0
      ? context.openTodos
          .map(
            (todo) =>
              `- ${todo.title}${todo.school ? ` [${todo.school}]` : ""}${todo.dueDate ? ` due ${todo.dueDate}` : ""}`,
          )
          .join("\n")
      : "- (none open)";

  return `Context:
- Today: ${context.today}
- Source filename: ${context.sourceFilename || "(untitled)"}
- Source type: ${context.sourceType}
- Schools in the tracker:
${schools}
- Current open to-dos:
${open}

Document text:
${text}`;
}

async function callModelOnce(
  text: string,
  context: ExtractTodosContext,
  modelOverride?: string | null,
): Promise<ExtractionResult> {
  const { generateText } = await import("ai");
  const { resolveCollegeModel } = await import("@/lib/ai-model");
  const result = await generateText({
    model: await resolveCollegeModel(modelOverride),
    system: EXTRACT_TODOS_SYSTEM_PROMPT,
    prompt: buildUserPrompt(text, context),
  });
  const parsed = parseJsonObject(result.text);
  return extractionResultSchema.parse(parsed);
}

async function callModelWithRetry(
  text: string,
  context: ExtractTodosContext,
): Promise<ExtractionResult> {
  const {
    FREE_FALLBACK_COLLEGE_AI_MODEL,
    formatGatewayAccessError,
    isGatewayModelAccessError,
  } = await import("@/lib/ai-model");

  const run = async (modelOverride?: string | null) => {
    try {
      return await callModelOnce(text, context, modelOverride);
    } catch (firstError) {
      try {
        return await callModelOnce(text, context, modelOverride);
      } catch (secondError) {
        const message =
          secondError instanceof Error
            ? secondError.message
            : firstError instanceof Error
              ? firstError.message
              : "Extraction failed";
        throw new Error(message);
      }
    }
  };

  try {
    return await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed";
    if (isGatewayModelAccessError(message)) {
      try {
        return await run(FREE_FALLBACK_COLLEGE_AI_MODEL);
      } catch (fallbackError) {
        const fallbackMessage =
          fallbackError instanceof Error ? fallbackError.message : message;
        throw new Error(
          `Could not extract to-dos: ${formatGatewayAccessError(fallbackMessage)}`,
        );
      }
    }
    throw new Error(`Could not parse model output as valid extraction JSON: ${message}`);
  }
}

/**
 * Replace the old line/heuristic extractor. Returns validated, post-checked to-dos,
 * or an error when the model output cannot be trusted.
 */
export async function extractTodosFromText(
  text: string,
  context: ExtractTodosContext,
): Promise<ExtractTodosSuccess | ExtractTodosFailure> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: true, documentSummary: "Empty document.", todos: [] };
  }
  const { aiGatewayAvailable } = await import("@/lib/ai-model");
  if (!aiGatewayAvailable()) {
    return {
      ok: false,
      error: "AI extraction is not configured (set AI_GATEWAY_API_KEY or deploy on Vercel).",
    };
  }

  try {
    const chunks = splitIntoChunks(trimmed);
    const parts: ExtractionResult[] = [];
    for (const chunk of chunks) {
      const raw = await callModelWithRetry(chunk, context);
      parts.push(refineExtractionResult(raw, trimmed, context.schoolNames));
    }
    const merged = refineExtractionResult(mergeChunkResults(parts), trimmed, context.schoolNames);
    return {
      ok: true,
      documentSummary: merged.document_summary,
      todos: merged.todos.sort((a, b) => b.confidence - a.confidence),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not extract to-dos",
    };
  }
}
