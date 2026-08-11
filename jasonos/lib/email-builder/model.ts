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
  lastSpoke: "months",
  length: "medium",
  // No default goal — drafts used to always sound like reconnects because
  // the prompt assumed "book a meeting" / reconnect stance.
  goals: [],
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

/**
 * Multi-select goals. Warm reconnect ≠ catch-up: reconnect is a long gap;
 * catch-up is a current check-in with someone you spoke to more recently.
 */
export const GOAL_OPTIONS: { key: string; label: string; hint?: string }[] = [
  {
    key: "reconnect",
    label: "Warm reconnect",
    hint: "Long gap — reopen the relationship",
  },
  {
    key: "catchup",
    label: "Catch-up / check-in",
    hint: "Spoke more recently; stay current, not 'long overdue'",
  },
  {
    key: "cold",
    label: "Cold first touch",
    hint: "Haven't met; lead with why you're writing",
  },
  { key: "followup", label: "Follow-up after a meeting" },
  { key: "thanks", label: "Thank you" },
  { key: "congrats", label: "Congrats" },
  { key: "advice", label: "Ask for advice" },
  { key: "intro", label: "Ask for an intro" },
  { key: "job", label: "Job lead / referral" },
  { key: "referral", label: "Referral ask" },
  { key: "pitch", label: "Pitch" },
  { key: "meeting", label: "Book a meeting" },
];

/** Drafting rules the model must follow for each selected goal. */
export const GOAL_GUIDANCE: Record<string, string> = {
  reconnect:
    "WARM RECONNECT after a long gap. Briefly acknowledge time passed. Do not invent shared history. Purpose is reopening the relationship; only add a hard ask if another selected goal needs one. Avoid fake familiarity.",
  catchup:
    "CATCH-UP / CHECK-IN with someone you are already in touch with (weeks/months, not a long-lost reconnect). Do NOT use reconnect language: no 'it's been too long', 'long overdue', 'voice from the past', or career-reintro bio dumps. Write a straightforward current note about the topics Jason listed.",
  cold:
    "COLD FIRST TOUCH. You have not met. Do not fake a relationship. Lead with why Jason is writing. Brief who-Jason-is only if needed. No reconnect framing.",
  followup:
    "FOLLOW-UP after a meeting. Reference the meeting / next step from the inputs. Do not write a reconnect email. Be specific and forward-looking.",
  thanks:
    "THANK-YOU note. Lead with gratitude for the specific thing in the inputs. Keep it short. Do not tack on a reconnect pitch unless another goal requires an ask.",
  congrats:
    "CONGRATS note. Lead with the specific win. Keep it short and genuine. No reconnect framing unless another goal requires it.",
  advice:
    "ASK FOR ADVICE. State what Jason wants a read on. Keep the ask clear and low-friction.",
  intro:
    "ASK FOR AN INTRO. Be clear who/what kind of intro, without being pushy.",
  job: "JOB LEAD / REFERRAL ask. State what Jason is exploring. Keep it concrete and easy to act on.",
  referral:
    "REFERRAL ASK. Be specific about the referral wanted. Separate from a vague reconnect.",
  pitch:
    "PITCH. Lead with the offer / idea from the inputs (e.g. Refactor Sprint, advisory, collab). Do not bury it under reconnect throat-clearing.",
  meeting:
    "BOOK A MEETING. Close with a specific low-friction ask: 20–30 minutes in the next couple of weeks, work around their schedule. Only include this close if Book a meeting is selected.",
};

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

export interface FieldCopy {
  show: boolean;
  label: string;
  placeholder: string;
}

export interface GoalAwareFields {
  showRemember: boolean;
  showLastSpoke: boolean;
  showCloseness: boolean;
  relationship: FieldCopy;
  detail: FieldCopy;
  ask: FieldCopy;
  heading: string;
  subheading: string;
}

function hasAny(goals: string[], keys: string[]): boolean {
  return keys.some((k) => goals.includes(k));
}

/**
 * Shape the question form from selected goals so cold / follow-up / thanks
 * don't all look like a reconnect questionnaire.
 */
export function fieldsForGoals(goals: string[]): GoalAwareFields {
  const reconnect = goals.includes("reconnect");
  const catchup = goals.includes("catchup");
  const cold = goals.includes("cold");
  const followup = goals.includes("followup");
  const thanks = goals.includes("thanks");
  const congrats = goals.includes("congrats");
  const pitch = goals.includes("pitch");
  const askGoals = hasAny(goals, [
    "advice",
    "intro",
    "job",
    "referral",
    "meeting",
  ]);
  const socialOnly =
    goals.length > 0 &&
    goals.every((g) => g === "thanks" || g === "congrats");

  let heading = "Shape the email";
  let subheading =
    "Pick what this email is for, then fill in only what matters. The draft should match your selections — not a generic reconnect.";

  if (cold) {
    heading = "Cold first touch";
    subheading = "Lead with why you're writing. No fake history.";
  } else if (reconnect && !catchup) {
    heading = "Warm reconnect";
    subheading =
      "Long gap. Reopen the relationship; only add a hard ask if you selected one.";
  } else if (catchup && !reconnect) {
    heading = "Catch-up / check-in";
    subheading =
      "You spoke more recently. Write a current note — not a 'long overdue' reconnect.";
  } else if (followup) {
    heading = "Meeting follow-up";
    subheading = "Reference what you discussed and the next step.";
  } else if (socialOnly) {
    heading = "Short note";
    subheading = "Say the thank-you or congrats clearly. Keep it tight.";
  } else if (pitch) {
    heading = "Pitch";
    subheading = "Lead with the offer. Don't bury it under reconnect filler.";
  }

  const relationship: FieldCopy = cold
    ? {
        show: true,
        label: "How did you find them / any thin connection?",
        placeholder:
          "Saw their talk at AdWeek; mutual with Sarah Chen; read their RMN post.",
      }
    : reconnect
      ? {
          show: true,
          label: "How do you know them?",
          placeholder:
            "Former colleague at Omnicom; we ran the APAC pitch together.",
        }
      : followup
        ? {
            show: true,
            label: "Meeting / context",
            placeholder:
              "Coffee last Tuesday about their Q3 media mix; they asked for a one-pager.",
          }
        : socialOnly
          ? {
              show: false,
              label: "",
              placeholder: "",
            }
          : {
              show: true,
              label: "How do you know them?",
              placeholder:
                "Former colleague; client from OUTFRONT days; met at a dinner.",
            };

  let detailLabel = "What should this email touch on?";
  let detailPlaceholder =
    "The points you want covered — news, a memory, a topic, an offer.";
  if (cold) {
    detailLabel = "Hook / why you're writing";
    detailPlaceholder =
      "Their Series B; a problem Jason solves; a specific reason this isn't spam.";
  } else if (reconnect) {
    detailLabel = "Shared history or memory to reference";
    detailPlaceholder =
      "2014 offsite; worked the Chrysler pitch; last saw them at Cannes.";
  } else if (catchup) {
    detailLabel = "What to catch up on";
    detailPlaceholder =
      "How their new role is going; Jason's sprint with X; that podcast they mentioned.";
  } else if (followup) {
    detailLabel = "What to follow up on";
    detailPlaceholder =
      "Sending the one-pager we discussed; confirming Thursday 2pm; intro to their CFO.";
  } else if (thanks) {
    detailLabel = "What you're thanking them for";
    detailPlaceholder = "The intro to Priya; taking the call yesterday.";
  } else if (congrats) {
    detailLabel = "What you're congratulating them on";
    detailPlaceholder = "The CMO seat; the funding round; the keynote.";
  } else if (pitch) {
    detailLabel = "What you're pitching";
    detailPlaceholder =
      "2-week Refactor Sprint on their retail media stack; fractional CMO for the launch.";
  }

  const detail: FieldCopy = {
    show: true,
    label: detailLabel,
    placeholder: detailPlaceholder,
  };

  const ask: FieldCopy =
    socialOnly && !askGoals
      ? {
          show: false,
          label: "",
          placeholder: "",
        }
      : {
          show: true,
          label: askGoals || pitch || meetingSelected(goals)
            ? "Concrete ask"
            : "Concrete ask (optional)",
          placeholder: pitch
            ? "20 minutes next week to walk through the sprint scope."
            : "15 minutes next week to get your read on the RMN market.",
        };

  return {
    showRemember: !cold && !socialOnly,
    showLastSpoke: !socialOnly,
    showCloseness: !socialOnly,
    relationship,
    detail,
    ask,
    heading,
    subheading,
  };
}

function meetingSelected(goals: string[]): boolean {
  return goals.includes("meeting");
}

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

export function goalGuidanceForPrompt(goals: string[]): string {
  if (!goals.length) {
    return "No goals selected — write a short, plain email covering only the free-text inputs. Do not invent a reconnect framing.";
  }
  return goals
    .map((g) => {
      const label = labelFor(g, GOAL_OPTIONS);
      const guide = GOAL_GUIDANCE[g] ?? `Honor the goal "${label}".`;
      return `- ${label}: ${guide}`;
    })
    .join("\n");
}

/**
 * Turn the answers into a plain-English brief for the drafting prompt (and a
 * live preview of what the model is being told).
 */
export function describeAnswers(a: BuilderAnswers): string {
  const goals = a.goals.length
    ? a.goals.map((g) => labelFor(g, GOAL_OPTIONS)).join(", ")
    : "(none — cover only the free-text points below)";

  const lines = [
    `Selected goals (MUST drive the email; do not substitute a reconnect unless Warm reconnect is selected): ${goals}.`,
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
    `Tone: ${scaleWord(
      a.tone,
      "warm and personal",
      "friendly but professional",
      "crisp and businesslike"
    )} (${a.tone}/5).`,
    `Length: ${labelFor(a.length, LENGTH_OPTIONS)}.`,
  ];

  if (a.relationship.trim())
    lines.push(`How I know them / context: ${a.relationship.trim()}.`);
  if (a.detail.trim())
    lines.push(`Points this email must touch on: ${a.detail.trim()}.`);
  if (a.ask.trim()) lines.push(`Concrete ask: ${a.ask.trim()}.`);

  return lines.map((l) => `- ${l}`).join("\n");
}
