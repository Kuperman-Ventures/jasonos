/** Browning ask rules (The Ask and Why): who questions, not if questions; say what and by when. */

export const ASK_NOTE_IF = "Starts with 'if'; ask with 'who' instead.";
export const ASK_NOTE_WHO = "No 'who' or 'which' in the ask.";
export const ASK_NOTE_WHAT_WHEN = "Say what you want and by when.";

export interface AskCheck {
  ok: boolean;
  notes: string[];
}

const LEAD_FILLER = /^(?:(?:so|and|then|now|well|okay|ok|honestly|also)\b[\s,]*)+/;
const WHO_START = /^(?:who|whom|whose|which)\b/;
const TELL_ME_WHO = /^(?:tell me|let me know|i'd love to know|i'd like to know)\s+(?:who|which)\b/;
const PUZZLE =
  /\b(?:how well do you know|what do you know about|how do you know|tell me about (?:them|him|her|that person|\[name\]))\b/;
const OBJECT =
  /\b(?:intro|introductions?|introduce|connect(?:ion)?|names?|call|conversation|meeting|meet|coffee|invite|referral|radar|in touch|email|note)\b/;
const ACTION =
  /\b(?:introduce|intro|introduction|connect|call|meet|meeting|send|email|set up|invite|forward|pass)\b/;
const DAYS = "monday|tuesday|wednesday|thursday|friday|saturday|sunday";
const UNIT = "(?:days?|weeks?|months?)";
const TIME = new RegExp(
  [
    `\\b(?:today|tonight|tomorrow|right now|this (?:week|month|quarter|afternoon|morning|${DAYS}))\\b`,
    `\\bnext (?:week|month|quarter|${DAYS})\\b`,
    `\\bby (?:the end|end of|${DAYS}|\\[date\\]|\\[day\\]|[a-z]+ \\d{1,2})`,
    `\\bin (?:a|one|two|three|four|a few|a couple of|\\d+) ${UNIT}\\b`,
    `\\b${UNIT} from (?:today|now)\\b`,
    `\\b(?:${DAYS})\\b`,
    "\\[(?:date|day|time)\\]",
    "\\bbefore (?:we|the|you|i|\\[)",
  ].join("|")
);

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** The sentence that carries the request: the last question, else the last sentence. */
export function requestSentence(text: string): string {
  const parts = sentences(text);
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (parts[index].endsWith("?")) return parts[index];
  }
  return parts[parts.length - 1] ?? "";
}

function clauses(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .split(/[,;:]|\s+-\s+|\s+—\s+/)
    .map((part) => part.trim().replace(LEAD_FILLER, "").trim())
    .filter(Boolean);
}

function isWhoQuestion(request: string): boolean {
  return clauses(request).some((clause) => WHO_START.test(clause) || TELL_ME_WHO.test(clause));
}

/** Rule notes for an ask. Empty text has nothing to check and is not ok. */
export function checkAsk(text: string | null | undefined): AskCheck {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return { ok: false, notes: [] };
  const lower = clean.toLowerCase();
  const request = requestSentence(clean);
  const requestLower = request.toLowerCase().replace(LEAD_FILLER, "");

  const notes: string[] = [];
  const startsWithIf = /^if\b/.test(requestLower) || /^if\b/.test(lower);
  const who = isWhoQuestion(request);
  const puzzle = PUZZLE.test(lower);

  if (startsWithIf) notes.push(ASK_NOTE_IF);
  else if (!who && !puzzle) notes.push(ASK_NOTE_WHO);

  const hasObject = who || puzzle || OBJECT.test(lower);
  const wantsAction = ACTION.test(requestLower);
  const hasTime = TIME.test(lower);
  if (!hasObject || (wantsAction && !hasTime)) notes.push(ASK_NOTE_WHAT_WHEN);

  return { ok: notes.length === 0, notes };
}
