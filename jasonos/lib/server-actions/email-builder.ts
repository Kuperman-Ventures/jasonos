"use server";

// Email Builder — turn the answer set into a first-draft email in Jason's
// voice. Prefers Claude via the AI gateway; falls back to a locally assembled
// draft so the feature still works when the gateway isn't configured.

import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { JASON_CORE_VOICE } from "@/lib/ai/jason-identity";
import {
  firstNameFromFullName,
  stripEmDashes,
} from "@/lib/email-templates/render";
import {
  describeAnswers,
  GOAL_OPTIONS,
  LAST_SPOKE_OPTIONS,
  goalGuidanceForPrompt,
  type BuilderAnswers,
} from "@/lib/email-builder/model";

export interface BuilderRecipient {
  name: string;
  firm: string | null;
  title: string | null;
  email: string | null;
}

export interface BuilderDraft {
  subject: string;
  body: string;
}

export type GenerateBuilderResult =
  | { ok: true; draft: BuilderDraft; source: "ai" | "fallback" }
  | { ok: false; error: string; draft: BuilderDraft; source: "fallback" };

function hasGoal(answers: BuilderAnswers, key: string): boolean {
  return answers.goals.includes(key);
}

function primaryGoal(a: BuilderAnswers): string | null {
  // Prefer stance goals over ask add-ons when picking opener/subject.
  const stance = [
    "cold",
    "followup",
    "thanks",
    "congrats",
    "pitch",
    "catchup",
    "reconnect",
  ];
  for (const key of stance) {
    if (hasGoal(a, key)) return key;
  }
  return a.goals[0] ?? null;
}

function fallbackSubject(recipient: BuilderRecipient, a: BuilderAnswers): string {
  const firm = recipient.firm || "your team";
  switch (primaryGoal(a)) {
    case "cold":
      return "Quick note";
    case "followup":
      return "Following up";
    case "thanks":
      return "Thank you";
    case "congrats":
      return "Congrats";
    case "pitch":
      return `An idea for ${firm}`;
    case "catchup":
      return "Quick check-in";
    case "advice":
      return "Quick ask";
    case "intro":
      return "An intro ask";
    case "job":
    case "referral":
      return "A quick ask";
    case "meeting":
      return "Worth 20 minutes?";
    case "reconnect":
      return "Long overdue";
    default:
      return a.lastSpoke === "never" ? "A quick note" : "Quick note";
  }
}

function fallbackAsk(a: BuilderAnswers): string {
  if (a.ask.trim()) return a.ask.trim();
  if (hasGoal(a, "meeting")) {
    return "If you've got 20-30 minutes in the next few weeks, I'd take it. Happy to work around your schedule.";
  }
  if (hasGoal(a, "advice")) {
    return "I'd value your read on a couple of things. Open to a short call?";
  }
  if (hasGoal(a, "intro")) {
    return "If anyone in your orbit comes to mind, an intro would mean a lot.";
  }
  if (hasGoal(a, "job") || hasGoal(a, "referral")) {
    return "I'm exploring CMO/CGO seats at growth-stage B2B. If you hear of anything, keep me in mind.";
  }
  if (hasGoal(a, "pitch")) {
    return "Happy to send a one-pager or hop on a short call if useful.";
  }
  if (hasGoal(a, "catchup")) {
    return "Would be good to catch up when you have a window.";
  }
  if (hasGoal(a, "reconnect")) {
    return "No agenda beyond reconnecting. Would genuinely enjoy hearing what you're up to.";
  }
  return "";
}

function fallbackBody(recipient: BuilderRecipient, a: BuilderAnswers): string {
  const first = firstNameFromFullName(recipient.name) || "there";
  const goal = primaryGoal(a);
  const detail = a.detail.trim();
  const context = a.relationship.trim();
  const ask = fallbackAsk(a);

  let opener = "Wanted to send a quick note.";
  if (goal === "cold" || a.lastSpoke === "never") {
    opener = "We haven't met - I'll keep this short.";
  } else if (goal === "followup") {
    opener = "Quick follow-up from our conversation.";
  } else if (goal === "thanks") {
    opener = detail
      ? `Thank you for ${detail.replace(/\.$/, "")}.`
      : "Thank you - genuinely appreciated.";
  } else if (goal === "congrats") {
    opener = detail
      ? `Congrats on ${detail.replace(/\.$/, "")}.`
      : "Congrats - well earned.";
  } else if (goal === "catchup") {
    opener = "Wanted to check in.";
  } else if (goal === "pitch") {
    opener = detail
      ? `I have an idea that may be useful: ${detail}`
      : "I have a GTM idea that may be useful for your team.";
  } else if (goal === "reconnect") {
    opener =
      a.remember <= 2
        ? "This is a name from a while back. Hope it's a welcome one."
        : "It's been too long. You've been on my mind lately.";
  }

  const parts: string[] = [`Hi ${first},`, "", opener];

  if (goal !== "thanks" && goal !== "congrats") {
    if (context) {
      parts.push("", context);
    } else if (goal === "reconnect" && a.closeness <= 3) {
      parts.push(
        "",
        "We crossed paths earlier in my career and I lost track of too many people I liked working with."
      );
    }

    if (
      goal === "reconnect" &&
      a.length !== "short" &&
      a.remember <= 3 &&
      a.closeness <= 3
    ) {
      parts.push(
        "",
        "Quick version: I spent eight years at OUTFRONT running marketing and product experience through their digital transformation, left last fall, and now do fractional CMO work while figuring out what's next."
      );
    }

    if (detail && goal !== "pitch" && goal !== "thanks" && goal !== "congrats") {
      parts.push("", detail);
    }
  } else if (detail && goal === "thanks") {
    // already folded into opener when present
  } else if (detail && goal === "congrats") {
    // already folded into opener when present
  }

  if (ask && goal !== "thanks" && goal !== "congrats") {
    parts.push("", ask);
  } else if (ask && (hasGoal(a, "meeting") || hasGoal(a, "referral"))) {
    parts.push("", ask);
  }

  parts.push("", "- Jason");

  return stripEmDashes(
    parts
      .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function buildFallback(
  recipient: BuilderRecipient,
  answers: BuilderAnswers
): BuilderDraft {
  return {
    subject: stripEmDashes(fallbackSubject(recipient, answers)),
    body: fallbackBody(recipient, answers),
  };
}

function safeParseDraft(text: string): BuilderDraft | null {
  // Model is asked for strict JSON; tolerate code fences / stray prose.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as {
      subject?: unknown;
      body?: unknown;
    };
    const subject = typeof parsed.subject === "string" ? parsed.subject : "";
    const body = typeof parsed.body === "string" ? parsed.body : "";
    if (!body.trim()) return null;
    return { subject: subject.trim(), body: body.trim() };
  } catch {
    return null;
  }
}

export async function generateBuilderEmail(input: {
  recipient: BuilderRecipient;
  answers: BuilderAnswers;
}): Promise<GenerateBuilderResult> {
  const { recipient, answers } = input;
  const fallback = buildFallback(recipient, answers);

  const lengthGuide =
    answers.length === "short"
      ? "3-4 sentences, one short paragraph."
      : answers.length === "detailed"
        ? "3 or more short paragraphs."
        : "2 short paragraphs.";

  const recipientLine = [
    recipient.name,
    recipient.title ? recipient.title : null,
    recipient.firm ? `at ${recipient.firm}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const lastSpoke =
    LAST_SPOKE_OPTIONS.find((o) => o.key === answers.lastSpoke)?.label ??
    answers.lastSpoke;

  const goalLabels = answers.goals
    .map((g) => GOAL_OPTIONS.find((o) => o.key === g)?.label ?? g)
    .join(", ");

  const system = `${JASON_CORE_VOICE}

You are drafting a single outbound email FROM Jason. Return STRICT JSON only:
{"subject": "...", "body": "..."}

Rules:
- Sound like Jason wrote it. Use his direct, anti-fluff voice.
- Greet by first name. Sign off "- Jason".
- No "I hope this finds you well", "circling back", "just wanted to", "touching base". No exclamation points. No em dashes.
- HONOR THE SELECTED GOALS STRICTLY. The email's purpose is exactly those goals. Do not default to a warm-reconnect / "it's been too long" email unless "Warm reconnect" is selected.
- Warm reconnect ≠ Catch-up. Catch-up is a current check-in with someone Jason spoke to more recently. Reconnect is for a long gap. Never use reconnect framing for catch-up, follow-up, thanks, congrats, cold, or pitch unless reconnect is also selected.
- Cover the free-text "points this email must touch on" and concrete ask when provided. Prefer those over generic career bio.
- Only include a Jason reintro / bio when Warm reconnect or Cold first touch needs it (low recall / never met). Skip bio dumps for catch-up, follow-up, thanks, and congrats.
- Calibrate warmth and familiarity to the inputs.
- Length: ${lengthGuide}
- When "Book a meeting" is selected, close with a specific low-friction ask (20-30 minutes, next couple of weeks). If it is NOT selected, do not invent a meeting ask.
- Do not invent facts, shared history, or numbers that aren't given.

Goal-specific instructions:
${goalGuidanceForPrompt(answers.goals)}`;

  const prompt = `Recipient: ${recipientLine || recipient.name}
Last contact: ${lastSpoke}
Selected goals: ${goalLabels || "(none)"}

Inputs for the draft:
${describeAnswers(answers)}

Write the email now as JSON. Match the selected goals. Do not write a reconnect email unless Warm reconnect is one of the goals.`;

  try {
    const { text } = await generateText({
      model: gateway("anthropic/claude-sonnet-4-6"),
      maxOutputTokens: 900,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const parsed = safeParseDraft(text);
    if (!parsed) {
      return { ok: true, draft: fallback, source: "fallback" };
    }
    return {
      ok: true,
      draft: {
        subject: stripEmDashes(parsed.subject) || fallback.subject,
        body: stripEmDashes(parsed.body),
      },
      source: "ai",
    };
  } catch (err) {
    console.error("[email-builder.generateBuilderEmail]", err);
    return {
      ok: false,
      error:
        "Couldn't reach the drafting model - here's a starter draft you can edit.",
      draft: fallback,
      source: "fallback",
    };
  }
}
