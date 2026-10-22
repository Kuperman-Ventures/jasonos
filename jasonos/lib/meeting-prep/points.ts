export const POINT_KINDS = ["agenda", "point", "question", "ask"] as const;
export type PointKind = (typeof POINT_KINDS)[number];
export type PointState = "open" | "covered" | "skipped";

export interface DraftPoint {
  kind: PointKind;
  headline: string;
  detail: string | null;
  sourceHint: string | null;
  listenFor: string | null;
}

export function clampListenFor(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.length <= 160 ? text : text.slice(0, 160).trim();
}

export interface DraftPromptInput {
  title: string;
  attendees: Array<{
    name: string;
    title: string | null;
    company: string | null;
    personResearch: { lead: string | null; bullets: string[] } | null;
    companyResearch: {
      name: string | null;
      lead: string | null;
      bullets: string[];
      verified?: boolean;
    } | null;
  }>;
  /** False when any attendee company was not read from its own website. */
  companyVerified?: boolean;
  purpose: string | null;
  emailContext: string | null;
  narratives: Array<{ title: string; body: string }>;
  track: string | null;
  outcomeSentence: string | null;
  summary: string | null;
  nextMove: string | null;
  openCommitments: Array<{
    text: string;
    direction: "mine" | "theirs";
    due: string | null;
    personName: string;
  }>;
  topics: string[];
  whereItStands: string | null;
  yourStake: string | null;
  introduction: string | null;
  referrer: string | null;
  personalGoal: string | null;
  projectGoal: string | null;
  relationshipGoal: string | null;
  lastNextStep: string | null;
  /** Newest first. Only the first three are sent, each already capped. */
  granolaSummaries: Array<{ title: string | null; date: string | null; summary: string }>;
  /** Newest first. Only the first four are sent. */
  pastMeetings: Array<{
    title: string | null;
    debriefNotes: string | null;
    nextStep: string | null;
  }>;
  jobSearch: Array<{ title: string; company: string | null; kind: string }>;
  linkedinUrl?: string | null;
  browningPrep?: string | null;
  packet?: {
    resumeText: string | null;
    introReason: string | null;
    linkedinUrls: string[];
    otherDocuments: Array<{ filename: string; text: string }>;
  } | null;
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

/** Fill {{narrative:key}} from Settings. Leave the token when that narrative is empty. */
export function fillNarrativePlaceholders(
  value: string | null,
  narratives: Array<{ key: string; body: string }>,
  limit = 400
): string | null {
  if (!value) return value;
  const byKey = new Map(
    narratives.map((item) => [item.key.trim().toLowerCase(), item.body.trim()])
  );
  return value.replace(/\{\{\s*narrative:([a-z0-9_]+)\s*\}\}/gi, (token, key: string) => {
    const body = byKey.get(key.toLowerCase()) ?? "";
    if (!body) return token;
    if (body.length <= limit) return body;
    return `${body.slice(0, Math.max(1, limit - 1)).trimEnd()}…`;
  });
}

/** Fill {{targets}} and {{snapshot}}. Leave the token when that setting is empty. */
export function fillStrategySettings(
  value: string | null,
  settings: { targetCompanies: string[]; snapshot: string | null }
): string | null {
  if (!value) return value;
  const targets = settings.targetCompanies
    .map((company) => company.trim())
    .filter(Boolean)
    .join(", ");
  const snapshot = settings.snapshot?.trim() ?? "";
  return value.replace(/\{\{\s*(targets|snapshot)\s*\}\}/gi, (token, key: string) => {
    if (key.toLowerCase() === "targets") return targets || token;
    return snapshot || token;
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
    const sourceHint = (item as { sourceHint?: unknown }).sourceHint;
    const hint =
      typeof sourceHint === "string" && sourceHint.trim()
        ? sourceHint.trim().replace(/\s+/g, " ").slice(0, 160)
        : null;
    const listenRaw =
      (item as { listen_for?: unknown }).listen_for ??
      (item as { listenFor?: unknown }).listenFor;
    const listenFor =
      kind === "question" ? clampListenFor(typeof listenRaw === "string" ? listenRaw : null) : null;
    drafts.push({
      kind: kind as PointKind,
      headline: clean,
      detail: cleanDetail,
      sourceHint: hint,
      listenFor,
    });
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

export const PACKET_PLACEHOLDER_INSTRUCTION =
  "When the strategy has a placeholder in square brackets such as [specific accomplishment] or [one specific thing from their background], replace it with a real item from the resume. Never leave a square-bracket placeholder in the output.";

export function meetingPointsSystemPrompt(writingRules: string, companyVerified = true): string {
  const unverified = companyVerified
    ? ""
    : " Company research is unverified (JasonOS could not read the company website). The first question in the plan should establish what the company is and what the person does there, and later points must not assume either.";
  return `Jason is preparing for this call. Return 5 to 9 items as JSON: [{"kind":"agenda|point|question|ask","headline":"...","detail":"...","sourceHint":"...","listen_for":null}]. Headlines are under 80 characters, plain, in Jason's voice, no questions phrased as statements. Include exactly one ask when the purpose names something Jason wants. Include a question for every open commitment of theirs and for anything in the context Jason does not yet know. Put one agenda item first ("Open") and one last ("Close and next step"). Add a one-line sourceHint per point naming the fact or source the point came from ("John owes the board notes since March", "Introduced by Tracy"), or null when it is Jason's own purpose. For question points, set listen_for to a short phrase of what Jason should listen for in the answer when the detail says what to listen for; otherwise null. When what Jason wants asks him to explain something about himself or his work, write those points from the narratives, in his voice, and keep each detail under 400 characters. Never summarize a narrative as "explain what you do."${unverified} ${PACKET_PLACEHOLDER_INSTRUCTION} Return JSON only.
${writingRules}`;
}

function filed(label: string, value: string | null | undefined): string {
  const text = value?.trim();
  return `${label}: ${text || "None on file"}`;
}

/** Labels shown under Draft after a run. Counts are included only when something was found. */
export function draftContextLines(input: {
  purpose: string | null;
  outcomeSentence: string | null;
  relationshipBrief: string | null;
  openCommitments: number;
  referrer: string | null;
  personalGoal: string | null;
  projectGoal: string | null;
  relationshipGoal: string | null;
  granolaNotes: number;
  earlierMeetings: number;
  jobSearch: number;
  personResearch: boolean;
  companyResearch: boolean;
  emailContext: string | null;
  narrativeCount: number;
  packet?: boolean;
  requirePacket?: boolean;
}): { contextUsed: string[]; contextMissing: string[] } {
  const rows: Array<{ label: string; present: boolean }> = [
    { label: "Purpose", present: Boolean(input.purpose?.trim()) },
    { label: "Outcome sentence", present: Boolean(input.outcomeSentence?.trim()) },
    { label: "Relationship brief", present: Boolean(input.relationshipBrief?.trim()) },
    { label: "Open commitments", present: input.openCommitments > 0 },
    { label: "Referrer", present: Boolean(input.referrer?.trim()) },
    { label: "Personal goal", present: Boolean(input.personalGoal?.trim()) },
    { label: "Project goal", present: Boolean(input.projectGoal?.trim()) },
    { label: "Goal for this relationship", present: Boolean(input.relationshipGoal?.trim()) },
    {
      label: input.granolaNotes > 0 ? `Granola notes (${input.granolaNotes})` : "Granola notes",
      present: input.granolaNotes > 0,
    },
    {
      label: input.earlierMeetings > 0 ? `Earlier meetings (${input.earlierMeetings})` : "Earlier meetings",
      present: input.earlierMeetings > 0,
    },
    { label: "Job search", present: input.jobSearch > 0 },
    { label: "Person research", present: input.personResearch },
    { label: "Company research", present: input.companyResearch },
    { label: "Email thread", present: Boolean(input.emailContext?.trim()) },
    {
      label: input.narrativeCount > 0 ? `Narratives (${input.narrativeCount})` : "Narratives",
      present: input.narrativeCount > 0,
    },
  ];
  if (input.packet || input.requirePacket) {
    rows.push({ label: "Browning packet", present: Boolean(input.packet) });
  }
  return {
    contextUsed: rows.filter((row) => row.present).map((row) => row.label),
    contextMissing: rows.filter((row) => !row.present).map((row) => row.label),
  };
}

export function buildMeetingPointsUserMessage(input: DraftPromptInput): string {
  const sections: string[] = [`Meeting: ${input.title.trim() || "Meeting"}`];

  if (input.attendees.length) {
    const people = input.attendees
      .map((person) => [person.name, person.title, person.company].filter(Boolean).join(", "))
      .filter(Boolean);
    if (people.length) sections.push(`Attendees:\n${people.map((person) => `- ${person}`).join("\n")}`);
  }

  const who = input.attendees.filter(
    (person) => person.personResearch?.lead || person.personResearch?.bullets.length
  );
  if (who.length) {
    const blocks = who.map((person) => {
      const lines = [person.personResearch?.lead, ...(person.personResearch?.bullets ?? []).slice(0, 4)].filter(Boolean);
      return `- ${person.name}\n${lines.join("\n")}`;
    });
    sections.push(`Who they are:\n${blocks.join("\n\n")}`);
  } else {
    sections.push("Who they are: None on file");
  }

  const companies = input.attendees.filter(
    (person) => person.companyResearch?.lead || person.companyResearch?.bullets.length
  );
  if (companies.length) {
    const blocks = companies.map((person) => {
      const research = person.companyResearch!;
      const lines = [research.lead, ...research.bullets.slice(0, 4)].filter(Boolean);
      return `- ${research.name || person.company || "Company"}\n${lines.join("\n")}`;
    });
    sections.push(`Their company:\n${blocks.join("\n\n")}`);
  } else {
    sections.push("Their company: None on file");
  }

  sections.push(
    input.emailContext?.trim()
      ? `How this meeting came about:\n${input.emailContext.trim()}`
      : "How this meeting came about: None on file"
  );
  if (input.narratives.some((item) => item.body.trim())) {
    const blocks = input.narratives
      .filter((item) => item.body.trim())
      .map((item) => `${item.title}\n${item.body.trim()}`);
    sections.push(`Jason's narratives for this meeting:\n${blocks.join("\n\n")}`);
  } else {
    sections.push("Jason's narratives for this meeting: None on file");
  }
  if (input.track?.trim()) sections.push(`Track: ${input.track.trim()}`);

  sections.push(
    input.purpose?.trim()
      ? `What Jason wants out of this: ${input.purpose.trim()}`
      : "What Jason wants out of this: Not written yet. Do not include an ask."
  );
  sections.push(filed("Outcome sentence", input.outcomeSentence));
  sections.push(filed("Referrer", input.referrer));
  sections.push(filed("Personal goal", input.personalGoal));
  sections.push(filed("Project goal", input.projectGoal));
  sections.push(filed("Goal for this relationship", input.relationshipGoal));

  const brief = [
    line("Summary", input.summary),
    line("Next move", input.nextMove),
    input.topics.length ? `Topics: ${input.topics.join("; ")}` : null,
  ].filter(Boolean);
  sections.push(brief.length ? `Relationship brief:\n${brief.join("\n")}` : "Relationship brief: None on file");

  if (input.openCommitments.length) {
    const rows = input.openCommitments.map((item) => {
      const who = item.direction === "mine" ? "his" : "theirs";
      const due = item.due?.trim() ? `, due ${item.due.trim()}` : "";
      return `- ${who} (${item.personName}${due}): ${item.text}`;
    });
    sections.push(`Open commitments:\n${rows.join("\n")}`);
  } else {
    sections.push("Open commitments: None on file");
  }
  sections.push(filed("Last next step", input.lastNextStep));

  const briefing = [
    line("Where it stands", input.whereItStands),
    line("Jason's stake", input.yourStake),
    line("Introduction", input.introduction),
  ].filter(Boolean);
  if (briefing.length) sections.push(briefing.join("\n"));

  const granola = input.granolaSummaries.slice(0, 3).filter((note) => note.summary.trim());
  if (granola.length) {
    const rows = granola.map((note) => {
      const title = note.title?.trim() || "Note";
      const when = note.date?.trim() ? ` (${note.date.trim()})` : "";
      return `- ${title}${when}: ${note.summary.trim()}`;
    });
    sections.push(`Granola notes:\n${rows.join("\n")}`);
  } else {
    sections.push("Granola notes: None on file");
  }

  const past = input.pastMeetings.slice(0, 4).filter((meeting) => {
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
    sections.push(`Earlier meetings:\n${rows.join("\n\n")}`);
  } else {
    sections.push("Earlier meetings: None on file");
  }

  if (input.jobSearch.length) {
    const rows = input.jobSearch.map((job) => {
      const company = job.company ? `, ${job.company}` : "";
      return `- ${job.kind}: ${job.title}${company}`;
    });
    sections.push(`Job search:\n${rows.join("\n")}`);
  } else {
    sections.push("Job search: None on file");
  }

  if (input.linkedinUrl?.trim()) sections.push(`LinkedIn: ${input.linkedinUrl.trim()}`);
  if (input.browningPrep?.trim()) {
    sections.push(`Browning prep note:\n${input.browningPrep.trim().slice(0, 2000)}`);
  }

  if (input.packet) {
    const resume = input.packet.resumeText?.trim() || "None on file";
    const reason = input.packet.introReason?.trim() || "None on file";
    const links = input.packet.linkedinUrls.length
      ? input.packet.linkedinUrls.join(", ")
      : "None on file";
    sections.push(
      `## Their background (from the Browning packet)\nResume:\n${resume}\n\nWhy Browning connected us:\n${reason}\n\nLinkedIn: ${links}`
    );
    if (input.packet.otherDocuments.length) {
      const docs = input.packet.otherDocuments
        .map((doc) => `- ${doc.filename}:\n${doc.text}`)
        .join("\n\n");
      sections.push(`Other documents:\n${docs}`);
    }
  }

  return sections.join("\n\n");
}
