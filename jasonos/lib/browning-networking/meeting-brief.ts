import { HANDOFF_OPENING } from "./types";

const OPENING = new RegExp(HANDOFF_OPENING.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

export const PREP_HEADINGS = [
  "Who they are",
  "Why Tracy thinks you should talk",
  "What to talk about",
  "Resume",
] as const;

/** Default Meeting Prep goal for Browning Connect calls (not the calendar title). */
export const BROWNING_PREP_GOAL =
  "Warm Browning intro — learn what they're focused on and where networks overlap";

const BOILERPLATE = [
  OPENING,
  /^attached please find the resume\b/i,
  /^good (morning|afternoon|evening)\b/i,
  /^dear\b/i,
  /^hi\b/i,
  /^hello\b/i,
  /^thanks?\b/i,
  /^thank you\b/i,
  /^best wishes\b/i,
  /^best,?\s*$/i,
  /^regards,?\s*$/i,
  /^tracy\b/i,
  /tracy santamaria/i,
  /browning associates/i,
  /find this mutually beneficial/i,
  /copying jason kuperman/i,
  /able to connect soon/i,
  /connecting via linkedin/i,
  /mutual familiarity/i,
  /reaching out to you today/i,
  /browning associates is working with/i,
  /expand (one another|each other).{0,40}professional networks/i,
  /please let me know if you would like a formal introduction/i,
  /i understand that you are very busy/i,
  /^jason kuperman will\b/i,
  /^kuperman\.?$/i,
  /safelinks\.protection\.outlook\.com/i,
  /linkedin\.com/i,
  /executivejobsearch\.net/i,
  /unsubscribe/i,
  /^_{2,}$/,
  /^\*+$/,
];

const SCHEDULING = [
  /\bi am available\b/i,
  /\bafter\s+\d/i,
  /\b(thursday|friday|monday|tuesday|wednesday|saturday|sunday)\b/i,
  /\bany day next week\b/i,
  /\bworks for me\b/i,
  /\blooking forward to chatting\b/i,
  /\bpleasure to connect\b/i,
];

export function meetingBrief(input: {
  name: string | null;
  tracyBody: string;
  resumeText: string | null;
  whyTheyReplied: string | null;
}): string | null {
  const resume = readResume(input.resumeText);
  const note = readTracyNote(input.tracyBody);
  const who = resume.who;
  const why = resume.why || note.why;
  const talk = resume.talk || note.talk;
  const points = resume.points;
  const parts: string[] = [];
  if (who) parts.push(`Who they are\n${who}`);
  if (why) parts.push(`Why Tracy thinks you should talk\n${why}`);
  if (talk) parts.push(`What to talk about\n${talk}`);
  if (points) parts.push(`Resume\n${points}`);
  const text = parts.join("\n\n").trim();
  return text.length >= 40 ? text : null;
}

/** Structured brief that still has signature / quote junk in a Tracy section. */
export function isPollutedMeetingBrief(brief: string | null | undefined): boolean {
  const text = (brief ?? "").trim();
  if (!text) return false;
  if (!text.startsWith("Who they are")) return false;
  return (
    /Best Wishes/i.test(text) ||
    /Tracy SantaMaria/i.test(text) ||
    /\bwrote:\s*>/i.test(text) ||
    /\bOn\s+\d{4}-\d{2}-\d{2}.{0,80}\bwrote:/i.test(text) ||
    /after\s+5\s*pm/i.test(text) ||
    /Browning Associates On\s+\d/i.test(text)
  );
}

export function isConnectTitleGoal(
  goal: string | null | undefined,
  contactName?: string | null
): boolean {
  const value = (goal ?? "").trim();
  if (!value) return false;
  if (/^Jason Kuperman\/.+: Connect$/i.test(value)) return true;
  const name = (contactName ?? "").trim();
  if (name && value === `Call with ${name}`) return true;
  return false;
}

export function prepSections(text: string): { heading: string; body: string }[] {
  const matches: { heading: string; index: number }[] = [];
  for (const heading of PREP_HEADINGS) {
    const index = text.indexOf(heading);
    if (index >= 0) matches.push({ heading, index });
  }
  matches.sort((a, b) => a.index - b.index);
  if (!matches.length) return [];
  return matches
    .map((match, i) => {
      const start = match.index + match.heading.length;
      const end = matches[i + 1]?.index ?? text.length;
      return { heading: match.heading, body: text.slice(start, end).trim() };
    })
    .filter((section) => section.body);
}

function readResume(resumeText: string | null): {
  who: string;
  why: string;
  talk: string;
  points: string;
} {
  const lines = resumeLines(resumeText);
  let summary: string[] = [];
  let why: string[] = [];
  let talk: string[] = [];
  let role = "";
  const points: string[] = [];
  let mode: "none" | "summary" | "why" | "talk" | "role" = "none";

  for (const line of lines) {
    const heading = headingKind(line);
    if (heading === "summary") {
      mode = "summary";
      continue;
    }
    if (heading === "why") {
      mode = "why";
      continue;
    }
    if (heading === "talk") {
      mode = "talk";
      continue;
    }
    if (heading === "stop") {
      mode = "none";
      continue;
    }
    if (isRole(line)) {
      if (!role) {
        role = line;
        mode = "role";
      } else {
        mode = "none";
      }
      continue;
    }
    if (mode === "summary" && summary.length < 3) summary.push(line);
    else if (mode === "why" && why.length < 3) why.push(line);
    else if (mode === "talk" && talk.length < 3) talk.push(line);
    else if (mode === "role" && points.length < 6) points.push(line);
  }

  const summaryText = sentences(summary.join(" "), 2);
  const usedInWho = !summaryText && points.length > 0;
  const whoParts = [role, summaryText || (usedInWho ? points[0] : "")].filter(Boolean);
  const resumePoints = (usedInWho ? points.slice(1) : points).slice(0, 4);

  return {
    who: clip(whoParts.join(" "), 500),
    why: clip(why.join(" "), 500),
    talk: clip(talk.join(" "), 500),
    points: resumePoints.map((line) => `- ${clip(line, 220)}`).join("\n"),
  };
}

function readTracyNote(body: string): { why: string; talk: string } {
  const text = stripQuotedMail(plainMail(body));
  const kept = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line && !line.startsWith(">"))
    .filter((line) => !BOILERPLATE.some((pattern) => pattern.test(line)))
    .filter((line) => !SCHEDULING.some((pattern) => pattern.test(line)))
    .filter((line) => !/@/.test(line))
    .filter((line) => !/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/.test(line))
    .filter((line) => !/^https?:/i.test(line))
    .filter((line) => line.length >= 30);
  const why: string[] = [];
  const talk: string[] = [];
  for (const sentence of sentences(kept.join(" "), 6).split(/(?<=[.!?])\s+/)) {
    const line = sentence.trim();
    if (line.length < 30) continue;
    if (BOILERPLATE.some((pattern) => pattern.test(line))) continue;
    if (SCHEDULING.some((pattern) => pattern.test(line))) continue;
    if (/\b(talk|discuss|compare|conversation|agenda)\b/i.test(line)) {
      if (talk.length < 2) talk.push(line);
    } else if (why.length < 2) {
      why.push(line);
    }
  }
  return { why: clip(why.join(" "), 500), talk: clip(talk.join(" "), 500) };
}

/** Drop quoted reply threads and Outlook/Gmail quote headers. */
function stripQuotedMail(body: string): string {
  const cutters = [
    /\n-{2,}\s*original message\s*-{2,}/i,
    /\nfrom:\s/i,
    /\non\s+\w{3},?\s+\w{3}\s+\d{1,2},?\s+\d{4}.{0,120}\bwrote:\s*/i,
    /\non\s+\d{4}-\d{2}-\d{2}.{0,120}\bwrote:\s*/i,
    /\non\s+\d{1,2}\/\d{1,2}\/\d{2,4}.{0,120}\bwrote:\s*/i,
  ];
  let text = body;
  for (const cutter of cutters) {
    const parts = text.split(cutter);
    if (parts.length > 1) text = parts[0] ?? text;
  }
  // Signature often glued as "Best Wishes, Tracy --- Tracy SantaMaria…"
  text = text.replace(/\n?best wishes[\s\S]*$/i, "\n");
  text = text.replace(/\n?-{2,}\s*tracy[\s\S]*$/i, "\n");
  return text;
}

function resumeLines(resumeText: string | null): string[] {
  return (resumeText ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/^[\s•·*\-–]+/, "").replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 12 && line.length <= 280)
    .filter((line) => !/@/.test(line))
    .filter((line) => !/linkedin\.com/i.test(line))
    .filter((line) => !/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/.test(line))
    .filter((line) => !/^page\s+\d+/i.test(line));
}

function headingKind(line: string): "summary" | "why" | "talk" | "stop" | null {
  const label = line.replace(/:$/, "").trim();
  if (label.length > 48) return null;
  const looksLikeHeading = label === label.toUpperCase() || /:$/.test(line);
  if (!looksLikeHeading) return null;
  if (/summary|profile|about|overview/i.test(label)) return "summary";
  if (/why|reason|fit|introduction/i.test(label)) return "why";
  if (/talk|discuss|agenda|topics/i.test(label)) return "talk";
  if (/education|skills|certification|activities|interests|references/i.test(label)) {
    return "stop";
  }
  if (/experience|employment|work history/i.test(label)) return "stop";
  return null;
}

function isRole(line: string): boolean {
  return /\b(19|20)\d{2}\b/.test(line) && line.length <= 140 && !/[.!?]$/.test(line);
}

function plainMail(body: string): string {
  return body
    .replace(/\r/g, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function sentences(value: string, max: number): string {
  const parts = value
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.slice(0, max).join(" ");
}

function clip(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}…`;
}
