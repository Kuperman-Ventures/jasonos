// Email Builder — shared question/answer model. Pure (no server-only imports)
// so the client can render the questions and preview a description, and the
// server action can turn the same answers into a Claude prompt.

export type Length = "short" | "medium" | "detailed";

export interface BuilderAnswers {
  /** 1 = strangers, 5 = very close. */
  closeness: number;
  /** 1 = won't remember me, 5 = knows me instantly. */
  remember: number;
  /** 1 = warm & personal, 5 = crisp & professional. */
  tone: number;
  /** How long since we last spoke — key from LAST_SPOKE_OPTIONS. */
  lastSpoke: string;
  /** Desired draft length. */
  length: Length;
  /** What I'm hoping to get — keys from GOAL_OPTIONS (multi-select). */
  goals: string[];
  /** How I know them / relationship context. */
  relationship: string;
  /** A specific memory, detail, or recent news to reference. */
  detail: string;
  /** A concrete ask, if there is one. */
  ask: string;
}

export const DEFAULT_ANSWERS: BuilderAnswers = {
  closeness: 3,
  remember: 3,
  tone: 3,
  lastSpoke: "years",
  length: "medium",
  // Jason's default objective is almost always to land a short meeting.
  goals: ["meeting"],
  relationship: "",
  detail: "",
  ask: "",
};

export const LAST_SPOKE_OPTIONS: { key: string; label: string }[] = [
  { key: "never", label: "Never met / cold" },
  { key: "years", label: "Years ago" },
  { key: "months", label: "A few months ago" },
  { key: "weeks", label: "A few weeks ago" },
  { key: "recent", label: "Recently" },
];

export const GOAL_OPTIONS: { key: string; label: string }[] = [
  { key: "reconnect", label: "Just reconnect" },
  { key: "catchup", label: "Catch up / coffee" },
  { key: "advice", label: "Ask for advice" },
  { key: "intro", label: "Ask for an intro" },
  { key: "job", label: "Job lead / referral" },
  { key: "sprint", label: "Pitch Refactor Sprint" },
  { key: "meeting", label: "Book a meeting" },
  { key: "collab", label: "Explore working together" },
];

export const LENGTH_OPTIONS: { key: Length; label: string }[] = [
  { key: "short", label: "Short (3-4 sentences)" },
  { key: "medium", label: "Medium (2 short paragraphs)" },
  { key: "detailed", label: "Detailed (3+ paragraphs)" },
];

// Slider end labels (index 0 = value 1, index 1 = value 5).
export const CLOSENESS_ENDS: [string, string] = ["We're strangers", "Very close"];
export const REMEMBER_ENDS: [string, string] = [
  "Won't remember me",
  "Knows me instantly",
];
export const TONE_ENDS: [string, string] = [
  "Warm & personal",
  "Crisp & professional",
];

export const SLIDER_MIN = 1;
export const SLIDER_MAX = 5;

function scaleWord(
  n: number,
  low: string,
  mid: string,
  high: string
): string {
  if (n <= 2) return low;
  if (n === 3) return mid;
  return high;
}

function labelFor(
  key: string,
  options: { key: string; label: string }[]
): string {
  return options.find((o) => o.key === key)?.label ?? key;
}

/**
 * Turn the answers into a plain-English brief for the drafting prompt (and a
 * live preview of what the model is being told).
 */
export function describeAnswers(a: BuilderAnswers): string {
  const goals = a.goals.length
    ? a.goals.map((g) => labelFor(g, GOAL_OPTIONS)).join(", ")
    : "just reconnect, no hard ask";

  const lines = [
    `Relationship closeness: ${a.closeness}/5 (${scaleWord(
      a.closeness,
      "barely know each other",
      "acquaintances / former colleagues",
      "close, trusted relationship"
    )}).`,
    `Last contact: ${labelFor(a.lastSpoke, LAST_SPOKE_OPTIONS)}.`,
    `Will they remember me: ${a.remember}/5 (${scaleWord(
      a.remember,
      "likely need reintroduction",
      "probably remember with a nudge",
      "will remember me instantly"
    )}).`,
    `What I want from this email: ${goals}.`,
    `Tone: ${scaleWord(
      a.tone,
      "warm and personal",
      "friendly but professional",
      "crisp and businesslike"
    )} (${a.tone}/5).`,
    `Length: ${labelFor(a.length, LENGTH_OPTIONS)}.`,
  ];

  if (a.relationship.trim())
    lines.push(`How I know them: ${a.relationship.trim()}.`);
  if (a.detail.trim())
    lines.push(`Specific detail to reference: ${a.detail.trim()}.`);
  if (a.ask.trim()) lines.push(`Concrete ask: ${a.ask.trim()}.`);

  return lines.map((l) => `- ${l}`).join("\n");
}
