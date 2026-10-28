import { parseResearchBrief } from "@/lib/ai/research-brief";
import { capWords } from "@/lib/live/decks-helpers";

export type PersonContextSection = {
  key: string;
  label: string;
  text: string;
  words: number;
  source: string;
};

export type PersonContext = {
  contactId: string;
  name: string;
  sections: PersonContextSection[];
  missing: string[];
  text: string;
};

export const PERSON_SECTION_ORDER = [
  {
    key: "who",
    label: "Who they are",
    maxWords: 120,
    source: "contacts, companies",
  },
  {
    key: "connected",
    label: "How we are connected",
    maxWords: 120,
    source: "contacts",
  },
  {
    key: "why_agreed",
    label: "Why they agreed to talk",
    maxWords: 200,
    source: "browning_handoffs",
  },
  {
    key: "browning_brief",
    label: "Browning brief",
    maxWords: 400,
    source: "contacts, browning_handoffs",
  },
  {
    key: "research",
    label: "Research",
    maxWords: 400,
    source: "contacts, companies",
  },
  {
    key: "past",
    label: "Past conversations",
    maxWords: 300,
    source: "browning_conversations, meetings",
  },
  {
    key: "said",
    label: "What they told me before",
    maxWords: 300,
    source: "decks",
  },
  {
    key: "email",
    label: "Recent email",
    maxWords: 300,
    source: "touches",
  },
  {
    key: "notes",
    label: "Jason's notes",
    maxWords: 200,
    source: "contacts",
  },
] as const;

export type PersonSectionKey = (typeof PERSON_SECTION_ORDER)[number]["key"];

/** Trim order when the joined context exceeds the total word cap. */
export const PERSON_CONTEXT_TRIM_ORDER: PersonSectionKey[] = [
  "email",
  "said",
  "past",
  "research",
];

export const PERSON_CONTEXT_TOTAL_CAP = 2400;

const ET = "America/New_York";

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Dates as "Oct 12, 2026" in America/New_York. */
export function formatPersonDate(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? Date.parse(`${raw}T12:00:00.000Z`)
    : Date.parse(raw);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString("en-US", {
    timeZone: ET,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function plainWords(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return value
    .trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");
}

function line(label: string, value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  return `${label}: ${text}`;
}

function joinLines(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part?.trim())).join("\n");
}

function researchToText(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const model = parseResearchBrief(raw);
  if (model.empty) return null;
  const parts: string[] = [];
  if (model.lead) parts.push(model.lead);
  for (const bullet of model.bullets) parts.push(bullet);
  for (const note of model.notes) parts.push(note);
  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  return text || null;
}

function handoffBriefToText(brief: unknown): string | null {
  if (brief == null) return null;
  if (typeof brief === "string") return brief.trim() || null;
  if (typeof brief !== "object") return null;
  const row = brief as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ["why", "overlap", "ask"] as const) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) parts.push(value.trim());
  }
  if (Array.isArray(row.questions)) {
    for (const item of row.questions) {
      if (typeof item === "string" && item.trim()) parts.push(item.trim());
    }
  }
  if (parts.length) return parts.join("\n");
  try {
    const json = JSON.stringify(brief);
    return json && json !== "{}" && json !== "null" ? json : null;
  } catch {
    return null;
  }
}

function normalizeForOverlap(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Drop paragraphs that largely repeat the Who section. */
export function dedupeAgainstWho(text: string, whoText: string): string {
  const whoNorm = normalizeForOverlap(whoText);
  if (!whoNorm) return text.trim();
  const whoWords = new Set(whoNorm.split(" ").filter(Boolean));
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const kept: string[] = [];
  for (const block of blocks) {
    const norm = normalizeForOverlap(block);
    if (!norm) continue;
    if (whoNorm.includes(norm) || norm.includes(whoNorm)) continue;
    const words = norm.split(" ").filter(Boolean);
    if (words.length >= 4) {
      const overlap = words.filter((word) => whoWords.has(word)).length;
      if (overlap / words.length >= 0.7) continue;
    }
    kept.push(block);
  }
  return kept.join("\n\n").trim();
}

function makeSection(
  key: PersonSectionKey,
  text: string
): PersonContextSection | null {
  const def = PERSON_SECTION_ORDER.find((row) => row.key === key);
  if (!def) return null;
  const flat = text.trim().replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  const words = flat.split(/\s+/).filter(Boolean);
  const clipped =
    words.length <= def.maxWords ? flat : `${words.slice(0, def.maxWords).join(" ")}…`;
  if (!clipped.trim()) return null;
  return {
    key: def.key,
    label: def.label,
    text: clipped.trim(),
    words: countWords(clipped),
    source: def.source,
  };
}

export function joinPersonContextText(
  name: string,
  sections: PersonContextSection[]
): string {
  const parts = [`PERSON CONTEXT: ${name.trim() || "(unknown)"}`];
  for (const section of sections) {
    parts.push(`${section.label}\n${section.text}`);
  }
  return parts.join("\n\n");
}

export function trimPersonContextSections(
  sections: PersonContextSection[],
  maxWords = PERSON_CONTEXT_TOTAL_CAP
): PersonContextSection[] {
  let total = sections.reduce((sum, row) => sum + row.words, 0);
  if (total <= maxWords) return sections;

  const byKey = new Map(sections.map((row) => [row.key, { ...row }]));
  for (const key of PERSON_CONTEXT_TRIM_ORDER) {
    if (total <= maxWords) break;
    const section = byKey.get(key);
    if (!section) continue;
    total -= section.words;
    byKey.delete(key);
  }
  return PERSON_SECTION_ORDER.map((def) => byKey.get(def.key)).filter(
    (row): row is PersonContextSection => Boolean(row)
  );
}

export type PersonContextInput = {
  contactId: string;
  name: string;
  title?: string | null;
  companyName?: string | null;
  location?: string | null;
  linkedinUrl?: string | null;
  networkRole?: string | null;
  relationshipType?: string | null;
  intent?: string | null;
  tags?: string[] | null;
  browningSource?: string | null;
  browningTier?: number | null;
  referredAt?: string | null;
  referrerName?: string | null;
  referrerTitle?: string | null;
  referrerCompany?: string | null;
  handoff?: {
    whyTheyReplied?: string | null;
    quotedReply?: string | null;
    introReason?: string | null;
    availabilityNote?: string | null;
    replyExcerpt?: string | null;
    brief?: unknown;
    meetingBrief?: string | null;
  } | null;
  browningPrep?: string | null;
  researchBrief?: string | null;
  researchAt?: string | null;
  companyResearchBrief?: string | null;
  companyDescription?: string | null;
  companyResearchAt?: string | null;
  conversations?: Array<{
    date: string;
    channel?: string | null;
    warmth?: number | null;
    referralsReceived?: number | null;
    whatWasHard?: string | null;
    whatToDoDifferently?: string | null;
  }>;
  meetings?: Array<{
    date: string;
    prepGoal?: string | null;
    debriefNotes?: string | null;
    nextStep?: string | null;
  }>;
  saidCommitted?: Array<{
    date: string;
    said: string[];
    committed: string[];
  }>;
  touches?: Array<{
    date: string;
    direction?: string | null;
    subject?: string | null;
    body?: string | null;
  }>;
  notes?: string | null;
  personalGoal?: string | null;
};

function buildWho(input: PersonContextInput): string {
  const tags =
    Array.isArray(input.tags) && input.tags.length
      ? input.tags.map((tag) => String(tag).trim()).filter(Boolean).join(", ")
      : null;
  const tier =
    typeof input.browningTier === "number" && Number.isFinite(input.browningTier)
      ? `Browning tier ${input.browningTier}`
      : null;
  return joinLines([
    line("Name", input.name),
    line("Title", input.title),
    line("Company", input.companyName),
    line("Location", input.location),
    line("LinkedIn", input.linkedinUrl),
    line("Network role", plainWords(input.networkRole)),
    line("Relationship", plainWords(input.relationshipType)),
    line("Intent", plainWords(input.intent)),
    line("Tags", tags),
    line("Browning source", plainWords(input.browningSource)),
    tier,
  ]);
}

function buildConnected(input: PersonContextInput): string {
  if (!input.referrerName?.trim() && !input.referredAt) return "";
  const referrerBits = [
    input.referrerName?.trim(),
    input.referrerTitle?.trim(),
    input.referrerCompany?.trim(),
  ]
    .filter(Boolean)
    .join(", ");
  return joinLines([
    line("Referred by", referrerBits || null),
    line("Referred", formatPersonDate(input.referredAt)),
  ]);
}

function buildWhyAgreed(input: PersonContextInput): string {
  const h = input.handoff;
  if (!h) return "";
  return joinLines([
    line("Why they replied", h.whyTheyReplied),
    line("Quoted reply", h.quotedReply),
    line("Intro reason", h.introReason),
    line("Availability", h.availabilityNote),
    line("Reply excerpt", h.replyExcerpt),
  ]);
}

function buildBrowningBrief(input: PersonContextInput, whoText: string): string {
  const chunks: string[] = [];
  if (input.browningPrep?.trim()) chunks.push(input.browningPrep.trim());
  const brief = handoffBriefToText(input.handoff?.brief);
  if (brief) chunks.push(brief);
  if (input.handoff?.meetingBrief?.trim()) chunks.push(input.handoff.meetingBrief.trim());
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const chunk of chunks) {
    const key = normalizeForOverlap(chunk);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(chunk);
  }
  return dedupeAgainstWho(unique.join("\n\n"), whoText);
}

function buildResearch(input: PersonContextInput): string {
  const parts: string[] = [];
  const person = researchToText(input.researchBrief);
  if (person) {
    const date = formatPersonDate(input.researchAt);
    parts.push(
      date ? `Person research (researched ${date}): ${person}` : `Person research: ${person}`
    );
  }
  const company =
    researchToText(input.companyResearchBrief) ||
    (input.companyDescription?.trim() || null);
  if (company) {
    const date = formatPersonDate(input.companyResearchAt);
    const label = input.companyName?.trim()
      ? `Company research (${input.companyName.trim()})`
      : "Company research";
    parts.push(date ? `${label} (researched ${date}): ${company}` : `${label}: ${company}`);
  }
  return parts.join("\n");
}

function buildPast(input: PersonContextInput): string {
  const parts: string[] = [];
  for (const row of input.conversations ?? []) {
    const date = formatPersonDate(row.date) || row.date;
    const bits = [
      date,
      row.channel ? `channel ${row.channel}` : null,
      typeof row.warmth === "number" ? `warmth ${row.warmth}` : null,
      typeof row.referralsReceived === "number"
        ? `referrals received ${row.referralsReceived}`
        : null,
      row.whatWasHard?.trim() ? `what was hard: ${row.whatWasHard.trim()}` : null,
      row.whatToDoDifferently?.trim()
        ? `do differently: ${row.whatToDoDifferently.trim()}`
        : null,
    ].filter(Boolean);
    if (bits.length) parts.push(bits.join(" · "));
  }
  for (const row of input.meetings ?? []) {
    const date = formatPersonDate(row.date) || row.date;
    const bits = [
      date,
      row.prepGoal?.trim() ? `prep goal: ${row.prepGoal.trim()}` : null,
      row.debriefNotes?.trim() ? `debrief: ${row.debriefNotes.trim()}` : null,
      row.nextStep?.trim() ? `next step: ${row.nextStep.trim()}` : null,
    ].filter(Boolean);
    if (bits.length > 1) parts.push(bits.join(" · "));
  }
  return parts.join("\n");
}

function buildSaid(input: PersonContextInput): string {
  const parts: string[] = [];
  for (const row of input.saidCommitted ?? []) {
    const date = formatPersonDate(row.date) || row.date;
    for (const lineText of row.said ?? []) {
      if (lineText.trim()) parts.push(`${date}: ${lineText.trim()}`);
    }
    for (const lineText of row.committed ?? []) {
      if (lineText.trim()) parts.push(`${date}: committed — ${lineText.trim()}`);
    }
  }
  return parts.join("\n");
}

function buildEmail(input: PersonContextInput): string {
  const parts: string[] = [];
  for (const row of (input.touches ?? []).slice(0, 5)) {
    const date = formatPersonDate(row.date) || row.date;
    const body = row.body?.trim()
      ? capWords(row.body.trim().replace(/\s+/g, " "), 60)
      : null;
    const bits = [
      date,
      row.direction?.trim() || null,
      row.subject?.trim() ? `subject: ${row.subject.trim()}` : null,
      body,
    ].filter(Boolean);
    if (bits.length) parts.push(bits.join(" · "));
  }
  return parts.join("\n");
}

function buildNotes(input: PersonContextInput): string {
  return joinLines([
    line("Notes", input.notes),
    line("Personal goal", input.personalGoal),
  ]);
}

/** Assemble PersonContext from already-loaded CRM rows (pure; used by tests). */
export function assemblePersonContext(input: PersonContextInput): PersonContext {
  const name = input.name?.trim() || "(unknown)";
  const whoText = buildWho(input);
  const builders: Record<PersonSectionKey, () => string> = {
    who: () => whoText,
    connected: () => buildConnected(input),
    why_agreed: () => buildWhyAgreed(input),
    browning_brief: () => buildBrowningBrief(input, whoText),
    research: () => buildResearch(input),
    past: () => buildPast(input),
    said: () => buildSaid(input),
    email: () => buildEmail(input),
    notes: () => buildNotes(input),
  };

  const sections: PersonContextSection[] = [];
  const missing: string[] = [];
  for (const def of PERSON_SECTION_ORDER) {
    const text = builders[def.key]().trim();
    const section = text ? makeSection(def.key, text) : null;
    if (section) sections.push(section);
    else missing.push(def.label);
  }

  const trimmed = trimPersonContextSections(sections, PERSON_CONTEXT_TOTAL_CAP);
  // Sections dropped by the total cap become missing.
  const keptKeys = new Set(trimmed.map((row) => row.key));
  for (const def of PERSON_SECTION_ORDER) {
    if (keptKeys.has(def.key)) continue;
    if (!missing.includes(def.label) && sections.some((row) => row.key === def.key)) {
      missing.push(def.label);
    }
  }

  return {
    contactId: input.contactId,
    name,
    sections: trimmed,
    missing,
    text: joinPersonContextText(name, trimmed),
  };
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function reviewStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

type Sb = {
  from: (table: string) => any;
};

async function loadPersonContextInput(
  sb: Sb,
  contactId: string
): Promise<PersonContextInput | null> {
  const { data: contact, error } = await sb
    .from("contacts")
    .select(
      "id, name, title, linkedin_url, network_role, relationship_type, intent, tags, browning_source, browning_tier, referred_by_contact_id, referred_at, browning_prep, research_brief, research_at, notes, personal_goal, companies(name, description, research_brief, research_at)"
    )
    .eq("id", contactId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!contact) return null;

  const companyRaw = contact.companies as
    | {
        name?: string | null;
        description?: string | null;
        research_brief?: string | null;
        research_at?: string | null;
      }
    | {
        name?: string | null;
        description?: string | null;
        research_brief?: string | null;
        research_at?: string | null;
      }[]
    | null;
  const company = Array.isArray(companyRaw) ? companyRaw[0] : companyRaw;

  let referrerName: string | null = null;
  let referrerTitle: string | null = null;
  let referrerCompany: string | null = null;
  const referrerId =
    typeof contact.referred_by_contact_id === "string"
      ? contact.referred_by_contact_id
      : null;
  if (referrerId) {
    const { data: referrer, error: refError } = await sb
      .from("contacts")
      .select("id, name, title, companies(name)")
      .eq("id", referrerId)
      .maybeSingle();
    if (refError) throw new Error(refError.message);
    if (referrer) {
      referrerName = (referrer.name as string | null)?.trim() || null;
      referrerTitle = (referrer.title as string | null)?.trim() || null;
      const refCo = referrer.companies as
        | { name?: string | null }
        | { name?: string | null }[]
        | null;
      const co = Array.isArray(refCo) ? refCo[0] : refCo;
      referrerCompany = co?.name?.trim() || null;
    }
  }

  const { data: handoffRows, error: handoffError } = await sb
    .from("browning_handoffs")
    .select(
      "why_they_replied, quoted_reply, intro_reason, availability_note, reply_excerpt, brief, meeting_brief, created_at, existing_contact_id, created_contact_id"
    )
    .or(`existing_contact_id.eq.${contactId},created_contact_id.eq.${contactId}`)
    .order("created_at", { ascending: false })
    .limit(1);
  if (handoffError) throw new Error(handoffError.message);
  const handoffRow = handoffRows?.[0] ?? null;

  const { data: conversationRows, error: convError } = await sb
    .from("browning_conversations")
    .select(
      "conversation_date, channel, warmth, referrals_received, what_was_hard, what_to_do_differently"
    )
    .eq("contact_id", contactId)
    .order("conversation_date", { ascending: false });
  if (convError) throw new Error(convError.message);

  const { data: meetingRows, error: meetingError } = await sb
    .from("meetings")
    .select("scheduled_at, held_at, prep_goal, debrief_notes, next_step")
    .eq("contact_id", contactId)
    .order("scheduled_at", { ascending: false });
  if (meetingError) throw new Error(meetingError.message);

  const { data: touchRows, error: touchError } = await sb
    .from("touches")
    .select("occurred_at, direction, subject, body")
    .eq("contact_id", contactId)
    .order("occurred_at", { ascending: false })
    .limit(5);
  if (touchError) throw new Error(touchError.message);

  const saidCommitted: PersonContextInput["saidCommitted"] = [];
  const { data: reviewedDecks, error: deckError } = await sb
    .from("decks")
    .select("id, reviewed_at, review, meeting_prep_id")
    .eq("kind", "deck")
    .not("reviewed_at", "is", null)
    .not("meeting_prep_id", "is", null)
    .order("reviewed_at", { ascending: false })
    .limit(80);
  if (deckError) throw new Error(deckError.message);
  const reviewedPrepIds = [
    ...new Set(
      (reviewedDecks ?? [])
        .map((row: { meeting_prep_id?: string | null }) => row.meeting_prep_id)
        .filter((value: string | null | undefined): value is string => Boolean(value))
    ),
  ];
  if (reviewedPrepIds.length) {
    const { data: prepRows, error: prepError } = await sb
      .from("meeting_preps")
      .select("id, starts_at, attendees")
      .in("id", reviewedPrepIds);
    if (prepError) throw new Error(prepError.message);
    const matchingPrepIds = new Set(
      (prepRows ?? [])
        .filter((row: { attendees?: unknown }) => {
          const attendees = Array.isArray(row.attendees) ? row.attendees : [];
          return attendees.some((item) => {
            if (!item || typeof item !== "object") return false;
            const id =
              (item as { contact_id?: unknown }).contact_id ??
              (item as { contactId?: unknown }).contactId;
            return id === contactId;
          });
        })
        .map((row: { id: string }) => row.id)
    );
    const prepById = new Map(
      (prepRows ?? []).map((row: { id: string; starts_at: string | null }) => [
        row.id,
        row.starts_at,
      ])
    );
    for (const deck of reviewedDecks ?? []) {
      const prepId = deck.meeting_prep_id as string | null;
      if (!prepId || !matchingPrepIds.has(prepId)) continue;
      const review = deck.review as { said?: unknown; committed?: unknown } | null;
      if (!review || typeof review !== "object") continue;
      const said = reviewStringList(review.said);
      const committed = reviewStringList(review.committed);
      if (!said.length && !committed.length) continue;
      const date =
        (prepById.get(prepId) as string | null | undefined) ||
        (deck.reviewed_at as string);
      saidCommitted.push({ date, said, committed });
    }
  }

  return {
    contactId,
    name: String(contact.name ?? "").trim() || "(unknown)",
    title: (contact.title as string | null) ?? null,
    companyName: company?.name ?? null,
    linkedinUrl: (contact.linkedin_url as string | null) ?? null,
    networkRole: (contact.network_role as string | null) ?? null,
    relationshipType: (contact.relationship_type as string | null) ?? null,
    intent: (contact.intent as string | null) ?? null,
    tags: asStringList(contact.tags),
    browningSource: (contact.browning_source as string | null) ?? null,
    browningTier:
      typeof contact.browning_tier === "number" ? contact.browning_tier : null,
    referredAt: (contact.referred_at as string | null) ?? null,
    referrerName,
    referrerTitle,
    referrerCompany,
    handoff: handoffRow
      ? {
          whyTheyReplied: (handoffRow.why_they_replied as string | null) ?? null,
          quotedReply: (handoffRow.quoted_reply as string | null) ?? null,
          introReason: (handoffRow.intro_reason as string | null) ?? null,
          availabilityNote: (handoffRow.availability_note as string | null) ?? null,
          replyExcerpt: (handoffRow.reply_excerpt as string | null) ?? null,
          brief: handoffRow.brief,
          meetingBrief: (handoffRow.meeting_brief as string | null) ?? null,
        }
      : null,
    browningPrep: (contact.browning_prep as string | null) ?? null,
    researchBrief: (contact.research_brief as string | null) ?? null,
    researchAt: (contact.research_at as string | null) ?? null,
    companyResearchBrief: company?.research_brief ?? null,
    companyDescription: company?.description ?? null,
    companyResearchAt: company?.research_at ?? null,
    conversations: (conversationRows ?? []).map(
      (row: {
        conversation_date: string;
        channel: string | null;
        warmth: number | null;
        referrals_received: number | null;
        what_was_hard: string | null;
        what_to_do_differently: string | null;
      }) => ({
        date: row.conversation_date,
        channel: row.channel,
        warmth: row.warmth,
        referralsReceived: row.referrals_received,
        whatWasHard: row.what_was_hard,
        whatToDoDifferently: row.what_to_do_differently,
      })
    ),
    meetings: (meetingRows ?? []).map(
      (row: {
        scheduled_at: string | null;
        held_at: string | null;
        prep_goal: string | null;
        debrief_notes: string | null;
        next_step: string | null;
      }) => ({
        date: row.held_at || row.scheduled_at || "",
        prepGoal: row.prep_goal,
        debriefNotes: row.debrief_notes,
        nextStep: row.next_step,
      })
    ),
    saidCommitted,
    touches: (touchRows ?? []).map(
      (row: {
        occurred_at: string;
        direction: string | null;
        subject: string | null;
        body: string | null;
      }) => ({
        date: row.occurred_at,
        direction: row.direction,
        subject: row.subject,
        body: row.body,
      })
    ),
    notes: (contact.notes as string | null) ?? null,
    personalGoal: (contact.personal_goal as string | null) ?? null,
  };
}

export async function buildPersonContext(contactId: string): Promise<PersonContext> {
  const id = contactId.trim();
  if (!id) {
    return {
      contactId: "",
      name: "(unknown)",
      sections: [],
      missing: PERSON_SECTION_ORDER.map((row) => row.label),
      text: "PERSON CONTEXT: (unknown)",
    };
  }
  const { createServiceRoleClient } = await import("@/lib/supabase/server");
  const sb = createServiceRoleClient();
  const input = await loadPersonContextInput(sb, id);
  if (!input) {
    return {
      contactId: id,
      name: "(unknown)",
      sections: [],
      missing: PERSON_SECTION_ORDER.map((row) => row.label),
      text: "PERSON CONTEXT: (unknown)",
    };
  }
  return assemblePersonContext(input);
}

export function formatFoundMissingLine(ctx: PersonContext): string {
  const found = ctx.sections.map((row) => row.label.toLowerCase());
  const missing = ctx.missing.map((label) => label.toLowerCase());
  const foundPart = found.length ? `Found: ${found.join(", ")}.` : "Found: none.";
  const missingPart = missing.length
    ? `Missing: ${missing.join(", ")}.`
    : "Missing: none.";
  return `${foundPart} ${missingPart}`;
}
