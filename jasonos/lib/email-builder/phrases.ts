// Email Builder phrase memory — normalize text, suggest structured tags,
// and rank tips for tap chips. Pure helpers (no server imports).

export type PhraseField = "relationship" | "detail" | "ask";

export type BuilderPhrase = {
  id: string;
  field: PhraseField;
  phrase: string;
  tags: string[];
  useCount: number;
  lastUsedAt: string;
};

/** Collapse whitespace + lowercase for uniqueness / search. */
export function normalizePhrase(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().toLowerCase();
}

export const RELATIONSHIP_TAG_OPTIONS: { key: string; label: string }[] = [
  { key: "company:outfront", label: "OUTFRONT" },
  { key: "company:omnicom", label: "Omnicom" },
  { key: "former_colleague", label: "Former colleague" },
  { key: "client", label: "Client" },
  { key: "mutual", label: "Mutual connection" },
  { key: "met_at_event", label: "Met at event" },
  { key: "same_team", label: "Same team" },
  { key: "vendor", label: "Vendor / partner" },
];

export const DETAIL_TAG_OPTIONS: { key: string; label: string }[] = [
  { key: "topic:new_role", label: "New role / job" },
  { key: "topic:funding", label: "Funding / news" },
  { key: "topic:project", label: "Project" },
  { key: "memory", label: "Shared memory" },
  { key: "news", label: "Something I saw" },
  { key: "meeting_followup", label: "Meeting follow-up" },
];

export const ASK_TAG_OPTIONS: { key: string; label: string }[] = [
  { key: "ask:meeting", label: "Book a meeting" },
  { key: "ask:catchup", label: "Catch up" },
  { key: "ask:intro", label: "Intro" },
  { key: "ask:advice", label: "Advice" },
  { key: "ask:referral", label: "Referral / job lead" },
  { key: "ask:pitch", label: "Pitch" },
  { key: "soft_ask", label: "Soft / no hard ask" },
];

export function tagOptionsForField(
  field: PhraseField
): { key: string; label: string }[] {
  if (field === "relationship") return RELATIONSHIP_TAG_OPTIONS;
  if (field === "detail") return DETAIL_TAG_OPTIONS;
  return ASK_TAG_OPTIONS;
}

/**
 * Guess tags from free text so the confirm UI has a sensible starting set.
 * Jason still confirms before save.
 */
export function suggestTagsForPhrase(
  field: PhraseField,
  phrase: string
): string[] {
  const t = normalizePhrase(phrase);
  if (!t) return [];
  const out = new Set<string>();

  if (field === "relationship") {
    if (/\bout\s*-?\s*front\b/.test(t) || t === "outfront") {
      out.add("company:outfront");
      out.add("former_colleague");
    }
    if (/\bomnicom\b/.test(t)) {
      out.add("company:omnicom");
      out.add("former_colleague");
    }
    if (/\bcolleague|coworker|worked (with|together)\b/.test(t)) {
      out.add("former_colleague");
    }
    if (/\bclient\b/.test(t)) out.add("client");
    if (/\bmutual|introduced|intro from\b/.test(t)) out.add("mutual");
    if (/\bevent|conference|dinner|cannes|adweek\b/.test(t)) {
      out.add("met_at_event");
    }
    if (/\bteam|same (group|org)\b/.test(t)) out.add("same_team");
    if (/\bvendor|partner|agency\b/.test(t)) out.add("vendor");
  }

  if (field === "detail") {
    if (/\bnew (job|role|gig|position|seat)\b/.test(t)) {
      out.add("topic:new_role");
    }
    if (/\bfund|raised|series [a-d]|ipo\b/.test(t)) out.add("topic:funding");
    if (/\bproject|sprint|launch\b/.test(t)) out.add("topic:project");
    if (/\bremember|offsite|years ago|that time\b/.test(t)) out.add("memory");
    if (/\bsaw|read|heard|linked\b/.test(t)) out.add("news");
    if (/\bfollow[- ]?up|yesterday|our call|our meeting\b/.test(t)) {
      out.add("meeting_followup");
    }
  }

  if (field === "ask") {
    if (/\b(20|30|15)\s*min|call|meeting|schedule\b/.test(t)) {
      out.add("ask:meeting");
    }
    if (/\bcatch up|coffee|check[- ]?in\b/.test(t)) out.add("ask:catchup");
    if (/\bintro\b/.test(t)) out.add("ask:intro");
    if (/\badvice|read on|your take\b/.test(t)) out.add("ask:advice");
    if (/\breferral|job lead|keep me in mind|role\b/.test(t)) {
      out.add("ask:referral");
    }
    if (/\bpitch|sprint|one-pager|idea for\b/.test(t)) out.add("ask:pitch");
    if (/\bno agenda|no ask|whenever\b/.test(t)) out.add("soft_ask");
  }

  return [...out];
}

/** Filter + rank tips for chips. Empty query → most-used / recent. */
export function filterPhrases(
  phrases: BuilderPhrase[],
  field: PhraseField,
  query: string,
  limit = 8
): BuilderPhrase[] {
  const q = normalizePhrase(query);
  const pool = phrases.filter((p) => p.field === field);
  const matched = q
    ? pool.filter(
        (p) =>
          normalizePhrase(p.phrase).includes(q) ||
          p.tags.some((tag) => tag.toLowerCase().includes(q))
      )
    : pool;

  return matched
    .slice()
    .sort((a, b) => {
      if (b.useCount !== a.useCount) return b.useCount - a.useCount;
      return b.lastUsedAt.localeCompare(a.lastUsedAt);
    })
    .slice(0, limit);
}

export function labelForTag(tag: string): string {
  const all = [
    ...RELATIONSHIP_TAG_OPTIONS,
    ...DETAIL_TAG_OPTIONS,
    ...ASK_TAG_OPTIONS,
  ];
  return all.find((t) => t.key === tag)?.label ?? tag.replace(/[_:]/g, " ");
}
