export const DEFAULT_RELATIONSHIP_BRIEF_PROMPT = `You are writing a relationship brief for Jason about {{contact_name}} at {{company}}.

Use only the material below. Do not guess. If something is unknown, leave it out.

Emails: {{emails}}
Meetings and notes: {{meetings}}
Referrals: {{referrals}}
Role in Jason's search: {{role_in_search}}
About Jason: {{about_jason}}
Today: {{today}}

Write: a three-sentence summary; how they have helped Jason; what they have talked about; commitments each way with status; things worth remembering; one suggested next move. Cite the source (email or meeting and date) after every line. Plain language, no flattery.`;

export const RELATIONSHIP_BRIEF_VARIABLES = [
  "contact_name",
  "company",
  "role_in_search",
  "emails",
  "meetings",
  "referrals",
  "commitments",
  "about_jason",
  "today",
] as const;

export type RelationshipBriefVariable =
  (typeof RELATIONSHIP_BRIEF_VARIABLES)[number];

export const REQUIRED_BRIEF_VARIABLES = ["emails", "meetings"] as const;

export const BRIEF_SECTION_KEYS = [
  "summary",
  "helped",
  "topics",
  "commitments",
  "remember",
  "next_move",
] as const;

export type BriefSectionKey = (typeof BRIEF_SECTION_KEYS)[number];

export const BRIEF_SECTION_LABELS: Record<BriefSectionKey, string> = {
  summary: "Summary",
  helped: "How they have helped",
  topics: "Topics",
  commitments: "Commitments",
  remember: "Worth remembering",
  next_move: "Next move",
};

export type BriefSectionFlags = Record<BriefSectionKey, boolean>;

export const DEFAULT_BRIEF_SECTIONS: BriefSectionFlags = {
  summary: true,
  helped: true,
  topics: true,
  commitments: true,
  remember: true,
  next_move: true,
};

export function normalizeRelationshipBriefPrompt(
  value: string | null | undefined
): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length ? trimmed : null;
}

export function resolveRelationshipBriefPrompt(
  stored: string | null | undefined
): string {
  return normalizeRelationshipBriefPrompt(stored) ?? DEFAULT_RELATIONSHIP_BRIEF_PROMPT;
}

export function parseBriefSections(value: unknown): BriefSectionFlags {
  const next = { ...DEFAULT_BRIEF_SECTIONS };
  if (!value || typeof value !== "object") return next;
  const rec = value as Record<string, unknown>;
  for (const key of BRIEF_SECTION_KEYS) {
    if (typeof rec[key] === "boolean") next[key] = rec[key];
  }
  return next;
}

const VAR_RE = /\{\{\s*([a-z_]+)\s*\}\}/gi;

export function unknownBriefVariables(prompt: string): string[] {
  const known = new Set<string>(RELATIONSHIP_BRIEF_VARIABLES);
  const found = new Set<string>();
  for (const match of prompt.matchAll(VAR_RE)) {
    const name = (match[1] ?? "").toLowerCase();
    if (name && !known.has(name)) found.add(name);
  }
  return [...found].sort();
}

export function missingRequiredBriefVariables(prompt: string): string[] {
  const present = new Set<string>();
  for (const match of prompt.matchAll(VAR_RE)) {
    present.add((match[1] ?? "").toLowerCase());
  }
  return REQUIRED_BRIEF_VARIABLES.filter((name) => !present.has(name));
}

export function fillBriefPrompt(
  template: string,
  vars: Partial<Record<RelationshipBriefVariable, string>>
): string {
  return template.replace(VAR_RE, (_, name: string) => {
    const key = name.toLowerCase() as RelationshipBriefVariable;
    return vars[key] ?? "";
  });
}

export function mergeDoneCommitments<
  T extends { text: string; status: string },
>(generated: T[], previous: T[] | null | undefined): T[] {
  if (!previous?.length) return generated;
  const done = new Set(
    previous
      .filter((item) => item.status === "done")
      .map((item) => item.text.trim().toLowerCase())
  );
  if (!done.size) return generated;
  return generated.map((item) =>
    done.has(item.text.trim().toLowerCase())
      ? { ...item, status: "done" as T["status"] }
      : item
  );
}

export function briefSourceLinkLabel(source: {
  type: string;
  date: string;
}): string {
  const parsed = Date.parse(`${source.date}T00:00:00`);
  const when = Number.isFinite(parsed)
    ? new Date(parsed)
        .toLocaleDateString("en-US", { month: "short", day: "numeric" })
        .toUpperCase()
    : source.date;
  const kind =
    source.type === "email"
      ? "EMAIL"
      : source.type === "meeting"
        ? "MEETING"
        : source.type.toUpperCase();
  return `${kind} ${when}`;
}
