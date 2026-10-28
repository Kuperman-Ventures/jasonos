import { extractJsonValue } from "@/lib/live/decks-helpers";

export type NumberedTranscriptLine = {
  n: number;
  raw: string;
  speaker: string | null;
  text: string;
};

export type MentionsHit = {
  term: string;
  lines: number[];
};

export type MentionsIndexEntry = {
  label: string;
  found: MentionsHit[];
  notFound: string[];
};

export type Pass1Layout = {
  speakers: Record<string, string>;
  jason_speaker: string | null;
  segments: Array<{
    from_line: number;
    to_line: number;
    topic: string;
    who_led: string;
  }>;
  talk_share: { jason_chars: number; others_chars: number; jason_pct: number };
};

const SPEAKER_LINE_RE = /^(Speaker\s+\d+|[^:]{1,40}):\s*(.*)$/i;

export function numberTranscriptLines(transcript: string): NumberedTranscriptLine[] {
  const lines = transcript.replace(/\r\n/g, "\n").split("\n");
  return lines.map((raw, index) => {
    const match = raw.match(SPEAKER_LINE_RE);
    if (match) {
      return {
        n: index + 1,
        raw,
        speaker: match[1]!.trim(),
        text: match[2] ?? "",
      };
    }
    return { n: index + 1, raw, speaker: null, text: raw };
  });
}

export function formatNumberedTranscript(lines: NumberedTranscriptLine[]): string {
  return lines
    .map((line) => `${String(line.n).padStart(4, "0")} ${line.raw}`)
    .join("\n");
}

export function computeTalkShare(
  lines: NumberedTranscriptLine[],
  jasonSpeaker: string | null
): Pass1Layout["talk_share"] {
  let jason = 0;
  let others = 0;
  const target = jasonSpeaker?.trim().toLowerCase() || null;
  for (const line of lines) {
    const chars = line.text.replace(/\s+/g, " ").trim().length;
    if (!chars) continue;
    if (target && line.speaker?.trim().toLowerCase() === target) jason += chars;
    else if (line.speaker) others += chars;
  }
  const total = jason + others;
  return {
    jason_chars: jason,
    others_chars: others,
    jason_pct: total ? Math.round((jason / total) * 100) : 0,
  };
}

/** Extract distinctive terms for mentions search. */
export function extractMentionTerms(text: string): string[] {
  const terms = new Set<string>();
  const quoted = text.matchAll(/"([^"]{2,80})"/g);
  for (const match of quoted) {
    const value = match[1]!.trim();
    if (value) terms.add(value);
  }
  // Multi-word Capitalised phrases
  const phrases = text.matchAll(/\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)+)\b/g);
  for (const match of phrases) terms.add(match[1]!);
  // Single capitalised tokens / product-like names (skip tiny words)
  const singles = text.matchAll(/\b([A-Z][a-zA-Z0-9]{2,})\b/g);
  for (const match of singles) {
    const value = match[1]!;
    if (!["The", "And", "For", "With", "From", "This", "That", "Jason"].includes(value)) {
      terms.add(value);
    }
  }
  // Numbers with units
  const units = text.matchAll(/\b(\d+(?:\.\d+)?\s?(?:%|k|m|minutes?|hours?|days?|weeks?|months?|\$))\b/gi);
  for (const match of units) terms.add(match[1]!);
  return [...terms].slice(0, 24);
}

function fuzzyIncludes(haystack: string, needle: string): boolean {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (h.includes(n)) return true;
  if (n.length < 5) return false;
  // Names of 5+ letters: allow small typos (Ronnie ↔ Ronny).
  const maxLen = n.length + 2;
  for (let i = 0; i < h.length; i += 1) {
    for (let len = Math.max(4, n.length - 2); len <= maxLen; len += 1) {
      const window = h.slice(i, i + len);
      if (window.length < 4) continue;
      if (levenshtein(window, n) <= 2) return true;
    }
  }
  return false;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  return prev[b.length];
}

export function findTermLines(
  lines: NumberedTranscriptLine[],
  term: string
): number[] {
  const hits: number[] = [];
  for (const line of lines) {
    if (fuzzyIncludes(line.raw, term)) hits.push(line.n);
  }
  return hits;
}

export function buildMentionsIndex(
  lines: NumberedTranscriptLine[],
  items: Array<{ label: string; text: string }>
): MentionsIndexEntry[] {
  return items.map((item) => {
    const terms = extractMentionTerms(item.text);
    const found: MentionsHit[] = [];
    const notFound: string[] = [];
    for (const term of terms) {
      const hitLines = findTermLines(lines, term);
      if (hitLines.length) found.push({ term, lines: hitLines.slice(0, 12) });
      else notFound.push(term);
    }
    return { label: item.label, found, notFound };
  });
}

export function formatMentionsIndex(entries: MentionsIndexEntry[]): string {
  return entries
    .map((entry) => {
      const found =
        entry.found.length === 0
          ? "none"
          : entry.found
              .map((hit) => `"${hit.term}" at lines ${hit.lines.join(", ")}`)
              .join("; ");
      const missing = entry.notFound.length
        ? ` Not found: ${entry.notFound.map((t) => `"${t}"`).join(", ")}.`
        : "";
      return `${entry.label} terms found: ${found}.${missing}`;
    })
    .join("\n");
}

/** Deterministic correction: "Speaker N: Hi, Ian" means Speaker N is greeting Ian. */
export function inferSpeakersFromGreetings(
  lines: NumberedTranscriptLine[]
): Record<string, string> {
  const inferred: Record<string, string> = {};
  const greetingRe = /^(?:hi|hello|hey|nice to meet you)[,.]?\s+([A-Z][a-zA-Z'-]+)/i;
  for (const line of lines.slice(0, 20)) {
    if (!line.speaker) continue;
    const match = line.text.trim().match(greetingRe);
    if (!match) continue;
    const greeted = match[1]!;
    // This speaker greeted someone else — record the other person's name against other speakers later.
    inferred[`greeted_by:${line.speaker}`] = greeted;
  }
  // If Speaker 1 greets Ian, Speaker 1 is not Ian; prefer Jason for the greeter when name is Jason/Ian pattern.
  const speakers: Record<string, string> = {};
  for (const line of lines.slice(0, 20)) {
    if (!line.speaker) continue;
    const match = line.text.trim().match(greetingRe);
    if (!match) continue;
    const greeted = match[1]!;
    if (/jason|kupe/i.test(greeted)) {
      // They greeted Jason → this speaker is the other party.
      speakers[line.speaker] = speakers[line.speaker] || "unknown";
    } else {
      // They greeted someone else → this speaker is likely Jason when greeting Ian/etc.
      if (/ian|alex|mike|sam|chris|dave|tom|nick|matt|john/i.test(greeted) || greeted.length >= 2) {
        speakers[line.speaker] = "Jason Kuperman";
      }
    }
  }
  // Fill greeted names onto the other speaker label when only two speakers.
  const labels = [...new Set(lines.map((line) => line.speaker).filter(Boolean))] as string[];
  if (labels.length === 2) {
    const [a, b] = labels;
    const greetA = inferred[`greeted_by:${a}`];
    const greetB = inferred[`greeted_by:${b}`];
    if (greetA && !speakers[b!]) speakers[b!] = greetA;
    if (greetB && !speakers[a!]) speakers[a!] = greetB;
    if (speakers[a!] === "Jason Kuperman" && greetA && !speakers[b!]) {
      speakers[b!] = greetA;
    }
    if (speakers[b!] === "Jason Kuperman" && greetB && !speakers[a!]) {
      speakers[a!] = greetB;
    }
  }
  return speakers;
}

export function parsePass1Layout(
  raw: string,
  lines: NumberedTranscriptLine[]
): Pass1Layout | null {
  const value = extractJsonValue(raw);
  if (!value || typeof value !== "object") return null;
  const root = value as Record<string, unknown>;
  const speakersRaw = root.speakers;
  const speakers: Record<string, string> = {};
  if (speakersRaw && typeof speakersRaw === "object" && !Array.isArray(speakersRaw)) {
    for (const [key, name] of Object.entries(speakersRaw as Record<string, unknown>)) {
      if (typeof name === "string" && name.trim()) speakers[key] = name.trim();
    }
  }
  // Prefer greeting-based corrections when the model inverts speakers.
  const inferred = inferSpeakersFromGreetings(lines);
  for (const [label, name] of Object.entries(inferred)) {
    if (speakers[label] && /jason/i.test(speakers[label]) && !/jason/i.test(name)) {
      // Model said this label is Jason but greetings say otherwise — trust greetings.
      speakers[label] = name;
    } else if (!speakers[label]) {
      speakers[label] = name;
    } else if (/jason/i.test(name)) {
      speakers[label] = name;
    } else if (speakers[label] === "unknown" || /ian|unknown/i.test(speakers[label])) {
      // If greetings identify Jason on this label, overwrite a wrong Ian assignment.
      if (/jason/i.test(name)) speakers[label] = name;
      else if (!/jason/i.test(speakers[label])) speakers[label] = name;
    }
  }
  // If greetings say Speaker 1 is Jason, force it.
  if (inferred["Speaker 1"] === "Jason Kuperman") {
    speakers["Speaker 1"] = "Jason Kuperman";
    if (inferred["Speaker 2"]) speakers["Speaker 2"] = inferred["Speaker 2"];
  }
  if (inferred["Speaker 2"] === "Jason Kuperman") {
    speakers["Speaker 2"] = "Jason Kuperman";
    if (inferred["Speaker 1"]) speakers["Speaker 1"] = inferred["Speaker 1"];
  }

  let jasonSpeaker =
    typeof root.jason_speaker === "string" && root.jason_speaker.trim()
      ? root.jason_speaker.trim()
      : null;
  for (const [label, name] of Object.entries(speakers)) {
    if (/jason|kupe/i.test(name)) {
      jasonSpeaker = label;
      break;
    }
  }
  if (jasonSpeaker && speakers[jasonSpeaker] === undefined) {
    const hit = Object.keys(speakers).find(
      (key) => key.toLowerCase() === jasonSpeaker!.toLowerCase()
    );
    jasonSpeaker = hit ?? jasonSpeaker;
  }

  const segments: Pass1Layout["segments"] = [];
  if (Array.isArray(root.segments)) {
    for (const row of root.segments) {
      if (!row || typeof row !== "object") continue;
      const item = row as Record<string, unknown>;
      const from = Number(item.from_line);
      const to = Number(item.to_line);
      if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
      segments.push({
        from_line: Math.max(1, Math.floor(from)),
        to_line: Math.max(1, Math.floor(to)),
        topic: typeof item.topic === "string" ? item.topic.trim() : "",
        who_led: typeof item.who_led === "string" ? item.who_led.trim() : "",
      });
    }
  }

  return {
    speakers,
    jason_speaker: jasonSpeaker,
    segments,
    talk_share: computeTalkShare(lines, jasonSpeaker),
  };
}

export function normalizeQuote(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when quote appears in transcript allowing ~10% character difference. */
export function quoteInTranscript(quote: string, transcript: string): boolean {
  const q = normalizeQuote(quote);
  if (!q) return true;
  const t = normalizeQuote(transcript);
  if (t.includes(q)) return true;
  if (q.length < 12) return false;
  const window = Math.max(8, Math.floor(q.length * 0.9));
  // Sliding approximate: check whether a high-overlap substring exists.
  for (let i = 0; i <= t.length - window; i += Math.max(1, Math.floor(window / 4))) {
    const slice = t.slice(i, i + q.length + 2);
    let matches = 0;
    const limit = Math.min(q.length, slice.length);
    for (let j = 0; j < limit; j += 1) {
      if (q[j] === slice[j]) matches += 1;
    }
    if (matches / q.length >= 0.9) return true;
  }
  return false;
}

export function extractLineRefs(text: string): number[] {
  const refs = new Set<number>();
  const re = /\[L(\d+)(?:\s*[-–]\s*L?(\d+))?\]/gi;
  for (const match of text.matchAll(re)) {
    const a = Number(match[1]);
    const b = match[2] ? Number(match[2]) : a;
    if (!Number.isFinite(a)) continue;
    refs.add(a);
    if (Number.isFinite(b)) {
      const start = Math.min(a, b);
      const end = Math.max(a, b);
      for (let n = start; n <= end; n += 1) refs.add(n);
    }
  }
  return [...refs];
}

export function stripInvalidLineRefs(text: string, maxLine: number): string {
  return text.replace(/\[L(\d+)(?:\s*[-–]\s*L?(\d+))?\]/gi, (full, aRaw, bRaw) => {
    const a = Number(aRaw);
    const b = bRaw ? Number(bRaw) : a;
    if (!Number.isFinite(a) || a < 1 || a > maxLine) return "";
    if (Number.isFinite(b) && (b < 1 || b > maxLine)) return "";
    return full;
  }).replace(/\s{2,}/g, " ").trim();
}

export function expectedTranscriptChars(runStartedAt: string | null, runEndedAt: string | null): number | null {
  if (!runStartedAt || !runEndedAt) return null;
  const start = Date.parse(runStartedAt);
  const end = Date.parse(runEndedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const minutes = (end - start) / 60_000;
  return Math.round(minutes * 900);
}

export function coverageMinutes(
  transcriptChars: number,
  runStartedAt: string | null,
  runEndedAt: string | null
): { coveredMinutes: number; recordedMinutes: number; ratio: number } | null {
  if (!runStartedAt || !runEndedAt) return null;
  const start = Date.parse(runStartedAt);
  const end = Date.parse(runEndedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const recordedMinutes = Math.max(1, Math.round((end - start) / 60_000));
  const coveredMinutes = Math.max(1, Math.round(transcriptChars / 900));
  return {
    coveredMinutes: Math.min(coveredMinutes, recordedMinutes),
    recordedMinutes,
    ratio: transcriptChars / (recordedMinutes * 900),
  };
}
