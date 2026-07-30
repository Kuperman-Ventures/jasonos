// Intercept Claude's published morning-brief markdown and turn it into a
// structured layout model. Known ## sections get dedicated UI; anything else
// falls through as an "extra" block so future headings still show up.
//
// Claude's formatting drifts day to day:
//   - Bold group headers may be alone on a line, OR followed by body text
//     on the same line: **Job search — noise.** LinkedIn alerts…
//   - Newsletter topics may live under ## Newsletter Digest (bold headers)
//     OR nested inside Email by Group as italic headers (*AI and Marketing*).

export interface CalendarItem {
  time: string;
  text: string;
}

export interface EmailGroup {
  title: string;
  /** Trailing phrase after an em-dash in the bold header, e.g. "high signal". */
  meta: string | null;
  body: string;
  bullets: string[];
}

export interface NewsletterGroup {
  title: string;
  items: string[];
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

function stripMdInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\\"/g, '"')
    .trim();
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

function parseCalendar(body: string): { items: CalendarItem[]; note: string | null } {
  const items: CalendarItem[] = [];
  const noteLines: string[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    // - **10:00–11:00 AM** — event text
    const m = line.match(/^[-*]\s+\*\*(.+?)\*\*\s*[—–-]\s*(.+)$/);
    if (m) {
      items.push({ time: stripMdInline(m[1]), text: stripMdInline(m[2]) });
      continue;
    }
    if (line.startsWith("-") || line.startsWith("*")) {
      items.push({ time: "", text: stripMdInline(line.replace(/^[-*]\s+/, "")) });
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

  for (const raw of lines) {
    const bold = matchBoldHeader(raw);
    const italic = !bold ? matchItalicHeader(raw) : null;
    if (bold || italic) {
      if (current) topics.push({ header: current.header, body: current.body });
      if (bold) {
        current = { header: bold.header, body: [] };
        if (bold.rest.trim()) current.body.push(bold.rest.trim());
      } else {
        current = { header: italic!, body: [] };
      }
      continue;
    }
    if (current) current.body.push(raw);
    else if (raw.trim()) preface.push(raw);
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
    if (/^[-*]\s+/.test(line) && !matchItalicHeader(line)) {
      items.push(stripMdInline(line.replace(/^[-*]\s+/, "")));
    } else {
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
      const { preface, topics } = splitTopicGroups(g.body);
      if (topics.length > 0) {
        for (const t of topics) {
          nestedNewsletters.push({
            title: t.header,
            items: topicItems(t.body),
          });
        }
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

function parseNewsletters(body: string): NewsletterGroup[] {
  const { topics } = splitTopicGroups(body);
  // Fall back to bold-only split if no topic headers matched.
  if (topics.length === 0) {
    const { groups } = splitBoldGroups(body);
    return groups.map((g) => ({
      title: g.header,
      items: topicItems(g.body),
    }));
  }
  return topics.map((t) => ({
    title: t.header,
    items: topicItems(t.body),
  }));
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
