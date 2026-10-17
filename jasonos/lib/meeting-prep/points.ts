export const POINT_KINDS = ["agenda", "point", "question", "ask"] as const;
export type PointKind = (typeof POINT_KINDS)[number];
export type PointState = "open" | "covered" | "skipped";

export interface DraftPoint {
  kind: PointKind;
  headline: string;
  detail: string | null;
}

export interface DraftPromptInput {
  title: string;
  attendees: Array<{ name: string; title: string | null; company: string | null }>;
  purpose: string | null;
  summary: string | null;
  nextMove: string | null;
  commitments: Array<{
    text: string;
    direction: "mine" | "theirs";
    status: string;
    personName: string;
  }>;
  topics: string[];
  whereItStands: string | null;
  yourStake: string | null;
  introduction: string | null;
  /** Newest first. Only the first two are sent. */
  pastMeetings: Array<{
    title: string | null;
    debriefNotes: string | null;
    nextStep: string | null;
  }>;
  jobSearch: Array<{ title: string; company: string | null; kind: string }>;
}

const KIND_SET = new Set<string>(POINT_KINDS);

export function headlineKey(headline: string): string {
  return headline.trim().toLowerCase();
}

export function clampHeadline(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 80) return trimmed;
  return trimmed.slice(0, 80).trim();
}

/** Fill {{name}}, {{company}}, and {{title}}. Leave the token when the value is missing. */
export function fillScriptPlaceholders(
  value: string | null,
  person: { name?: string | null; company?: string | null; title?: string | null } | null
): string | null {
  if (!value) return value;
  return value.replace(/\{\{\s*(name|company|title)\s*\}\}/gi, (token, key: string) => {
    const field = key.toLowerCase() as "name" | "company" | "title";
    const filled = person?.[field]?.trim();
    return filled ? filled : token;
  });
}

export function clampDetail(value: string): string {
  const trimmed = value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/[ \t]+/g, " "))
    .join("\n")
    .trim()
    .replace(/\n{3,}/g, "\n\n");
  if (trimmed.length <= 400) return trimmed;
  return trimmed.slice(0, 400).trim();
}

function unwrapFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

function extractJson(text: string): string {
  const arrayAt = text.indexOf("[");
  const objectAt = text.indexOf("{");
  const start =
    arrayAt === -1 ? objectAt : objectAt === -1 ? arrayAt : Math.min(arrayAt, objectAt);
  if (start === -1) return text;
  const end = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));
  if (end <= start) return text.slice(start);
  return text.slice(start, end + 1);
}

export function parseDraftPoints(text: string): DraftPoint[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(unwrapFence(text)));
  } catch {
    return null;
  }

  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? Object.values(parsed).find((value) => Array.isArray(value))
      : null;
  if (!Array.isArray(list)) return null;

  const drafts: DraftPoint[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const kind = (item as { kind?: unknown }).kind;
    const headline = (item as { headline?: unknown }).headline;
    const detail = (item as { detail?: unknown }).detail;
    if (typeof kind !== "string" || !KIND_SET.has(kind)) continue;
    if (typeof headline !== "string") continue;
    const clean = clampHeadline(headline);
    if (!clean) continue;
    const cleanDetail =
      typeof detail === "string" && detail.trim() ? clampDetail(detail) : null;
    drafts.push({ kind: kind as PointKind, headline: clean, detail: cleanDetail });
    if (drafts.length === 9) break;
  }
  return drafts.length ? drafts : null;
}

/** Drop drafts whose headline already exists. Comparison is trimmed and case-insensitive. */
export function newDrafts(existingHeadlines: string[], drafts: DraftPoint[]): DraftPoint[] {
  const seen = new Set(existingHeadlines.map(headlineKey).filter(Boolean));
  const out: DraftPoint[] = [];
  for (const draft of drafts) {
    const key = headlineKey(draft.headline);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(draft);
  }
  return out;
}

export function isMarkable(kind: string): boolean {
  return kind !== "agenda";
}

export function coveredTally(points: Array<{ kind: string; state: string }>): {
  covered: number;
  total: number;
} {
  const markable = points.filter((point) => isMarkable(point.kind));
  return {
    covered: markable.filter((point) => point.state === "covered").length,
    total: markable.length,
  };
}

export function firstOpenIndex(points: Array<{ kind: string; state: string }>): number {
  return points.findIndex((point) => isMarkable(point.kind) && point.state === "open");
}

/** Next open markable item after fromIndex, else the first open item before it. */
export function nextOpenIndex(
  points: Array<{ kind: string; state: string }>,
  fromIndex: number
): number {
  for (let index = fromIndex + 1; index < points.length; index += 1) {
    const point = points[index];
    if (isMarkable(point.kind) && point.state === "open") return index;
  }
  for (let index = 0; index < fromIndex; index += 1) {
    const point = points[index];
    if (isMarkable(point.kind) && point.state === "open") return index;
  }
  return -1;
}

export function moveMarkableIndex(
  points: Array<{ kind: string }>,
  fromIndex: number,
  direction: 1 | -1
): number {
  const markable: number[] = [];
  points.forEach((point, index) => {
    if (isMarkable(point.kind)) markable.push(index);
  });
  if (!markable.length) return -1;
  const current = markable.indexOf(fromIndex);
  const start = current === -1 ? (direction === 1 ? -1 : 0) : current;
  const next = (start + direction + markable.length) % markable.length;
  return markable[next];
}

/** 1-based position among non-agenda items. */
export function markableIndexAt(points: Array<{ kind: string }>, nth: number): number {
  if (nth < 1) return -1;
  let seen = 0;
  for (let index = 0; index < points.length; index += 1) {
    if (!isMarkable(points[index].kind)) continue;
    seen += 1;
    if (seen === nth) return index;
  }
  return -1;
}

export function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function line(label: string, value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  return `${label}: ${text}`;
}

export function meetingPointsSystemPrompt(writingRules: string): string {
  return `Jason is preparing for this call. Return 5 to 9 items as JSON: [{"kind":"agenda|point|question|ask","headline":"...","detail":"..."}]. Headlines are under 80 characters, plain, in Jason's voice, no questions phrased as statements. Include exactly one ask when the purpose names something Jason wants. Include a question for every open commitment of theirs and for anything in the context Jason does not yet know. Put one agenda item first ("Open") and one last ("Close and next step"). Return JSON only.
${writingRules}`;
}

export function buildMeetingPointsUserMessage(input: DraftPromptInput): string {
  const sections: string[] = [`Meeting: ${input.title.trim() || "Meeting"}`];

  if (input.attendees.length) {
    const people = input.attendees
      .map((person) => [person.name, person.title, person.company].filter(Boolean).join(", "))
      .filter(Boolean);
    if (people.length) sections.push(`Attendees:\n${people.map((person) => `- ${person}`).join("\n")}`);
  }

  sections.push(
    input.purpose?.trim()
      ? `What Jason wants out of this: ${input.purpose.trim()}`
      : "What Jason wants out of this: Not written yet. Do not include an ask."
  );

  const brief = [
    line("Summary", input.summary),
    line("Next move", input.nextMove),
    input.topics.length ? `Topics: ${input.topics.join("; ")}` : null,
  ].filter(Boolean);
  if (brief.length) sections.push(brief.join("\n"));

  if (input.commitments.length) {
    const rows = input.commitments.map((item) => {
      const who = item.direction === "mine" ? "his" : "theirs";
      return `- ${who} (${item.personName}, ${item.status}): ${item.text}`;
    });
    sections.push(`Commitments:\n${rows.join("\n")}`);
  }

  const briefing = [
    line("Where it stands", input.whereItStands),
    line("Jason's stake", input.yourStake),
    line("Introduction", input.introduction),
  ].filter(Boolean);
  if (briefing.length) sections.push(briefing.join("\n"));

  const past = input.pastMeetings.slice(0, 2).filter((meeting) => {
    return meeting.debriefNotes?.trim() || meeting.nextStep?.trim();
  });
  if (past.length) {
    const rows = past.map((meeting, index) => {
      const bits = [
        meeting.title?.trim() || `Earlier meeting ${index + 1}`,
        meeting.debriefNotes?.trim() ? `Debrief: ${meeting.debriefNotes.trim()}` : null,
        meeting.nextStep?.trim() ? `Next step: ${meeting.nextStep.trim()}` : null,
      ].filter(Boolean);
      return bits.join("\n");
    });
    sections.push(`Last meetings:\n${rows.join("\n\n")}`);
  }

  if (input.jobSearch.length) {
    const rows = input.jobSearch.map((job) => {
      const company = job.company ? `, ${job.company}` : "";
      return `- ${job.kind}: ${job.title}${company}`;
    });
    sections.push(`Job search:\n${rows.join("\n")}`);
  }

  return sections.join("\n\n");
}
