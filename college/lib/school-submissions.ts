/** Optional and extra submissions beyond the standard application pieces. */

export type SubmissionType =
  | "arts"
  | "maker"
  | "research"
  | "resume"
  | "additional_rec"
  | "video"
  | "other";

export const SUBMISSION_TYPE_LABEL: Record<SubmissionType, string> = {
  arts: "Music or arts",
  maker: "Maker portfolio",
  research: "Research",
  resume: "Resume",
  additional_rec: "Extra letter",
  video: "Video",
  other: "Other",
};

export const SUBMISSION_TYPE_ORDER: SubmissionType[] = [
  "arts",
  "maker",
  "research",
  "resume",
  "additional_rec",
  "video",
  "other",
];

export const ACCENT_SUBMISSION_TYPES: ReadonlySet<SubmissionType> = new Set([
  "arts",
  "maker",
  "research",
]);

export type SelfReportState = "req" | "mod" | "no" | "unk";

export type SchoolSubmissions = {
  cycle: string;
  selfReport: { state: SelfReportState; name?: string; note: string; sourceUrl?: string };
  required: { name: string; description: string; how: string; sourceUrl: string }[];
  optional: {
    type: SubmissionType;
    name: string;
    who: string;
    how: string;
    deadline: string;
    sourceUrl: string;
  }[];
  notAccepted: { item: string; sourceUrl: string }[];
  notes: string;
};

const SUBMISSION_TYPES = new Set<string>(SUBMISSION_TYPE_ORDER);
const SELF_REPORT_STATES = new Set<string>(["req", "mod", "no", "unk"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asSubmissionType(value: unknown): SubmissionType {
  return typeof value === "string" && SUBMISSION_TYPES.has(value)
    ? (value as SubmissionType)
    : "other";
}

function asSelfReportState(value: unknown): SelfReportState {
  return typeof value === "string" && SELF_REPORT_STATES.has(value)
    ? (value as SelfReportState)
    : "unk";
}

export function normalizeSubmissions(raw: unknown): SchoolSubmissions | null {
  if (!isPlainObject(raw)) return null;

  const selfRaw = isPlainObject(raw.selfReport) ? raw.selfReport : {};
  const name = asString(selfRaw.name).trim();
  const sourceUrl = asString(selfRaw.sourceUrl).trim();
  const selfReport: SchoolSubmissions["selfReport"] = {
    state: asSelfReportState(selfRaw.state),
    note: asString(selfRaw.note),
  };
  if (name) selfReport.name = name;
  if (sourceUrl) selfReport.sourceUrl = sourceUrl;

  const required: SchoolSubmissions["required"] = [];
  if (Array.isArray(raw.required)) {
    for (const item of raw.required) {
      if (!isPlainObject(item)) continue;
      const itemName = asString(item.name).trim();
      const itemSource = asString(item.sourceUrl).trim();
      if (!itemName || !itemSource) continue;
      required.push({
        name: itemName,
        description: asString(item.description),
        how: asString(item.how),
        sourceUrl: itemSource,
      });
    }
  }

  const optional: SchoolSubmissions["optional"] = [];
  if (Array.isArray(raw.optional)) {
    for (const item of raw.optional) {
      if (!isPlainObject(item)) continue;
      const itemName = asString(item.name).trim();
      const itemSource = asString(item.sourceUrl).trim();
      if (!itemName || !itemSource) continue;
      optional.push({
        type: asSubmissionType(item.type),
        name: itemName,
        who: asString(item.who),
        how: asString(item.how),
        deadline: asString(item.deadline),
        sourceUrl: itemSource,
      });
    }
  }

  const notAccepted: SchoolSubmissions["notAccepted"] = [];
  if (Array.isArray(raw.notAccepted)) {
    for (const item of raw.notAccepted) {
      if (!isPlainObject(item)) continue;
      const label = asString(item.item).trim();
      const itemSource = asString(item.sourceUrl).trim();
      if (!label || !itemSource) continue;
      notAccepted.push({ item: label, sourceUrl: itemSource });
    }
  }

  return {
    cycle: asString(raw.cycle),
    selfReport,
    required,
    optional,
    notAccepted,
    notes: asString(raw.notes),
  };
}

export function selfReportListLabel(submissions: SchoolSubmissions | null): string {
  if (!submissions) return "";
  switch (submissions.selfReport.state) {
    case "req":
      return submissions.selfReport.name?.trim() || "Required";
    case "mod":
      return "In app";
    case "no":
      return "—";
    default:
      return "";
  }
}

export function extraSubmissionTypes(submissions: SchoolSubmissions | null): SubmissionType[] {
  if (!submissions) return [];
  const seen = new Set<SubmissionType>();
  for (const item of submissions.optional) {
    if (item.type === "other") continue;
    seen.add(item.type);
  }
  return SUBMISSION_TYPE_ORDER.filter((type) => type !== "other" && seen.has(type));
}

export function sortOptionalSubmissions(
  items: SchoolSubmissions["optional"],
): SchoolSubmissions["optional"] {
  const rank = new Map(SUBMISSION_TYPE_ORDER.map((type, index) => [type, index]));
  return [...items].sort((a, b) => (rank.get(a.type) ?? 99) - (rank.get(b.type) ?? 99));
}

export function formatCheckedDate(iso: string): string {
  const match = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso.trim();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function optionalDetailLine(item: {
  who: string;
  how: string;
  deadline: string;
}): string {
  const parts: string[] = [];
  if (item.who.trim()) parts.push(`Who: ${item.who.trim()}`);
  if (item.how.trim()) parts.push(`How: ${item.how.trim()}`);
  if (item.deadline.trim()) parts.push(`Deadline: ${item.deadline.trim()}`);
  return parts.join(". ");
}

export const SUBMISSIONS_RESEARCH_SHAPE =
  '{ cycle: string, selfReport: { state: "req"|"mod"|"no"|"unk", name?: string, note: string, sourceUrl?: string }, required: [{ name, description, how, sourceUrl }], optional: [{ type: "arts"|"maker"|"research"|"resume"|"additional_rec"|"video"|"other", name, who, how, deadline, sourceUrl }], notAccepted: [{ item, sourceUrl }], notes: string }';
