import {
  hrefFromMarkdownUrl,
  matchMdLink,
  mdLinkRe,
  rewriteMarkdownHrefs,
} from "./brief-links";

// Intercept Claude's published morning-brief markdown and turn it into a
// structured layout model. Known ## sections get dedicated UI; anything else
// falls through as an "extra" block so future headings still show up.
//
// Claude's formatting drifts day to day:
//   - Bold group headers may be alone on a line, OR followed by body text
//     on the same line: **Job search — noise.** LinkedIn alerts…
//   - Newsletter topics may live under ## Newsletter Digest as ### headings,
//     **bold** headers, or italic headers (*AI and Marketing*), OR nested
//     inside Email by Group. The Home UI always remaps them into three
//     buckets: Marketing and advertising, AI in general, AI in marketing
//     and advertising.
//   - Calendar bullets may bold only the time (`**10:00 AM** — Title`) or
//     bold time + title (`**10:00 AM — [Title](calendar-url)** — notes`).
export interface CalendarItem {
  time: string;
  /** Event name, often a markdown link to the Google Calendar event. */
  title: string | null;
  text: string;
}

export interface EmailGroup {
  title: string;
  /** Trailing phrase after an em-dash in the bold header, e.g. "high signal". */
  meta: string | null;
  body: string;
  bullets: string[];
}

export const NEWSLETTER_GROUP_IDS = [
  "marketing",
  "ai-general",
  "ai-marketing",
] as const;

export type NewsletterGroupId = (typeof NEWSLETTER_GROUP_IDS)[number];

export const NEWSLETTER_GROUP_TITLES: Record<NewsletterGroupId, string> = {
  marketing: "Marketing and advertising",
  "ai-general": "AI in general",
  "ai-marketing": "AI in marketing and advertising",
};

export interface NewsletterStory {
  title: string;
  /** First sentence / truncated summary for the digest card. */
  teaser: string;
  /** Full published summary (markdown links kept). */
  summary: string;
  url: string | null;
}

export interface NewsletterGroup {
  id: NewsletterGroupId;
  title: string;
  stories: NewsletterStory[];
}

export interface ExtraSection {
  title: string;
  bodyMd: string;
}

export interface ParsedMorningBrief {
  title: string | null;
  attention: string[];
  calendar: CalendarItem[];
  calendarNote: string | null;
  emailIntro: string | null;
  emailGroups: EmailGroup[];
  newsletters: NewsletterGroup[];
  footer: string | null;
  extras: ExtraSection[];
  /** True when we found at least one ## section worth structured rendering. */
  structured: boolean;
}

/**
 * Strip bold/italic/code for structured display, but KEEP markdown links
 * `[label](https://…)` and bare URLs so the UI can render them as clicks.
 */
function stripMdInline(s: string): string {
  const saved: string[] = [];
  const protect = (raw: string) => {
    const i = saved.length;
    saved.push(raw);
    return `\u0000L${i}\u0000`;
  };
  let out = rewriteMarkdownHrefs(s)
    // Protect markdown links first so bold/italic stripping can't mangle them.
    // URLs may contain spaces (Google Calendar `eid`).
    .replace(mdLinkRe(), (m) => protect(m))
    // Protect bare URLs next.
    .replace(/https?:\/\/[^\s<>"'`)\]}]+/g, (m) => protect(m))
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\\"/g, '"');
  out = out.replace(/\u0000L(\d+)\u0000/g, (_, i) => saved[Number(i)] ?? "");
  return out.trim();
}

function splitSections(md: string): { title: string | null; sections: { heading: string; body: string }[] } {
  const lines = md.replace(/\r\n/g, "\n").trim().split("\n");
  let title: string | null = null;
  const sections: { heading: string; body: string }[] = [];
  let current: { heading: string; body: string[] } | null = null;
  const preamble: string[] = [];

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1 && !title && !current) {
      title = stripMdInline(h1[1]);
      continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      if (current) {
        sections.push({ heading: current.heading, body: current.body.join("\n").trim() });
      }
      current = { heading: stripMdInline(h2[1]), body: [] };
      continue;
    }
    if (current) current.body.push(line);
    else if (line.trim()) preamble.push(line);
  }
  if (current) {
    sections.push({ heading: current.heading, body: current.body.join("\n").trim() });
  }
  void preamble;
  return { title, sections };
}

function normalizeKey(heading: string): string {
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const TIME_RE =
  /^(all\s*day|\d{1,2}:\d{2}(?:\s*[AP]M)?(?:\s*[–—-]\s*\d{1,2}:\d{2}(?:\s*[AP]M)?)?)\s*/i;

function stripLeadingDash(s: string): string {
  return s.replace(/^[—–-]\s*/, "").trim();
}

function splitTimePrefix(
  s: string
): { time: string; rest: string } | null {
  const m = s.trim().match(TIME_RE);
  if (!m) return null;
  return {
    time: m[1].replace(/\s+/g, " ").trim(),
    rest: s.trim().slice(m[0].length),
  };
}

/** Leading `[Title](url)` becomes the event title; the rest is notes. */
function splitTitleAndText(s: string): { title: string | null; text: string } {
  const cleaned = stripLeadingDash(s);
  if (!cleaned) return { title: null, text: "" };
  const md = matchMdLink(cleaned);
  if (md && md.index === 0) {
    const title = `[${md.label}](${md.url})`;
    const after = stripLeadingDash(cleaned.slice(md.length));
    return { title: stripMdInline(title), text: stripMdInline(after) };
  }
  return { title: null, text: stripMdInline(cleaned) };
}

function parseCalendarItem(raw: string): CalendarItem {
  const line = raw.trim();
  const bold = line.match(/^\*\*(.+?)\*\*\s*(.*)$/);
  const head = bold ? bold[1].trim() : "";
  const tail = bold ? (bold[2] ?? "").trim() : line;

  const fromHead = head ? splitTimePrefix(head) : null;
  const fromLine = fromHead ? null : splitTimePrefix(tail);

  if (fromHead) {
    const tailClean = stripLeadingDash(tail);
    const restClean = stripLeadingDash(fromHead.rest);
    if (restClean) {
      const titled = splitTitleAndText(restClean);
      if (titled.title) {
        return {
          time: fromHead.time,
          title: titled.title,
          text: [titled.text, stripMdInline(tailClean)].filter(Boolean).join(" — "),
        };
      }
      if (tailClean) {
        return {
          time: fromHead.time,
          title: titled.text || null,
          text: stripMdInline(tailClean),
        };
      }
      return { time: fromHead.time, title: null, text: titled.text };
    }
    return { time: fromHead.time, ...splitTitleAndText(tailClean) };
  }

  if (fromLine) {
    const titled = splitTitleAndText(fromLine.rest);
    return { time: fromLine.time, title: titled.title, text: titled.text };
  }

  const titled = splitTitleAndText(line.replace(/^\*\*|\*\*$/g, ""));
  return { time: "", title: titled.title, text: titled.text || stripMdInline(line) };
}

function parseCalendar(body: string): { items: CalendarItem[]; note: string | null } {
  const items: CalendarItem[] = [];
  const noteLines: string[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("-") || line.startsWith("*")) {
      items.push(parseCalendarItem(line.replace(/^[-*]\s+/, "")));
      continue;
    }
    noteLines.push(stripMdInline(line));
  }
  return { items, note: noteLines.length ? noteLines.join(" ") : null };
}

function parseAttention(body: string): { items: string[]; footer: string | null } {
  const items: string[] = [];
  const footerLines: string[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^\d+\.\s+(.+)$/);
    if (m) {
      items.push(stripMdInline(m[1]));
      continue;
    }
    if (line.startsWith("-") || line.startsWith("*")) {
      items.push(stripMdInline(line.replace(/^[-*]\s+/, "")));
      continue;
    }
    footerLines.push(stripMdInline(line));
  }
  return { items, footer: footerLines.length ? footerLines.join(" ") : null };
}

/** Bold group header at the start of a line, optional same-line body after. */
function matchBoldHeader(
  line: string
): { header: string; rest: string } | null {
  const m = line.trim().match(/^\*\*(.+?)\*\*\s*(.*)$/);
  if (!m) return null;
  // Trailing period inside the bold ("0 unread.") is decorative.
  const header = stripMdInline(m[1]).replace(/\.$/, "").trim();
  if (!header) return null;
  return { header, rest: m[2] ?? "" };
}

/** Italic-only topic header: *Marketing and Media News* */
function matchItalicHeader(line: string): string | null {
  const m = line.trim().match(/^\*([^*\n]+)\*\s*$/);
  if (!m) return null;
  const title = stripMdInline(m[1]);
  return title || null;
}

/** ### / #### topic header (today's Claude newsletter format). */
function matchAtxTopicHeader(line: string): string | null {
  const m = line.trim().match(/^#{3,6}\s+(.+)$/);
  if (!m) return null;
  const title = stripMdInline(m[1]).replace(/\.$/, "").trim();
  return title || null;
}

function emptyNewsletterBuckets(): Record<NewsletterGroupId, NewsletterGroup> {
  return {
    marketing: {
      id: "marketing",
      title: NEWSLETTER_GROUP_TITLES.marketing,
      stories: [],
    },
    "ai-general": {
      id: "ai-general",
      title: NEWSLETTER_GROUP_TITLES["ai-general"],
      stories: [],
    },
    "ai-marketing": {
      id: "ai-marketing",
      title: NEWSLETTER_GROUP_TITLES["ai-marketing"],
      stories: [],
    },
  };
}

function bucketsToGroups(
  buckets: Record<NewsletterGroupId, NewsletterGroup>
): NewsletterGroup[] {
  const groups = NEWSLETTER_GROUP_IDS.map((id) => buckets[id]);
  if (groups.every((g) => g.stories.length === 0)) return [];
  return groups;
}

/** Map Claude's drifting topic titles onto the three Home buckets. */
export function classifyNewsletterHeading(heading: string): NewsletterGroupId {
  const n = heading
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const hasAi =
    /\bai\b/.test(n) ||
    n.includes("artificial intelligence") ||
    n.includes("generative");
  const hasMarketing =
    /\b(market(?:ing|s)?|advertis(?:e|ing|ement|ements)?|brands?|cmo|martech|adtech|media)\b/.test(
      n
    );
  // "AI and Marketing" / "AI in marketing and advertising"
  if (hasAi && hasMarketing) return "ai-marketing";
  // "AI and Business" / "AI in general" / leftover AI headings
  if (hasAi) return "ai-general";
  return "marketing";
}

function mdToPlain(s: string): string {
  return rewriteMarkdownHrefs(s)
    .replace(mdLinkRe(), "$1")
    .replace(/https?:\/\/[^\s<>"'`)\]}]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function makeNewsletterTeaser(text: string, max = 140): string {
  const t = mdToPlain(text);
  if (!t) return "";
  const end = t.search(/[.!?]\s/);
  const sentence = end === -1 ? t : t.slice(0, end + 1);
  if (sentence.length <= max) return sentence;
  return `${sentence.slice(0, max - 1).trimEnd()}…`;
}

function firstMarkdownUrl(line: string): { label: string; url: string } | null {
  const m = matchMdLink(line);
  if (!m) return null;
  return { label: m.label, url: m.url };
}

export function parseNewsletterStory(raw: string): NewsletterStory | null {
  const line = raw.replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, "").trim();
  if (!line) return null;
  if (/^[-*_]{3,}$/.test(line)) return null;

  const mdAtStart = line.match(
    /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)(?:\s*[—–\-·:|]+\s*(.*))?$/
  );
  if (mdAtStart) {
    const title = mdAtStart[1].trim();
    const url = hrefFromMarkdownUrl(mdAtStart[2]);
    const rest = (mdAtStart[3] ?? "").trim();
    const summary = rest || title;
    return {
      title,
      url,
      summary,
      teaser: makeNewsletterTeaser(summary),
    };
  }

  const dash = line.match(/^(.+?)\s+[—–]\s+(.+)$/);
  const link = firstMarkdownUrl(line);
  if (dash) {
    const title = mdToPlain(dash[1]) || dash[1].trim();
    const summary = dash[2].trim();
    return {
      title,
      url: link?.url ?? null,
      summary,
      teaser: makeNewsletterTeaser(summary),
    };
  }

  if (link) {
    const summary = line;
    return {
      title: link.label,
      url: link.url,
      summary,
      teaser: makeNewsletterTeaser(mdToPlain(line)),
    };
  }

  const plain = mdToPlain(line);
  if (!plain) return null;
  const bare = line.match(/https?:\/\/[^\s<>"'`)\]}]+/);
  return {
    title: makeNewsletterTeaser(plain, 80) || plain,
    url: bare?.[0] ?? null,
    summary: line,
    teaser: makeNewsletterTeaser(plain),
  };
}

function storiesFromBody(body: string): NewsletterStory[] {
  return topicItems(body)
    .map(parseNewsletterStory)
    .filter((s): s is NewsletterStory => s !== null);
}

/**
 * Split a section body on bold headers. Headers may stand alone or be followed
 * by body text on the same line (today's Claude format).
 */
function splitBoldGroups(body: string): {
  intro: string | null;
  groups: { header: string; body: string }[];
} {
  const lines = body.split("\n");
  const intro: string[] = [];
  const groups: { header: string; body: string[] }[] = [];
  let current: { header: string; body: string[] } | null = null;

  for (const raw of lines) {
    const header = matchBoldHeader(raw);
    if (header) {
      if (current) groups.push({ header: current.header, body: current.body });
      current = { header: header.header, body: [] };
      if (header.rest.trim()) current.body.push(header.rest.trim());
      continue;
    }
    if (current) current.body.push(raw);
    else if (raw.trim()) intro.push(raw.trim());
  }
  if (current) groups.push({ header: current.header, body: current.body });

  const introRaw = intro
    .join(" ")
    .replace(/^\*+\s*|\s*\*+$/g, "")
    .replace(/^\(|\)$/g, "")
    .trim();
  return {
    intro: introRaw ? stripMdInline(introRaw) : null,
    groups: groups.map((g) => ({
      header: g.header,
      body: g.body.join("\n").trim(),
    })),
  };
}

/** True for column titles (Marketing and Media News), not inline bold leads. */
function isNewsletterTopicHeader(header: string): boolean {
  const n = header
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!n || n.length > 80) return false;
  return /\b(market(?:ing|s)?|media|advertis(?:e|ing)?|ai\b|artificial intelligence|business|general|digest|news)\b/.test(
    n
  );
}

/**
 * Split on bold OR italic topic headers (newsletter digest styles).
 * Lines before the first topic become `preface`.
 */
function splitTopicGroups(body: string): {
  preface: string;
  topics: { header: string; body: string }[];
} {
  const lines = body.split("\n");
  const preface: string[] = [];
  const topics: { header: string; body: string[] }[] = [];
  let current: { header: string; body: string[] } | null = null;

  const pushBody = (line: string) => {
    if (current) current.body.push(line);
    else if (line.trim()) preface.push(line);
  };

  for (const raw of lines) {
    const atx = matchAtxTopicHeader(raw);
    const bold = !atx ? matchBoldHeader(raw) : null;
    const italic = !atx && !bold ? matchItalicHeader(raw) : null;
    if (bold && bold.rest.trim() && !isNewsletterTopicHeader(bold.header)) {
      // Same-line bold lead-in, not a column title
      // (e.g. **Crunchbase / prospecting:** no clean ICP fits…).
      pushBody(`- ${bold.header} — ${bold.rest.trim()}`);
      continue;
    }
    if (atx || bold || italic) {
      if (current) topics.push({ header: current.header, body: current.body });
      if (atx) {
        current = { header: atx, body: [] };
      } else if (bold) {
        current = { header: bold.header, body: [] };
        if (bold.rest.trim()) current.body.push(bold.rest.trim());
      } else {
        current = { header: italic!, body: [] };
      }
      continue;
    }
    pushBody(raw);
  }
  if (current) topics.push({ header: current.header, body: current.body });

  return {
    preface: preface.join("\n").trim(),
    topics: topics.map((t) => ({
      header: t.header,
      body: t.body.join("\n").trim(),
    })),
  };
}

function splitTitleMeta(header: string): { title: string; meta: string | null } {
  const parts = header.split(/\s+[—–-]\s+/);
  if (parts.length < 2) return { title: header, meta: null };
  return {
    title: parts[0].trim(),
    meta: parts.slice(1).join(" — ").trim().replace(/\.$/, "") || null,
  };
}

function bulletsAndParas(body: string): { bullets: string[]; body: string } {
  const bullets: string[] = [];
  const paras: string[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    // Bullet lists only — bare italic topic lines are handled elsewhere.
    if (/^[-*]\s+/.test(line) && !matchItalicHeader(line)) {
      bullets.push(stripMdInline(line.replace(/^[-*]\s+/, "")));
    } else {
      paras.push(stripMdInline(line));
    }
  }
  return { bullets, body: paras.join("\n\n") };
}

function topicItems(body: string): string[] {
  const items: string[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[-*_]{3,}$/.test(line)) continue;
    if (matchAtxTopicHeader(line) || matchItalicHeader(line)) continue;
    if (/^[-*]\s+/.test(line)) {
      items.push(stripMdInline(line.replace(/^[-*]\s+/, "")));
      continue;
    }
    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      items.push(stripMdInline(numbered[1]));
      continue;
    }
    // Skip intro chrome ("Digest below.") unless it looks like a story.
    if (
      /https?:\/\//.test(line) ||
      /\[[^\]]+\]\(https?:/.test(line) ||
      /[—–]/.test(line)
    ) {
      items.push(stripMdInline(line));
    }
  }
  return items;
}

function isNewsletterBucket(title: string): boolean {
  const t = title.toLowerCase();
  return t.includes("newsletter") || t.includes("fyi");
}

function parseEmailGroups(body: string): {
  intro: string | null;
  groups: EmailGroup[];
  nestedNewsletters: NewsletterGroup[];
} {
  const { intro, groups: raw } = splitBoldGroups(body);
  const nestedNewsletters: NewsletterGroup[] = [];
  const groups: EmailGroup[] = [];

  for (const g of raw) {
    const { title, meta } = splitTitleMeta(g.header);

    // Newsletter / FYI buckets often nest topic digests (*Topic* + bullets)
    // instead of a separate ## Newsletter Digest section.
    if (isNewsletterBucket(title)) {
      const nested = parseNewsletters(g.body);
      if (nested.length > 0) {
        mergeNewsletterGroups(nestedNewsletters, nested);
        const { preface } = splitTopicGroups(g.body);
        const summary = bulletsAndParas(preface);
        groups.push({
          title,
          meta,
          body:
            summary.body ||
            (nestedNewsletters.length
              ? "See newsletter digest below."
              : ""),
          bullets: summary.bullets,
        });
        continue;
      }
    }

    const { bullets, body: paraBody } = bulletsAndParas(g.body);
    groups.push({ title, meta, body: paraBody, bullets });
  }

  return { intro, groups, nestedNewsletters };
}

function mergeNewsletterGroups(
  into: NewsletterGroup[],
  from: NewsletterGroup[]
): void {
  if (into.length === 0) {
    into.push(...from.map((g) => ({ ...g, stories: [...g.stories] })));
    return;
  }
  const byId = new Map(into.map((g) => [g.id, g]));
  for (const g of from) {
    const dest = byId.get(g.id);
    if (dest) dest.stories.push(...g.stories);
    else into.push({ ...g, stories: [...g.stories] });
  }
}

function parseNewsletters(body: string): NewsletterGroup[] {
  const buckets = emptyNewsletterBuckets();
  const { preface, topics } = splitTopicGroups(body);

  const addUnder = (id: NewsletterGroupId, stories: NewsletterStory[]) => {
    buckets[id].stories.push(...stories);
  };

  if (topics.length === 0) {
    const stories = storiesFromBody(body);
    for (const story of stories) {
      addUnder(
        classifyNewsletterHeading(`${story.title} ${story.summary}`),
        [story]
      );
    }
    return bucketsToGroups(buckets);
  }

  if (preface.trim()) {
    for (const story of storiesFromBody(preface)) {
      addUnder(
        classifyNewsletterHeading(`${story.title} ${story.summary}`),
        [story]
      );
    }
  }

  for (const t of topics) {
    addUnder(classifyNewsletterHeading(t.header), storiesFromBody(t.body));
  }

  return bucketsToGroups(buckets);
}

export function parseMorningBrief(md: string): ParsedMorningBrief {
  const empty: ParsedMorningBrief = {
    title: null,
    attention: [],
    calendar: [],
    calendarNote: null,
    emailIntro: null,
    emailGroups: [],
    newsletters: [],
    footer: null,
    extras: [],
    structured: false,
  };
  if (!md?.trim()) return empty;

  const { title, sections } = splitSections(md);
  if (sections.length === 0) {
    return {
      ...empty,
      title,
      extras: [{ title: "Brief", bodyMd: md }],
      structured: false,
    };
  }

  const parsed: ParsedMorningBrief = {
    ...empty,
    title,
    structured: true,
  };

  for (const sec of sections) {
    const key = normalizeKey(sec.heading);
    if (key.includes("calendar") || key.includes("schedule") || key === "today") {
      const cal = parseCalendar(sec.body);
      parsed.calendar = cal.items;
      parsed.calendarNote = cal.note;
      continue;
    }
    if (key.includes("email")) {
      const email = parseEmailGroups(sec.body);
      parsed.emailIntro = email.intro;
      parsed.emailGroups = email.groups;
      // Prefer a dedicated ## Newsletter Digest when present; otherwise use
      // topics nested under the Email newsletter bucket.
      if (email.nestedNewsletters.length && parsed.newsletters.length === 0) {
        parsed.newsletters = email.nestedNewsletters;
      } else if (email.nestedNewsletters.length) {
        // Digest section already filled — keep it; nested is redundant.
      }
      continue;
    }
    if (key.includes("newsletter") || key.includes("digest")) {
      parsed.newsletters = parseNewsletters(sec.body);
      continue;
    }
    if (
      key.includes("attention") ||
      key.includes("action") ||
      key.includes("needs your")
    ) {
      const att = parseAttention(sec.body);
      parsed.attention = att.items;
      if (att.footer) parsed.footer = att.footer;
      continue;
    }
    parsed.extras.push({ title: sec.heading, bodyMd: sec.body });
  }

  // If Email was parsed after Newsletter Digest and left nested topics unused
  // while digest is empty, fill from nested — handled above. If Email came
  // first and digest section overwrites, that's correct. If Email came first
  // and nested filled newsletters, then digest section overwrites — also
  // correct when both exist.
  //
  // Re-scan: when digest section is missing entirely, nested already set.
  // When digest exists but is empty and nested has topics, use nested.
  if (parsed.newsletters.length === 0) {
    for (const sec of sections) {
      if (!normalizeKey(sec.heading).includes("email")) continue;
      const email = parseEmailGroups(sec.body);
      if (email.nestedNewsletters.length) {
        parsed.newsletters = email.nestedNewsletters;
      }
    }
  }

  return parsed;
}
