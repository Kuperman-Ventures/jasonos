// Intercept Claude's published morning-brief markdown and turn it into a
// structured layout model. Known ## sections get dedicated UI; anything else
// falls through as an "extra" block so future headings still show up.

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
  // Orphan preamble before the first ## becomes a footer-ish note only if we
  // have no other place for it — usually empty because the H1 is first.
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
    const m = line.match(
      /^[-*]\s+\*\*(.+?)\*\*\s*[—–-]\s*(.+)$/
    );
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

/** Split a section body on bold-only header lines: **Title — meta** */
function splitBoldGroups(body: string): { intro: string | null; groups: { header: string; body: string }[] } {
  const lines = body.split("\n");
  const intro: string[] = [];
  const groups: { header: string; body: string[] }[] = [];
  let current: { header: string; body: string[] } | null = null;

  for (const raw of lines) {
    const header = raw.trim().match(/^\*\*(.+?)\*\*\s*$/);
    if (header) {
      if (current) groups.push({ header: current.header, body: current.body });
      current = { header: stripMdInline(header[1]), body: [] };
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
    groups: groups.map((g) => ({ header: g.header, body: g.body.join("\n").trim() })),
  };
}

function splitTitleMeta(header: string): { title: string; meta: string | null } {
  const parts = header.split(/\s+[—–-]\s+/);
  if (parts.length < 2) return { title: header, meta: null };
  return { title: parts[0].trim(), meta: parts.slice(1).join(" — ").trim() };
}

function parseEmailGroups(body: string): { intro: string | null; groups: EmailGroup[] } {
  const { intro, groups } = splitBoldGroups(body);
  return {
    intro,
    groups: groups.map((g) => {
      const { title, meta } = splitTitleMeta(g.header);
      const bullets: string[] = [];
      const paras: string[] = [];
      for (const raw of g.body.split("\n")) {
        const line = raw.trim();
        if (!line) continue;
        if (line.startsWith("-") || line.startsWith("*")) {
          bullets.push(stripMdInline(line.replace(/^[-*]\s+/, "")));
        } else {
          paras.push(stripMdInline(line));
        }
      }
      return { title, meta, body: paras.join("\n\n"), bullets };
    }),
  };
}

function parseNewsletters(body: string): NewsletterGroup[] {
  const { groups } = splitBoldGroups(body);
  return groups.map((g) => {
    const items: string[] = [];
    for (const raw of g.body.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("-") || line.startsWith("*")) {
        items.push(stripMdInline(line.replace(/^[-*]\s+/, "")));
      } else {
        items.push(stripMdInline(line));
      }
    }
    return { title: g.header, items };
  });
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
    return { ...empty, title, extras: [{ title: "Brief", bodyMd: md }], structured: false };
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
      continue;
    }
    if (key.includes("newsletter") || key.includes("digest")) {
      parsed.newsletters = parseNewsletters(sec.body);
      continue;
    }
    if (key.includes("attention") || key.includes("action") || key.includes("needs your")) {
      const att = parseAttention(sec.body);
      parsed.attention = att.items;
      if (att.footer) parsed.footer = att.footer;
      continue;
    }
    parsed.extras.push({ title: sec.heading, bodyMd: sec.body });
  }

  return parsed;
}
