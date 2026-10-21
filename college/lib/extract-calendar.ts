/** Model-based calendar event extraction from ingested document text. */

import { z } from "zod";
import { listDayDatesInOrder, parseEventDatesFromText } from "@/lib/event-date";

export const CALENDAR_EVENT_KINDS = [
  "test",
  "registration",
  "late_registration",
  "score_release",
  "deadline",
  "visit",
  "interview",
  "other",
] as const;

export type CalendarEventKind = (typeof CALENDAR_EVENT_KINDS)[number];

export const extractedCalendarEventSchema = z.object({
  title: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.union([z.string().max(40), z.null()]),
  location: z.union([z.string().max(200), z.null()]),
  kind: z.enum(CALENDAR_EVENT_KINDS),
  related_label: z.union([z.string().max(120), z.null()]),
  evidence: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export const calendarExtractionResultSchema = z.object({
  document_summary: z.string().min(1),
  events: z.array(extractedCalendarEventSchema),
});

export type ExtractedCalendarEvent = z.infer<typeof extractedCalendarEventSchema>;
export type CalendarExtractionResult = z.infer<typeof calendarExtractionResultSchema>;

export type ExtractCalendarContext = {
  today: string;
  sourceFilename: string;
  sourceType: "paste" | "url" | "file" | "pdf" | "word" | "image";
};

export type ExtractCalendarSuccess = {
  ok: true;
  documentSummary: string;
  events: ExtractedCalendarEvent[];
};

export type ExtractCalendarFailure = {
  ok: false;
  error: string;
};

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const EXTRACT_CALENDAR_SYSTEM_PROMPT = `You help a family put college-related dates on a shared calendar. You will receive the text of a document (email, web page, PDF, screenshot OCR, counselor handout, or notes).

Read the entire document. Pull out every dated event the family should put on the calendar — not only action items.

What counts as a calendar event:
- Explicit dates tied to a named event: test dates, registration deadlines, late registration, score release, application deadlines, visit days, interviews, info sessions, webinars, decision dates, deposit due dates, financial-aid deadlines.
- Schedule or deadline tables. Every cell that is a date becomes its own event. Example: a table with columns "SAT Test Date", "Regular Registration Deadline", "Late Registration Deadline", and "Score Release Date" and five rows produces twenty events — four per row.
- For each related deadline, name the event it belongs to in the title. Prefer short titles like:
  - "Nov 7 SAT Test"
  - "Nov 7 SAT — register by Oct 23"
  - "Nov 7 SAT — late registration Oct 27"
  - "Nov 7 SAT — scores Nov 20"
- Convert every date to YYYY-MM-DD. Use the year printed in the document (for example 2026–2027 in a title). Do not invent years.

What does not count:
- Vague timing with no day ("this fall", "senior year").
- Purely historical dates with no future relevance.
- Duplicate rows for the same title and date.

Aim for the list a careful parent would write after reading the page. If you are less than 50% confident a row is a real dated event, leave it out. If there are no dates, return an empty list.

Return only JSON in this shape:
{
  "document_summary": "one sentence on what this document is",
  "events": [
    {
      "title": "short calendar title",
      "date": "YYYY-MM-DD",
      "time": "optional time text or null",
      "location": "place or null",
      "kind": "test | registration | late_registration | score_release | deadline | visit | interview | other",
      "related_label": "anchor event name such as Nov 7 SAT, or null",
      "evidence": "exact quote or cell text that supports this event",
      "confidence": 0.0
    }
  ]
}`;

function shortMonthDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTH_SHORT[m - 1]} ${d}`;
}

function normalizeLoose(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

export function calendarEvidenceInSource(evidence: string, sourceText: string): boolean {
  const needle = normalizeLoose(evidence);
  if (needle.length < 6) return false;
  const hay = normalizeLoose(sourceText);
  if (hay.includes(needle)) return true;
  const tokens = needle.split(" ").filter((token) => token.length >= 3);
  if (tokens.length < 2) return false;
  const hits = tokens.filter((token) => hay.includes(token)).length;
  return hits >= Math.ceil(tokens.length * 0.6);
}

function eventKey(event: ExtractedCalendarEvent): string {
  return `${event.date}::${normalizeLoose(event.title)}`;
}

/** Post-model checks. Keep dated rows even when OCR evidence is a little noisy. */
export function refineCalendarExtraction(
  result: CalendarExtractionResult,
  sourceText: string,
): CalendarExtractionResult {
  const events: ExtractedCalendarEvent[] = [];
  const seen = new Set<string>();
  for (const event of result.events) {
    if (event.confidence < 0.5) continue;
    const dateInSource = parseEventDatesFromText(sourceText).some((row) => row.date === event.date);
    if (!dateInSource && !calendarEvidenceInSource(event.evidence, sourceText)) continue;
    const key = eventKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    events.push(event);
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  return { document_summary: result.document_summary, events };
}

/**
 * Deterministic pass for test/registration/score tables (SAT and similar).
 * Turns each row of four dates into four calendar events.
 */
export function expandScheduleTableEvents(text: string): ExtractedCalendarEvent[] {
  const compact = text.replace(/\u00a0/g, " ");
  const lower = compact.toLowerCase();
  const looksLikeSchedule =
    /\b(sat|act|psat|test date|registration deadline|late registration|score release)\b/.test(
      lower,
    ) &&
    /\b(registration|register|deadline|score)\b/.test(lower);
  if (!looksLikeSchedule) return [];

  const exam =
    /\bact\b/.test(lower) && !/\bsat\b/.test(lower)
      ? "ACT"
      : /\bpsat\b/.test(lower)
        ? "PSAT"
        : "SAT";

  // Keep duplicate dates (e.g. Nov 20 as both a score day and a registration day).
  const dates = listDayDatesInOrder(compact);
  if (dates.length < 4) return [];

  const events: ExtractedCalendarEvent[] = [];
  const rowWidth = 4;
  const fullRows = Math.floor(dates.length / rowWidth);
  if (fullRows < 1) return [];

  for (let row = 0; row < fullRows; row += 1) {
    const base = row * rowWidth;
    const test = dates[base]!;
    const regular = dates[base + 1]!;
    const late = dates[base + 2]!;
    const scores = dates[base + 3]!;
    const anchor = `${shortMonthDay(test)} ${exam}`;
    const rows: Array<{ title: string; date: string; kind: CalendarEventKind; evidence: string }> = [
      {
        title: `${anchor} Test`,
        date: test,
        kind: "test",
        evidence: `${shortMonthDay(test)} ${exam} test date`,
      },
      {
        title: `${anchor} — register by ${shortMonthDay(regular)}`,
        date: regular,
        kind: "registration",
        evidence: `${shortMonthDay(regular)} regular registration for ${anchor}`,
      },
      {
        title: `${anchor} — late registration ${shortMonthDay(late)}`,
        date: late,
        kind: "late_registration",
        evidence: `${shortMonthDay(late)} late registration for ${anchor}`,
      },
      {
        title: `${anchor} — scores ${shortMonthDay(scores)}`,
        date: scores,
        kind: "score_release",
        evidence: `${shortMonthDay(scores)} score release for ${anchor}`,
      },
    ];
    for (const item of rows) {
      events.push({
        title: item.title,
        date: item.date,
        time: null,
        location: null,
        kind: item.kind,
        related_label: anchor,
        evidence: item.evidence,
        confidence: 0.92,
      });
    }
  }

  return events;
}

function mergeCalendarResults(
  summary: string,
  parts: ExtractedCalendarEvent[],
): CalendarExtractionResult {
  const seen = new Set<string>();
  const events: ExtractedCalendarEvent[] = [];
  for (const event of parts) {
    const key = eventKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    events.push(event);
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  return {
    document_summary: summary || "Dated events from the document.",
    events,
  };
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

function buildUserPrompt(text: string, context: ExtractCalendarContext): string {
  return `Context:
- Today: ${context.today}
- Source filename: ${context.sourceFilename || "(untitled)"}
- Source type: ${context.sourceType}

Document text:
${text}`;
}

async function callCalendarModelOnce(
  text: string,
  context: ExtractCalendarContext,
  modelOverride?: string | null,
): Promise<CalendarExtractionResult> {
  const { generateText } = await import("ai");
  const { resolveIngestModel } = await import("@/lib/ai-model");
  const { timeSourceCall } = await import("@/lib/data-source-checks");
  const model = await resolveIngestModel(modelOverride);
  const result = await timeSourceCall("ai-gateway", () =>
    generateText({
      model,
      system: EXTRACT_CALENDAR_SYSTEM_PROMPT,
      prompt: buildUserPrompt(text, context),
      temperature: 0.1,
      maxOutputTokens: 8_000,
    }),
  );
  const parsed = parseJsonObject(result.text);
  return calendarExtractionResultSchema.parse(parsed);
}

async function callCalendarModelWithRetry(
  text: string,
  context: ExtractCalendarContext,
): Promise<CalendarExtractionResult> {
  const {
    DEFAULT_COLLEGE_AI_MODEL,
    FREE_FALLBACK_COLLEGE_AI_MODEL,
    formatGatewayAccessError,
    isGatewayModelAccessError,
  } = await import("@/lib/ai-model");

  const run = async (modelOverride?: string | null) => {
    try {
      return await callCalendarModelOnce(text, context, modelOverride);
    } catch (firstError) {
      try {
        return await callCalendarModelOnce(text, context, modelOverride);
      } catch (secondError) {
        const message =
          secondError instanceof Error
            ? secondError.message
            : firstError instanceof Error
              ? firstError.message
              : "Calendar extraction failed";
        throw new Error(message);
      }
    }
  };

  try {
    return await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar extraction failed";
    if (isGatewayModelAccessError(message)) {
      for (const fallback of [DEFAULT_COLLEGE_AI_MODEL, FREE_FALLBACK_COLLEGE_AI_MODEL]) {
        try {
          return await run(fallback);
        } catch {
          /* try next */
        }
      }
      throw new Error(`Could not extract calendar events: ${formatGatewayAccessError(message)}`);
    }
    throw new Error(`Could not parse model output as valid calendar JSON: ${message}`);
  }
}

/**
 * Extract calendar events with a stronger ingest model, then merge in any
 * clear test/registration/score table rows the deterministic pass finds.
 */
export async function extractCalendarFromText(
  text: string,
  context: ExtractCalendarContext,
): Promise<ExtractCalendarSuccess | ExtractCalendarFailure> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: true, documentSummary: "Empty document.", events: [] };
  }
  const { aiGatewayAvailable } = await import("@/lib/ai-model");
  const tableEvents = expandScheduleTableEvents(trimmed);

  if (!aiGatewayAvailable()) {
    if (tableEvents.length) {
      return {
        ok: true,
        documentSummary: "Schedule table dates from the document.",
        events: tableEvents,
      };
    }
    return {
      ok: false,
      error: "AI extraction is not configured (set AI_GATEWAY_API_KEY or deploy on Vercel).",
    };
  }

  try {
    const raw = await callCalendarModelWithRetry(trimmed, context);
    const refined = refineCalendarExtraction(raw, trimmed);
    const merged = mergeCalendarResults(
      refined.document_summary,
      [...refined.events, ...tableEvents],
    );
    // Prefer the denser schedule-table expansion when the model under-counted a clear table.
    if (tableEvents.length >= 8 && refined.events.length < tableEvents.length) {
      return {
        ok: true,
        documentSummary: refined.document_summary || "Schedule table dates from the document.",
        events: mergeCalendarResults(
          refined.document_summary || "Schedule table dates from the document.",
          tableEvents,
        ).events,
      };
    }
    return {
      ok: true,
      documentSummary: merged.document_summary,
      events: merged.events,
    };
  } catch (error) {
    if (tableEvents.length) {
      return {
        ok: true,
        documentSummary: "Schedule table dates from the document.",
        events: tableEvents,
      };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not extract calendar events",
    };
  }
}
